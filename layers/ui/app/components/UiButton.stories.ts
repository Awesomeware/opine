import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiButton from './UiButton.vue'

const meta = {
  title: 'UI/Button',
  component: UiButton,
  args: { variant: 'default', type: 'button', disabled: false, busy: false },
  render: (args) => ({
    components: { UiButton },
    setup: () => ({ args }),
    template: '<UiButton v-bind="args">Save changes</UiButton>',
  }),
} satisfies Meta<typeof UiButton>
export default meta

type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Primary: Story = { args: { variant: 'primary' } }
export const Disabled: Story = { args: { disabled: true } }
export const Busy: Story = { args: { busy: true } }
export const Quiet: Story = { args: { variant: 'quiet' } }
export const Tab: Story = {
  args: { variant: 'tab' },
  render: (args) => ({
    components: { UiButton },
    setup: () => ({ args }),
    template: '<UiButton v-bind="args" aria-pressed="true">All contributions</UiButton>',
  }),
}
