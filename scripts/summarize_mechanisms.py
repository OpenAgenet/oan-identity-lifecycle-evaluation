import argparse
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

parser=argparse.ArgumentParser()
parser.add_argument('run',type=Path)
args=parser.parse_args()
root=json.loads((args.run/'root-upstream-paired.json').read_text(encoding='utf-8'))
discovery=json.loads((args.run/'discovery-query-paired.json').read_text(encoding='utf-8'))
summary=[]
for fault in ['valid','missing_signature','invalid_signature','body_binding']:
    rows=[r for r in root['rows'] if r['fault']==fault]
    summary.append(dict(mechanism='Root upstream envelope',sample=fault,n=len(rows),full=sum(r['fullAccepted'] for r in rows),ablated=sum(r['ablatedAccepted'] for r in rows)))
for visible in [True,False]:
    rows=[r for r in discovery['rows'] if r['expectedVisible']==visible]
    summary.append(dict(mechanism='Discovery exact-DID domain filter',sample='in-scope' if visible else 'out-of-scope',n=len(rows),full=sum(r['fullReturned'] for r in rows),ablated=sum(r['ablatedReturned'] for r in rows)))
assert all(r['n']==30 for r in summary)
(args.run/'paired-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
plt.rcParams.update({'font.family':'serif','font.size':9,'axes.linewidth':0.8,'xtick.direction':'in','ytick.direction':'in','pdf.fonttype':42})
fig,ax=plt.subplots(figsize=(6.6,2.7))
negative=[r for r in summary if r['sample'] not in ('valid','in-scope')]
positions=list(range(len(negative)))
ax.bar([x-.18 for x in positions],[r['full'] for r in negative],width=.36,color='#0072BD',label='Full checks')
ax.bar([x+.18 for x in positions],[r['ablated'] for r in negative],width=.36,color='#D95319',label='Selected check omitted')
ax.set_xticks(positions,['Missing upstream\nsignature','Invalid upstream\nsignature','Modified upstream\nbody','Out-of-scope\nquery candidate'])
ax.set_ylabel('Accepted / returned (of 30)')
ax.set_ylim(0,35);ax.set_yticks([0,10,20,30]);ax.grid(axis='y',alpha=.25);ax.set_axisbelow(True)
ax.legend(frameon=False,loc='upper center',bbox_to_anchor=(.5,1.2),ncol=2)
fig.tight_layout();fig.savefig(args.run/'paired-mechanisms.pdf',bbox_inches='tight');plt.close(fig)
print(json.dumps(summary,indent=2))
