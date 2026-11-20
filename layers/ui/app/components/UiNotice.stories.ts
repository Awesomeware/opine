import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiNotice from './UiNotice.vue'

const meta = {
  title: 'UI/Notice',
  component: UiNotice,
  render: (args) => ({
    components: { UiNotice },
    setup: () => ({ args }),
    template:
      '<UiNotice v-bind="args" role="alert">Please check the highlighted fields.</UiNotice>',
  }),
} satisfies Meta<typeof UiNotice>
export default meta

type Story = StoryObj<typeof meta>
export const Default: Story = {}
