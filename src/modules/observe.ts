import type {Experiment,Result} from '../contracts.js';
import {request} from '../transport.js';
export async function observe(c:Experiment,emit:(r:Result)=>void):Promise<boolean> {
 const observation=c.observation; if(!observation) return true;
 const start=performance.now(), pending=new Map(observation.cases.map(x=>[x.id,x]));let iteration=0;
 while(pending.size && performance.now()-start<observation.deadlineMs) {
  for(const [id,x] of pending) {
   const remaining=observation.deadlineMs-(performance.now()-start);if(remaining<=0)break;
   const r=await request(c,x,iteration,remaining);emit(r);if(r.actual==='matched')pending.delete(id);
  }
  iteration++;
  if(pending.size)await new Promise(resolve=>setTimeout(resolve,Math.max(0,Math.min(observation.intervalMs,observation.deadlineMs-(performance.now()-start)))));
 }
 return pending.size===0;
}
