import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {requestBudget,t1Policy} from './t1-policy.js';

async function main(){
 const [id,mode='full',signer='sdk']=process.argv.slice(2);if(!id||!/^g2-[a-z0-9-]+$/.test(id)||!['full','cloud-pilot'].includes(mode)||!['harness','sdk'].includes(signer))throw Error('Usage: t1-g2 g2-RUN-ID [full|cloud-pilot] [harness|sdk]');
 const base=path.resolve('runs/t1',id),stage=path.join(base,'private-stage'),workspace=path.resolve('..');
 const output=path.join(base,`${mode==='full'?'g2-evidence':'cloud-pilot-evidence'}${signer==='sdk'?'-sdk':''}`);await fs.mkdir(output);
 process.env.OAN_WORKSPACE_ROOT=workspace;process.env.OAN_BENCH_BUILD_PROFILE='release';
 const s:any=await import(pathToFileURL(path.join(workspace,'oan-official-skill/skills/oan-system-test-ops/fixtures/oan-ops-harness/.bench-dist/bench/shared.js')).href);
 const sdk:any=await import(pathToFileURL(path.join(workspace,'oan-sdk-ts/dist/packages/sdk-ts/src/index.js')).href);
 const root=JSON.parse(await fs.readFile(path.join(stage,'root/identity.json'),'utf8'));
 const anchor={rootDid:root.did,verificationMethod:`${root.did}#key-1`,publicKeyJwk:root.publicKeyJwk};
 const registrars=[['registrar-a','100.126.2.41'],['registrar-b','100.69.96.59'],['registrar-c','100.67.12.66']];
 const discoveries=mode==='full'?['http://100.69.96.59:28102','http://100.67.12.66:28102']:['http://100.67.12.66:28102'];
 const request=async(url:string,body?:unknown)=>{
  const r=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(requestBudget(url))});
  const data=await r.json();if(!r.ok)throw Error(`Experiment HTTP ${r.status}: ${new URL(url).pathname}`);return data as any;
 };
 const rows:any[]=[];
 try{
  for(const [,host] of registrars)await request(`http://${host}:28101/registrar/status`);
  for(const d of discoveries)await request(`${d}/discovery/status`);
  for(const [name,host] of registrars){
   const registrar=s.loadIdentityMaterial(path.join(stage,name));
   const identity=s.createAgentIdentity(registrar.did.split(':')[3].slice(0,5),['technology.software_engineering'],`http://${host}:29001/invoke`,`${id}-${name}`);
   if(signer==='sdk')identity.didDocument=await sdk.signDidDocumentProof(identity.didDocument,{did:identity.did,verificationMethodId:identity.keyId,publicKeyJwk:identity.publicKeyJwk,privateKeyJwk:identity.privateKeyJwk});
   const fixture=s.buildResourceRegistrationFixture(identity,{draftId:`${id}-${name}`,registrarDid:registrar.did,metadata:{authorizedDomains:s.defaultAuthorizedDomains}});
   const start=performance.now(),submittedAt=new Date().toISOString();
   const response=await request(`http://${host}:28101/resources/register`,fixture);
   const row:any={registrar:name,signer,did:identity.did,submittedAt,responseMs:performance.now()-start,response,discoveries:[]};rows.push(row);
   const end=Date.now()+t1Policy.batchTimeoutMs;
   for(const d of discoveries){
    let matched=false;
    while(Date.now()<end){
     const result=await request(`${d}/discovery/resources/query`,{query:identity.did,limit:5});
     if(s.listDiscoveryCandidates(result).includes(identity.did)){
      const raw=await request(`${d}/discovery/index/resources/${encodeURIComponent(identity.did)}`);
      const pkg=raw.package;
      if(!pkg)throw Error('Discovery package evidence absent');
      const candidate=result.candidates.find((c:any)=>(c.resourceDid??c.did)===identity.did);
      if(pkg.packageVersion!=='1.0.0')throw Error('Unexpected package version');
      sdk.verifyCandidateMatchesPackage(candidate,pkg,{versionMode:'exact',version:'1.0.0',resourceType:'agent_service'});
      const archive=await request(`http://100.67.12.66:28100/root/resources/${encodeURIComponent(identity.did)}/versions`);
      if(!JSON.stringify(archive).includes('1.0.0'))throw Error('Root version archive absent');
      const vc=response.registrationCredential;
      const report=await sdk.verifyIdentityEvidence({expectedDid:identity.did,didDocument:pkg.didDocument,resourcePackage:pkg,registrationVc:vc},{anchor,observedAt:new Date().toISOString(),maxAgeMs:60000,requirePrivateVc:true,registrar:{did:registrar.did,verificationMethod:registrar.keyId,publicKeyJwk:registrar.publicKeyJwk,proofProfile:'registrar-canonical-v1'}});
      row.discoveries.push({endpoint:d,visibleMs:performance.now()-start,result,report,resourcePackage:pkg,rootVersions:archive});
      if(!report.valid)throw Error('SDK evidence verification did not pass');matched=true;break;
     }
     await new Promise(resolve=>setTimeout(resolve,300));
    }
    if(!matched)throw Error('Required Discovery did not converge before G2 deadline');
   }
   console.log(`${name}: ${discoveries.length} Discovery observation(s) and SDK evidence verification passed; scope=${mode}`);
  }
  await fs.writeFile(path.join(output,'completion.json'),JSON.stringify({state:mode==='full'?'g2-passed-not-performance':'partial-pilot-not-g2',mode,resources:rows.length},null,2),'utf8');
 }catch(error){
  await fs.writeFile(path.join(output,'completion.json'),JSON.stringify({state:'incomplete',mode,signer,resources:rows.length,error:error instanceof Error?error.message:'unknown',at:new Date().toISOString()},null,2),'utf8');
  throw error;
 }finally{await fs.writeFile(path.join(output,'observations.json'),JSON.stringify(rows,null,2),'utf8');}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
