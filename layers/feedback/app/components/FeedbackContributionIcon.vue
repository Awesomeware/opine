<script setup lang="ts">
import UiIcon from '../../../ui/app/components/UiIcon.vue'
import type { ContributionType } from '../../shared/contribution-types'
defineProps<{ type: ContributionType }>()
const icons = {
  context: 'context',
  different_view: 'different-view',
  suggestion: 'suggestion',
  question: 'question',
} as const
</script>
<template><UiIcon :name="icons[type]" /></template>
