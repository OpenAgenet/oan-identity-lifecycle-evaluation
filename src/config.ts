import type {Experiment} from './contracts.js';
export function validate(c:Experiment):void {
 if(c.schemaVersion!==1 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(c.runId) || c.isolatedExperiment!==true) throw Error('invalid schema, run id or isolation declaration');
 if(!['registration','query','lifecycle','negative','authorization','ablation'].includes(c.module)) throw Error('unknown module');
 for(const n of [c.timeoutMs,c.concurrency,c.repetitions]) if(!Number.isInteger(n)||n<=0) throw Error('positive integer required');
 if(!Number.isInteger(c.warmup)||c.warmup<0||!c.cases.length) throw Error('invalid workload');
 const ids=new Set<string>();
 for(const x of [...c.cases,...(c.observation?.cases??[])]) {
  if(ids.has(x.id)||!x.id) throw Error('duplicate/empty case id'); ids.add(x.id);
  if(JSON.stringify(x).includes('REPLACE')) throw Error('template placeholders must be replaced before execution');
  const u=new URL(c.endpoints[x.endpoint]);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash) throw Error('invalid endpoint');
  if(!x.path.startsWith('/')||x.path.startsWith('//')||x.path.includes('://')) throw Error('relative service path required');
  if(!['GET','POST'].includes(x.method)||!Number.isInteger(x.expectedStatus)||x.expectedStatus<100||x.expectedStatus>599) throw Error('invalid request');
  if(!['end-to-end','component','service-ablation'].includes(x.scope)) throw Error('invalid scope');
 }
 if(c.observation && (!c.observation.cases.length||c.observation.intervalMs<=0||c.observation.deadlineMs<=0)) throw Error('invalid observation');
 if(['lifecycle','authorization','ablation'].includes(c.module)&&c.concurrency!==1) throw Error('stateful experiments require sequential execution');
 if(c.module==='ablation'&&!c.ablation) throw Error('ablation build manifest required');
}
export function pointer(value:unknown,path:string):unknown {
 if(path==='') return value;
 if(!path.startsWith('/')) throw Error('JSON pointer required');
 return path.slice(1).split('/').reduce<unknown>((v,k)=>v!==null&&typeof v==='object'?(v as Record<string,unknown>)[k.replace(/~1/g,'/').replace(/~0/g,'~')]:undefined,value);
}
