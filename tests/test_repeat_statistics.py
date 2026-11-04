import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from summarize_five_rounds import summarize, collect


class RepeatStatisticsTests(unittest.TestCase):
    def test_sample_standard_deviation_and_all_values(self):
        result=summarize([1,2,3,4,5])
        self.assertEqual(result['n'],5)
        self.assertEqual(result['mean'],3)
        self.assertAlmostEqual(result['std'],2.5**.5)
        self.assertEqual(result['values'],[1,2,3,4,5])

    def test_repeated_or_missing_suite_rejected(self):
        with self.assertRaises(ValueError):
            collect([Path('same')]*5,Path('unused'))
        with self.assertRaises(ValueError):
            collect([],Path('unused'))
