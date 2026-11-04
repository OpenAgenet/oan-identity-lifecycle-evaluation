export interface T1Bindings {
 listenAddress:string; endpoints:Record<string,string>; databaseUrl?:string; capabilityTree?:string;
}
export function isTailnetAddress(value:string):boolean {
 const parts=value.split('.');
 return parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255)
  &&Number(parts[0])===100&&Number(parts[1])>=64&&Number(parts[1])<=127;
}
export function bindHarnessConfig(source:string,b:T1Bindings):string {
 if(!isTailnetAddress(b.listenAddress))throw Error('Expected Tailscale listener');
 if(!/^host = "127\.0\.0\.1"$/m.test(source))throw Error('Missing official listener binding');
 let result=source.replace(/^host = "127\.0\.0\.1"$/m,`host = "${b.listenAddress}"`);
 for(const [original,target] of Object.entries(b.endpoints)){
  const url=new URL(target);
  if(url.protocol!=='http:'||!isTailnetAddress(url.hostname)||!['28100','28101','28102','28103','28110'].includes(url.port)
   ||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Expected experiment HTTP endpoint');
  result=result.replaceAll(original,target);
 }
 if(b.databaseUrl){
  const url=new URL(b.databaseUrl);
  if(url.protocol!=='postgresql:'||url.hostname!=='127.0.0.1'||url.port!=='25432'||!/^\/oan_tetc_[a-z0-9_]+$/.test(url.pathname)||url.search||url.hash)throw Error('Database must use isolated local cluster');
  if(!/^database_url = ".*"$/m.test(result))throw Error('Missing official database binding');
  result=result.replace(/^database_url = ".*"$/m,`database_url = "${b.databaseUrl}"`);
 }
 if(b.capabilityTree)result=result.replace(/^capability_tree_file = ".*"$/m,`capability_tree_file = "${b.capabilityTree.replaceAll('\\','/')}"`);
 if(/https?:\/\/(?:localhost|127\.0\.0\.1):(?:28100|28101|28102|28103)/.test(result))throw Error('Unbound cross-host endpoint');
 return result;
}
export function allocateTotal(total:number):number[]{
 if(!Number.isSafeInteger(total)||total<1)throw Error('Invalid total');
 return Array.from({length:3},(_,i)=>Math.floor(total/3)+(i<total%3?1:0));
}
