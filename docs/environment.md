# Experiment Environment

| Host | Configuration |
|---|---|
| Laptop A | Intel Core Ultra 9 285H, 16 cores/logical processors, 33,752,997,888 bytes RAM (31.44 GiB), Windows 11 Home 10.0.26200 |
| Laptop B | Collect CPU, RAM, OS and toolchain details using the environment command on that host |
| Cloud | ecs.u2a-c1m2.xlarge, four vCPUs, 8 GB RAM, Ubuntu 22.04 x64, Hong Kong, 120 GiB system disk, 300 GiB data disk, provisioned bandwidth 5120 Kbps |

The laptop A configuration was collected on 2026-10-28. Single-host toolchain versions were Node 24.15.0 and Rust 1.98.1.

Collect each host's environment with:

```powershell
python scripts/evaluate.py environment --output runs/environment.json
```

Run records include OS, CPU/RAM, Node/Rust/PostgreSQL/NATS versions, source revisions, binary hashes, power/network settings, background load, clock estimates, database state and warm-up settings.
