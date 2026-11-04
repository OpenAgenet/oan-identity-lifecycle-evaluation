# Laptop Setup

1. Clone the experiment and service repositories; record source commits and toolchain versions.
2. Configure SSH public-key access using the [control-plane guide](three-host-control-plane.md).
3. Collect the host environment with `python scripts/evaluate.py environment --output runs/environment.json`.
4. Keep the laptop powered, logged in and awake during scheduled-task execution.
5. Configure separate service directories, ports, PostgreSQL databases, identities and firewall rules.
6. Verify Registrar-to-Root, distribution and client-to-Discovery connections.
7. Register one resource and verify its signed evidence before starting workload runs.

Record task names, executable paths, process IDs, ports and data directories for deployment and cleanup.
