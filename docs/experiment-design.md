# Experiment Design

## Workloads

| Group | Measurements |
|---|---|
| Lifecycle | Registration, document updates, Root version archives, Registrar revocation, subsequent admission decisions |
| Verification | Valid controls and 25 invalid conditions |
| Authorization | Registrar admission and Discovery domain filtering |
| Performance | Batch registration throughput, first visibility, query latency and response size |
| Ablations | Paired decisions with full checks and a selected mechanism omitted |
| Cross-host | Registration and distribution through three Registrars and two Discoveries |

## Topologies

T0 places logical nodes on one Windows host. T1 uses laptop A for the driver/client and Registrar R1, laptop B for Registrar R2 and Discovery D1, and a Linux cloud host for Root, R3, D2, CDN, Publisher and NATS. PostgreSQL instances are node-local.

Record source commits, lockfiles, binary hashes, toolchain versions, hardware, configuration, concurrency, database state, and background load. Build services before measurement.

## Lifecycle and ablations

Three local deployments each register ten identities, submit updated documents for those DIDs, and inspect the current Discovery version and both Root archives. Each deployment revokes its Registrar and submits ten additional admission requests. Discovery-grant contraction and restoration are recorded at Root.

Root ablation compares upstream-envelope verification enabled and omitted, retaining Registrar authorization, submission shape, document proof and routing checks. Discovery ablation compares exact-DID output-domain filtering enabled and omitted on validated indexed packages. Both use matched inputs and service test functions.

See [lifecycle and ablation results](completed-lifecycle-ablation.md).

## Performance

Single-host sweeps cover agent-only and equal-share mixed agent services, Skills, MCP servers and tool-API resources, with one Registrar/one Discovery or three Registrars/two Discoveries. Five repeats reset each scenario; scale steps accumulate within each repeat. Scale and concurrency follow the scenario configuration.

T1 uses total batches 30/300/1200/2000, five runs each, concurrency 16. Each run uses fresh identities, databases and message/storage namespaces. Detailed functional verification checks signed evidence; subsequent workload units register resources and observe both Discovery index counts.

Steady-state queries accumulate 100/1000/2000 resources, validate the index, stop registration, then execute 20 warm-ups and 200 measured requests per operation at concurrency one. Operations are exact DID, capability retrieval with limits 20/50, and administrative-summary enumeration.

## Metrics

- Per-resource registration time: submission to Registrar response.
- Batch registration time: first submission to all registration responses.
- Registration throughput: batch size divided by batch registration time.
- First visibility: resource submission to first observed Discovery index availability.
- Cross-host completion: first submission to both Discovery indices reaching the target count.
- Query time: client HTTP dispatch through full response reception and JSON decoding.

Use monotonic timing. Record polling intervals and request durations. T1 business and readiness timeouts are 1500 seconds.

Five-run summaries use means and sample SD (ddof=1). P95 summaries use five per-run P95 values. Query statistics use within-run requests.

## Output

Each run stores configuration and environment records, requests, observations, counts, logs, metrics, source/binary hashes, and summary files. Use separate service directories, ports, accounts, databases, message namespaces and identities for each deployment.

