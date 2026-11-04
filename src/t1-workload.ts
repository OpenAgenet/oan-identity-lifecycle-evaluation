import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {requestBudget,t1Policy} from './t1-policy.js';

export async function workload(id:string,total:number,concurrency:number,queries:boolean,indexOnly=false){
 if(!/^g2-[a-z0-9-]+$/.test(id)||!Number.isInteger(total)||total<1||total>2000||![1,4,8,16].includes(concurrency))throw Error('Invalid workload parameters');
 const base=path.resolve('runs/t1',id),output=path.join(base,'workload');await fs.mkdir(output);
 const workspace=path.resolve('..');process.env.OAN_WORKSPACE_ROOT=workspace;process.env.OAN_BENCH_BUILD_PROFILE='release';
 const s:any=await import(pathToFileURL(path.join(workspace,'oan-official-skill/skills/oan-system-test-ops/fixtures/oan-ops-harness/.bench-dist/bench/shared.js')).href);
 const sdk:any=await import(pathToFileURL(path.join(workspace,'oan-sdk-ts/dist/packages/sdk-ts/src/index.js')).href);
 const stage=path.join(base,'private-stage'),root=JSON.parse(await fs.readFile(path.join(stage,'root/identity.json'),'utf8'));
 const anchor={rootDid:root.did,verificationMethod:`${root.did}#key-1`,publicKeyJwk:root.publicKeyJwk};
 const registrars=['100.126.2.41','100.69.96.59','100.67.12.66'].map((host,i)=>({host,identity:s.loadIdentityMaterial(path.join(stage,`registrar-${'abc'[i]}`))}));
 const discoveries=['http://100.69.96.59:28102','http://100.67.12.66:28102'];
 const tag='technology.software_engineering';
 const rows:any[]=[],observations:any[]=[],queryRows:any[]=[];
 const request=async(url:string,body?:unknown)=>{
  const start=performance.now();let r:Response;
  try{r=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(requestBudget(url))});}
  catch(e){
   const error=e as Error & {cause?:{code?:string}};
   summary.lastTransportError={at:new Date().toISOString(),host:new URL(url).host,path:new URL(url).pathname,name:error.name,code:error.cause?.code??null};
   throw Error(`Transport error: ${new URL(url).host}${new URL(url).pathname}: ${error.name} (${error.cause?.code??'unknown'})`);
  }
  const bytes=Buffer.from(await r.arrayBuffer()),data=JSON.parse(bytes.toString('utf8'));
  if(!r.ok){
   const error=String(data.error??'unspecified').replace(/postgresql:\/\/[^\s"']+/g,'[redacted database URL]').slice(0,1500);
   summary.lastHttpError={at:new Date().toISOString(),host:new URL(url).host,path:new URL(url).pathname,status:r.status,error};
   throw Error(`HTTP ${r.status}: ${new URL(url).host}${new URL(url).pathname}: ${error}`);
  }
  return {ms:performance.now()-start,bytes:bytes.length,data};
 };
 async function enumerate(d:string){
  const start=performance.now();let cursor:number|undefined,did:string|undefined,bytes=0,pages=0;const found=new Set<string>();
  do{
   const r=await request(`${d}/discovery/index/resources?limit=100${cursor===undefined?'':`&afterCursor=${cursor}&afterResourceDid=${encodeURIComponent(did??'')}`}`);
   bytes+=r.bytes;pages++;
   for(const item of r.data.items){const key=item.resourceDid??item.did;if(typeof key!=='string'||found.has(key))throw Error('Invalid/duplicate enumeration DID');found.add(key);}
   if(r.data.hasMore){if(!Number.isSafeInteger(r.data.nextCursor)||pages>30)throw Error('Invalid pagination');cursor=r.data.nextCursor;did=r.data.nextResourceDid;}else cursor=undefined;
  }while(cursor!==undefined);
  return {ms:performance.now()-start,bytes,pages,found};
 }
 const summary:any={id,total,concurrency,queries,state:'running',scope:'real-three-host-agent-pipeline',startedAt:new Date().toISOString(),requestBudgets:t1Policy,batchTimeoutMs:t1Policy.batchTimeoutMs,watchdogScope:'submission-start-to-observer-processing; not an OAN SLA; in-flight HTTP may finish after watchdog',signer:'sdk',verification:'per-resource-per-discovery-pinned-root',observerConcurrency:t1Policy.observerConcurrency};
 const save=async()=>{
  for(const [file,value] of Object.entries({'requests.json':rows,'observations.json':observations,'queries.json':queryRows,'summary.json':summary}))await fs.writeFile(path.join(output,file),JSON.stringify(value,null,2),'utf8');
 };
 try{
  for(const d of discoveries){
   const count=indexOnly?Number((await request(`${d}/discovery/status`)).data.indexedResourceCount):(await enumerate(d)).found.size;
   if(!Number.isSafeInteger(count)||count!==0)throw Error('Refuse nonempty or invalid Discovery');
  }
  const prepareStart=performance.now();const inputs:any[]=[];
  for(let i=0;i<total;i++){
   const registrar=registrars[i%3],identity=s.createAgentIdentity(registrar.identity.did.split(':')[3].slice(0,5),[tag],`http://${registrar.host}:29001/invoke`,`${id}-${i}`);
   identity.didDocument=await sdk.signDidDocumentProof(identity.didDocument,{did:identity.did,verificationMethodId:identity.keyId,publicKeyJwk:identity.publicKeyJwk,privateKeyJwk:identity.privateKeyJwk});
   const fixture=s.buildResourceRegistrationFixture(identity,{draftId:`${id}-${i}`,registrarDid:registrar.identity.did,metadata:{capabilityTags:[tag],authorizedDomains:s.defaultAuthorizedDomains}});
   inputs.push({did:identity.did,registrar,fixture});
  }
  summary.preparationMs=performance.now()-prepareStart;
  const start=performance.now(),deadline=start+summary.batchTimeoutMs;let next=0,finished=false,fatal:unknown;
  const pending:any[]=[];
  const observers=Array.from({length:indexOnly?0:8},async()=>{
   while(!fatal&&(!finished||pending.length)){
    const item=pending.shift();if(!item){await new Promise(r=>setTimeout(r,25));continue;}
    if(performance.now()>deadline){fatal??=Error('Unified batch deadline reached');return;}
    try{
     const raw=await request(`${item.endpoint}/discovery/index/resources/${encodeURIComponent(item.row.did)}`);
     const pkg=raw.data.package;if(!pkg){pending.push(item);await new Promise(r=>setTimeout(r,300));continue;}
     const visibleAt=performance.now()-start;
     const result=await request(`${item.endpoint}/discovery/resources/query`,{query:item.row.did,limit:1});
     const candidate=result.data.candidates.find((c:any)=>(c.resourceDid??c.did)===item.row.did);
     if(!candidate)throw Error('Exact candidate missing');
     sdk.verifyCandidateMatchesPackage(candidate,pkg,{versionMode:'exact',version:'1.0.0',resourceType:'agent_service'});
     const vstart=performance.now();
     const r=item.input.registrar.identity;
     const report=await sdk.verifyIdentityEvidence({expectedDid:item.row.did,didDocument:pkg.didDocument,resourcePackage:pkg,registrationVc:item.row.registrationCredential},{anchor,observedAt:new Date().toISOString(),maxAgeMs:600000,requirePrivateVc:true,registrar:{did:r.did,verificationMethod:r.keyId,publicKeyJwk:r.publicKeyJwk,proofProfile:'registrar-canonical-v1'}});
     if(!report.valid)throw Error('Identity evidence verification failed');
     observations.push({did:item.row.did,endpoint:item.endpoint,firstPackageObservedMs:visibleAt,lastAbsentMs:item.lastAbsentMs,verifiedAtMs:performance.now()-start,fromSubmitVerifiedMs:performance.now()-start-item.row.submitStartMs,verificationMs:performance.now()-vstart,report,resourcePackage:pkg});
    }catch(e){
     if(e instanceof Error&&e.message==='HTTP 404: /discovery/index/resources/'+encodeURIComponent(item.row.did)){
      item.lastAbsentMs=performance.now()-start;pending.push(item);await new Promise(r=>setTimeout(r,300));
     }else{fatal??=e;return;}
    }
   }
  });
  await Promise.all(Array.from({length:concurrency},async()=>{
   for(;;){const i=next++;if(i>=inputs.length||fatal)return;const input=inputs[i],submitStartMs=performance.now()-start;
    if(performance.now()>deadline){fatal??=Error('Submission deadline');return;}
    try{
     const r=await request(`http://${input.registrar.host}:28101/resources/register`,input.fixture);
     const row={did:input.did,registrarHost:input.registrar.host,submitStartMs,responseEndMs:performance.now()-start,responseMs:r.ms,registrationCredential:r.data.registrationCredential};rows.push(row);
     for(const endpoint of discoveries)pending.push({input,row,endpoint,lastAbsentMs:null});
    }catch(e){fatal??=e;return;}
   }
  }));finished=true;summary.registrationWallMs=performance.now()-start;
  if(indexOnly){
   if(fatal)throw fatal;
   if(rows.length!==total)throw Error('Incomplete registration submissions');
   const indexDeadline=Date.now()+t1Policy.batchTimeoutMs;const counts:any={};
   while(Date.now()<indexDeadline){let done=true;for(const d of discoveries){const status=await request(`${d}/discovery/status`);counts[d]=Number(status.data.indexedResourceCount??0);if(counts[d]<total)done=false;}if(done)break;await new Promise(r=>setTimeout(r,1000));}
   if(discoveries.some(d=>!Number.isSafeInteger(counts[d])||counts[d]!==total))throw Error(`Discovery index count does not match ${total}`);
   summary.allVerifiedWallMs=performance.now()-start;summary.endToEndPerSecond=total/(summary.allVerifiedWallMs/1000);summary.completeness={expectedPerDiscovery:total,indexedCounts:counts,indexOnly:true};summary.state='complete';summary.completedAt=new Date().toISOString();await save();return summary;
  }
  await Promise.all(observers);if(fatal)throw fatal;
  if(rows.length!==total||observations.length!==total*2)throw Error('Incomplete required observations');
  summary.allVerifiedWallMs=Math.max(...observations.map(o=>o.verifiedAtMs));summary.endToEndPerSecond=total/(summary.allVerifiedWallMs/1000);
  for(const d of discoveries){const all=await enumerate(d);if(all.found.size!==total||inputs.some(i=>!all.found.has(i.did)))throw Error('Final DID set mismatch');}
  summary.completeness={expectedPerDiscovery:total,verifiedObservations:observations.length,exactSets:true};await save();
  if(queries)for(const d of discoveries)for(const mode of ['exact','limit20','enumeration']){
   for(let i=-20;i<200;i++){
    let r:any;
    if(mode==='enumeration'){r=await enumerate(d);if(r.found.size!==total||inputs.some(x=>!r.found.has(x.did)))throw Error('Query enumeration mismatch');}
    else{
     const did=inputs[(i+20)%total].did;
     r=await request(`${d}/discovery/resources/query`,mode==='exact'?{query:did,limit:1}:{capabilityTags:[tag],resourceType:'agent_service',limit:20});
     if(r.data.candidates.length!==(mode==='exact'?1:Math.min(20,total)))throw Error('Unexpected query count');
     if(mode==='exact'&&!s.listDiscoveryCandidates(r.data).includes(did))throw Error('Wrong exact DID');
    }
    if(i>=0)queryRows.push({endpoint:d,mode,index:i,ms:r.ms,bytes:r.bytes,pages:r.pages});
   }
   console.log(`${id}: ${d} ${mode} measured`);await save();
  }
  summary.state='complete';summary.completedAt=new Date().toISOString();console.log(`${id}: ${total} resources, ${observations.length} verified observations; wall=${summary.allVerifiedWallMs.toFixed(1)}ms`);
 }catch(e){summary.state='incomplete';summary.error=e instanceof Error?e.message:String(e);throw e;}finally{await save();}
 return summary;
}
