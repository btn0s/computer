# Computer: Slack-Native AI Agent Harness

## Problem

Engineering teams want AI agents to handle routine implementation tasks—but context-switching between Slack discussions and separate AI tools creates friction. Cursor's Background Agents API enables autonomous coding, but lacks native team collaboration workflows.

## Solution

**Computer** bridges Slack and Cursor Background Agents. Bind a channel to a GitHub repo, mention `@Computer` with a request, and it dispatches an agent to implement and open a PR—all without leaving Slack.

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
