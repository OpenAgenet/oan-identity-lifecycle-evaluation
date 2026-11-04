import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from collect_harness_metrics import extract


class HarnessMetricsTests(unittest.TestCase):
    def test_allowlist_excludes_secrets_and_observations(self):
        report = {'observations': ['token=secret'], 'scales': [dict(
            scale=10, registeredCount=10, discoveredCount=9, missingCount=1,
            privateKeyJwk={'d': 'secret'}, stageStats={'visibility.latency':
            {'p95Ms': 2, 'token': 'secret'}})]}
        result = extract(report)
        self.assertNotIn('secret', str(result))
        self.assertEqual(result['scales'][0]['missingCount'], 1)

    def test_inconsistent_or_empty_reports_rejected(self):
        for report in ({}, {'scales': [dict(registeredCount=2, discoveredCount=2, missingCount=1)]}):
            with self.assertRaises(ValueError):
                extract(report)
