import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FeedbackOfficialResponse from './FeedbackOfficialResponse.vue'
const meta = {
  title: 'Feedback/OfficialResponse',
  component: FeedbackOfficialResponse,
  args: {
    featured: true,
    response: {
      id: '00000000-0000-4000-8000-000000000002',
      postId: '00000000-0000-4000-8000-000000000001',
      author: { name: 'Community team' },
      body: "We want travel to remain meaningful. We're looking into where group formation takes the most time. Which part tends to hold your group up?",
      createdAt: '2026-11-19T12:00:00.000Z',
      previousStatus: 'new',
      status: 'reviewing',
    },
  },
} satisfies Meta<typeof FeedbackOfficialResponse>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const StatusUnchanged: Story = {
  args: {
    response: {
      ...meta.args.response,
      previousStatus: null,
      status: null,
      body: 'Thank you for the examples. We are looking into the time spent finding replacements.',
    },
  },
}
export const Linked: Story = { args: { featured: false, linked: true, outside: true } }
