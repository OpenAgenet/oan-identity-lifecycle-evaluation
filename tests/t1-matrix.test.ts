import test from 'node:test';
import assert from 'node:assert/strict';
import {t1Matrix} from '../src/t1-matrix.js';
test('formal matrix reproducibly freezes 20 independent total-N agent units',()=>{
 const m=t1Matrix();assert.equal(m.runs.length,20);assert.deepEqual(t1Matrix(),m);
 assert.notDeepEqual(t1Matrix(20261029).runs,m.runs);
 assert.equal(new Set(m.runs.map(r=>r.id)).size,20);
 for(const r of m.runs){
  assert.equal(r.allocation.reduce((a,b)=>a+b),r.total);
  assert.equal(Object.values(r.typeCounts).reduce((a,b)=>a+(b??0),0),r.total);
 }
 for(const n of [30,300,1200,2000])assert.equal(m.runs.filter(r=>r.kind==='agent'&&r.total===n).length,5);
 assert.ok(m.runs.every(r=>r.kind==='agent'));
});
