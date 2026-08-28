import { fetchGeorefSignal } from './fetch-georef.mjs'
import { updateGeorefSnapshot } from './update-georef-snapshot.mjs'

export async function refreshGeorefSnapshot(
  snapshot,
  fetchImpl = fetch,
  fetchedAt = new Date().toISOString(),
) {
  const georefSignal = await fetchGeorefSignal(fetchImpl, fetchedAt)
  return updateGeorefSnapshot(snapshot, georefSignal)
}
