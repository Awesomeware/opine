import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Button from './Button.vue'

const meta = {
  title: 'UI/Button',
  component: Button,
  args: { variant: 'default', type: 'button', disabled: false, busy: false },
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: '<Button v-bind="args">Save changes</Button>',
  }),
} satisfies Meta<typeof Button>
export default meta

type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Primary: Story = { args: { variant: 'primary' } }
export const Disabled: Story = { args: { disabled: true } }
export const Busy: Story = { args: { busy: true } }
export const Quiet: Story = { args: { variant: 'quiet' } }
export const HoverHighlight: Story = { args: { hoverHighlight: true } }
export const DisabledHighlight: Story = { args: { hoverHighlight: true, disabled: true } }
export const Tab: Story = {
  args: { variant: 'tab' },
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: '<Button v-bind="args" aria-pressed="true">All contributions</Button>',
  }),
}
