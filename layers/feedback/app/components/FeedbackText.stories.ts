import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FeedbackText from './FeedbackText.vue'

const meta = {
  title: 'Feedback/Text',
  component: FeedbackText,
  args: {
    text: 'Please make the quest tracker easier to read.\nExample: https://example.com/feedback\n<script>alert("example")</script> and javascript:alert(1) are plain text.',
  },
} satisfies Meta<typeof FeedbackText>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const LongContent: Story = {
  args: {
    text: `A long link should wrap within the discussion on small screens:\nhttps://example.com/${'quest-tracker-'.repeat(30)}\n\nThe original paragraph breaks should remain readable.`,
  },
}
