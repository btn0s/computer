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
  agentId?: string | null
  repo: string
  branch: string
  targetBranch?: string | null
  status: string
  summary?: string | null
  prUrl?: string | null
  deploymentUrl?: string | null
  error?: string | null
}

function convertMarkdownToMrkdwn(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '*$1*')
    .replace(/^## (.+)$/gm, '*$1*')
    .replace(/^# (.+)$/gm, '*$1*')
    .replace(/^\* /gm, '• ')
    .replace(/^- /gm, '• ')
}

export function buildRunMessageBlocks(options: RunMessageBlocksOptions): KnownBlock[] {
  const { runId, agentId, repo, branch, targetBranch, status, summary, prUrl, deploymentUrl, error } = options

  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)

  const blocks: KnownBlock[] = []

  if (isTerminal && summary) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: convertMarkdownToMrkdwn(summary),
      },
    })
  } else if (!isTerminal) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: "Launched an agent. I'll notify here when it's finished.",
      },
    })
  } else if (error) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error:* ${error}`,
      },
    })
  }

  const displayBranch = targetBranch || branch
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Repository:* \`${repo}\`\n*Branch:* \`${displayBranch}\``,
    },
  })

  const buttons: Array<{
    type: 'button'
    text: { type: 'plain_text'; text: string }
    url?: string
    action_id: string
    value?: string
    style?: 'danger' | 'primary'
  }> = []

  if (prUrl) {
    buttons.push({
      type: 'button',
      text: { type: 'plain_text', text: 'View PR' },
      style: 'primary',
      url: prUrl,
      action_id: 'view_pr',
    })
  }

  if (deploymentUrl) {
    buttons.push({
      type: 'button',
      text: { type: 'plain_text', text: 'View Deployment' },
      url: deploymentUrl,
      action_id: 'view_deployment',
    })
  }

  if (agentId) {
    buttons.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Open in Cursor' },
      url: `cursor://open-background-agent?id=${agentId}`,
      action_id: 'open_cursor',
    })
    buttons.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Open in Web' },
      url: `https://cursor.com/agents?id=${agentId}`,
      action_id: 'open_web',
    })
  }

  if (!isTerminal) {
    buttons.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Cancel' },
      style: 'danger',
      action_id: 'cancel_run',
      value: runId,
    })
  }

  if (buttons.length > 0) {
    blocks.push({
      type: 'actions',
      elements: buttons,
    })
  }

  return blocks
}
