import { DEFAULT_SETTINGS, type Settings } from '../../../desktop/src/core/types'
import { useSessions } from './useSessions'

// App-owned state from the payload, with defaults until the first payload arrives.
export function useAppState() {
  const payload = useSessions()
  return {
    settings: (payload?.settings ?? DEFAULT_SETTINGS) as Settings,
    names: payload?.names ?? {},
    archived: payload?.archived ?? [],
    keptAt: payload?.keptAt ?? {},
    hasWt: payload?.hasWt ?? false,
    planUsage: payload?.planUsage ?? null,
  }
}
