import { logger } from '../utils/logger.js'
import { env } from '../env.js'

export interface DeploymentStatus {
  state: 'pending' | 'success' | 'failure' | 'error' | null
  targetUrl?: string
  description?: string
}

export async function getVercelDeploymentStatus(
  repoFullName: string,
  ref: string
): Promise<DeploymentStatus> {
  if (!env.GITHUB_TOKEN) {
    return { state: null }
  }

  const url = `https://api.github.com/repos/${repoFullName}/commits/${ref}/status`

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Computer-Slack-App',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    }

    const res = await fetch(url, { headers })

    if (!res.ok) {
      logger.warn({ status: res.status, repoFullName, ref }, 'GitHub status API error')
      return { state: null }
    }

    const data = await res.json() as {
      state: string
      statuses: Array<{
        context: string
        state: string
        target_url?: string
        description?: string
      }>
    }

    const vercelStatus = data.statuses.find(
      (s) => s.context.toLowerCase().includes('vercel') || s.context.toLowerCase().includes('deployment')
    )

    if (!vercelStatus) {
      return { state: null }
    }

    return {
      state: vercelStatus.state as DeploymentStatus['state'],
      targetUrl: vercelStatus.target_url,
      description: vercelStatus.description,
    }
  } catch (err) {
    logger.warn({ err, repoFullName, ref }, 'Failed to fetch GitHub status')
    return { state: null }
  }
}

export async function pollForDeployment(
  repoFullName: string,
  ref: string,
  options: { maxAttempts?: number; intervalMs?: number } = {}
): Promise<DeploymentStatus> {
  const { maxAttempts = 30, intervalMs = 10000 } = options

  for (let i = 0; i < maxAttempts; i++) {
    const status = await getVercelDeploymentStatus(repoFullName, ref)

    if (status.state === 'success' || status.state === 'failure' || status.state === 'error') {
      return status
    }

    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  return { state: null }
}
