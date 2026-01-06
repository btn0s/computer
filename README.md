# Computer

Slack-native agent harness that forwards runs to [Cursor Background Agents](https://docs.cursor.com/background-agent/api).

Bind Slack channels to GitHub repos. Mention `@Computer` with a request, and it dispatches a Cursor agent to implement it and open a PR.

## Features

- **Channel-bound repos** – Each channel maps to a single repo. No inline tags needed.
- **Per-workspace Cursor keys** – Each workspace uses their own Cursor API key.
- **Inline overrides** – `--branch=feat/x`, `--model=gpt-4o`, `--dry-run`
- **Cancel/retry controls** – Buttons in Slack threads.
- **Audit trail** – Every run records resolved context.

## Quick Start

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Under **OAuth & Permissions**, add these Bot Token Scopes:
   - `app_mentions:read`
   - `chat:write`
   - `commands`
   - `channels:read`
   - `im:history`
   - `reactions:write`
3. Under **Event Subscriptions**, subscribe to:
   - `app_mention`
4. Under **Slash Commands**, create:
   - `/computer` – Computer commands
5. Note your **Client ID**, **Client Secret**, and **Signing Secret**

### 2. Local Development

```bash
# Clone and install
git clone https://github.com/your-org/computer.git
cd computer
npm install

# Start Postgres
docker-compose up -d

# Copy env and fill in values
cp .env.example .env

# For local dev, enable Socket Mode in your Slack app and add:
# SOCKET_MODE=true
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_APP_TOKEN=xapp-...

# Run migrations
npm run db:push

# Start dev server
npm run dev
```

### 3. Production Deployment (Fly.io)

```bash
# Install flyctl
brew install flyctl

# Login and launch
fly auth login
fly launch

# Create Postgres database
fly postgres create --name computer-db
fly postgres attach computer-db

# Set secrets
fly secrets set \
  SLACK_CLIENT_ID="..." \
  SLACK_CLIENT_SECRET="..." \
  SLACK_SIGNING_SECRET="..." \
  BASE_URL="https://computer.fly.dev"

# Deploy
fly deploy
```

### 4. Install to Your Workspace

1. Visit `https://your-app-url/slack/oauth/install`
2. Approve the installation
3. Run `/computer connect` to set your Cursor API key
4. In a channel, run `/computer settings` to bind it to a repo
5. Mention `@Computer` with your request!

## Commands

| Command | Description |
|---------|-------------|
| `/computer` | Show help |
| `/computer connect` | Set Cursor API key for workspace |
| `/computer settings` | Configure current channel (repo, branch, model) |
| `/computer status` | Show channel config and recent runs |

## Usage

Mention `@Computer` in a configured channel:

```
@Computer add a health check endpoint to the API

@Computer fix the TypeScript errors in src/utils --branch=fix/types

@Computer refactor the auth middleware --dry-run
```

## Inline Overrides

| Override | Example | Description |
|----------|---------|-------------|
| `--branch=name` | `--branch=feat/api` | Override target branch |
| `--model=name` | `--model=gpt-4o` | Override model |
| `--dry-run` | `--dry-run` | Generate patch without PR |

## Architecture

```
Slack Message
    │
    ▼
┌─────────────────┐
│  Resolver       │  (workspace, channel) → config
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Orchestrator   │  Create run, call Cursor API
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cursor API     │  Background agent executes
└────────┬────────┘
         │
         ▼
    PR Created → Slack Thread Updated
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SLACK_CLIENT_ID` | Yes | Slack app client ID |
| `SLACK_CLIENT_SECRET` | Yes | Slack app client secret |
| `SLACK_SIGNING_SECRET` | Yes | Slack app signing secret |
| `BASE_URL` | Yes | Public URL of the app |
| `PORT` | No | Server port (default: 3000) |
| `SOCKET_MODE` | No | Enable Socket Mode for local dev |
| `SLACK_BOT_TOKEN` | Socket Mode | Bot token for Socket Mode |
| `SLACK_APP_TOKEN` | Socket Mode | App token for Socket Mode |

## License

MIT
