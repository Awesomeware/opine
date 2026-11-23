<script setup lang="ts">
import { useFeedbackTagManagement } from '../composables/useFeedbackTagManagement'

const props = defineProps<{ owner: string }>()

const { tags, ready, allowed, loading, error, createError, name, icon, busy, load, create } =
  useFeedbackTagManagement(props)
</script>
<template>
  <p v-if="error" role="alert">
    {{ error }}
    <Button type="button" :busy="loading" @click="load">Reload tags</Button>
  </p>
  <p v-if="createError" id="new-tag-error" role="alert">{{ createError }}</p>
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
        <input
          id="new-tag-name"
          v-model="name"
          maxlength="40"
          required
          :readonly="busy"
          :aria-describedby="createError ? 'new-tag-error' : undefined"
        />
      </div>
      <div class="field">
        <label for="new-tag-icon">New tag icon (optional)</label>
        <input
          id="new-tag-icon"
          v-model="icon"
          maxlength="16"
          :readonly="busy"
          :aria-describedby="`new-tag-icon-help${createError ? ' new-tag-error' : ''}`"
        />
        <p id="new-tag-icon-help" class="help">Use an emoji, or leave blank for no icon.</p>
      </div>
      <Button type="submit" :busy="busy" variant="primary">Create tag</Button>
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
