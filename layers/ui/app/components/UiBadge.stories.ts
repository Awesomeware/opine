import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiBadge from './UiBadge.vue'

const meta = {
  title: 'UI/Badge',
  component: UiBadge,
  render: (args) => ({
    components: { UiBadge },
    setup: () => ({ args }),
    template: '<UiBadge v-bind="args">Under review</UiBadge>',
  }),
} satisfies Meta<typeof UiBadge>
export default meta

type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Review: Story = { args: { tone: 'review' } }
export const Complete: Story = { args: { tone: 'complete' } }
