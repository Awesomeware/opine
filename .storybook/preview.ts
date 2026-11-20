import type { Preview } from '@storybook/vue3-vite'
import '../layers/ui/app/assets/css/tokens.css'
import '../layers/ui/app/assets/css/base.css'

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
  },
}

export default preview
