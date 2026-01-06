import { z } from 'zod'

// Agent status enum
export const AgentStatusSchema = z.enum([
  'CREATING',
  'RUNNING',
  'WAITING',
  'FINISHED',
  'FAILED',
  'CANCELLED',
])
export type AgentStatus = z.infer<typeof AgentStatusSchema>

// Launch agent request
export const LaunchAgentRequestSchema = z.object({
  prompt: z.object({
    text: z.string(),
    images: z
      .array(
        z.object({
          data: z.string(), // base64
          dimension: z.object({
            width: z.number(),
            height: z.number(),
          }),
        })
      )
      .optional(),
  }),
  source: z.object({
    repository: z.string(), // e.g., "https://github.com/org/repo" or "org/repo"
    ref: z.string(), // branch name
  }),
  target: z
    .object({
      autoCreatePr: z.boolean().optional(),
      branch: z.string().optional(),
    })
    .optional(),
  model: z.string().optional(),
  webhook: z
    .object({
      url: z.string().url(),
    })
    .optional(),
})
export type LaunchAgentRequest = z.infer<typeof LaunchAgentRequestSchema>

// Launch agent response
export const LaunchAgentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: AgentStatusSchema,
  source: z.object({
    repository: z.string(),
    ref: z.string(),
  }),
  target: z
    .object({
      branch: z.string().optional(),
      pullRequestUrl: z.string().optional(),
    })
    .optional(),
  createdAt: z.string(),
})
export type LaunchAgentResponse = z.infer<typeof LaunchAgentResponseSchema>

// Get agent response
export const GetAgentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: AgentStatusSchema,
  source: z.object({
    repository: z.string(),
    ref: z.string(),
  }),
  target: z
    .object({
      branch: z.string().optional(),
      pullRequestUrl: z.string().optional(),
    })
    .optional(),
  createdAt: z.string(),
  finishedAt: z.string().optional(),
})
export type GetAgentResponse = z.infer<typeof GetAgentResponseSchema>

// List agents response
export const ListAgentsResponseSchema = z.object({
  agents: z.array(GetAgentResponseSchema),
  nextCursor: z.string().optional(),
})
export type ListAgentsResponse = z.infer<typeof ListAgentsResponseSchema>

// Followup request
export const FollowupRequestSchema = z.object({
  prompt: z.object({
    text: z.string(),
  }),
})
export type FollowupRequest = z.infer<typeof FollowupRequestSchema>
