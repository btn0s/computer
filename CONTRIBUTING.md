# Contributing to Computer

Thanks for your interest in contributing to Computer! This document outlines how to get started.

## Development Setup

### Prerequisites

- Node.js 20+
- Docker (for local Postgres)
- A Slack workspace where you can install test apps

### Getting Started

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/computer.git
   cd computer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start local Postgres**

   ```bash
   docker-compose up -d
   ```

4. **Set up environment**

   ```bash
   cp .env.example .env
   # Edit .env with your Slack app credentials
   ```

5. **Run database migrations**

   ```bash
   npm run db:push
   ```

6. **Start development server**

   ```bash
   npm run dev:socket  # Socket Mode for local development
   ```

### Creating a Test Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app from scratch
3. Enable Socket Mode (Settings → Socket Mode)
4. Add Bot Token Scopes: `app_mentions:read`, `chat:write`, `commands`, `channels:read`, `im:history`
5. Subscribe to Events: `app_mention`
6. Create Slash Command: `/computer`
7. Install to your workspace
8. Copy tokens to `.env`

## Making Changes

### Code Style

- We use TypeScript with strict mode
- Run `npm run typecheck` before committing
- Run `npm run lint` to check for issues

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `chore:` Maintenance tasks
- `refactor:` Code refactoring
- `test:` Test additions/changes

Examples:
```
feat: add support for custom models in settings
fix: handle missing channel config gracefully
docs: update deployment instructions for Railway
```

### Pull Request Process

1. **Create a branch**

   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make your changes**

3. **Test your changes**

   ```bash
   npm run typecheck
   npm run build
   ```

4. **Commit with a descriptive message**

5. **Push and open a PR**

   ```bash
   git push origin feat/your-feature
   ```

6. **Fill out the PR template**

### What to Include in PRs

- Clear description of what changed and why
- Screenshots for UI changes (Slack modals, etc.)
- Test instructions if behavior changed
- Documentation updates if needed

## Project Structure

```
src/
├── index.ts              # Entry point
├── env.ts                # Environment config
├── db.ts                 # Prisma client
├── server/               # Fastify routes
├── slack/                # Slack Bolt handlers
│   ├── commands/         # Slash commands
│   ├── events/           # Event handlers
│   ├── actions/          # Button actions
│   └── views/            # Modal builders
├── cursor/               # Cursor API client
├── core/                 # Business logic
│   ├── resolver.ts       # Context resolution
│   └── orchestrator.ts   # Run management
└── utils/                # Utilities
```

## Areas for Contribution

### Good First Issues

- Improve error messages
- Add more inline override options
- Enhance status display formatting

### Larger Projects

- Discord adapter
- Web dashboard for config management
- Rate limiting per workspace
- Audit log viewer

## Getting Help

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Tag maintainers if you're stuck on a PR

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

Thank you for contributing!
