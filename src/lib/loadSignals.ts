import type { SignalSnapshot } from '../types/signal'
import { validateSnapshot } from './validateSnapshot'

function snapshotUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}data/signals.json`
}

export async function loadSignals(
  fetcher: typeof fetch = fetch,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<SignalSnapshot> {
  const response = await fetcher(snapshotUrl(baseUrl), { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load public signals snapshot: HTTP ${response.status}`)
  }

  return validateSnapshot(await response.json())
}
