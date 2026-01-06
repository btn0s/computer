import type { FastifyInstance } from 'fastify'
import { db } from '../../db.js'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    try {
      // Check database connection
      await db.$queryRaw`SELECT 1`

      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      return reply.status(503).send({
        status: 'error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      })
    }
  })
}
