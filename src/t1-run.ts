import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {deploy} from './t1-deploy.js';
import {workload} from './t1-workload.js';
import {t1Matrix} from './t1-matrix.js';
import {startCollector} from './t1-collector.js';
import {provenance} from './t1-provenance.js';

async function command(script:string,args:string[]){
 await new Promise<void>((resolve,reject)=>{
  const p=spawn(process.execPath,[`dist/src/${script}.js`,...args],{stdio:'inherit',windowsHide:true});
  p.once('error',reject);p.once('close',code=>code===0?resolve():reject(Error(`${script} exited ${code}`)));
 });
}
async function main(){
 const [mode,previous,stamp]=process.argv.slice(2);
 if(!['pilot','formal'].includes(mode)||!/^g2-[a-z0-9-]+$/.test(previous??'')||!/^\d{8}[a-z]$/.test(stamp??''))throw Error('Usage: t1-run pilot|formal PREVIOUS-G2-ID YYYYMMDDx');
 const output=path.resolve('runs/t1',`${mode}-${stamp}`);await fs.mkdir(output);
 const matrix=mode==='pilot'?[1,4,8,16].map(concurrency=>({id:`pilot-c${concurrency}`,total:100,concurrency})):t1Matrix().runs.map(r=>({...r,concurrency:0}));
 let concurrency=0;
 if(mode==='formal'){
  const pilot=JSON.parse(await fs.readFile('runs/t1/selected-configuration.json','utf8'));
  if(![1,4,8,16].includes(pilot.concurrency)||pilot.state!=='frozen-from-complete-pilots')throw Error('Missing successful pilot selection');
  concurrency=pilot.concurrency;
 }
 const completed:any[]=[];let active=previous;
 await fs.writeFile(path.join(output,'plan.json'),JSON.stringify({mode,stamp,matrix,previous,concurrency,state:'planned-not-measured'},null,2),'utf8');
 try{
  for(const item of matrix){
   const id=`g2-${stamp}-${item.id}`;
   await command('t1-prepare',[id]);await command('t1-stage',[id]);
   await deploy(id,active);active=id;
   await provenance(id);
   const stopCollector=await startCollector(id);
   let result;
   try{result=await workload(id,item.total,concurrency||item.concurrency,mode==='formal',false);}
   finally{await stopCollector();await command('t1-evidence-backup',[id]);}
   completed.push(result);
   await fs.writeFile(path.join(output,'progress.json'),JSON.stringify({active,completed,state:'running'},null,2),'utf8');
  }
  if(mode==='pilot'){
   const selected=[...completed].sort((a,b)=>a.allVerifiedWallMs-b.allVerifiedWallMs||a.concurrency-b.concurrency)[0];
   const file=path.resolve('runs/t1/selected-configuration.json');
   await fs.writeFile(file,JSON.stringify({state:'frozen-from-complete-pilots',concurrency:selected.concurrency,pilots:completed.map(r=>({id:r.id,concurrency:r.concurrency,allVerifiedWallMs:r.allVerifiedWallMs})),criterion:'lowest all-resource/all-Discovery verified wall time among complete pilots',lastRun:active,at:new Date().toISOString()},null,2),{encoding:'utf8',flag:'wx'});
  }
  await fs.writeFile(path.join(output,'progress.json'),JSON.stringify({active,completed,state:'complete'},null,2),'utf8');
 }catch(e){await fs.writeFile(path.join(output,'progress.json'),JSON.stringify({active,completed,state:'stopped-not-retried',error:e instanceof Error?e.message:String(e)},null,2),'utf8');throw e;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
