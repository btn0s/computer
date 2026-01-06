import type { ModalView } from '@slack/types'

export function buildConnectModal(existingKey?: boolean): ModalView {
  return {
    type: 'modal',
    callback_id: 'connect_modal_submit',
    title: {
      type: 'plain_text',
      text: 'Connect Cursor',
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
          text: existingKey
            ? '✅ Your workspace already has a Cursor API key configured. Enter a new key below to replace it.'
            : 'Enter your Cursor API key to enable Computer in this workspace.',
        },
      },
      {
        type: 'input',
        block_id: 'cursor_api_key_block',
        label: {
          type: 'plain_text',
          text: 'Cursor API Key',
        },
        element: {
          type: 'plain_text_input',
          action_id: 'cursor_api_key_input',
          placeholder: {
            type: 'plain_text',
            text: 'Enter your Cursor API key',
          },
        },
        hint: {
          type: 'plain_text',
          text: 'Get your API key from cursor.com/dashboard?tab=background-agents',
        },
      },
    ],
  }
}
