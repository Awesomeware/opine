<script setup lang="ts">
import { useCategoryCorrection } from '../composables/useCategoryCorrection'

const props = defineProps<{ owner: string; postId: string; categoryId: string; version: number }>()
const emit = defineEmits<{ saved: [] }>()

const {
  categories,
  categoriesLoading,
  categoriesError,
  loadCategories,
  reviewing,
  reviewError,
  categoryId,
  busy,
  message,
  conflict,
  latest,
  latestCategory,
  changes,
  cursor,
  loadingHistory,
  historyError,
  save,
  review,
  accept,
  loadHistory,
  name,
} = useCategoryCorrection(props, () => emit('saved'))
</script>
<template>
  <details class="category-correction">
    <summary>Correct category</summary>
    <form class="feedback-form" @submit.prevent="save()">
      <p v-if="categoriesError" role="alert">
        {{ categoriesError }}
        <UiButton :busy="categoriesLoading" @click="loadCategories">Retry categories</UiButton>
      </p>
      <div class="field">
        <label for="correct-category">Corrected category</label>
        <select id="correct-category" v-model="categoryId" :disabled="busy">
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
            :disabled="!category.isActive"
          >
            {{ category.name }}{{ category.isActive ? '' : ' (unavailable)' }}
          </option>
        </select>
      </div>
      <p v-if="message" role="alert">{{ message }}</p>
      <div v-if="conflict">
        <p v-if="reviewError" role="alert">{{ reviewError }}</p>
        <UiButton type="button" :busy="reviewing" @click="review">
          Review category conflict
        </UiButton>
        <div v-if="latest">
          <p>Current category: {{ latestCategory }}</p>
          <FeedbackOfficialResponse
            v-if="latest.latestResponse"
            :response="latest.latestResponse"
            featured
          >
            <template #link="{ href }"><NuxtLink :to="href">Response link</NuxtLink></template>
          </FeedbackOfficialResponse>
          <UiButton type="button" @click="accept">I’ve reviewed the category conflict</UiButton>
        </div>
      </div>
      <UiButton type="submit" :busy="busy" :disabled="busy || conflict">
        Save category correction
      </UiButton>
    </form>
    <h3>Category history</h3>
    <p v-if="historyError" role="alert">
      {{ historyError }}
      <UiButton @click="loadHistory()">Retry category history</UiButton>
    </p>
    <p v-if="!changes.length">No category corrections.</p>
    <ol>
      <li v-for="change in changes" :key="change.id">
        {{ name(change.previousCategoryId) }} → {{ name(change.categoryId) }} ·
        {{ change.actor.name }} · {{ new Date(change.createdAt).toLocaleString() }}
      </li>
    </ol>
    <UiButton
      v-if="cursor"
      type="button"
      :busy="loadingHistory"
      :disabled="loadingHistory"
      @click="loadHistory(true)"
    >
      Load more category history
    </UiButton>
  </details>
</template>
<style scoped>
.category-correction {
  padding: 0.75rem 0;
  font-size: 0.85rem;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
</style>
