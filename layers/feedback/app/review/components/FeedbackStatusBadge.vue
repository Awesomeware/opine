<script setup lang="ts">
import UiBadge from '../../../../ui/app/components/UiBadge.vue'
import { statusLabels, type PostStatus } from '../../../shared/status'

defineProps<{ status: PostStatus }>()

const tones = {
  new: 'neutral',
  reviewing: 'review',
  planned: 'planned',
  delivered: 'complete',
  not_planned: 'neutral',
  answered: 'complete',
} as const
</script>

<template><UiBadge :tone="tones[status]">{{ statusLabels[status] }}</UiBadge></template>
