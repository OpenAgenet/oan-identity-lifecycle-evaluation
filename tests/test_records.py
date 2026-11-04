import sys
from pathlib import Path
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import run_records as m
class RecordsTests(unittest.TestCase):
    def event(self):
        return dict(runId='r',scenario='registration',node='d1',subject='anonymous-1',version='1',startNs=1,endNs=2,expected='accepted',actual='timeout',scope='end-to-end')
    def test_timeout_preserved(self):
        self.assertEqual(m.validate_event(self.event())['actual'],'timeout')
    def test_reverse_time(self):
        e=self.event();e['endNs']=0
        with self.assertRaises(ValueError):m.validate_event(e)
    def test_empty_not_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'events';p.write_text('',encoding='utf-8')
            with self.assertRaises(ValueError):m.check_events(p)
    def test_prepare_no_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            config=Path(__file__).resolve().parents[1]/'configs/experiment.json'
            result=m.prepare('smoke',config,Path(folder))
            self.assertEqual(result['state'],'prepared-not-executed')
            with self.assertRaises(FileExistsError):m.prepare('smoke',config,Path(folder))
    def test_path_escape_rejected(self):
        with self.assertRaises(ValueError):m.prepare('../outside','unused')
