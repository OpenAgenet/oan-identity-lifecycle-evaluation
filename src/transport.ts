import {isDeepStrictEqual} from 'node:util';
import type {Experiment,RequestCase,Result} from './contracts.js';
import {pointer} from './config.js';
export async function request(c:Experiment,x:RequestCase,iteration:number,budgetMs=c.timeoutMs):Promise<Result> {
 const start=process.hrtime.bigint(); let status:number|null=null,bytes=0,actual:Result['actual']='transport-error';
 try {
  const headers:Record<string,string>={'content-type':'application/json'};
  for(const [key,env] of Object.entries(x.headerEnv??{})) {const value=process.env[env];if(!value) throw Error('missing credential environment');headers[key]=value;}
  const response=await fetch(c.endpoints[x.endpoint].replace(/\/$/,'')+x.path,{method:x.method,headers,body:x.body===undefined?undefined:JSON.stringify(x.body),signal:AbortSignal.timeout(Math.max(1,Math.floor(Math.min(c.timeoutMs,budgetMs)))),redirect:'error'});
  status=response.status;const text=await response.text();bytes=Buffer.byteLength(text);
  let matched=status===x.expectedStatus;
  if(x.expected) {try {matched=matched&&isDeepStrictEqual(pointer(JSON.parse(text),x.expected.pointer),x.expected.equals);}catch{matched=false;}}
  actual=matched?'matched':'mismatch';
 } catch(error) {actual=error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'timeout':'transport-error';}
 const end=process.hrtime.bigint();
 return {runId:c.runId,module:c.module,caseId:x.id,iteration,scope:x.scope,startNs:String(start),endNs:String(end),elapsedMs:Number(end-start)/1e6,httpStatus:status,actual,responseBytes:bytes};
}
