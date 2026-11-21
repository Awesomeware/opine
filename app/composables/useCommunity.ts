import { useFetch } from '#app'
import type { CommunitySettings } from '../../shared/community'

/** Share the public configuration read between the application shell and rules page. */
export function useCommunity() {
  return useFetch<CommunitySettings>('/api/community', { key: 'community' })
}
