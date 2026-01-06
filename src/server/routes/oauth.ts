import type { FastifyInstance } from 'fastify'
import type { Installation } from '@slack/oauth'
import { InstallProvider } from '@slack/oauth'
import { env } from '../../env.js'
import { db } from '../../db.js'
import { logger } from '../../utils/logger.js'

// Create install provider for OAuth
const installer = new InstallProvider({
  clientId: env.SLACK_CLIENT_ID,
  clientSecret: env.SLACK_CLIENT_SECRET,
  stateSecret: env.SLACK_SIGNING_SECRET,
  installationStore: {
    storeInstallation: async (installation) => {
      if (installation.isEnterpriseInstall && installation.enterprise) {
        throw new Error('Enterprise installs not supported')
      }

      if (!installation.team?.id) {
        throw new Error('Missing team ID')
      }

      const teamId = installation.team.id
      const teamName = installation.team.name
      const botToken = installation.bot?.token
      const botId = installation.bot?.id
      const botUserId = installation.bot?.userId
      const installedBy = installation.user.id

      if (!botToken || !botId || !botUserId) {
        throw new Error('Missing bot credentials')
      }

      await db.installation.upsert({
        where: { teamId },
        create: {
          teamId,
          teamName,
          botToken,
          botId,
          botUserId,
          installedBy,
        },
        update: {
          teamName,
          botToken,
          botId,
          botUserId,
        },
      })

      logger.info({ teamId, teamName }, 'Installation stored')
    },

    fetchInstallation: async (installQuery): Promise<Installation> => {
      if (installQuery.isEnterpriseInstall) {
        throw new Error('Enterprise installs not supported')
      }

      if (!installQuery.teamId) {
        throw new Error('Missing team ID')
      }

      const installation = await db.installation.findUnique({
        where: { teamId: installQuery.teamId },
      })

      if (!installation) {
        throw new Error('Installation not found')
      }

      return {
        team: { id: installation.teamId, name: installation.teamName ?? undefined },
        enterprise: undefined,
        bot: {
          token: installation.botToken,
          id: installation.botId,
          userId: installation.botUserId,
          scopes: ['app_mentions:read', 'chat:write', 'commands', 'channels:read'],
        },
        user: { id: installation.installedBy, token: undefined, scopes: undefined },
      } as Installation
    },

    deleteInstallation: async (installQuery) => {
      if (!installQuery.teamId) {
        throw new Error('Missing team ID')
      }

      await db.installation.delete({
        where: { teamId: installQuery.teamId },
      })

      logger.info({ teamId: installQuery.teamId }, 'Installation deleted')
    },
  },
})

export async function oauthRoutes(fastify: FastifyInstance) {
  // OAuth install URL
  fastify.get('/slack/oauth/install', async (_request, reply) => {
    const url = await installer.generateInstallUrl({
      scopes: ['app_mentions:read', 'chat:write', 'commands', 'channels:read', 'im:history'],
      redirectUri: `${env.BASE_URL}/slack/oauth/callback`,
    })

    return reply.redirect(url)
  })

  // OAuth callback
  fastify.get('/slack/oauth/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string }

    if (query.error) {
      logger.error({ error: query.error }, 'OAuth error')
      return reply.status(400).send(`Installation failed: ${query.error}`)
    }

    try {
      await installer.handleCallback(
        request.raw,
        reply.raw,
        {
          success: (_installation, _options, _req, res) => {
            res.writeHead(302, { Location: `${env.BASE_URL}/slack/oauth/success` })
            res.end()
          },
          failure: (error, _options, _req, res) => {
            logger.error({ error }, 'OAuth callback failure')
            res.writeHead(500)
            res.end(`Installation failed: ${error.message}`)
          },
        }
      )
    } catch (error) {
      logger.error({ error }, 'OAuth callback error')
      return reply.status(500).send('Installation failed')
    }
  })

  // Success page
  fastify.get('/slack/oauth/success', async (_request, reply) => {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Computer - Installed</title>
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 100px auto; text-align: center; }
            h1 { color: #1a1a1a; }
            p { color: #666; line-height: 1.6; }
            code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Computer installed!</h1>
          <p>Next steps:</p>
          <ol style="text-align: left;">
            <li>Run <code>/computer connect</code> to set your Cursor API key</li>
            <li>In a channel, run <code>/computer settings</code> to bind it to a repo</li>
            <li>Mention <code>@Computer</code> with your request!</li>
          </ol>
        </body>
      </html>
    `)
  })
}

export { installer }
