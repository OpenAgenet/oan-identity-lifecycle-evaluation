import test from 'node:test';
import assert from 'node:assert/strict';
import {requestBudget,t1Policy} from '../src/t1-policy.js';
test('all business and readiness budgets use the user-selected 1500 second ceiling',()=>{
 assert.equal(requestBudget('http://100.67.12.66:28101/resources/register'),1500000);
 assert.equal(requestBudget('http://100.69.96.59:28102/discovery/resources/query'),1500000);
 assert.equal(requestBudget('http://100.69.96.59:28102/discovery/index/resources'),1500000);
 for(const [key,value] of Object.entries(t1Policy))if(key.endsWith('TimeoutMs'))assert.equal(value,1500000);
});
