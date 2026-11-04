import test from 'node:test';
import assert from 'node:assert/strict';
import {scaleEnvironment} from '../src/harness-config.js';
test('explicit scales override all four scenario selectors',()=>{
 const env={OAN_MULTI_MIXED_PIPELINE_BENCH_SCALES:'10',...scaleEnvironment('60,150')};
 assert.equal(Object.keys(env).length,5);
 for(const value of Object.values(env))assert.equal(value,'60,150');
});
test('invalid and zero scales fail before launching services',()=>{
 for(const value of ['0','-1','1,0','1,','1 2'])assert.throws(()=>scaleEnvironment(value));
 assert.deepEqual(scaleEnvironment(),{});
});
