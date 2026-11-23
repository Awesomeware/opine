import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Brand from './Brand.vue'
const meta = { title: 'UI/Brand', component: Brand } satisfies Meta<typeof Brand>
export default meta
export const Default: StoryObj<typeof meta> = {}
