import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execute, type Host} from './cross-host.js';
import {bindHarnessConfig} from './t1-config.js';

async function main(){
 const [id]=process.argv.slice(2);
 if(!id||!/^g2-[a-z0-9-]+$/.test(id))throw Error('Usage: t1-prepare g2-RUN-ID');
 const workspace=path.resolve('..'),base=path.resolve('runs/t1',id);
 await fs.mkdir(base);
 const inventory=JSON.parse(await fs.readFile('.local/three-host.inventory.json','utf8')) as {hosts:Host[]};
 const remote=Object.fromEntries(inventory.hosts.map(h=>[h.id,h]));
 const addresses={a:'100.126.2.41',b:'100.69.96.59',c:'100.67.12.66'};
 const cloudRoot='/data/oan/experiments/tetc-cross-host';
 const infra=path.resolve('runs/t1/infrastructure-20261031');
 const manifest=JSON.parse(await fs.readFile(path.join(infra,'postgres-manifest.json'),'utf8'));
 const passwords:Record<string,string>={a:(await fs.readFile(manifest.passwordFile,'utf8')).trim()};
 for(const [host,key,script] of [
  [remote['laptop-b'],'b',`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); [IO.File]::ReadAllText('D:/Works/VscodeProject/OAN/oan-identity-lifecycle-evaluation/runs/t1/infrastructure-20261031/postgres-password.local',[Text.Encoding]::UTF8)`],
  [remote.cloud,'c',`cat ${cloudRoot}/postgres/password.local`],
 ] as [Host,string,string][]){
  const r=await execute(host,script);if(r.exitCode!==0||r.timedOut)throw Error(`Cannot obtain experiment credential: ${key}`);
  passwords[key]=r.stdout.trim();if(!passwords[key]||/\s/.test(passwords[key]))throw Error('Invalid credential response');
 }
 process.env.OAN_WORKSPACE_ROOT=workspace;
 process.env.OAN_BENCH_BUILD_PROFILE='release';
 process.env.OAN_BENCH_DB_BACKEND='sqlite';
 const harness=path.join(workspace,'oan-official-skill/skills/oan-system-test-ops/fixtures/oan-ops-harness');
 const s:any=await import(pathToFileURL(path.join(harness,'.bench-dist/bench/shared.js')).href);
 const staging=path.join(base,'private-stage');await fs.mkdir(staging);
 const rootUrl=`http://${addresses.c}:28100`,cdnUrl=`http://${addresses.c}:28103`;
 const roles=[
  {name:'root',host:'c',node:'genesis-root',port:28100},
  {name:'registrar-a',host:'a',node:'genesis-registrar-1',port:28101},
  {name:'registrar-b',host:'b',node:'genesis-registrar-2',port:28101},
  {name:'registrar-c',host:'c',node:'genesis-registrar-3',port:28101},
  {name:'discovery-a',host:'b',node:'genesis-discovery-1',port:28102},
  {name:'discovery-b',host:'c',node:'genesis-discovery-2',port:28102},
 ];
 const identities:Record<string,any>={};
 for(const r of roles)identities[r.name]=s.copyGenesisNodeIdentity(r.node,path.join(staging,r.name),{endpoint:`http://${addresses[r.host as keyof typeof addresses]}:${r.port}`});
 const rootDid=identities.root.did;
 s.seedRootBulletin(s.rootFixtureRoot,path.join(staging,'root'),{cdnEndpoint:cdnUrl});
 s.writeGenesisAuthorizationState(path.join(staging,'root'),{
  registrarDirs:roles.filter(r=>r.name.startsWith('registrar')).map(r=>path.join(staging,r.name)),
  discoveryDirs:roles.filter(r=>r.name.startsWith('discovery')).map(r=>path.join(staging,r.name)),
  authorizedDomains:s.defaultAuthorizedDomains,
 });
 const events=s.uniqueRootEventStreamProfile(id,24222);
 for(const host of ['a','b','c']){
  const dir=path.join(staging,host),config=path.join(dir,'config');await fs.mkdir(config,{recursive:true});
  const selected=roles.filter(r=>r.host===host);
  for(const r of selected)await fs.cp(path.join(staging,r.name),path.join(dir,r.name),{recursive:true,errorOnExist:true});
  if(host==='c'){
   for(const d of ['cdn/documents','cdn/metadata','cdn/packages','cdn/resources'])await fs.mkdir(path.join(dir,d),{recursive:true});
   await fs.copyFile(s.capabilityTreeFixturePath,path.join(dir,'capability-tree-v1.json'));
   s.writeJson(path.join(dir,'root/request-nonces.json'),{nonces:{}});
   s.writeJson(path.join(dir,'cdn/manifest.json'),{version:'0.1.0',generatedAt:new Date().toISOString(),rootDid,packages:[]});
   s.writeBenchmarkRootConfig(path.join(config,'root.toml'),{rootPort:28100},rootDid,{events});
   s.writeBenchmarkCdnConfig(path.join(config,'cdn.toml'),{rootPort:28100,cdnPort:28103},rootDid);
   s.writeBenchmarkCdnPublisherConfig(path.join(config,'cdn-publisher.toml'),{rootPort:28100,cdnPort:28103,publisherPort:28110},{events});
  }
  for(const r of selected){
   if(r.name.startsWith('registrar'))s.writeBenchmarkRegistrarConfig(path.join(config,`${r.name}.toml`),{rootPort:28100,registrarPort:r.port},rootDid,r.name);
   if(r.name.startsWith('discovery')){
    s.writeBenchmarkDiscoveryConfig(path.join(config,`${r.name}.toml`),{rootPort:28100,cdnPort:28103,discoveryPort:r.port},r.name);
    await fs.mkdir(path.join(dir,r.name,'index'),{recursive:true});s.writeJson(path.join(dir,r.name,'index/capabilities.json'),[]);
   }
  }
  for(const file of await fs.readdir(config)){
   const role=file.replace('.toml',''),record=roles.find(r=>r.name===role);
   const port=record?.port??(role==='cdn'?28103:28110);
   const oldSelf=`http://localhost:${port}`,self=`http://${addresses[host as keyof typeof addresses]}:${port}`;
   const mappings:Record<string,string>={'http://localhost:28100':rootUrl,'http://localhost:28103':cdnUrl,[oldSelf]:self};
   const db=`oan_tetc_${id.replaceAll('-','_')}_${role.replaceAll('-','_')}`;
   const source=await fs.readFile(path.join(config,file),'utf8');
   const result=bindHarnessConfig(source,{listenAddress:addresses[host as keyof typeof addresses],endpoints:mappings,
    databaseUrl:role==='cdn-publisher'?undefined:`postgresql://oan_tetc:${encodeURIComponent(passwords[host])}@127.0.0.1:25432/${db}`,
    capabilityTree:host==='c'?`${cloudRoot}/runs/${id}/capability-tree-v1.json`:undefined});
   await fs.writeFile(path.join(config,file),result,'utf8');
  }
 }
 await fs.writeFile(path.join(base,'preparation.json'),JSON.stringify({id,state:'prepared-not-deployed',roles:roles.map(r=>({...r,endpoint:`http://${addresses[r.host as keyof typeof addresses]}:${r.port}`})),events:{endpoint:events.endpoint,stream:events.stream},privateStage:staging},null,2),'utf8');
 console.log(`Prepared ${id}; private inputs retained under ignored runs. Not deployed or measured.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
