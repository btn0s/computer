import { startServer } from './server/index.js'
import { createSlackApp, registerSlackHandlers } from './slack/app.js'
import { logger } from './utils/logger.js'
import { env } from './env.js'

async function main() {
  logger.info('Starting Computer...')

  // Start Fastify server (for OAuth, webhooks, landing page)
  const server = await startServer()

  // Create and configure Slack app
  const slackApp = createSlackApp()
  registerSlackHandlers(slackApp)

  if (env.SOCKET_MODE) {
    // Socket Mode: Bolt handles its own connection
    await slackApp.start()
    logger.info('Slack app started in Socket Mode')
  } else {
    // HTTP Mode: Mount Bolt receiver on Fastify
    // Note: For HTTP mode, we need to handle Slack events via the receiver
    // The OAuth routes are already handled by Fastify

    // Register Slack event endpoint
    server.post('/slack/events', async (request, reply) => {
      // URL verification challenge
      const body = request.body as { type?: string; challenge?: string }
      if (body.type === 'url_verification' && body.challenge) {
        return reply.send({ challenge: body.challenge })
      }

      // Process event through Bolt
      // This is a simplified approach - in production you might want
      // to use ExpressReceiver or a custom receiver
      await slackApp.processEvent({
        body: request.body as Record<string, unknown>,
        ack: async (response: unknown) => {
          if (response) {
            return reply.send(response)
          }
          return reply.send()
        },
      })
    })

    logger.info('Slack app configured in HTTP Mode')
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...')

    await server.close()
    await slackApp.stop()

    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  logger.info({ port: env.PORT, socketMode: env.SOCKET_MODE }, 'Computer is running')
}

main().catch((error) => {
  logger.fatal({ error }, 'Failed to start')
  process.exit(1)
})
