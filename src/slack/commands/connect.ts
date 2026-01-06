import type { App } from '@slack/bolt'
import { db } from '../../db.js'
import { logger } from '../../utils/logger.js'
import { buildConnectModal } from '../views/connect-modal.js'

export function registerConnectCommand(app: App) {
  // /computer connect - Open modal to set Cursor API key
  app.command('/computer', async ({ command, ack, client, body }) => {
    await ack()

    // Only handle "connect" subcommand here
    const args = command.text.trim().toLowerCase()
    if (args !== 'connect' && args !== '') {
      return // Let other handlers deal with it
    }

    if (args !== 'connect') {
      // Show help if no subcommand
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: '*Computer Commands:*\n• `/computer connect` - Set your Cursor API key\n• `/computer settings` - Configure this channel\n• `/computer status` - View channel status',
      })
      return
    }

    const teamId = body.team_id
    if (!teamId) {
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: '❌ Could not determine workspace. Please try again.',
      })
      return
    }

    // Check if already has API key
    const installation = await db.installation.findUnique({
      where: { teamId },
    })

    const hasKey = !!installation?.cursorApiKey

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildConnectModal(hasKey),
      })
    } catch (error) {
      logger.error({ error }, 'Failed to open connect modal')
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: '❌ Failed to open settings. Please try again.',
      })
    }
  })

  // Handle modal submission
  app.view('connect_modal_submit', async ({ ack, body, view, client }) => {
    await ack()

    const teamId = body.team?.id
    if (!teamId) {
      logger.error('Missing team ID in connect modal submission')
      return
    }

    const apiKey = view.state.values['cursor_api_key_block']?.['cursor_api_key_input']?.value

    if (!apiKey) {
      logger.error('Missing API key in connect modal submission')
      return
    }

    try {
      await db.installation.upsert({
        where: { teamId },
        create: {
          teamId,
          botToken: '',
          botId: '',
          botUserId: '',
          installedBy: body.user.id,
          cursorApiKey: apiKey,
        },
        update: { cursorApiKey: apiKey },
      })

      // DM the user to confirm
      await client.chat.postMessage({
        channel: body.user.id,
        text: '✅ Cursor API key saved! You can now use `/computer settings` in any channel to bind it to a repo.',
      })

      logger.info({ teamId }, 'Cursor API key saved')
    } catch (error) {
      logger.error({ error, teamId }, 'Failed to save Cursor API key')
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Failed to save API key. Please try again.',
      })
    }
  })
}
