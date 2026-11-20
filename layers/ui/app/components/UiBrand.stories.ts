import type { Meta, StoryObj } from '@storybook/vue3-vite'
import UiBrand from './UiBrand.vue'
const meta = { title: 'UI/Brand', component: UiBrand } satisfies Meta<typeof UiBrand>
export default meta
export const Default: StoryObj<typeof meta> = {}
