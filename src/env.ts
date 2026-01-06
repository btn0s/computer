import dotenv from 'dotenv'
import { z } from 'zod'

// Load .env file, overriding any existing env vars
dotenv.config({ override: true })

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),

  // Slack App
  SLACK_CLIENT_ID: z.string().min(1),
  SLACK_CLIENT_SECRET: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),

  // Socket Mode (optional - for local dev)
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),

  // Server
  PORT: z.string().default('3000').transform(Number),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Mode
  SOCKET_MODE: z.string().default('false').transform((v) => v === 'true'),

  // GitHub (optional - for deployment status polling on private repos)
  GITHUB_TOKEN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    console.error(result.error.flatten().fieldErrors)
    process.exit(1)
  }

  return result.data
}

export const env = loadEnv()
