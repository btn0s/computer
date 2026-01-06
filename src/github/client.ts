import { logger } from '../utils/logger.js'
import { env } from '../env.js'

export interface DeploymentStatus {
  state: 'pending' | 'success' | 'failure' | 'error' | null
  targetUrl?: string
  description?: string
}

async function githubRequest<T>(url: string): Promise<T | null> {
  if (!env.GITHUB_TOKEN) {
    return null
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Computer-Slack-App',
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  }

  const res = await fetch(url, { headers })

  if (!res.ok) {
    logger.warn({ status: res.status, url }, 'GitHub API error')
    return null
  }

  return res.json() as Promise<T>
}

async function getDeploymentPreviewUrl(
  repoFullName: string,
  ref: string
): Promise<string | undefined> {
  const deploymentsUrl = `https://api.github.com/repos/${repoFullName}/deployments?sha=${ref}&per_page=5`
  
  const deployments = await githubRequest<Array<{
    id: number
    environment: string
  }>>(deploymentsUrl)

  if (!deployments?.length) {
    return undefined
  }

  const previewDeployment = deployments.find(
    (d) => d.environment.toLowerCase().includes('preview') || d.environment.toLowerCase().includes('production')
  )

  if (!previewDeployment) {
    return undefined
  }

  const statusesUrl = `https://api.github.com/repos/${repoFullName}/deployments/${previewDeployment.id}/statuses`
  
  const statuses = await githubRequest<Array<{
    state: string
    environment_url?: string
    target_url?: string
  }>>(statusesUrl)

  if (!statuses?.length) {
    return undefined
  }

  const successStatus = statuses.find((s) => s.state === 'success')
  return successStatus?.environment_url || successStatus?.target_url
}

export async function getVercelDeploymentStatus(
  repoFullName: string,
  ref: string
): Promise<DeploymentStatus> {
  if (!env.GITHUB_TOKEN) {
    return { state: null }
  }

  try {
    const statusUrl = `https://api.github.com/repos/${repoFullName}/commits/${ref}/status`
    
    const data = await githubRequest<{
      state: string
      statuses: Array<{
        context: string
        state: string
        target_url?: string
        description?: string
      }>
    }>(statusUrl)

    if (!data) {
      return { state: null }
    }

    const vercelStatus = data.statuses.find(
      (s) => s.context.toLowerCase().includes('vercel') || s.context.toLowerCase().includes('deployment')
    )

    if (!vercelStatus) {
      return { state: null }
    }

    let targetUrl = vercelStatus.target_url

    if (vercelStatus.state === 'success') {
      const previewUrl = await getDeploymentPreviewUrl(repoFullName, ref)
      if (previewUrl) {
        targetUrl = previewUrl
      }
    }

    return {
      state: vercelStatus.state as DeploymentStatus['state'],
      targetUrl,
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
