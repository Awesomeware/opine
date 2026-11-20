<script setup lang="ts">
import { useFeedbackTagManagement } from '../composables/useFeedbackTagManagement'

const props = defineProps<{ owner: string }>()

const { tags, ready, allowed, loading, error, createError, name, busy, createWrite, load, create } =
  useFeedbackTagManagement(props)
</script>
<template>
  <p v-if="error" role="alert">
    {{ error }}
    <UiButton type="button" :busy="loading" @click="load">Reload tags</UiButton>
  </p>
  <p v-if="createError" role="alert">{{ createError }}</p>
  <p v-if="createWrite.warning.value" role="status">{{ createWrite.warning.value }}</p>
  <p v-if="loading" role="status">Loading tags…</p>
  <p v-if="ready && !allowed">Only administrators can manage tags.</p>
  <template v-if="allowed">
    <p class="help">
      Tags are optional labels for feedback. Disabling a tag prevents new selections and keeps it on
      existing posts.
    </p>
    <form class="create-tag" @submit.prevent="create">
      <div class="field">
        <label for="new-tag-name">New tag name</label>
        <input id="new-tag-name" v-model="name" maxlength="40" required :readonly="busy" />
      </div>
      <UiButton type="submit" :busy="busy" variant="primary">Create tag</UiButton>
    </form>
    <div class="tag-list">
      <FeedbackTagAdminRow
        v-for="tag in tags"
        :key="tag.id"
        :tag="tag"
        :owner="owner"
        @saved="load"
      />
    </div>
  </template>
</template>
<style scoped>
.help {
  color: var(--color-text-muted);
  max-width: 650px;
}
.create-tag {
  display: flex;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
  margin: 24px 0;
}
.create-tag .field {
  flex: 1;
  max-width: 400px;
  min-width: 160px;
}
.tag-list {
  border-top: 1px solid var(--color-border);
}
</style>
