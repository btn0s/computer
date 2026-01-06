import { logger } from '../utils/logger.js'
import {
  LaunchAgentResponseSchema,
  GetAgentResponseSchema,
  ListAgentsResponseSchema,
  type LaunchAgentResponse,
  type GetAgentResponse,
  type ListAgentsResponse,
} from './types.js'

export class CursorAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string
  ) {
    super(message)
    this.name = 'CursorAPIError'
  }
}

export class CursorClient {
  private baseUrl = 'https://api.cursor.com'

  constructor(private apiKey: string) {}

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`

    logger.debug({ url, method: options.method ?? 'GET' }, 'Cursor API request')

    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const text = await res.text()

    if (!res.ok) {
      logger.error({ status: res.status, body: text }, 'Cursor API error')
      throw new CursorAPIError(
        `Cursor API error: ${res.status}`,
        res.status,
        text
      )
    }

    try {
      return JSON.parse(text) as T
    } catch {
      throw new CursorAPIError('Invalid JSON response', res.status, text)
    }
  }

  /**
   * Launch a new background agent
   */
  async launchAgent(params: {
    prompt: string
    repository: string
    ref?: string
    model?: string
    autoCreatePr?: boolean
    targetBranch?: string
    webhookUrl?: string
  }): Promise<LaunchAgentResponse> {
    const repoUrl = params.repository.startsWith('https://')
      ? params.repository
      : `https://github.com/${params.repository}`

    const body: Record<string, unknown> = {
      prompt: { text: params.prompt },
      source: {
        repository: repoUrl,
        ref: params.ref,
      },
      target: {
        autoCreatePr: params.autoCreatePr ?? true,
        branchName: params.targetBranch,
      },
    }

    body['model'] = params.model || 'gpt-5.2-high'

    if (params.webhookUrl) {
      body['webhook'] = { url: params.webhookUrl }
    }

    const data = await this.request<unknown>('/v0/agents', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return LaunchAgentResponseSchema.parse(data)
  }

  /**
   * Get agent status and details
   */
  async getAgent(agentId: string): Promise<GetAgentResponse> {
    const data = await this.request<unknown>(`/v0/agents/${agentId}`)
    return GetAgentResponseSchema.parse(data)
  }

  /**
   * List all agents (paginated)
   */
  async listAgents(
    limit = 20,
    cursor?: string
  ): Promise<ListAgentsResponse> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)

    const data = await this.request<unknown>(`/v0/agents?${params}`)
    return ListAgentsResponseSchema.parse(data)
  }

  /**
   * Send a follow-up message to a running agent
   */
  async sendFollowup(agentId: string, message: string): Promise<void> {
    await this.request(`/v0/agents/${agentId}/followups`, {
      method: 'POST',
      body: JSON.stringify({ prompt: { text: message } }),
    })
  }

  async getConversation(agentId: string): Promise<{ id: string; messages: Array<{ id: string; type: string; text: string }> }> {
    return this.request(`/v0/agents/${agentId}/conversation`)
  }

  async cancelAgent(agentId: string): Promise<void> {
    await this.request(`/v0/agents/${agentId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Poll agent until it reaches a terminal state
   */
  async waitForCompletion(
    agentId: string,
    options: {
      pollIntervalMs?: number
      timeoutMs?: number
      onStatusChange?: (status: GetAgentResponse) => void
    } = {}
  ): Promise<GetAgentResponse> {
    const { pollIntervalMs = 5000, timeoutMs = 600000, onStatusChange } = options
    const startTime = Date.now()
    let lastStatus: string | undefined

    while (Date.now() - startTime < timeoutMs) {
      const agent = await this.getAgent(agentId)

      if (agent.status !== lastStatus) {
        lastStatus = agent.status
        onStatusChange?.(agent)
      }

      if (['FINISHED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(agent.status)) {
        for (let retry = 0; retry < 5; retry++) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          const finalAgent = await this.getAgent(agentId)
          if (finalAgent.target?.prUrl || retry === 4) {
            return finalAgent
          }
        }
        return agent
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    throw new Error(`Agent ${agentId} timed out after ${timeoutMs}ms`)
  }
}
