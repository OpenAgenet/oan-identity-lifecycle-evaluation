import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class QuerySummaryTests(unittest.TestCase):
    def invoke(self,rows):
        with tempfile.TemporaryDirectory() as folder:
            run=Path(folder)
            (run/'query-evidence.json').write_text(json.dumps({'raw':rows}),encoding='utf-8')
            result=subprocess.run([sys.executable,str(ROOT/'scripts/summarize_queries.py'),str(run)],capture_output=True,text=True,encoding='utf-8',env={**os.environ,'PYTHONIOENCODING':'utf-8'})
            summary=json.loads((run/'query-summary.json').read_text(encoding='utf-8')) if result.returncode==0 else None
            return result,summary

    def test_complete_groups_and_nearest_rank(self):
        rows=[dict(n=n,mode=mode,ms=i+1,bytes=100,count={'exact':1,'limit20':20,'limit50':50,'enumeration':n}[mode])
              for n in [100,1000,2000] for mode in ['exact','limit20','limit50','enumeration'] for i in range(200)]
        result,summary=self.invoke(rows)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(len(summary),12)
        self.assertEqual(summary[0]['meanMs'],100.5)
        self.assertEqual(summary[0]['p95Ms'],190)

    def test_partial_evidence_cannot_be_reported_complete(self):
        result,_=self.invoke([])
        self.assertNotEqual(result.returncode,0)
        self.assertIn('incomplete group',result.stderr)
