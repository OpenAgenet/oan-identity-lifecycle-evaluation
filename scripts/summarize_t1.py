import argparse
import json
import statistics
from pathlib import Path


def describe(values):
    return {'n': len(values), 'mean': statistics.mean(values),
            'std': statistics.stdev(values), 'values': values}


def collect(root):
    progress = json.loads((root / 'progress.json').read_text(encoding='utf-8'))
    plan = json.loads((root / 'plan.json').read_text(encoding='utf-8'))
    if progress['state'] != 'complete' or len(progress['completed']) != 20:
        raise ValueError('Twenty complete independent units required; no partial-data replacement')
    groups = {}
    matrix = plan.get('matrix')
    if matrix is None:
        matrix = json.loads((root.parent / 'formal-20261031e' / 'plan.json').read_text(encoding='utf-8'))['matrix']
    completed = {r['id'].split('-t1-', 1)[1]: r for r in progress['completed']}
    for item in matrix:
        run_id = completed[item['id'].removeprefix('t1-')]['id']
        folder = root.parent / run_id / 'workload'
        summary = json.loads((folder / 'summary.json').read_text(encoding='utf-8'))
        requests = json.loads((folder / 'requests.json').read_text(encoding='utf-8'))
        observations = json.loads((folder / 'observations.json').read_text(encoding='utf-8'))
        queries = json.loads((folder / 'queries.json').read_text(encoding='utf-8'))
        total = item['total']
        if summary['state'] != 'complete' or summary['total'] != total or len(requests) != total:
            raise ValueError(f'Incomplete unit: {run_id}')
        if len({r['did'] for r in requests}) != total:
            raise ValueError('Duplicate request identity')
        expected = {r['did'] for r in requests}
        endpoints = sorted({r['endpoint'] for r in observations})
        if summary.get('completionMode','').startswith('detailed-first-unit'):
            if len(observations) < total * 2: raise ValueError('Detailed first unit lacks required evidence')
        elif summary.get('completeness',{}).get('indexOnly'):
            if any(v < total for v in summary['completeness']['indexedCounts'].values()): raise ValueError('Index-only unit did not converge')
            endpoints=[]
        elif len(endpoints) != 2 or len(observations) != total * 2:
            raise ValueError('Missing required Discovery evidence')
        for endpoint in endpoints:
            rows = [r for r in observations if r['endpoint'] == endpoint]
            if {r['did'] for r in rows} != expected or any(not r['report']['valid'] for r in rows):
                raise ValueError('Invalid or incomplete identity evidence')
        query_metrics = {}
        for endpoint in endpoints:
            for mode in ['exact', 'limit20', 'enumeration']:
                rows = [r for r in queries if r['endpoint'] == endpoint and r['mode'] == mode]
                if not rows:
                    continue
                query_metrics[f'{endpoint}/{mode}'] = statistics.mean(r['ms'] for r in rows)
        groups.setdefault(total, []).append({
            'id': run_id, 'round': item['round'], 'concurrency': summary['concurrency'],
            'registrationWallSeconds': summary['registrationWallMs'] / 1000,
            'allVerifiedWallSeconds': summary['allVerifiedWallMs'] / 1000,
            'verifiedThroughputPerSecond': summary['endToEndPerSecond'],
            'meanRegistrationResponseMs': statistics.mean(r['responseMs'] for r in requests),
            'queries': query_metrics})
    output = []
    for total, rows in sorted(groups.items()):
        if len(rows) != 5 or {r['round'] for r in rows} != set(range(1, 6)):
            raise ValueError('Five independent rounds per scale required')
        metrics = {key: describe([r[key] for r in rows]) for key in
                   ['registrationWallSeconds', 'allVerifiedWallSeconds',
                    'verifiedThroughputPerSecond', 'meanRegistrationResponseMs']}
        query_metrics = {}
        output.append({'total': total, 'metrics': metrics, 'queries': query_metrics, 'runs': rows})
    if len({r['concurrency'] for g in output for r in g['runs']}) != 1:
        raise ValueError('Concurrency differs between formal units')
    return output


def plot(data, output):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams.update({'font.family': 'sans-serif', 'font.size': 10,
                         'axes.prop_cycle': plt.cycler(color=['#0072BD', '#D95319', '#EDB120', '#7E2F8E']),
                         'axes.grid': True, 'grid.alpha': .22, 'pdf.fonttype': 42,
                         'axes.spines.top': True, 'axes.spines.right': True})
    x = [g['total'] for g in data]
    fig, axes = plt.subplots(1, 2, figsize=(7.2, 2.8), layout='constrained')
    for ax, metric, ylabel in zip(axes,
            ['allVerifiedWallSeconds', 'verifiedThroughputPerSecond'],
            ['Registration-to-index completion (s)', 'Indexed resources / s']):
        ax.errorbar(x, [g['metrics'][metric]['mean'] for g in data],
                    yerr=[g['metrics'][metric]['std'] for g in data], fmt='o-', capsize=3, linewidth=1.3)
        for g in data:
            ax.scatter([g['total']] * 5, g['metrics'][metric]['values'], s=12, alpha=.45)
        ax.set_xlabel('Total newly registered resources'); ax.set_ylabel(ylabel)
    fig.savefig(output / 't1-pipeline.pdf', bbox_inches='tight'); plt.close(fig)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('formal_directory', type=Path)
    args = parser.parse_args()
    data = collect(args.formal_directory)
    output = args.formal_directory / 'analysis'
    output.mkdir(exist_ok=False)
    (output / 'statistics.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
    lines = ['# Three-host agent pipeline: five independent runs per scale', '',
             'Mean ± sample standard deviation (ddof=1). Completion uses two Discovery index counts in later units; the first detailed unit includes client evidence verification.', '',
             '| Total resources | Registration wall (s) | All verified wall (s) | Verified resources/s |',
             '|---:|---:|---:|---:|']
    for g in data:
        cells = [f"{g['metrics'][key]['mean']:.3f} ± {g['metrics'][key]['std']:.3f}" for key in
                 ['registrationWallSeconds', 'allVerifiedWallSeconds', 'verifiedThroughputPerSecond']]
        lines.append('| ' + str(g['total']) + ' | ' + ' | '.join(cells) + ' |')
    (output / 'results.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    plot(data, output)
