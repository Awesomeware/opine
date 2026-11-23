import { ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FeedbackTagPicker from './FeedbackTagPicker.vue'
const tags = [
  { id: 'gameplay', name: 'Gameplay', icon: '🕹️', isActive: true, version: 1 },
  { id: 'ui', name: 'UI', icon: null, isActive: true, version: 1 },
  { id: 'old', name: 'Older tag', icon: null, isActive: false, version: 2 },
]
const meta = {
  title: 'Feedback/TagPicker',
  component: FeedbackTagPicker,
  args: { tags, name: 'example-tags', modelValue: [] },
  render: (args) => ({
    components: { FeedbackTagPicker },
    setup() {
      const selected = ref([...args.modelValue])
      return { args, selected }
    },
    template: '<FeedbackTagPicker v-bind="args" v-model="selected" />',
  }),
} satisfies Meta<typeof FeedbackTagPicker>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Selected: Story = { args: { modelValue: ['gameplay', 'ui'] } }
export const Inactive: Story = { args: { modelValue: ['old'], retainedIds: ['old'] } }
