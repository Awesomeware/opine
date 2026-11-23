<script setup lang="ts">
import Badge from '../../../../ui/app/components/Badge.vue'
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

<template><Badge :tone="tones[status]">{{ statusLabels[status] }}</Badge></template>
