import { App, LogLevel } from '@slack/bolt'
import { env } from '../env.js'
import { prismaInstallationStore } from './installation-store.js'
import { logger } from '../utils/logger.js'

// Commands
import { registerConnectCommand } from './commands/connect.js'
import { registerSettingsCommand } from './commands/settings.js'
import { registerStatusCommand } from './commands/status.js'

// Events
import { registerAppMentionHandler } from './events/app-mention.js'

// Actions
import { registerRunControlActions } from './actions/run-controls.js'

export function createSlackApp() {
  // Socket Mode for local dev (single workspace)
  if (env.SOCKET_MODE) {
    if (!env.SLACK_BOT_TOKEN || !env.SLACK_APP_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN and SLACK_APP_TOKEN required for Socket Mode')
    }

    logger.info('Creating Slack app in Socket Mode')

    return new App({
      token: env.SLACK_BOT_TOKEN,
      appToken: env.SLACK_APP_TOKEN,
      socketMode: true,
      logLevel: LogLevel.INFO,
    })
  }

  // HTTP Mode for production (multi-workspace)
  logger.info('Creating Slack app in HTTP Mode')

  return new App({
    signingSecret: env.SLACK_SIGNING_SECRET,
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    installationStore: prismaInstallationStore,
    installerOptions: {
      directInstall: true,
      redirectUriPath: '/slack/oauth/callback',
    },
    logLevel: LogLevel.INFO,
  })
}

export function registerSlackHandlers(app: App) {
  // Commands
  registerConnectCommand(app)
  registerSettingsCommand(app)
  registerStatusCommand(app)

  // Events
  registerAppMentionHandler(app)

  // Actions
  registerRunControlActions(app)

  logger.info('Slack handlers registered')
}
