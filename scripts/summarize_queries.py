import json
import statistics
import math
import sys
from pathlib import Path

run=Path(sys.argv[1])
data=json.loads((run/'query-evidence.json').read_text(encoding='utf-8'))
summary=[]
for n in [100,1000,2000]:
    for mode in ['exact','limit20','limit50','enumeration']:
        rows=[r for r in data['raw'] if r['n']==n and r['mode']==mode]
        if len(rows)!=200:
            raise ValueError(f'incomplete group {n} {mode}: {len(rows)}')
        if {r.get('index',i) for i,r in enumerate(rows)}!=set(range(200)):
            raise ValueError('duplicate or missing sample identifier')
        if any(not math.isfinite(r['ms']) or r['ms']<0 or r['bytes']<=0 for r in rows):
            raise ValueError('invalid timing or byte count')
        expected={'exact':1,'limit20':20,'limit50':50,'enumeration':n}[mode]
        if any(r['count']!=expected for r in rows):
            raise ValueError('unexpected result count')
        values=sorted(r['ms'] for r in rows)
        summary.append(dict(n=n,mode=mode,samples=len(rows),meanMs=statistics.mean(values),sdMs=statistics.stdev(values),medianMs=statistics.median(values),p95Ms=values[math.ceil(.95*len(values))-1],meanBytes=statistics.mean(r['bytes'] for r in rows),resultCount=rows[0]['count'],pages=rows[0].get('pages')))
(run/'query-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
lines=['# Steady-State Query Measurements', '', 'Local PostgreSQL with cumulative index sizes 100, 1000, and 2000; 20 warm-ups and 200 measured requests per operation, concurrency 1. Non-semantic queries; latency includes HTTP body reception and JSON decoding. SD describes within-run requests. Enumeration returns administrative index summaries.', '', '|Index size|Operation|Mean ± SD (ms)|P95 (ms)|Mean response bytes|Result count|', '|---:|---|---:|---:|---:|---:|']
for r in summary:
    lines.append(f"|{r['n']}|{r['mode']}|{r['meanMs']:.2f}±{r['sdMs']:.2f}|{r['p95Ms']:.2f}|{r['meanBytes']:.0f}|{r['resultCount']}|")
(run/'query-results.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
table=[r'\begin{table}[!ht]',r'\caption{Steady-state query diagnostics (ms), 200 requests per cell}',r'\label{tab:query-diagnostics}',r'\centering',r'\begin{tabular}{@{}rlrr@{}}',r'\toprule',r'Index & Operation & Mean $\pm$ SD & P95 \\',r'\midrule']
labels={'exact':'Exact DID','limit20':'Capability, 20','limit50':'Capability, 50','enumeration':'Summary enumeration'}
for r in summary:
    table.append(f"{r['n']} & {labels[r['mode']]} & ${r['meanMs']:.2f}\\pm{r['sdMs']:.2f}$ & {r['p95Ms']:.2f} \\\\")
table.extend([r'\bottomrule',r'\end{tabular}',r'\end{table}'])
(run/'query-table.tex').write_text('\n'.join(table)+'\n',encoding='utf-8')
print('\n'.join(lines))
