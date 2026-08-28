import type { SignalSnapshot } from '../types/signal'
import { validateSnapshot } from './validateSnapshot'

export async function loadSignals(fetcher: typeof fetch = fetch): Promise<SignalSnapshot> {
  const response = await fetcher('/data/signals.json', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load public signals snapshot: HTTP ${response.status}`)
  }

  return validateSnapshot(await response.json())
}
