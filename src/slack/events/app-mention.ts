import type { App } from '@slack/bolt'
import type { WebClient } from '@slack/web-api'
import { db } from '../../db.js'
import { logger } from '../../utils/logger.js'
import { resolveContext, parseOverrides, ResolverError } from '../../core/resolver.js'
import { launchRun, pollRunCompletion } from '../../core/orchestrator.js'
import { buildRunMessageBlocks } from '../views/status-blocks.js'

export function registerAppMentionHandler(app: App) {
  app.event('app_mention', async ({ event, client, context }) => {
    const teamId = context.teamId
    const channelId = event.channel
    const userId = event.user
    const threadTs = event.thread_ts ?? event.ts

    if (!teamId) {
      logger.error('Missing team ID in app_mention event')
      return
    }

    if (!userId) {
      logger.error('Missing user ID in app_mention event')
      return
    }

    // Extract the message text (remove the bot mention)
    const text = event.text
      .replace(/<@[A-Z0-9]+>/g, '') // Remove all mentions
      .trim()

    if (!text) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: "Hi! Tell me what you'd like me to do. For example:\n> @Computer add a health check endpoint to the API",
      })
      return
    }

    // Parse inline overrides
    const { cleanText, overrides } = parseOverrides(text)

    if (!cleanText) {
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: "I didn't catch what you wanted me to do. Please describe the task.",
      })
      return
    }

    // Post initial acknowledgment
    const ackMessage = await client.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: '🔄 Working on it...',
    })

    if (!ackMessage.ts) {
      logger.error('Failed to get message timestamp')
      return
    }

    const messageTs = ackMessage.ts

    try {
      // Resolve context
      const resolvedContext = await resolveContext({
        teamId,
        channelId,
        overrides,
      })

      // Launch run
      const result = await launchRun({
        context: resolvedContext,
        prompt: cleanText,
        triggeredBy: userId,
        threadTs,
      })

      // Update message with run details
      const blocks = buildRunMessageBlocks({
        runId: result.runId,
        prompt: cleanText,
        repo: resolvedContext.repo,
        branch: resolvedContext.branch,
        status: result.status,
      })

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        blocks,
        text: `Running: ${cleanText}`, // Fallback
      })

      // Start polling for completion (in background)
      // This is a fallback in case webhooks don't work
      pollRunCompletion(result.runId).catch((error) => {
        logger.error({ error, runId: result.runId }, 'Background poll failed')
      })

      // Also set up a listener to update the message when the run completes
      // This will be triggered by the webhook or the polling
      watchRunCompletion(result.runId, client, channelId, messageTs)
    } catch (error) {
      let errorMessage = '❌ Something went wrong. Please try again.'

      if (error instanceof ResolverError) {
        errorMessage = `❌ ${error.message}`
      } else if (error instanceof Error) {
        logger.error({ error, teamId, channelId }, 'Failed to process mention')
        errorMessage = `❌ Failed to start: ${error.message}`
      }

      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: errorMessage,
      })
    }
  })
}

/**
 * Watch for run completion and update Slack message
 */
async function watchRunCompletion(
  runId: string,
  client: WebClient,
  channel: string,
  messageTs: string
) {
  const checkInterval = 10000 // 10 seconds
  const maxChecks = 360 // 1 hour max

  for (let i = 0; i < maxChecks; i++) {
    await new Promise((resolve) => setTimeout(resolve, checkInterval))

    const run = await db.run.findUnique({ where: { id: runId } })

    if (!run) {
      logger.warn({ runId }, 'Run not found during watch')
      return
    }

    // Check if terminal state
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      const blocks = buildRunMessageBlocks({
        runId: run.id,
        prompt: run.promptText,
        repo: run.resolvedRepo,
        branch: run.resolvedBranch,
        status: run.status,
        prUrl: run.prUrl,
        error: run.error,
      })

      try {
        await client.chat.update({
          channel,
          ts: messageTs,
          blocks,
          text: `${run.status}: ${run.promptText}`,
        })
      } catch (error) {
        logger.error({ error, runId }, 'Failed to update Slack message')
      }

      return
    }
  }

  logger.warn({ runId }, 'Watch timed out')
}
