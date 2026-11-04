import test from 'node:test';
import assert from 'node:assert/strict';
import {remoteCommand,sshArgs,validateHost,type Host} from '../src/cross-host.js';
const host:Host={id:'b',os:'windows',address:'100.1.2.3',user:'tester',key:'private-key-path',knownHosts:'known-hosts',hostKeyAlias:'verified-host',workspace:'D:\\OAN'};
test('SSH pins host identity and only uses the selected key',()=>{
 const args=sshArgs(host,'whoami');
 for(const item of ['BatchMode=yes','StrictHostKeyChecking=yes','IdentitiesOnly=yes','HostKeyAlias=verified-host'])assert.ok(args.includes(item));
 assert.ok(!args.includes('StrictHostKeyChecking=no'));
});
test('Windows script preserves Unicode through mandated encoded transport',()=>{
 const script="Write-Output 'café Δ'";
 const command=remoteCommand('windows',script);
 assert.equal(Buffer.from(command.split(' ').at(-1)!,'base64').toString('utf16le'),script);
});
test('reject malformed targets, missing trust store and production cloud paths',()=>{
 for(const change of [{address:'-oProxyCommand=bad'},{knownHosts:''},{user:'root;bad'},{os:'linux',workspace:'/data/oan/src'}])assert.throws(()=>validateHost({...host,...change} as Host));
 validateHost({...host,os:'linux',workspace:'/data/oan/experiments/tetc-cross-host/src'});
});
