<script setup lang="ts">
import type { OfficialResponse } from '../../shared/contracts'
import { statusLabels } from '../../shared/status'
defineProps<{
  response: OfficialResponse
  featured?: boolean
  linked?: boolean
  outside?: boolean
}>()
</script>
<template>
  <article
    :id="featured ? undefined : `response-${response.id}`"
    class="panel official-response"
    :class="{ linked }"
  >
    <p v-if="outside" class="field-help">
      Linked team response · outside the selected filter or current page
    </p>
    <p class="eyebrow">Official team response</p>
    <p class="byline">
      <strong>{{ response.author.name }}</strong> ·
      <time :datetime="response.createdAt">{{
        new Date(response.createdAt).toLocaleString()
      }}</time>
    </p>
    <p v-if="response.status">
      {{ response.previousStatus ? statusLabels[response.previousStatus] : '' }} →
      {{ statusLabels[response.status] }}
    </p>
    <FeedbackText :text="response.body" />
    <NuxtLink
      :to="{
        path: `/feedback/${response.postId}`,
        query: { response: response.id },
        hash: `#response-${response.id}`,
      }"
      >Response link</NuxtLink
    >
  </article>
</template>
<style scoped>
.official-response {
  background: #112f32;
  border: 1px solid #4d9c91;
  padding: 1.25rem;
  margin: 1rem 0;
  overflow-wrap: anywhere;
  scroll-margin-top: 2rem;
}
.linked {
  outline: 2px solid #8bd5c6;
}
</style>
