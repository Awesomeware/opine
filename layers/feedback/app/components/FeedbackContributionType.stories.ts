import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref, watch } from 'vue'
import FeedbackContributionType from './FeedbackContributionType.vue'

const meta = {
  title: 'Feedback/ContributionType',
  component: FeedbackContributionType,
  args: { name: 'contribution-type', modelValue: '' },
  render: (args) => ({
    components: { FeedbackContributionType },
    setup() {
      const selected = ref(args.modelValue)
      watch(
        () => args.modelValue,
        (value) => {
          selected.value = value
        },
      )
      return { args, selected }
    },
    template: '<FeedbackContributionType v-bind="args" v-model="selected" />',
  }),
} satisfies Meta<typeof FeedbackContributionType>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Error: Story = { args: { error: 'Choose a contribution type.' } }
export const Disabled: Story = { args: { modelValue: 'context', disabled: true } }
export const Legacy: Story = { args: { legacy: true } }
