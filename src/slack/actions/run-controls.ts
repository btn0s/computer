import type { App } from '@slack/bolt'
import { logger } from '../../utils/logger.js'
import { cancelRun, retryRun } from '../../core/orchestrator.js'
import { db } from '../../db.js'
import { buildRunMessageBlocks } from '../views/status-blocks.js'

export function registerRunControlActions(app: App) {
  // Cancel run
  app.action('cancel_run', async ({ ack, action, body, client }) => {
    await ack()

    if (action.type !== 'button') return

    const runId = action.value
    if (!runId) {
      logger.error('Missing run ID in cancel action')
      return
    }

    try {
      await cancelRun(runId)

      // Update the message
      const run = await db.run.findUnique({ where: { id: runId } })
      if (run && 'channel' in body && 'message' in body) {
        const channel = (body as { channel: { id: string } }).channel.id
        const messageTs = (body as { message: { ts: string } }).message.ts

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

        await client.chat.update({
          channel,
          ts: messageTs,
          blocks,
          text: `Cancelled: ${run.promptText}`,
        })
      }

      logger.info({ runId }, 'Run cancelled via button')
    } catch (error) {
      logger.error({ error, runId }, 'Failed to cancel run')
    }
  })

  // Retry run
  app.action('retry_run', async ({ ack, action, body, client }) => {
    await ack()

    if (action.type !== 'button') return

    const runId = action.value
    if (!runId) {
      logger.error('Missing run ID in retry action')
      return
    }

    try {
      const result = await retryRun(runId)

      // Update the message
      const run = await db.run.findUnique({ where: { id: result.runId } })
      if (run && 'channel' in body && 'message' in body) {
        const channel = (body as { channel: { id: string } }).channel.id
        const messageTs = (body as { message: { ts: string } }).message.ts

        const blocks = buildRunMessageBlocks({
          runId: run.id,
          agentId: run.cursorAgentId,
          repo: run.resolvedRepo,
          branch: run.resolvedBranch,
          targetBranch: run.targetBranch,
          status: run.status,
          summary: run.summary,
        })

        await client.chat.update({
          channel,
          ts: messageTs,
          blocks,
          text: `Retrying: ${run.promptText}`,
        })
      }

      logger.info({ oldRunId: runId, newRunId: result.runId }, 'Run retried via button')
    } catch (error) {
      logger.error({ error, runId }, 'Failed to retry run')
    }
  })
}
