import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

async function main(){
 const [id]=process.argv.slice(2);if(!id||!/^g2-[a-z0-9-]+$/.test(id))throw Error('Usage: t1-evidence-backup g2-ID');
 const run=path.resolve('runs/t1',id),target=path.resolve('runs/t1/backups',`${id}-${Date.now()}`);await fs.mkdir(target,{recursive:true});
 const allowed=['cloud-pilot-evidence','cloud-pilot-evidence-sdk','g2-evidence-sdk','snapshots','workload','resource-usage.jsonl','provenance.json'];
 const hashes:string[]=[];
 async function copy(source:string,destination:string,relative:string){
  const stat=await fs.lstat(source);if(stat.isSymbolicLink())throw Error('Evidence symlink refused');
  if(stat.isDirectory()){
   await fs.mkdir(destination,{recursive:true});
   for(const name of await fs.readdir(source))await copy(path.join(source,name),path.join(destination,name),`${relative}/${name}`);
  }else if(stat.isFile()){
   const bytes=await fs.readFile(source);await fs.writeFile(destination,bytes);
   hashes.push(`${crypto.createHash('sha256').update(bytes).digest('hex')}  ${relative}`);
  }
 }
 for(const entry of allowed){
  try{await fs.access(path.join(run,entry));}catch{continue;}
  await copy(path.join(run,entry),path.join(target,entry),entry);
 }
 if(hashes.length===0)throw Error('No evidence found');
 await fs.writeFile(path.join(target,'hashes.sha256'),hashes.join('\n')+'\n','utf8');
 await fs.writeFile(path.join(target,'scope.json'),JSON.stringify({source:id,createdAt:new Date().toISOString(),files:hashes.length,scope:'local-redundant-copy-not-offsite-backup',excludes:['private-stage','deployment','identities','configs','database']},null,2),'utf8');
 console.log(`Backed up ${hashes.length} evidence files with SHA256; private runtime inputs excluded`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
