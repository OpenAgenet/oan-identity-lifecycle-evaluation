export interface RequestCase {
  id:string; endpoint:string; method:'GET'|'POST'; path:string; body?:unknown;
  expectedStatus:number; expected?:{pointer:string;equals:unknown};
  headerEnv?:Record<string,string>; scope:'end-to-end'|'component'|'service-ablation';
}
export interface Experiment {
  schemaVersion:1; runId:string; module:'registration'|'query'|'lifecycle'|'negative'|'authorization'|'ablation';
  isolatedExperiment:true; endpoints:Record<string,string>; timeoutMs:number;
  concurrency:number; warmup:number; repetitions:number;
  cases:RequestCase[];
  observation?:{cases:RequestCase[];intervalMs:number;deadlineMs:number};
  ablation?:{variant:string;buildManifest:string};
}
export interface Result {
 runId:string;module:string;caseId:string;iteration:number;scope:string;
 startNs:string;endNs:string;elapsedMs:number;httpStatus:number|null;
 actual:'matched'|'mismatch'|'timeout'|'transport-error'; responseBytes:number;
}
