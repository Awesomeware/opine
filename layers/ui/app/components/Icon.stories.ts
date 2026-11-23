import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Icon from './Icon.vue'
const meta = { title: 'UI/Icon', component: Icon, args: { name: 'context' } } satisfies Meta<
  typeof Icon
>
export default meta
export const Default: StoryObj<typeof meta> = {}
