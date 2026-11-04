import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {deploy} from './t1-deploy.js';
import {workload} from './t1-workload.js';
import {startCollector} from './t1-collector.js';
import {provenance} from './t1-provenance.js';

async function cmd(script:string,args:string[]){
  await new Promise<void>((resolve,reject)=>{
    const p=spawn(process.execPath,[`dist/src/${script}.js`,...args],{stdio:'inherit',windowsHide:true});
    p.once('error',reject); p.once('close',code=>code===0?resolve():reject(Error(`${script} exited ${code}`)));
  });
}

async function main(){
  const [progressPath,stamp]=process.argv.slice(2);
  if(!progressPath||!/^[0-9]{8}[a-z]$/.test(stamp??'')) throw Error('Usage: t1-resume PROGRESS.json YYYYMMDDx');
  const progress=JSON.parse(await fs.readFile(progressPath,'utf8'));
  const matrix=JSON.parse(await fs.readFile('runs/t1/formal-20261031e/plan.json','utf8')).matrix;
  const completed:any[]=progress.completed??[];
  const done=new Set(completed.map((x:any)=>String(x.id).replace(/^g2-[^-]+-t1-/,'t1-')));
  const out=path.resolve('runs/t1',`formal-${stamp}`); await fs.mkdir(out);
  await fs.writeFile(path.join(out,'plan.json'),JSON.stringify({mode:'formal-resume',stamp,matrix,sourceProgress:path.resolve(progressPath),remaining:matrix.filter((x:any)=>!done.has(x.id)),state:'running'},null,2),'utf8');
  let active=progress.active;
  const save=async(state:string,extra:Record<string,unknown>={})=>fs.writeFile(path.join(out,'progress.json'),JSON.stringify({active,completed,state,...extra},null,2),'utf8');
  await save('running');
  try{
  for(const item of matrix){
    if(done.has(item.id)) continue;
    const id=`g2-${stamp}-${item.id}`;
    await save('running',{attempted:id,phase:'preparation'});
    await cmd('t1-prepare',[id]); await cmd('t1-stage',[id]);
    await save('running',{attempted:id,phase:'deployment'});
    await deploy(id,active); active=id; await provenance(id);
    await save('running',{attempted:id,phase:'workload'});
    const stop=await startCollector(id); let result:any;
    try{ result=await workload(id,item.total,16,false,true); }
    finally{ await stop(); await cmd('t1-evidence-backup',[id]); }
    completed.push(result);
    await save('running');
  }
  await save('complete');
  }catch(e){await save('stopped-not-retried',{error:e instanceof Error?e.message:String(e)});throw e;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
