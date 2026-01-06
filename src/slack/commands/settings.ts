import type { App } from '@slack/bolt'
import { db } from '../../db.js'
import { logger } from '../../utils/logger.js'
import { buildSettingsModal } from '../views/settings-modal.js'

export function registerSettingsCommand(app: App) {
  // /computer settings - Open modal to configure channel
  app.command('/computer', async ({ command, ack, client, body }) => {
    // Only handle "settings" subcommand
    const args = command.text.trim().toLowerCase()
    if (args !== 'settings') {
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

    // Get installation
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

    if (!installation.cursorApiKey) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: command.user_id,
        text: '❌ No Cursor API key configured. Run `/computer connect` first.',
      })
      return
    }

    // Get existing config for this channel
    const existingConfig = await db.channelConfig.findUnique({
      where: {
        installationId_channelId: {
          installationId: installation.id,
          channelId,
        },
      },
    })

    // Get channel name for display
    let channelName: string | undefined
    try {
      const channelInfo = await client.conversations.info({ channel: channelId })
      channelName = (channelInfo.channel as { name?: string })?.name
    } catch {
      // Ignore - we'll just use the ID
    }

    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildSettingsModal({
          channelId,
          channelName,
          existingConfig: existingConfig
            ? {
                repoFullName: existingConfig.repoFullName,
                defaultBranch: existingConfig.defaultBranch,
                modelId: existingConfig.modelId,
                dryRunDefault: existingConfig.dryRunDefault,
              }
            : undefined,
        }),
      })
    } catch (error) {
      logger.error({ error }, 'Failed to open settings modal')
      await client.chat.postEphemeral({
        channel: channelId,
        user: command.user_id,
        text: '❌ Failed to open settings. Please try again.',
      })
    }
  })

  // Handle settings modal submission
  app.view('settings_modal_submit', async ({ ack, body, view, client }) => {
    const teamId = body.team?.id
    if (!teamId) {
      await ack({ response_action: 'errors', errors: {} })
      return
    }

    const metadata = JSON.parse(view.private_metadata || '{}') as { channelId?: string }
    const channelId = metadata.channelId

    if (!channelId) {
      await ack({ response_action: 'errors', errors: {} })
      return
    }

    const repoFullName = view.state.values['repo_block']?.['repo_input']?.value
    const defaultBranch = view.state.values['branch_block']?.['branch_input']?.value || 'main'
    const modelId = view.state.values['model_block']?.['model_select']?.selected_option?.value || 'auto'
    const dryRunOptions = view.state.values['dryrun_block']?.['dryrun_checkbox']?.selected_options || []
    const dryRunDefault = dryRunOptions.length > 0

    // Validate repo format
    if (!repoFullName || !/^[\w.-]+\/[\w.-]+$/.test(repoFullName)) {
      await ack({
        response_action: 'errors',
        errors: { repo_block: 'Please enter a valid repository (e.g., owner/repo)' },
      })
      return
    }

    await ack()

    try {
      const installation = await db.installation.findUnique({
        where: { teamId },
      })

      if (!installation) {
        throw new Error('Installation not found')
      }

      await db.channelConfig.upsert({
        where: {
          installationId_channelId: {
            installationId: installation.id,
            channelId,
          },
        },
        create: {
          installationId: installation.id,
          channelId,
          repoFullName,
          defaultBranch,
          modelId,
          dryRunDefault,
          updatedBy: body.user.id,
        },
        update: {
          repoFullName,
          defaultBranch,
          modelId,
          dryRunDefault,
          updatedBy: body.user.id,
        },
      })

      await client.chat.postMessage({
        channel: channelId,
        text: `✅ Channel configured!\n• *Repository:* \`${repoFullName}\`\n• *Branch:* \`${defaultBranch}\`\n• *Model:* \`${modelId}\`\n\nMention \`@Computer\` with your request to get started.`,
      })

      logger.info({ teamId, channelId, repoFullName }, 'Channel config saved')
    } catch (error) {
      logger.error({ error, teamId, channelId }, 'Failed to save channel config')
      await client.chat.postMessage({
        channel: body.user.id,
        text: '❌ Failed to save settings. Please try again.',
      })
    }
  })
}
