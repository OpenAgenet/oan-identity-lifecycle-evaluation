import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const workspace=path.resolve('..');
Object.assign(process.env,{OAN_WORKSPACE_ROOT:workspace,OAN_BENCH_DB_BACKEND:'postgres',OAN_BENCH_BUILD_PROFILE:'release',OAN_ADMIN_TOKEN:'local-dev-admin-token'});
process.env.OAN_BENCH_POSTGRES_PASSWORD??=JSON.parse(await readFile('.local/postgres.local.json','utf8')).password;
const harness=path.join(workspace,'oan-official-skill/skills/oan-system-test-ops/fixtures/oan-ops-harness');
const f:any=await import(pathToFileURL(path.join(harness,'.bench-dist/bench/example-flows.js')).href);
const h:any=await import(pathToFileURL(path.join(harness,'.bench-dist/bench/shared.js')).href);
const output=path.resolve('runs',`query-specialist-${Date.now()}`);await mkdir(output,{recursive:true});
const sources=[];
for(const repo of ['oan-discovery-node','oan-root-services','oan-registrar-node','oan-identity-lifecycle-evaluation','oan-official-skill']){
 const cwd=path.join(workspace,repo);
 sources.push({repo,head:execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim(),diffSha256:createHash('sha256').update(execFileSync('git',['diff'],{cwd})).digest('hex')});
}
const binaries=[];
for(const relative of ['oan-discovery-node/target/release/discovery-node.exe','oan-root-services/target/release/root-node.exe','oan-registrar-node/target/release/registrar-node.exe'])binaries.push({path:relative,sha256:createHash('sha256').update(await readFile(path.join(workspace,relative))).digest('hex')});
await writeFile(path.join(output,'provenance.json'),JSON.stringify({createdAt:new Date().toISOString(),node:process.version,sources,binaries},null,2),'utf8');
const raw:any[]=[];const checkpoints:any[]=[];const dids:string[]=[];
const s=f.prepareSingleNodeScenario('paper-query-specialist');
const base=`http://127.0.0.1:${s.runtime.discoveryPort}`;
async function request(url:string,body?:any){
 const start=performance.now();const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const bytes=Buffer.from(await response.arrayBuffer());const data=JSON.parse(bytes.toString('utf8'));
 if(!response.ok)throw Error(`HTTP ${response.status}: ${bytes.toString('utf8')}`);
 return {ms:performance.now()-start,bytes:bytes.length,data};
}
async function enumerate(){
 const start=performance.now();let bytes=0,pages=0,next:number|undefined,nextDid:string|undefined;const found=new Set<string>();
 do{
  const r=await request(`${base}/discovery/index/resources?limit=100${next!==undefined?`&afterCursor=${next}&afterResourceDid=${encodeURIComponent(nextDid??'')}`:''}`);
  bytes+=r.bytes;pages++;
  for(const item of r.data.items){const did=item.resourceDid??item.did;f.assert(typeof did==='string'&&!found.has(did),'missing/duplicate enumeration DID');found.add(did);}
  next=r.data.hasMore?r.data.nextCursor:undefined;nextDid=r.data.nextResourceDid;
  f.assert(!r.data.hasMore||next!==undefined,'missing continuation');f.assert(pages<=30,'pagination cycle');
 }while(next!==undefined);
 f.assert(found.size===dids.length&&dids.every(d=>found.has(d)),'enumeration mismatch');
 return {ms:performance.now()-start,bytes,count:found.size,pages};
}
async function save(){await writeFile(path.join(output,'query-evidence.json'),JSON.stringify({backend:'postgres',scope:'one-local-deployment-cumulative-100-1000-2000',warmup:20,samples:200,concurrency:1,semanticEnabled:false,timer:'HTTP dispatch through full response and JSON parse; enumeration additionally validates DID set',clientCryptographicVerificationTimed:false,checkpoints,raw},null,2),'utf8');}
try{
 await f.startSingleNodeScenario(s);
 for(const n of [100,1000,2000]){
  let cursor=dids.length;
  await Promise.all(Array.from({length:8},async()=>{
   for(;;){const index=cursor++;if(index>=n)return;
    const identity=h.createResourceIdentity({routingCode:s.identities.registrar.did.split(':')[3].slice(0,5),resourceType:'agent_service',capabilityTags:['demo.agent_service'],serviceEndpoint:'http://127.0.0.1:9001',protocol:'http'});
    const fixture=h.buildResourceRegistrationFixture(identity,{draftId:`query-${index}`,registrarDid:s.identities.registrar.did,metadata:{capabilityTags:['demo.agent_service'],authorizedDomains:h.defaultAuthorizedDomains}});
    await h.postJson(`http://127.0.0.1:${s.runtime.registrarPort}/resources/register`,fixture,{timeoutMs:60000});dids.push(identity.did);
   }
  }));
  const deadline=Date.now()+120000;
  for(;;){try{await enumerate();break;}catch(e){if(Date.now()>deadline)throw e;await f.sleep(300);}}
  console.log(`Index converged at ${n}`);
  for(const mode of ['exact','limit20','limit50','enumeration']){
   for(let i=-20;i<200;i++){
    let r:any;
    if(mode==='enumeration')r=await enumerate();
    else{
     const body=mode==='exact'?{query:dids[(i+20)%dids.length],limit:1}:{capabilityTags:['demo.agent_service'],resourceType:'agent_service',limit:mode==='limit20'?20:50};
     r=await request(`${base}/discovery/resources/query`,body);
     const candidates=r.data.candidates;const expected=mode==='exact'?1:mode==='limit20'?20:50;
     f.assert(candidates.length===expected,'query result count differs from requested bound');
     if(mode==='exact')f.assert(h.listDiscoveryCandidates(r.data).includes(body.query),'wrong exact DID');
     r.count=candidates.length;
    }
    if(i>=0)raw.push({n,mode,index:i,ms:r.ms,bytes:r.bytes,count:r.count,pages:r.pages});
   }
   console.log(`Measured ${n} ${mode}`);await save();
  }
  checkpoints.push({n,complete:true});await save();
 }
 console.log(`Completed: ${output}`);
}finally{await save();await f.stopSingleNodeScenario(s);}
