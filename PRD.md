# Computer – Agent Harness PRD

## Problem

Operators in a single Slack workspace manage several unrelated projects. Requiring inline repo tags for each message is brittle and creates a clear wrong‑repo risk. Channels need persistent context so that requests resolve safely and automatically.

## Goal

Computer is defined as a workspace‑native agent harness that deterministically forwards every run to a cursor‑cloud CLI agent for execution. Slack and Discord act only as configuration and input surfaces.

## Core Loop

Message arrives → identify (workspace_id, channel_id) → load channel config → parse optional overrides → resolve final run context → enqueue run → Cursor‑cloud CLI agent executes against repo → publish artifacts back to thread.

## Data Model

**Config Table** (keyed by workspace_id + channel_id)

- repo_full_name
- default_branch
- model_id
- tool_policy
- secrets_refs
- updated_by
- updated_at

**Run Table**

- run_id
- channel_id
- thread_ts
- resolved_repo
- resolved_branch
- resolved_model
- status
- logs_pointer
- pr_url
- error

## Features

- Per‑channel settings via `/computer settings` modal with explicit fields.
- Project status view via `/computer status`.
- Cancel and rerun controls surfaced in chat.
- Clear precedence rules recorded for each run.
- Dry‑run option that produces a patch without pushes.
- Command allowlist and path allowlist enforcement.
- Ephemeral isolation boundary per run.

## Non‑Goals (v1)

- No roaming internet behavior.
- No multi‑tenant billing platform.
- No IDE replacement.

## Milestones

- **POC:** append‑line edit and PR creation from one bound channel.
- **Harden:** support inline overrides and audit of resolved context.
- **Scale:** workspace project registry and Discord adapter.

## Success Criteria

- Zero pushes to unbound repos.
- Every run records resolved context.
- Config changes limited to authorized roles.
- Sub‑second acknowledgment in chat.

---

**Cursor Execution Target**
All repo operations and code changes are executed by a Cursor‑cloud CLI agent. Computer maintains lifecycle state and never bypasses the resolver or allowlist layers.
