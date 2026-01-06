import { db } from '../db.js'
import { logger } from '../utils/logger.js'
import { CursorClient } from '../cursor/client.js'
import { env } from '../env.js'
import type { ResolvedContext } from './resolver.js'
import { RunStatus } from '@prisma/client'

export interface LaunchRunOptions {
  context: ResolvedContext
  prompt: string
  triggeredBy: string
  threadTs?: string
}

export interface LaunchRunResult {
  runId: string
  cursorAgentId: string
  status: RunStatus
}

/**
 * Launch a new Cursor agent run
 */
export async function launchRun(options: LaunchRunOptions): Promise<LaunchRunResult> {
  const { context, prompt, triggeredBy, threadTs } = options

  // Create run record
  const run = await db.run.create({
    data: {
      channelConfigId: context.channelConfigId,
      threadTs,
      triggeredBy,
      resolvedRepo: context.repo,
      resolvedBranch: context.branch,
      resolvedModel: context.model,
      promptText: prompt,
      status: RunStatus.CREATING,
    },
  })

  logger.info({ runId: run.id, repo: context.repo }, 'Run created')

  try {
    // Launch Cursor agent
    const client = new CursorClient(context.cursorApiKey)

    const webhookUrl = `${env.BASE_URL}/webhooks/cursor`

    const agent = await client.launchAgent({
      prompt,
      repository: `https://github.com/${context.repo}`,
      ref: context.branch,
      model: context.model === 'auto' ? undefined : context.model,
      autoCreatePr: !context.dryRun,
      webhookUrl,
    })

    // Update run with agent ID
    await db.run.update({
      where: { id: run.id },
      data: {
        cursorAgentId: agent.id,
        status: RunStatus.RUNNING,
        startedAt: new Date(),
      },
    })

    logger.info({ runId: run.id, agentId: agent.id }, 'Cursor agent launched')

    return {
      runId: run.id,
      cursorAgentId: agent.id,
      status: RunStatus.RUNNING,
    }
  } catch (error) {
    // Mark run as failed
    await db.run.update({
      where: { id: run.id },
      data: {
        status: RunStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    })

    logger.error({ error, runId: run.id }, 'Failed to launch Cursor agent')
    throw error
  }
}

/**
 * Cancel a running agent
 */
export async function cancelRun(runId: string): Promise<void> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: { channelConfig: { include: { installation: true } } },
  })

  if (!run) {
    throw new Error('Run not found')
  }

  if (!run.cursorAgentId) {
    throw new Error('Run has no agent ID')
  }

  const apiKey = run.channelConfig.installation.cursorApiKey
  if (!apiKey) {
    throw new Error('No API key found')
  }

  const client = new CursorClient(apiKey)
  await client.cancelAgent(run.cursorAgentId)

  await db.run.update({
    where: { id: runId },
    data: {
      status: RunStatus.CANCELLED,
      completedAt: new Date(),
    },
  })

  logger.info({ runId }, 'Run cancelled')
}

/**
 * Retry a failed run
 */
export async function retryRun(runId: string): Promise<LaunchRunResult> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: { channelConfig: { include: { installation: true } } },
  })

  if (!run) {
    throw new Error('Run not found')
  }

  const installation = run.channelConfig.installation

  if (!installation.cursorApiKey) {
    throw new Error('No API key found')
  }

  // Launch a new run with the same parameters
  return launchRun({
    context: {
      installationId: installation.id,
      channelConfigId: run.channelConfigId,
      cursorApiKey: installation.cursorApiKey,
      repo: run.resolvedRepo,
      branch: run.resolvedBranch,
      model: run.resolvedModel,
      dryRun: false, // Retries always create PRs
    },
    prompt: run.promptText,
    triggeredBy: run.triggeredBy,
    threadTs: run.threadTs ?? undefined,
  })
}

/**
 * Poll for run completion (fallback if webhooks fail)
 */
export async function pollRunCompletion(runId: string): Promise<void> {
  const run = await db.run.findUnique({
    where: { id: runId },
    include: { channelConfig: { include: { installation: true } } },
  })

  if (!run || !run.cursorAgentId) {
    return
  }

  const apiKey = run.channelConfig.installation.cursorApiKey
  if (!apiKey) {
    return
  }

  const client = new CursorClient(apiKey)

  try {
    const agent = await client.waitForCompletion(run.cursorAgentId, {
      pollIntervalMs: 5000,
      timeoutMs: 600000, // 10 minutes
      onStatusChange: async (status) => {
        logger.debug({ runId, status: status.status }, 'Agent status changed')
      },
    })

    // Update run based on final status
    let status: RunStatus = RunStatus.COMPLETED
    if (agent.status === 'FAILED') status = RunStatus.FAILED
    if (agent.status === 'CANCELLED') status = RunStatus.CANCELLED

    await db.run.update({
      where: { id: runId },
      data: {
        status,
        prUrl: agent.target?.pullRequestUrl,
        completedAt: new Date(),
      },
    })

    logger.info({ runId, status, prUrl: agent.target?.pullRequestUrl }, 'Run completed')
  } catch (error) {
    logger.error({ error, runId }, 'Failed to poll run completion')
  }
}
