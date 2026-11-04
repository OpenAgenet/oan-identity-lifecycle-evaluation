import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateTotal,bindHarnessConfig,isTailnetAddress} from '../src/t1-config.js';
test('total is not interpreted as per-Registrar scale',()=>{
 assert.deepEqual(allocateTotal(2000),[667,667,666]);
 assert.deepEqual(allocateTotal(100),[34,33,33]);
 for(const n of [30,300,1200,2000])assert.equal(allocateTotal(n).reduce((a,b)=>a+b),n);
});
test('bind official configuration and isolate database',()=>{
 const input='[server]\nhost = "127.0.0.1"\nendpoint = "http://localhost:28101"\nroot_endpoint = "http://localhost:28100"\ndatabase_url = "old"';
 const bindings={listenAddress:'100.69.2.3',endpoints:{'http://localhost:28101':'http://100.69.2.3:28101','http://localhost:28100':'http://100.67.2.4:28100'},databaseUrl:'postgresql://test:password@127.0.0.1:25432/oan_tetc_r1'};
 const result=bindHarnessConfig(input,bindings);
 assert.ok(!result.includes('localhost'));
 assert.throws(()=>bindHarnessConfig(input,{...bindings,databaseUrl:'postgresql://test@127.0.0.1:5432/production'}));
 assert.throws(()=>bindHarnessConfig(input,{...bindings,endpoints:{}}));
});
test('cross-host bindings reject public lookalikes and wrong ports',()=>{
 for(const ip of ['100.1.2.3','100.128.2.3','100.69.999.1','100.example.org'])assert.equal(isTailnetAddress(ip),false);
 assert.equal(isTailnetAddress('100.69.96.59'),true);
 const source='host = "127.0.0.1"';
 for(const target of ['http://100.example.org:28100','http://100.69.96.59:8100','http://100.69.96.59:28100/path','http://user:secret@100.69.96.59:28100'])assert.throws(()=>bindHarnessConfig(source,{listenAddress:'100.69.96.59',endpoints:{old:target}}));
 assert.throws(()=>bindHarnessConfig('invalid',{listenAddress:'100.69.96.59',endpoints:{}}));
});
