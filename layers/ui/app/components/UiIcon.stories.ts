import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiIcon from './UiIcon.vue'
const meta = { title: 'UI/Icon', component: UiIcon, args: { name: 'context' } } satisfies Meta<
  typeof UiIcon
>
export default meta
export const Default: StoryObj<typeof meta> = {}
