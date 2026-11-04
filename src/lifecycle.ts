import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';

const workspace=path.resolve('..');
process.env.OAN_WORKSPACE_ROOT=workspace;
process.env.OAN_BENCH_DB_BACKEND='sqlite';
process.env.OAN_BENCH_BUILD_PROFILE='release';
process.env.OAN_ADMIN_TOKEN='local-dev-admin-token';
const harness=path.join(workspace,'oan-official-skill/skills/oan-system-test-ops/fixtures/oan-ops-harness');
const flows:any=await import(pathToFileURL(path.join(harness,'.bench-dist/bench/example-flows.js')).href);
const shared:any=await import(pathToFileURL(path.join(harness,'.bench-dist/bench/shared.js')).href);
const output=path.resolve(process.argv[2]??'runs/corrected-lifecycle-ablation-20261028');
await mkdir(output,{recursive:true});
const rows:any[]=[];
const save=()=>writeFile(path.join(output,'lifecycle-http.json'),JSON.stringify({scope:'local-multiprocess-http',backend:'sqlite',rounds:3,identitiesPerRound:10,rows},null,2),'utf8');
async function query(s:any,did:string){
 return shared.postJson(`http://127.0.0.1:${s.runtime.discoveryPort}/discovery/resources/query`,{query:did,limit:5},{timeoutMs:10000});
}
async function until(check:()=>Promise<boolean>,timeout=60000){
 const end=Date.now()+timeout;
 while(Date.now()<end){if(await check())return;await flows.sleep(100);}
 throw Error('lifecycle checkpoint timed out');
}
try{
 for(let round=1;round<=3;round++){
  const s=flows.prepareSingleNodeScenario(`paper-lifecycle-${round}`);
  try{
   await flows.startSingleNodeScenario(s);
   const root=`http://127.0.0.1:${s.runtime.rootPort}`;
   const registrar=`http://127.0.0.1:${s.runtime.registrarPort}`;
   const resources:any[]=[];
   for(let index=0;index<10;index++){
    const r=flows.createAndPersistDemoService(s.environment.workDir,'http://127.0.0.1:9001',{draftId:`life-${round}-${index}`,source:'paper-lifecycle'});
    const start=performance.now();
    const registration=await shared.postJson(`${registrar}/resources/register`,r.registration,{timeoutMs:60000});
    await until(async()=>shared.listDiscoveryCandidates(await query(s,r.resourceDid)).includes(r.resourceDid));
    const response=await query(s,r.resourceDid);
    flows.assert(shared.listDiscoveryCandidates(response).includes(r.resourceDid),'exact DID absent');
    flows.assert(registration.registrationCredential,'registration credential absent');
    rows.push({round,index,checkpoint:'register-distribute-discover',did:r.resourceDid,passed:true,elapsedMs:performance.now()-start});
    resources.push(r);await save();
   }
   for(let index=0;index<10;index++){
    const r=resources[index];
    const update=shared.buildResourceRegistrationFixture(r.resourceIdentity,{draftId:`update-${round}-${index}`,registrarDid:s.identities.registrar.did,resourceType:'agent_service',packageVersion:'2.0.0',metadata:{authorizedDomains:shared.defaultAuthorizedDomains}});
    const start=performance.now();
    await shared.postJson(`${registrar}/resources/register`,update,{timeoutMs:60000});
    await until(async()=>JSON.stringify(await query(s,r.resourceDid)).includes('2.0.0'));
    const versions=await shared.getJson(`${root}/root/resources/${encodeURIComponent(r.resourceDid)}/versions`);
    flows.assert(JSON.stringify(versions).includes('1.0.0')&&JSON.stringify(versions).includes('2.0.0'),'version archive incomplete');
    rows.push({round,index,checkpoint:'update-v1-to-v2',did:r.resourceDid,passed:true,elapsedMs:performance.now()-start});await save();
   }
   const discoveryDid=encodeURIComponent(s.identities.discovery.did);
   for(const domains of [['finance'],shared.defaultAuthorizedDomains]){
    await shared.postJson(`${root}/root/discovery-nodes/${discoveryDid}/domains`,{authorizedDomains:domains},{admin:true});
    const state=await shared.getJson(`${root}/root/discovery-nodes/${discoveryDid}`);
    flows.assert(JSON.stringify(state.latestDomains.authorizedDomains)===JSON.stringify(domains),'Root domain transition absent');
    rows.push({round,checkpoint:domains[0]==='finance'?'root-grant-contraction':'root-grant-restoration',passed:true,state});await save();
   }
   await shared.postJson(`${root}/root/nodes/${encodeURIComponent(s.identities.registrar.did)}/revoke`,{reason:'isolated lifecycle experiment'},{admin:true});
   for(let index=0;index<10;index++){
    const r=flows.createAndPersistDemoService(s.environment.workDir,'http://127.0.0.1:9001',{draftId:`revoked-${round}-${index}`,source:'paper-lifecycle'});
    const response=await flows.postJsonAllowFailure(`${registrar}/resources/register`,r.registration,10000);
    flows.assert(response.status>=400,'revoked Registrar accepted new registration');
    rows.push({round,index,checkpoint:'revoked-registrar-new-registration',passed:true,httpStatus:response.status,response:response.body});await save();
   }
   const old=await query(s,resources[0].resourceDid);
   flows.assert(shared.listDiscoveryCandidates(old).includes(resources[0].resourceDid),'unexpected retroactive resource withdrawal');
   rows.push({round,checkpoint:'historical-resource-still-discoverable',passed:true});await save();
   console.log(`Lifecycle round ${round} completed`);
  }finally{await flows.stopSingleNodeScenario(s);}
 }
}catch(error){await save();throw error;}
