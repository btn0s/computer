import { db } from '../db.js'
import { logger } from '../utils/logger.js'

export interface ResolvedContext {
  installationId: string
  channelConfigId: string
  cursorApiKey: string
  repo: string
  branch: string
  model: string
  dryRun: boolean
}

export interface ResolveOptions {
  teamId: string
  channelId: string
  // Inline overrides from message
  overrides?: {
    branch?: string
    model?: string
    dryRun?: boolean
  }
}

export class ResolverError extends Error {
  constructor(
    message: string,
    public code: 'NO_INSTALLATION' | 'NO_API_KEY' | 'NO_CONFIG'
  ) {
    super(message)
    this.name = 'ResolverError'
  }
}

/**
 * Resolve run context from workspace and channel
 */
export async function resolveContext(options: ResolveOptions): Promise<ResolvedContext> {
  const { teamId, channelId, overrides } = options

  // Get installation
  const installation = await db.installation.findUnique({
    where: { teamId },
  })

  if (!installation) {
    throw new ResolverError(
      'Computer is not installed in this workspace',
      'NO_INSTALLATION'
    )
  }

  if (!installation.cursorApiKey) {
    throw new ResolverError(
      'No Cursor API key configured. Run `/computer connect` first.',
      'NO_API_KEY'
    )
  }

  // Get channel config
  const config = await db.channelConfig.findUnique({
    where: {
      installationId_channelId: {
        installationId: installation.id,
        channelId,
      },
    },
  })

  if (!config) {
    throw new ResolverError(
      'This channel is not configured. Run `/computer settings` first.',
      'NO_CONFIG'
    )
  }

  // Apply overrides
  const resolved: ResolvedContext = {
    installationId: installation.id,
    channelConfigId: config.id,
    cursorApiKey: installation.cursorApiKey,
    repo: config.repoFullName,
    branch: overrides?.branch ?? config.defaultBranch,
    model: overrides?.model ?? config.modelId,
    dryRun: overrides?.dryRun ?? config.dryRunDefault,
  }

  logger.debug({ teamId, channelId, resolved: { ...resolved, cursorApiKey: '[REDACTED]' } }, 'Context resolved')

  return resolved
}

/**
 * Parse inline overrides from message text
 * Supports: --branch=name, --model=name, --dry-run
 */
export function parseOverrides(text: string): {
  cleanText: string
  overrides: ResolveOptions['overrides']
} {
  const overrides: ResolveOptions['overrides'] = {}
  let cleanText = text

  // --branch=name
  const branchMatch = text.match(/--branch[=\s]+(\S+)/i)
  if (branchMatch?.[1]) {
    overrides.branch = branchMatch[1]
    cleanText = cleanText.replace(branchMatch[0], '').trim()
  }

  // --model=name
  const modelMatch = text.match(/--model[=\s]+(\S+)/i)
  if (modelMatch?.[1]) {
    overrides.model = modelMatch[1]
    cleanText = cleanText.replace(modelMatch[0], '').trim()
  }

  // --dry-run
  if (text.match(/--dry-run/i)) {
    overrides.dryRun = true
    cleanText = cleanText.replace(/--dry-run/i, '').trim()
  }

  // Clean up extra whitespace
  cleanText = cleanText.replace(/\s+/g, ' ').trim()

  return { cleanText, overrides }
}
