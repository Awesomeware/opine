<script setup lang="ts">
import { nextTick, ref } from 'vue'
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

const categorySelect = ref<HTMLSelectElement | null>(null)

async function acceptConflict() {
  accept()
  await nextTick()
  categorySelect.value?.focus()
}

const items = ref<HTMLOListElement | null>(null)

async function loadMore() {
  const previousCount = changes.value.length
  const focusedElement = document.activeElement
  await loadHistory(true)
  await nextTick()
  if (
    !historyError.value &&
    (document.activeElement === focusedElement || document.activeElement === document.body)
  ) {
    const firstNewItem = items.value?.children.item(previousCount)
    if (firstNewItem instanceof HTMLElement) {
      firstNewItem.focus()
    }
  }
}
</script>
<template>
  <details class="category-correction">
    <summary>Correct category</summary>
    <form class="feedback-form" @submit.prevent="save()">
      <p v-if="categoriesError" role="alert">
        {{ categoriesError }}
        <Button :busy="categoriesLoading" @click="loadCategories">Retry categories</Button>
      </p>
      <div class="field">
        <label for="correct-category">Corrected category</label>
        <select ref="categorySelect" id="correct-category" v-model="categoryId" :disabled="busy">
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
        <Button type="button" :busy="reviewing" @click="review">Review category conflict</Button>
        <div v-if="latest">
          <p>Current category: {{ latestCategory }}</p>
          <FeedbackOfficialResponse
            v-if="latest.latestResponse"
            :response="latest.latestResponse"
            featured
          >
            <template #link="{ href }"><NuxtLink :to="href">Response link</NuxtLink></template>
          </FeedbackOfficialResponse>
          <Button type="button" @click="acceptConflict">I’ve reviewed the category conflict</Button>
        </div>
      </div>
      <Button type="submit" :busy="busy" :disabled="busy || conflict">
        Save category correction
      </Button>
    </form>
    <h3>Category history</h3>
    <p v-if="historyError" role="alert">
      {{ historyError }}
      <Button @click="loadHistory()">Retry category history</Button>
    </p>
    <p v-if="!changes.length">No category corrections.</p>
    <ol ref="items">
      <li tabindex="-1" v-for="change in changes" :key="change.id">
        {{ name(change.previousCategoryId) }} → {{ name(change.categoryId) }} ·
        {{ change.actor.name }} · {{ new Date(change.createdAt).toLocaleString() }}
      </li>
    </ol>
    <Button
      v-if="cursor"
      type="button"
      :busy="loadingHistory"
      :disabled="loadingHistory"
      @click="loadMore"
    >
      Load more category history
    </Button>
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
