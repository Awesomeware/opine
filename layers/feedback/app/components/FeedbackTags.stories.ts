import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FeedbackTags from './FeedbackTags.vue'
const meta = {
  title: 'Feedback/Tags',
  component: FeedbackTags,
  args: {
    tags: [
      { id: 'gameplay', name: 'Gameplay', isActive: true, version: 1 },
      { id: 'ui', name: 'UI', isActive: true, version: 1 },
    ],
  },
} satisfies Meta<typeof FeedbackTags>
export default meta
export const Default: StoryObj<typeof meta> = {}
