import type { BaseTerritorialEvent, TerritorialSnapshot } from '../types/territorial'

export function territorialAvailability(
  snapshot: TerritorialSnapshot<BaseTerritorialEvent>,
  now = new Date(),
): 'available' | 'stale' {
  const ageMs = now.getTime() - Date.parse(snapshot.sourceCheckedAt)
  return ageMs >= snapshot.freshness.staleAfterMinutes * 60_000 ? 'stale' : 'available'
}
