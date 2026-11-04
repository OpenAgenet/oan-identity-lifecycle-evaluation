import type {Experiment,Result} from '../contracts.js';
import {request} from '../transport.js';
export async function workload(c:Experiment,emit:(r:Result)=>void):Promise<boolean> {
 let ok=true;
 for(let round=-c.warmup;round<c.repetitions;round++) {
  let next=0;
  await Promise.all(Array.from({length:Math.min(c.concurrency,c.cases.length)},async()=>{
   while(next<c.cases.length) {const x=c.cases[next++];const r=await request(c,x,round);if(round>=0){emit(r);ok=ok&&r.actual==='matched';}}
  }));
 }
 return ok;
}
