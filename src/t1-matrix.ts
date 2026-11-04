import {allocateTotal} from './t1-config.js';
export function t1Matrix(seed=20261028){
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const rows=Array.from({length:5},(_,round)=>[
  ...[30,300,1200,2000].map(total=>({kind:'agent',total,round:round+1})),
 ]).flat().map(r=>({...r,allocation:allocateTotal(r.total),typeCounts:{agent_service:r.total}}));
 for(let i=rows.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
 return {seed,state:'planned-not-measured',runs:rows.map((r,i)=>({...r,order:i+1,id:`t1-${r.kind}-n${r.total}-r${r.round}`}))};
}
