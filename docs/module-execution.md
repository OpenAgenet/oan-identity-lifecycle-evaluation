# Experiment Execution

## HTTP modules

```powershell
npm run build
npm run experiment -- validate .local/query.json
npm run experiment -- run .local/query.json
python scripts/analyze_requests.py runs/query-pilot/requests.jsonl --output runs/query-pilot/http-summary.json
```

Replace REPLACE placeholders in `configs/modules/`. Configure endpoint URLs, expected status codes, JSON Pointer assertions, concurrency and observation settings. Credentials are referenced through headerEnv. Use separate experiment service instances and databases.

Registration submits SDK-signed material; observation cases inspect exact DID/version results. Query supports warm-ups and repetitions. Other modules use warmup=0 and repetitions=1. Lifecycle executes ordered cases with concurrency=1. Negative and authorization modules accept paired cases. Ablation manifests contain the variant, source commit and binary hash.

Outputs include requests.jsonl and summary.json. Each request records timing and configured assertion outcomes.

## Scenario drivers

`src/harness.ts` and `src/suite.ts` execute service scenarios. Select a single scale with:

```powershell
node dist/src/harness.js SCENARIO postgres SCALE
```

Scenarios include `trusted-negative`, `authorized-domain-isolation`, `service-registration-vc` and the pipeline workloads. Configure workspace fixture paths before execution.

Dedicated drivers provide [lifecycle and ablations](completed-lifecycle-ablation.md), [steady-state queries](query-specialist-method.md), [repeated sweeps](five-round-release-results.md), and [cross-host workloads](three-host-experiment-plan.md).
