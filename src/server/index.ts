import Fastify from 'fastify'
import { env } from '../env.js'
import { logger } from '../utils/logger.js'
import { healthRoutes } from './routes/health.js'
import { oauthRoutes } from './routes/oauth.js'
import { webhookRoutes } from './routes/webhooks.js'
import { landingRoutes } from './routes/landing.js'

export async function buildServer() {
  const fastify = Fastify({
    logger: false, // We use our own pino logger
  })

  // Register routes
  await fastify.register(landingRoutes)
  await fastify.register(healthRoutes)
  await fastify.register(oauthRoutes)
  await fastify.register(webhookRoutes)

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    logger.error({ error }, 'Unhandled error')
    reply.status(500).send({ error: 'Internal server error' })
  })

  return fastify
}

export async function startServer() {
  const server = await buildServer()

  await server.listen({ port: env.PORT, host: '0.0.0.0' })
  logger.info({ port: env.PORT }, 'Fastify server started')

  return server
}
