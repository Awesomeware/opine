import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Notice from './Notice.vue'

const meta = {
  title: 'UI/Notice',
  component: Notice,
  render: (args) => ({
    components: { Notice },
    setup: () => ({ args }),
    template: '<Notice v-bind="args" role="alert">Please check the highlighted fields.</Notice>',
  }),
} satisfies Meta<typeof Notice>
export default meta

type Story = StoryObj<typeof meta>
export const Default: Story = {}
