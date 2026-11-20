<script setup lang="ts">
import { useFeedbackReviewQueue } from '../composables/useFeedbackReviewQueue'
import { postStatuses, statusLabels } from '../../shared/status'

const {
  filters,
  posts,
  categories,
  categoryError,
  categoriesLoading,
  loadCategories,
  cursor,
  loading,
  loaded,
  error,
  load,
  apply,
} = useFeedbackReviewQueue()
</script>
<template>
  <p>Oldest feedback first. The initial queue shows New posts awaiting review.</p>
  <form class="panel filters" @submit.prevent="apply">
    <div class="field">
      <label for="queue-category">Category</label>
      <select
        id="queue-category"
        v-model="filters.category"
        :disabled="categoriesLoading || !!categoryError"
      >
        <option value="">All categories</option>
        <option v-for="category in categories" :key="category.id" :value="category.slug">
          {{ category.name }}
        </option>
      </select>
    </div>
    <div class="field">
      <label for="queue-status">Status</label>
      <select id="queue-status" v-model="filters.status">
        <option value="all">All statuses</option>
        <option v-for="status in postStatuses" :key="status" :value="status">
          {{ statusLabels[status] }}
        </option>
      </select>
    </div>
    <label>
      <input v-model="filters.followUp" type="checkbox" />
      Needs follow-up
    </label>
    <UiButton type="submit">Apply queue filters</UiButton>
  </form>
  <p v-if="categoryError" role="alert">
    {{ categoryError }}
    <UiButton :busy="categoriesLoading" @click="loadCategories">Retry categories</UiButton>
  </p>
  <p class="field-help">
    Needs follow-up shows member comments since the latest official response. Select All statuses to
    check follow-up across the workflow.
  </p>
  <p v-if="error" role="alert">
    {{ error }}
    <UiButton type="button" @click="load()">Retry queue</UiButton>
  </p>
  <p v-if="loading" role="status">Loading queue…</p>
  <p v-else-if="loaded && !posts.length">No feedback needs review with these filters.</p>
  <ol class="feedback-list">
    <li v-for="post in posts" :key="post.id" class="panel feedback-card">
      <p>{{ post.category.name }} · {{ statusLabels[post.status] }}</p>
      <h2><NuxtLink :to="`/feedback/${post.id}`">{{ post.title }}</NuxtLink></h2>
      <p>{{ post.excerpt }}</p>
    </li>
  </ol>
  <UiButton v-if="cursor" type="button" :busy="loading" @click="load(true)">
    Load more review items
  </UiButton>
</template>
