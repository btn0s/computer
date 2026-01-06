import type { ModalView } from '@slack/types'

interface SettingsModalOptions {
  channelId: string
  channelName?: string
  existingConfig?: {
    repoFullName: string
    defaultBranch: string
    dryRunDefault: boolean
  }
}

export function buildSettingsModal(options: SettingsModalOptions): ModalView {
  const { channelId, channelName, existingConfig } = options

  return {
    type: 'modal',
    callback_id: 'settings_modal_submit',
    private_metadata: JSON.stringify({ channelId }),
    title: {
      type: 'plain_text',
      text: 'Channel Settings',
    },
    submit: {
      type: 'plain_text',
      text: 'Save',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Configure Computer for *#${channelName ?? channelId}*`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'input',
        block_id: 'repo_block',
        label: {
          type: 'plain_text',
          text: 'Repository',
        },
        element: {
          type: 'plain_text_input',
          action_id: 'repo_input',
          placeholder: {
            type: 'plain_text',
            text: 'org/repo',
          },
          initial_value: existingConfig?.repoFullName ?? '',
        },
        hint: {
          type: 'plain_text',
          text: 'GitHub repository in format: owner/repo',
        },
      },
      {
        type: 'input',
        block_id: 'branch_block',
        label: {
          type: 'plain_text',
          text: 'Default Branch',
        },
        element: {
          type: 'plain_text_input',
          action_id: 'branch_input',
          placeholder: {
            type: 'plain_text',
            text: 'main',
          },
          initial_value: existingConfig?.defaultBranch ?? 'main',
        },
        optional: true,
      },

      {
        type: 'input',
        block_id: 'dryrun_block',
        label: {
          type: 'plain_text',
          text: 'Dry Run by Default',
        },
        element: {
          type: 'checkboxes',
          action_id: 'dryrun_checkbox',
          options: [
            {
              text: { type: 'plain_text', text: 'Generate patches without creating PRs' },
              value: 'dry_run',
            },
          ],
          initial_options: existingConfig?.dryRunDefault
            ? [{ text: { type: 'plain_text', text: 'Generate patches without creating PRs' }, value: 'dry_run' }]
            : undefined,
        },
        optional: true,
      },
    ],
  }
}
