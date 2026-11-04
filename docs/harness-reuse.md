# Scenario Configuration

Drivers use workspace helpers for service configuration, signed identity fixtures, startup, registration and observation.

- Set OAN_AGENT_PY_ROOT to the Python demo host, normally `oan-demos/runtime/agent-py`.
- Supply PostgreSQL credentials through local configuration or OAN_BENCH_POSTGRES_PASSWORD.
- OAN_BENCH_BUILD_PROFILE selects build flags and binary paths; performance drivers default to release.
- Explicit scale arguments override inherited scenario scale variables. Agent-only multi-Registrar helper scales are per Registrar; mixed-resource scales are totals.
- Single-host sweeps reset each scenario between repeats and accumulate scale steps within a repeat. Cross-host units use fresh instances and data.

See [module execution](module-execution.md) for entry points.
