<script setup lang="ts">
import Icon from '../../../../ui/app/components/Icon.vue'
import type { ContributionType } from '../../../shared/discussion/contribution-types'

defineProps<{ type: ContributionType }>()

const icons = {
  context: 'context',
  different_view: 'different-view',
  suggestion: 'suggestion',
  question: 'question',
} as const
</script>

<template><Icon :name="icons[type]" /></template>
