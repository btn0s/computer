# Computer: Slack-Native AI Agent Harness

## Problem

Cursor's first-party Slack integration is workspace-wide—one repo, one config. Teams working across multiple repositories can't scope agent behavior per channel. Every request requires manually specifying context that the channel already implies.

## Solution

**Computer** adds per-channel configuration. Bind `#frontend` to one repo, `#backend` to another. Mention `@Computer` and it uses that channel's settings—repo, branch, model—without any inline config.

## Architecture

```
Slack @mention → Resolver → Cursor Background Agent → PR → Slack thread update
```

- **Fastify + TypeScript** for the runtime
- **Prisma + PostgreSQL** for multi-workspace state
- **Slack Bolt** with OAuth for workspace isolation
- **Cursor API client** with polling and webhook support

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Per-channel repo binding | Eliminates inline config; channels already have context |
| Per-workspace API keys | Security isolation; teams control their own Cursor access |
| Slack-only config UI | No separate dashboard to maintain; meets users where they are |
| Inline overrides (`--branch`, `--model`) | Power users get flexibility without UI complexity |

## Outcome

A complete, deployable Slack app in ~2,500 LOC. Ships with Docker, Fly.io config, and full documentation. Open source under MIT.

## Stack

TypeScript · Fastify · Prisma · PostgreSQL · Slack Bolt · Cursor Background Agents API · Fly.io
