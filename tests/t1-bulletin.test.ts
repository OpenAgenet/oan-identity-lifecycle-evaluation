import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

test('official bulletin seed signs the final cross-host CDN origin and preserves default behavior',async()=>{
 const workspace=path.resolve('..');process.env.OAN_WORKSPACE_ROOT=workspace;
 const file=path.join(workspace,'oan-official-skill/skills/oan-system-test-ops/fixtures/oan-ops-harness/.bench-dist/bench/shared.js');
 const s:any=await import(pathToFileURL(file).href);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oan-t1-bulletin-'));
 try{
  const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
  const did='did:oan:RootX:test';
  fs.writeFileSync(path.join(dir,'identity.json'),JSON.stringify({did,privateKeyJwk:privateKey.export({format:'jwk'})}),'utf8');
  const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?`[${v.map(canonical).join(',')}]`:`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  for(const [options,expected] of [[{cdnEndpoint:'http://100.67.12.66:28103/'},'http://100.67.12.66:28103'],[{cdnPort:8123},'http://localhost:8123']] as const){
   s.seedRootBulletin(s.rootFixtureRoot,dir,options);
   const b=JSON.parse(fs.readFileSync(path.join(dir,'bulletin.json'),'utf8'));
   const event=b.events.find((e:any)=>e.eventType==='CDN_SERVICE_INFO_UPDATED');assert.ok(event);
   assert.equal(event.payload.baseUrl,expected);
   assert.equal(event.payload.resourceIndexUrl,`${expected}/cdn/resources/index`);
   const core=Object.fromEntries(['sequence','previousHash','eventType','subjectDid','actorDid','payload','createdAt'].map(k=>[k,event[k]]));
   assert.equal(crypto.createHash('sha256').update(canonical(core)).digest('hex'),event.eventHash);
   assert.ok(crypto.verify(null,Buffer.from(canonical({eventHash:event.eventHash}),'utf8'),publicKey,Buffer.from(event.signature,'base64url')));
  }
  for(const cdnEndpoint of ['file:///tmp/a','http://user:secret@100.1.1.1','http://100.1.1.1/path','http://100.1.1.1/?x=1'])assert.throws(()=>s.seedRootBulletin(s.rootFixtureRoot,dir,{cdnEndpoint}));
 }finally{fs.rmSync(dir,{recursive:true});}
});
