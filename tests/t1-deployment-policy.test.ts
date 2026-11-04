import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('cross-host deployment matches operations resource policy without added hard quotas',()=>{
 const source=fs.readFileSync('src/t1-deploy.ts','utf8');
 assert.doesNotMatch(source,/MemoryMax=|MemoryHigh=|CPUQuota=|LimitAS=/);
 assert.match(source,/User=oan-tetc/);
 assert.match(source,/Database|database/);
 assert.match(source,/Experiment port still occupied/);
});
test('cleaned transient cloud units are skipped but loaded units retain ownership and stop gates',()=>{
 const source=fs.readFileSync('src/t1-deploy.ts','utf8');
 assert.match(source,/LoadState --value\)" != not-found/);
 assert.match(source,/WorkingDirectory --value/);
 assert.match(source,/User --value/);
 assert.doesNotMatch(source,/systemctl stop[^\n]*\|\| true/);
});
test('NATS is ready before starting Publisher and Publisher is part of the service gate',()=>{
 const source=fs.readFileSync('src/t1-deploy.ts','utf8');
 assert.ok(source.indexOf('28222/healthz') < source.indexOf("for spec in 'root root-node root'"));
 assert.match(source,/28110\/health/);
});
