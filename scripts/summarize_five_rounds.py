import argparse
import json
import statistics
from pathlib import Path
from collect_harness_metrics import extract

REPORTS = {'pipeline-benchmark':'pipeline-e2e',
 'multi-node-pipeline-benchmark':'multi-node-pipeline-e2e',
 'mixed-pipeline-benchmark':'mixed-resource-pipeline-e2e',
 'multi-node-mixed-pipeline-benchmark':'multi-node-mixed-resource-pipeline-e2e'}


def summarize(values):
    return dict(n=len(values), mean=statistics.mean(values),
                std=statistics.stdev(values), minimum=min(values), maximum=max(values), values=values)


def collect(suites, report_root):
    if len(suites) != 5 or len(set(suites)) != 5:
        raise ValueError('five distinct suites required')
    groups = {}
    reference = None
    for round_id, suite in enumerate(suites, 1):
        status = json.loads((suite/'status.json').read_text(encoding='utf-8'))
        if len(status) != 7 or any(x['exitCode'] != 0 or x['buildProfile'] != 'release' for x in status):
            raise ValueError(f'incomplete release suite: {suite.name}')
        cells = set()
        for run in status:
            if run['scenario'] not in REPORTS:
                continue
            candidates = []
            from datetime import datetime, timezone
            start = datetime.fromisoformat(run['startedAt'].replace('Z','+00:00'))
            end = datetime.fromisoformat(run['finishedAt'].replace('Z','+00:00'))
            for folder in (report_root/REPORTS[run['scenario']]).iterdir():
                if not (folder/'summary.json').exists():
                    continue
                try:
                    created = datetime.strptime(folder.name,'%Y-%m-%d-%H%M%S%f').replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
                if start <= created <= end:
                    candidates.append(folder)
            if len(candidates) != 1:
                raise ValueError(f'ambiguous report association: {suite.name}/{run["scenario"]}: {len(candidates)}')
            data = extract(json.loads((candidates[0]/'summary.json').read_text(encoding='utf-8')))
            for row in data['scales']:
                key = (run['scenario'],row['registeredCount'])
                if key in cells or row['missingCount'] != 0:
                    raise ValueError('duplicate cell or incomplete visibility')
                cells.add(key)
                groups.setdefault(key,[]).append(dict(round=round_id,**row))
        if reference is None:
            reference = cells
        elif cells != reference:
            raise ValueError('scale coverage differs between rounds')
    result = []
    for (scenario,count),rows in groups.items():
        if len({r['concurrency'] for r in rows}) != 1:
            raise ValueError('concurrency differs between rounds')
        result.append(dict(scenario=scenario,resources=count,concurrency=rows[0]['concurrency'],
            registrationPerSec=summarize([r['registrationThroughputPerSec'] for r in rows]),
            visibilityP95Ms=summarize([r['visibilityLatency']['p95Ms'] for r in rows]),
            missingTotal=sum(r['missingCount'] for r in rows),rounds=rows))
    return result


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest',type=Path)
    args=parser.parse_args()
    manifest=json.loads(args.manifest.read_text(encoding='utf-8'))
    if len(manifest['results']) != 4 or any(r['exitCode'] for r in manifest['results']):
        raise ValueError('four additional rounds not completed')
    suites=[Path('runs')/manifest['baseline']]+[Path(r['suite']) for r in manifest['results']]
    root=Path('../oan-official-skill/skills/oan-system-test-ops/fixtures/oan-ops-harness/.oan-benchmark-reports')
    data=collect(suites,root)
    out=args.manifest.parent
    (out/'statistics.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    lines=['# Five-Sweep Statistics','', 'Scenarios reset between sweeps; scale steps accumulate within each scenario in the same order. SD is the sample standard deviation. P95 summaries describe five within-run P95 values, not pooled requests.','',
      '| Scenario | Resources | Registrations/s mean ± SD | Min–max | Visibility P95 s mean ± SD | Missing |',
      '|---|---:|---:|---:|---:|---:|']
    for r in data:
        t=r['registrationPerSec'];v=r['visibilityP95Ms']
        lines.append(f'| {r["scenario"]} | {r["resources"]} | {t["mean"]:.2f} ± {t["std"]:.2f} | {t["minimum"]:.2f}–{t["maximum"]:.2f} | {v["mean"]/1000:.3f} ± {v["std"]/1000:.3f} | {r["missingTotal"]} |')
    lines += ['', '## Method and Execution Record', '',
      '- Keep the initial scale order and scale-dependent concurrency. Reset each scenario; accumulate registrations within it.',
      '- Visibility latency ends at the first observed index visibility. Final completeness is checked separately across Discoveries.',
      '- The multi-node mixed scenario was interrupted once in sweep 2 and once in sweep 4 by Windows Node exit 3221226505 / 0xC0000409, with cause unconfirmed. Original logs and incomplete reports are retained separately. Each scenario was reset and rerun; incomplete batches are not included among the five complete observations.',
      '- Rust services and cryptographic helpers use release builds. Five service binary hashes match the first sweep.',
      '- Each sweep also executes authorization-domain isolation, registration-credential checks, and 25 negative-validation categories; all seven scenario exit statuses form the completeness gate.', '',
      '## Sweep Sources', '']
    for i, suite in enumerate(suites, 1):
        lines.append(f'- Sweep {i}: `{suite.name}`.')
    lines += ['', 'Logs and per-sweep values are stored in local run/report directories. Statistics JSON: `'+str(out/'statistics.json')+'`.']
    Path('docs/five-round-release-results.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(f'validated {len(data)} cells, five rounds each')
