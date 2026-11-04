# OAN Identity Lifecycle Evaluation

TypeScript experiment drivers, Python analysis scripts, configuration templates, and result summaries for OAN identity lifecycle and discovery evaluation.

## Experiments

| Experiment | Entry points | Documentation |
|---|---|---|
| Lifecycle correctness | `src/lifecycle.ts` | [Lifecycle and ablations](docs/completed-lifecycle-ablation.md) |
| Negative verification | `src/harness.ts`, scenario `trusted-negative` | [Execution](docs/module-execution.md) |
| Authorization-aware discovery | `src/harness.ts`, scenario `authorized-domain-isolation` | [Execution](docs/module-execution.md) |
| Repeated performance sweeps | `src/release-suite.ts`, `src/repeat-release.ts` | [Results](docs/five-round-release-results.md) |
| Steady-state queries | `src/query-specialist.ts`, `scripts/summarize_queries.py` | [Method](docs/query-specialist-method.md), [results](docs/query-specialist-results.md) |
| Cross-host pipeline | `src/t1-*.ts`, `scripts/summarize_t1.py` | [Deployment and workload](docs/three-host-experiment-plan.md) |
| Paired ablations | `scripts/summarize_mechanisms.py` | [Method and results](docs/completed-lifecycle-ablation.md) |

## Setup

Use Node.js 24, Python 3, Rust, and the PostgreSQL/NATS dependencies required by the selected topology. Place the OAN service repositories and TypeScript SDK alongside this repository. Configure workspace paths and fixture bindings in the selected driver.

```powershell
npm ci
npm test
python -m unittest discover -s tests
```

Complete the templates in `configs/` with experiment endpoints and local credential references. Run commands and output formats are documented in [module execution](docs/module-execution.md). See [environment](docs/environment.md) and [three-host control plane](docs/three-host-control-plane.md) for deployment details.

Run outputs are stored in `runs/`; local configuration is stored in `.local/`. Both directories are ignored by Git.

OAN service repositories: [OpenAgenet](https://github.com/OpenAgenet).

