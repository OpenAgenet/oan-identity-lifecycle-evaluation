# Steady-State Query Method

## Workload

Accumulate 100, 1000 and 2000 unique resources through Registrar, Root, distribution and Discovery using local PostgreSQL. At each stage validate the indexed DID set, stop registration, then measure. Preparation uses concurrency eight.

At each index size, execute 20 warm-ups followed by 200 measured requests at concurrency one for each operation:

- exact: Discovery query by DID, one result.
- limit20: common capability-tag query, twenty results.
- limit50: the same query, fifty results.
- enumeration: administrative index summaries, one hundred per page; traverse afterCursor/afterResourceDid and validate the complete DID set.

## Measurement

Client monotonic timing covers HTTP dispatch, full response reception and JSON decoding. Record latency, uncompressed response bytes, result count and page count. Enumeration sums all pages. Compute mean, sample SD, median and nearest-rank P95.

Measurements use warmed, sequential, local-loopback nonsemantic queries on one deployment. SD describes the 200 requests in each group.

The exact-DID path reads one resource. Common-tag candidate processing precedes output truncation; the candidate cap is clamp(limit*50, 200, 5000). With 2000 indexed resources, limit20 processes up to 1000 candidates and limit50 up to 2000.

## Execution

Configure local fixture bindings and PostgreSQL credentials in .local/postgres.local.json or the environment. The setup resets local oan_bench_* databases; use dedicated experiment databases and run serially.

```powershell
npm run build
node dist/src/query-specialist.js
python scripts/summarize_queries.py RUN_DIRECTORY
```

Outputs are stored under runs/query-specialist-TIMESTAMP, including query-evidence.json, query-summary.json, query-results.md and query-table.tex.
