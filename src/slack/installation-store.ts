import type { Installation, InstallationQuery } from '@slack/oauth'
import type { InstallationStore } from '@slack/bolt'
import { db } from '../db.js'
import { logger } from '../utils/logger.js'

export const prismaInstallationStore: InstallationStore = {
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

  fetchInstallation: async (installQuery: InstallationQuery<boolean>): Promise<Installation> => {
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

    // Return in Slack's expected format with required enterprise field
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

  deleteInstallation: async (installQuery: InstallationQuery<boolean>) => {
    if (!installQuery.teamId) {
      throw new Error('Missing team ID')
    }

    await db.installation.delete({
      where: { teamId: installQuery.teamId },
    })

    logger.info({ teamId: installQuery.teamId }, 'Installation deleted')
  },
}
