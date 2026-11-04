import type {Experiment,Result} from '../contracts.js';
import {workload} from './workload.js';
import {observe} from './observe.js';
export async function run(c:Experiment,emit:(r:Result)=>void):Promise<boolean> {
 const passed=await workload(c,emit);
 return passed ? await observe(c,emit) : false;
}
