# Three-Host Deployment and Workload

## Topology

| Host | Roles | Local dependencies |
|---|---|---|
| A: Windows control laptop | Driver, observers, client verification, Registrar R1 | Isolated PostgreSQL |
| B: Windows laptop | Registrar R2, Discovery D1 | Isolated PostgreSQL |
| C: Linux cloud | Root, R3, D2, CDN, Publisher | Isolated PostgreSQL and NATS JetStream |

Use existing toolchains and build each host's modules sequentially. Cloud Rust builds use one job. Record source commits, lockfiles and binary hashes before starting measurements.

## Service ports

| Host | Service | Port |
|---|---|---:|
| A | R1 | 28101 |
| B | R2 / D1 | 28101 / 28102 |
| C | Root / R3 / D2 | 28100 / 28101 / 28102 |
| C | CDN / Publisher | 28103 / 28110 |
| C | NATS / monitor | 24222 / 28222 |
| Each host | PostgreSQL, loopback only | 25432 |

Cloud data is stored under /data/oan/experiments/tetc-cross-host using the oan-tetc account and run-specific systemd units. Windows data is stored under runs/t1 with dedicated scheduled tasks. Each run uses fresh databases, configuration, identities, message namespaces and CDN storage.

Windows task users stay logged in and laptops remain powered and awake. Services use the host's available CPU and memory without additional experiment quotas. Deployment manifests identify owned processes, ports and data directories.

## Network and startup

A connects to B/C with pinned SSH host keys. The private network provides addresses for direct service communication. Configure the following connections:

1. Driver to all three Registrars.
2. Registrars to Root.
3. Root, Publisher, CDN and NATS.
4. Distribution source to both Discoveries.
5. Client/observer to both Discoveries.

Check service HTTP readiness after startup. NATS becomes ready before Publisher starts. Record network paths, HTTP baselines, clock estimates and background load. See [control-plane setup](three-host-control-plane.md).

## Functional validation

Register one new resource through each Registrar and inspect both Discoveries. Verify DID/version, document signatures, Root package evidence, candidate-package binding and the Registrar credential.

The N=100 pilots explore concurrency 1/4/8/16. The formal matrix uses total concurrency 16.

## Workload matrix

| Total new resources | R1 / R2 / R3 | Repeats |
|---:|---|---:|
| 30 | 10 / 10 / 10 | 5 |
| 300 | 100 / 100 / 100 | 5 |
| 1200 | 400 / 400 / 400 | 5 |
| 2000 | 667 / 667 / 666 | 5 |

Each unit starts with empty Discovery indices and submits resources across the three Registrars. Registration completes when all responses arrive; distribution completes when both Discovery index counts equal the target.

The initial detailed unit also collects query and client-verification observations. Subsequent units use registration responses and index-count completion. Store the observation mode with each unit.

## Timing and outputs

Business requests, readiness and batch observation use 1500-second timeouts. Successful operations continue immediately.

Use the driver monotonic clock. Batch registration and both-index completion begin at the first submission. Store request durations, polling observations, counts, summaries, service logs, environment records and source/binary hashes. The field allVerifiedWallMs contains the recorded completion duration; consult completionMode for detailed versus index-count observation.

Summarize five runs per size using means and sample SD. Raw run records and analysis outputs are stored under runs/t1. Stop run-owned tasks/units after collection, retaining their data and logs.
