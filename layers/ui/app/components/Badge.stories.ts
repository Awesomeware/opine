import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Badge from './Badge.vue'

const meta = {
  title: 'UI/Badge',
  component: Badge,
  render: (args) => ({
    components: { Badge },
    setup: () => ({ args }),
    template: '<Badge v-bind="args">Under review</Badge>',
  }),
} satisfies Meta<typeof Badge>
export default meta

type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Review: Story = { args: { tone: 'review' } }
export const Complete: Story = { args: { tone: 'complete' } }
export const Pill: Story = {
  args: { shape: 'pill' },
  render: (args) => ({
    components: { Badge },
    setup: () => ({ args }),
    template: '<Badge v-bind="args">Gameplay</Badge>',
  }),
}
export const PillWithIcon: Story = {
  ...Pill,
  args: { shape: 'pill', icon: '🕹️' },
}
