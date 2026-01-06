import type { Block, KnownBlock as SlackKnownBlock } from '@slack/types'
import type { ChannelConfig, Run } from '@prisma/client'

// Use a union type for blocks that Slack accepts
type KnownBlock = SlackKnownBlock | Block

interface StatusBlocksOptions {
  config: ChannelConfig | null
  recentRuns: Run[]
  hasApiKey: boolean
}

export function buildStatusBlocks(options: StatusBlocksOptions): KnownBlock[] {
  const { config, recentRuns, hasApiKey } = options

  const blocks: KnownBlock[] = []

  // API Key status
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: hasApiKey
        ? '✅ *Cursor API Key:* Connected'
        : '❌ *Cursor API Key:* Not configured. Run `/computer connect`',
    },
  })

  blocks.push({ type: 'divider' })

  // Channel config status
  if (config) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Repository:* \`${config.repoFullName}\`\n*Branch:* \`${config.defaultBranch}\`\n*Model:* \`${config.modelId}\`\n*Dry Run:* ${config.dryRunDefault ? 'Yes' : 'No'}`,
      },
    })
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '⚠️ *This channel is not configured.* Run `/computer settings` to bind it to a repo.',
      },
    })
  }

  // Recent runs
  if (recentRuns.length > 0) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Recent Runs:*',
      },
    })

    for (const run of recentRuns.slice(0, 5)) {
      const statusEmoji = {
        PENDING: '⏳',
        CREATING: '🔄',
        RUNNING: '🏃',
        COMPLETED: '✅',
        FAILED: '❌',
        CANCELLED: '🚫',
      }[run.status] ?? '❓'

      const prLink = run.prUrl ? ` (<${run.prUrl}|PR>)` : ''
      const prompt = run.promptText.length > 50 
        ? run.promptText.substring(0, 50) + '...' 
        : run.promptText

      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${statusEmoji} ${prompt}${prLink} - ${run.createdAt.toLocaleDateString()}`,
          },
        ],
      })
    }
  }

  return blocks
}

interface RunMessageBlocksOptions {
  runId: string
  prompt: string
  repo: string
  branch: string
  status: string
  prUrl?: string | null
  error?: string | null
}

export function buildRunMessageBlocks(options: RunMessageBlocksOptions): KnownBlock[] {
  const { runId, prompt, repo, branch, status, prUrl, error } = options

  const statusEmoji = {
    PENDING: '⏳',
    CREATING: '🔄',
    RUNNING: '🏃',
    COMPLETED: '✅',
    FAILED: '❌',
    CANCELLED: '🚫',
  }[status] ?? '❓'

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${statusEmoji} *${status}*\n\n${prompt}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📁 \`${repo}\` @ \`${branch}\``,
        },
      ],
    },
  ]

  if (prUrl) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔗 *Pull Request:* <${prUrl}|View PR>`,
      },
    })
  }

  if (error) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Error:* ${error}`,
      },
    })
  }

  // Action buttons (only for non-terminal states)
  if (!['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Cancel' },
          style: 'danger',
          action_id: 'cancel_run',
          value: runId,
        },
      ],
    })
  } else if (status === 'FAILED') {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Retry' },
          action_id: 'retry_run',
          value: runId,
        },
      ],
    })
  }

  return blocks
}
