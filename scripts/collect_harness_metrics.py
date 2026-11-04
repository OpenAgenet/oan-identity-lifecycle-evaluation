import argparse
import json
from pathlib import Path

FIELDS = ('scale', 'registeredCount', 'discoveredCount', 'missingCount',
          'registrationWallMs', 'totalWallMs', 'registrationThroughputPerSec',
          'endToEndThroughputPerSec', 'concurrency')


def extract(report):
    rows = []
    for item in report.get('scales', []):
        row = {key: item[key] for key in FIELDS if key in item}
        if not all(key in row for key in ('registeredCount', 'discoveredCount', 'missingCount')):
            raise ValueError('incomplete resource counts')
        if row['registeredCount'] != row['discoveredCount'] + row['missingCount']:
            raise ValueError('inconsistent resource counts')
        stages = item.get('stageStats', {})
        row['visibilityLatency'] = {
            key: value for key, value in stages.get('visibility.latency', {}).items()
            if key in ('count', 'minMs', 'maxMs', 'p50Ms', 'p95Ms', 'p99Ms', 'meanMs')
        }
        rows.append(row)
    if not rows:
        raise ValueError('report contains no completed scales')
    return {'measurementClass': 'functional-or-pilot', 'scales': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    result = extract(json.loads(args.report.read_text(encoding='utf-8')))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
