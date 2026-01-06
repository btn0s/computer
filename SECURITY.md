# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainers directly (see [CONTRIBUTING.md](./CONTRIBUTING.md) for contact info)
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## What to Expect

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Timeline**: Depends on severity, typically within 30 days

## Security Best Practices for Users

When deploying Computer:

1. **Never commit secrets** – Use environment variables for all sensitive values
2. **Rotate API keys** – Regularly rotate your Cursor and Slack API keys
3. **Limit permissions** – Only grant the minimum required Slack scopes
4. **Keep updated** – Always run the latest version
5. **Secure your database** – Use SSL connections for PostgreSQL in production

## Scope

This security policy covers:
- The Computer application code
- Docker images built from this repository
- Documentation and configuration examples

This policy does NOT cover:
- Third-party dependencies (report to their maintainers)
- Cursor Background Agents API
- Slack API
- User deployment infrastructure
