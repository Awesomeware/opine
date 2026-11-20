import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FeedbackStatusBadge from './FeedbackStatusBadge.vue'
const meta = {
  title: 'Feedback/StatusBadge',
  component: FeedbackStatusBadge,
  args: { status: 'reviewing' },
} satisfies Meta<typeof FeedbackStatusBadge>
export default meta
export const Default: StoryObj<typeof meta> = {}
export const Delivered: StoryObj<typeof meta> = { args: { status: 'delivered' } }
