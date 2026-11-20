import { authClient } from '../auth-client'

/** Start Discord sign-in and return a displayable failure; callers own view state. */
export async function startDiscordSignIn(callbackURL: string, errorCallbackURL?: string) {
  try {
    const result = await authClient.signIn.social({
      provider: 'discord',
      callbackURL,
      ...(errorCallbackURL ? { errorCallbackURL } : {}),
    })

    return result.error ? 'Unable to start sign-in. Please try again.' : ''
  } catch {
    return 'Unable to start sign-in. Please try again.'
  }
}
