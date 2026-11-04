# Steady-State Query Results

Local evidence: runs/query-specialist-1793197965762. See the [query method](query-specialist-method.md). Three index-set checkpoints and twelve groups of two hundred measured requests give 2400 observations; twenty warm-ups per group are excluded.

One PostgreSQL deployment accumulates 100, 1000 and 2000 resources. Queries are nonsemantic, warmed and sequential. Timing includes HTTP reception/JSON decoding; SD is within-run sample variation. Enumeration returns administrative index summaries.

| Index size | Operation | Mean +/- SD (ms) | P95 (ms) | Mean response bytes | Results |
|---:|---|---:|---:|---:|---:|
|100|exact|1.53±0.38|2.27|1919|1|
|100|limit20|48.40±2.63|52.92|35908|20|
|100|limit50|48.37±2.53|52.57|89563|50|
|100|enumeration|9.98±2.88|17.20|55955|100|
|1000|exact|1.27±0.27|1.79|1919|1|
|1000|limit20|540.76±27.78|596.38|35890|20|
|1000|limit50|534.36±28.17|577.05|89512|50|
|1000|enumeration|101.66±9.94|121.70|560929|1000|
|2000|exact|1.27±0.54|1.75|1919|1|
|2000|limit20|704.58±45.52|785.46|35891|20|
|2000|limit50|1172.49±93.22|1375.65|89556|50|
|2000|enumeration|209.27±11.91|228.26|1123029|2000|

## Interpretation

Exact-DID lookup remains approximately 1-2 ms across these sizes. Common-tag retrieval increases with internal candidate processing despite bounded output. At 2000 indexed resources, the two query limits process 1000 and 2000 candidates respectively.

Enumeration requires 1/10/20 pages at the three sizes. The recorded bytes and duration cover all pages.
