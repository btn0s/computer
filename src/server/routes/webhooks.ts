import type { FastifyInstance } from 'fastify'
import { db } from '../../db.js'
import { logger } from '../../utils/logger.js'
import { RunStatus } from '@prisma/client'

// Webhook payload from Cursor (shape may vary)
interface CursorWebhookPayload {
  agentId: string
  status: string
  pullRequestUrl?: string
  error?: string
}

export async function webhookRoutes(fastify: FastifyInstance) {
  // Cursor completion webhook
  fastify.post('/webhooks/cursor', async (request, reply) => {
    const payload = request.body as CursorWebhookPayload

    logger.info({ payload }, 'Received Cursor webhook')

    if (!payload.agentId) {
      return reply.status(400).send({ error: 'Missing agentId' })
    }

    // Find the run by cursorAgentId
    const run = await db.run.findFirst({
      where: { cursorAgentId: payload.agentId },
      include: { channelConfig: { include: { installation: true } } },
    })

    if (!run) {
      logger.warn({ agentId: payload.agentId }, 'Run not found for webhook')
      return reply.status(404).send({ error: 'Run not found' })
    }

    // Map Cursor status to our status
    let status: RunStatus = run.status
    if (payload.status === 'FINISHED') {
      status = RunStatus.COMPLETED
    } else if (payload.status === 'FAILED') {
      status = RunStatus.FAILED
    } else if (payload.status === 'CANCELLED') {
      status = RunStatus.CANCELLED
    } else if (payload.status === 'RUNNING') {
      status = RunStatus.RUNNING
    }

    // Update the run
    await db.run.update({
      where: { id: run.id },
      data: {
        status,
        prUrl: payload.pullRequestUrl ?? run.prUrl,
        error: payload.error ?? run.error,
        completedAt: ['FINISHED', 'FAILED', 'CANCELLED'].includes(payload.status)
          ? new Date()
          : undefined,
      },
    })

    // TODO: Post update to Slack thread
    // This will be implemented when we have the Slack app set up

    logger.info(
      { runId: run.id, status, prUrl: payload.pullRequestUrl },
      'Run updated from webhook'
    )

    return reply.send({ ok: true })
  })
}
