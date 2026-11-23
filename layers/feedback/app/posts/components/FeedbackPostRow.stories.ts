import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FeedbackPostRow from './FeedbackPostRow.vue'
const meta = {
  title: 'Feedback/PostRow',
  component: FeedbackPostRow,
  args: {
    post: {
      id: 'example-grouping',
      tags: [{ id: 'gameplay', name: 'Gameplay', icon: '🕹️', isActive: true, version: 1 }],
      title: 'Finding a group takes most of my evening',
      excerpt: 'Forty minutes organising a group, barely an hour left to play.',
      lockedAt: null,
      status: 'reviewing',
      createdAt: '2026-11-20T12:00:00.000Z',
      author: { name: 'Thalen' },
      category: { id: 'grouping', slug: 'grouping', name: 'Grouping & travel' },
    },
  },
} satisfies Meta<typeof FeedbackPostRow>
export default meta
export const Default: StoryObj<typeof meta> = {}
export const LongContent: StoryObj<typeof meta> = {
  args: {
    post: {
      ...meta.args.post,
      title:
        'A long proposal about making group invitations easier to notice during busy encounters',
      excerpt:
        'The invitation can disappear behind other windows while I am fighting. A clearer reminder would help groups get together without repeated messages.',
      status: 'planned',
    },
  },
}

export const Locked: StoryObj<typeof meta> = {
  args: { post: { ...meta.args.post, lockedAt: '2026-11-20T13:00:00.000Z' } },
}
