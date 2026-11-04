import importlib.util
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('evaluation',ROOT/'scripts/evaluate.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class PlanningTests(unittest.TestCase):
    def config(self):
        return json.loads((ROOT/'configs/experiment.json').read_text(encoding='utf-8'))
    def test_allocations_and_repetitions(self):
        rows=m.plan(self.config())['performanceCells']
        self.assertEqual(len(rows),95)
        for row in rows:
            self.assertEqual(sum(row['registrarAllocation']),row['totalResources'])
            self.assertLessEqual(max(row['registrarAllocation'])-min(row['registrarAllocation']),1)
            self.assertEqual(row['status'],'planned')
    def test_required_scale(self):
        c=self.config();c['totalResourceScales']['single'].remove(2000)
        with self.assertRaises(ValueError):m.validate(c)
    def test_invalid_scale(self):
        c=self.config();c['totalResourceScales']['multi']=[0]
        with self.assertRaises(ValueError):m.validate(c)

    def test_reproducible_plan(self):
        self.assertEqual(m.plan(self.config()),m.plan(self.config()))
    def test_role_overlap_rejected(self):
        c=self.config();c['hosts']['cloud']['roles'].append('registrar-1')
        with self.assertRaises(ValueError):m.validate(c)
    def test_credentials_in_url_rejected(self):
        c=self.config();c['serviceEndpoints']['root']='https://user:secret@example.org'
        with self.assertRaises(ValueError):m.validate(c)
    def test_unsupported_not_promoted(self):
        c=self.config();c['capabilities']['resource-revocation']['status']='unsupported'
        cells=m.plan(c)['lifecycleCells']
        self.assertTrue(all(x['capability']=='unsupported' for x in cells if x['scenario']=='resource-revocation'))
        self.assertFalse(m.readiness(c)['readyToRun'])
    def test_supported_requires_evidence(self):
        c=self.config();c['capabilities']['resource-revocation']['status']='supported'
        with self.assertRaises(ValueError):m.validate(c)

    def test_ablation_isolation_required(self):
        c=self.config();c['ablation']['buildPolicy']['productionDeploymentForbidden']=False
        with self.assertRaises(ValueError):m.validate(c)
    def test_service_side_ablation_planned(self):
        rows=m.plan(self.config())['ablationCells']
        self.assertEqual(len(rows),4)
        self.assertEqual(
            {x['mechanism'] for x in rows},
            {'root-upstream-signature-binding','discovery-authorization-filter'}
        )
        self.assertTrue(all(x['executionScope']=='actual-service-path' for x in rows))
