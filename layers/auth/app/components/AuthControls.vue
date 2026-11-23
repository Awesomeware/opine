<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { authClient } from '../auth-client'
import { startDiscordSignIn } from '../api/session'

const session = authClient.useSession()
const route = useRoute()
const busy = ref(false)
const errorMessage = ref('')
const accountControls = ref<HTMLElement | null>(null)

async function signIn() {
  if (busy.value) {
    return
  }

  busy.value = true
  errorMessage.value = ''

  const error = await startDiscordSignIn(
    route.path === '/feedback/new' ? '/feedback/new' : '/',
    '/sign-in',
  )

  errorMessage.value = error ? 'Unable to start Discord sign-in. Please try again.' : ''
  busy.value = false
}

async function signOut() {
  busy.value = true
  errorMessage.value = ''

  try {
    const { error } = await authClient.signOut()
    if (error) {
      errorMessage.value = 'Unable to sign out. Please try again.'
    }
  } catch {
    errorMessage.value = 'Unable to sign out. Please try again.'
  } finally {
    busy.value = false
  }

  if (!errorMessage.value) {
    // The sign-out button disappears; keep focus in the account controls.
    await nextTick()
    accountControls.value?.focus()
  }
}

async function retrySession() {
  busy.value = true
  errorMessage.value = ''

  try {
    await session.value.refetch()
  } catch {
    errorMessage.value = 'Unable to check your session. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    ref="accountControls"
    class="account-controls"
    role="group"
    aria-label="Account"
    tabindex="-1"
  >
    <p v-if="session.isPending" role="status">Checking your session…</p>
    <template v-else-if="session.error">
      <p role="alert">Unable to check your session.</p>
      <Button variant="quiet" type="button" :busy="busy" @click="retrySession">
        Retry session
      </Button>
    </template>
    <template v-else-if="session.data">
      <p>Signed in as {{ session.data.user.name }}</p>
      <Button variant="quiet" type="button" :busy="busy" @click="signOut">Sign out</Button>
    </template>
    <Button v-else variant="quiet" type="button" :busy="busy" @click="signIn">
      Sign in with Discord
    </Button>
    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.account-controls {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.8rem;
  min-width: 0;
}
p {
  margin: 0;
  max-width: 240px;
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .account-controls {
    max-width: 65%;
    gap: 2px;
    font-size: 0.75rem;
    --ui-button-padding: 6px 8px;
  }
}
</style>
