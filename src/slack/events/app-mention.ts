import type { App } from '@slack/bolt'
import type { WebClient } from '@slack/web-api'
import { db } from '../../db.js'
import { logger } from '../../utils/logger.js'
import { resolveContext, parseOverrides, ResolverError } from '../../core/resolver.js'
import { launchRun, pollRunCompletion } from '../../core/orchestrator.js'
import { buildRunMessageBlocks } from '../views/status-blocks.js'
import { pollForDeployment } from '../../github/client.js'

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

    // Add hourglass reaction to the original message immediately
    try {
      await client.reactions.add({
        channel: channelId,
        timestamp: event.ts,
        name: 'hourglass_flowing_sand',
      })
    } catch {
      // Ignore if reaction fails
    }

    let ackMessage: { ts?: string } | undefined

    try {
      const resolvedContext = await resolveContext({
        teamId,
        channelId,
        overrides,
      })

      const result = await launchRun({
        context: resolvedContext,
        prompt: cleanText,
        triggeredBy: userId,
        threadTs,
      })

      const blocks = buildRunMessageBlocks({
        runId: result.runId,
        agentId: result.agentId,
        repo: resolvedContext.repo,
        branch: resolvedContext.branch,
        status: result.status,
      })

      ackMessage = await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        blocks,
        text: `Launched an agent. I'll notify here when it's finished.`,
      })

      if (!ackMessage.ts) {
        logger.error('Failed to get message timestamp')
        return
      }

      pollRunCompletion(result.runId).catch((error) => {
        logger.error({ error, runId: result.runId }, 'Background poll failed')
      })

      watchRunCompletion(result.runId, client, channelId, ackMessage.ts, event.ts)
    } catch (error) {
      let errorMessage = '❌ Something went wrong. Please try again.'

      if (error instanceof ResolverError) {
        errorMessage = `❌ ${error.message}`
      } else if (error instanceof Error) {
        logger.error({ error, teamId, channelId }, 'Failed to process mention')
        errorMessage = `❌ Failed to start: ${error.message}`
      }

      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: errorMessage,
      })

      try {
        await client.reactions.remove({
          channel: channelId,
          timestamp: event.ts,
          name: 'hourglass_flowing_sand',
        })
      } catch {
        // Ignore
      }
    }
  })
}

async function watchRunCompletion(
  runId: string,
  client: WebClient,
  channel: string,
  messageTs: string,
  originalMessageTs: string
) {
  const checkInterval = 10000
  const maxChecks = 360

  for (let i = 0; i < maxChecks; i++) {
    await new Promise((resolve) => setTimeout(resolve, checkInterval))

    const run = await db.run.findUnique({ where: { id: runId } })

    if (!run) {
      logger.warn({ runId }, 'Run not found during watch')
      return
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      const blocks = buildRunMessageBlocks({
        runId: run.id,
        agentId: run.cursorAgentId,
        repo: run.resolvedRepo,
        branch: run.resolvedBranch,
        targetBranch: run.targetBranch,
        status: run.status,
        summary: run.summary,
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

        await client.reactions.remove({
          channel,
          timestamp: originalMessageTs,
          name: 'hourglass_flowing_sand',
        })

        const doneEmoji = run.status === 'COMPLETED' ? 'white_check_mark' : 'x'
        await client.reactions.add({
          channel,
          timestamp: originalMessageTs,
          name: doneEmoji,
        })

        if (run.status === 'COMPLETED' && run.targetBranch) {
          pollForDeployment(run.resolvedRepo, run.targetBranch, {
            maxAttempts: 30,
            intervalMs: 10000,
          }).then(async (deployment) => {
            const updatedRun = await db.run.findUnique({ where: { id: runId } })
            if (!updatedRun) return

            const updatedBlocks = buildRunMessageBlocks({
              runId: updatedRun.id,
              agentId: updatedRun.cursorAgentId,
              repo: updatedRun.resolvedRepo,
              branch: updatedRun.resolvedBranch,
              targetBranch: updatedRun.targetBranch,
              status: updatedRun.status,
              summary: updatedRun.summary,
              prUrl: updatedRun.prUrl,
              deploymentUrl: deployment.state === 'success' ? deployment.targetUrl : null,
              error: updatedRun.error,
            })

            await client.chat.update({
              channel,
              ts: messageTs,
              blocks: updatedBlocks,
              text: `${updatedRun.status}: ${updatedRun.promptText}`,
            })
          }).catch((err) => {
            logger.warn({ err, runId }, 'Failed to poll deployment status')
          })
        }
      } catch (error) {
        logger.error({ error, runId }, 'Failed to update Slack message')
      }

      return
    }
  }

  logger.warn({ runId }, 'Watch timed out')
}
