# Five Repeated Performance Sweeps

Each scenario resets between repeats and accumulates scale steps in the same order within a repeat. SD is the sample standard deviation. P95 statistics summarize five per-run P95 values, not a pooled-request P95.

| Scenario | Resources | Registration/s mean +/- SD | Min-max | Visibility P95 s mean +/- SD | Missing |
|---|---:|---:|---:|---:|---:|
| pipeline-benchmark | 10 | 8.65 ± 1.32 | 7.16–9.93 | 2.625 ± 0.312 | 0 |
| pipeline-benchmark | 50 | 16.27 ± 2.22 | 12.40–17.94 | 2.993 ± 0.493 | 0 |
| pipeline-benchmark | 100 | 17.32 ± 2.02 | 13.78–18.60 | 4.322 ± 0.696 | 0 |
| pipeline-benchmark | 200 | 17.65 ± 1.91 | 14.33–18.96 | 5.006 ± 0.599 | 0 |
| pipeline-benchmark | 500 | 17.39 ± 1.55 | 14.68–18.51 | 15.535 ± 1.361 | 0 |
| pipeline-benchmark | 1000 | 17.03 ± 1.58 | 14.29–18.13 | 9.119 ± 3.413 | 0 |
| pipeline-benchmark | 2000 | 16.99 ± 1.62 | 14.16–18.32 | 9.323 ± 3.530 | 0 |
| multi-node-pipeline-benchmark | 30 | 10.98 ± 1.09 | 9.34–11.84 | 3.300 ± 0.246 | 0 |
| multi-node-pipeline-benchmark | 300 | 15.69 ± 1.67 | 14.10–17.96 | 7.191 ± 0.583 | 0 |
| multi-node-pipeline-benchmark | 1200 | 15.90 ± 1.47 | 14.20–17.47 | 17.510 ± 2.775 | 0 |
| mixed-pipeline-benchmark | 40 | 14.15 ± 1.79 | 12.28–16.15 | 2.868 ± 0.163 | 0 |
| mixed-pipeline-benchmark | 100 | 16.53 ± 1.96 | 14.25–18.51 | 3.510 ± 0.444 | 0 |
| mixed-pipeline-benchmark | 200 | 16.42 ± 2.16 | 13.81–18.65 | 4.420 ± 0.579 | 0 |
| mixed-pipeline-benchmark | 500 | 16.30 ± 2.15 | 13.78–18.38 | 13.878 ± 1.981 | 0 |
| mixed-pipeline-benchmark | 1000 | 16.51 ± 1.79 | 14.06–18.04 | 8.483 ± 3.078 | 0 |
| multi-node-mixed-pipeline-benchmark | 60 | 14.64 ± 1.55 | 12.69–16.00 | 3.863 ± 0.342 | 0 |
| multi-node-mixed-pipeline-benchmark | 150 | 16.17 ± 2.04 | 13.60–18.47 | 6.117 ± 0.590 | 0 |
| multi-node-mixed-pipeline-benchmark | 300 | 16.24 ± 1.81 | 13.87–17.76 | 15.088 ± 2.706 | 0 |
| multi-node-mixed-pipeline-benchmark | 600 | 16.11 ± 1.75 | 14.10–17.88 | 19.266 ± 2.150 | 0 |
| multi-node-mixed-pipeline-benchmark | 1000 | 15.86 ± 1.89 | 13.56–17.61 | 20.620 ± 2.354 | 0 |

## Method

Scale and concurrency follow the baseline sweep. First visibility ends at the driver's first index observation; final completeness is checked separately across Discoveries.

In repeats 2 and 4, the multi-node mixed driver exited with status 3221226505 / 0xC0000409. The affected scenario was reset and rerun; the table uses five complete samples per configuration. Original attempt records are retained.

Services and cryptographic helpers used release builds with matching baseline binary hashes. Each repeat also exercised authorization isolation, registration credentials and 25 negative conditions. Logs and per-run values are stored in local run/report directories.
