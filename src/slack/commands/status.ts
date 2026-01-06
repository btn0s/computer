import type { App } from '@slack/bolt'
import { db } from '../../db.js'
import { logger } from '../../utils/logger.js'
import { buildStatusBlocks } from '../views/status-blocks.js'

export function registerStatusCommand(app: App) {
  // /computer status - Show channel configuration and recent runs
  app.command('/computer', async ({ command, ack, client, body }) => {
    // Only handle "status" subcommand
    const args = command.text.trim().toLowerCase()
    if (args !== 'status') {
      return // Let other handlers deal with it
    }

    await ack()

    const teamId = body.team_id
    const channelId = command.channel_id

    if (!teamId) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: command.user_id,
        text: '❌ Could not determine workspace. Please try again.',
      })
      return
    }

    try {
      const installation = await db.installation.findUnique({
        where: { teamId },
      })

      if (!installation) {
        await client.chat.postEphemeral({
          channel: channelId,
          user: command.user_id,
          text: '❌ Computer is not installed in this workspace. Please reinstall.',
        })
        return
      }

      const config = await db.channelConfig.findUnique({
        where: {
          installationId_channelId: {
            installationId: installation.id,
            channelId,
          },
        },
      })

      const recentRuns = config
        ? await db.run.findMany({
            where: { channelConfigId: config.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : []

      const blocks = buildStatusBlocks({
        config,
        recentRuns,
        hasApiKey: !!installation.cursorApiKey,
      })

      await client.chat.postEphemeral({
        channel: channelId,
        user: command.user_id,
        blocks,
        text: 'Channel status', // Fallback
      })
    } catch (error) {
      logger.error({ error, teamId, channelId }, 'Failed to get status')
      await client.chat.postEphemeral({
        channel: channelId,
        user: command.user_id,
        text: '❌ Failed to get status. Please try again.',
      })
    }
  })
}
