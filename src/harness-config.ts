export function scaleEnvironment(scales?:string):Record<string,string>{
 if(scales===undefined)return {};
 if(!/^[1-9]\d*(,[1-9]\d*)*$/.test(scales))throw Error('scales must be positive integers');
 return Object.fromEntries(['OAN_BENCH_SCALES','OAN_PIPELINE_BENCH_SCALES','OAN_MULTI_PIPELINE_BENCH_SCALES','OAN_MIXED_PIPELINE_BENCH_SCALES','OAN_MULTI_MIXED_PIPELINE_BENCH_SCALES'].map(key=>[key,scales]));
}
