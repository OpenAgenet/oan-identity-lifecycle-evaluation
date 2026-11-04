# Lifecycle and Paired Ablations

## Method

Three local SQLite deployments each register ten identities, update the same DIDs, and inspect exact-DID Discovery results and Root version archives. Each deployment also records a Root Discovery-grant contraction/restoration, revokes its Registrar, and submits ten subsequent admission requests.

Root ablation compares the Registrar-signed upstream-envelope verification enabled and omitted. Registrar authorization, submission shape, document proof and routing checks remain enabled.

Discovery ablation first indexes validated packages, then narrows the local exposure domains and compares exact-DID output filtering enabled and omitted. Paired ablations execute service test functions with matched controls.

## Results

| Experiment | Samples/events | Outcome |
|---|---:|---|
| Register through Root, Publisher/NATS, CDN and exact-DID Discovery | 3 runs x 10 new identities | 30/30 visible |
| Update the same DID; inspect current candidate and both Root versions | 30 updates | 30/30 |
| Root Discovery-grant contraction/restoration | One of each per deployment | 3 contractions and 3 restorations recorded at Root |
| New admissions after experiment Registrar revocation | 3 events x 10 requests | 30/30 rejected because Registrar was unauthorized |
| Historical resources after Registrar revocation | One check per deployment | 3/3 remain discoverable |
| Root valid controls | 3 rounds x 10 | Full and omitted-check conditions accept 30/30 |
| Root missing signature, invalid signature, modified body | 3 rounds x 10 per category | Full rejects all; omission accepts those inputs at the tested boundary |
| Discovery in-scope controls | 3 rounds x 10 | Both conditions return 30/30 |
| Discovery out-of-scope candidates | 3 rounds x 10 | Full returns 0/30; omission returns 30/30 |

## Execution

Prepare service revisions containing the named test functions and configure local fixture bindings. Required local ports are 8000/8001/8002/8003/8010/4222; use dedicated service data directories.

```powershell
npm run build
node dist/src/lifecycle.js runs/new-lifecycle-run
$env:OAN_EVALUATION_OUTPUT_DIR = (Resolve-Path runs/new-lifecycle-run).Path
cargo test --release --manifest-path ../oan-root-services/Cargo.toml -p root-node evaluation_root_upstream_paired -- --nocapture
cargo test --release --manifest-path ../oan-discovery-node/Cargo.toml -p discovery-node evaluation_discovery_query_paired -- --nocapture
python scripts/summarize_mechanisms.py runs/new-lifecycle-run
```

Measurements were collected on 2026-10-28 under `runs/corrected-lifecycle-ablation-20261028`.
