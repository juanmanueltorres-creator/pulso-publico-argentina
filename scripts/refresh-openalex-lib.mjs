import { fetchOpenAlexSignal } from './fetch-openalex.mjs'

const OPENALEX_SIGNAL_ID = 'openalex-argentina-works'

function replaceOpenAlexSignal(snapshot, openAlexSignal) {
  if (snapshot?.schemaVersion !== '1.0' || !Array.isArray(snapshot.signals)) {
    throw new Error('Signal snapshot must use schemaVersion 1.0 and contain signals')
  }

  if (openAlexSignal?.id !== OPENALEX_SIGNAL_ID || typeof openAlexSignal.fetchedAt !== 'string') {
    throw new Error(`Replacement signal must be ${OPENALEX_SIGNAL_ID}`)
  }

  const matches = snapshot.signals.filter((signal) => signal?.id === OPENALEX_SIGNAL_ID).length
  if (matches !== 1) {
    throw new Error(`Snapshot must contain exactly one ${OPENALEX_SIGNAL_ID} signal`)
  }

  return {
    ...snapshot,
    generatedAt: openAlexSignal.fetchedAt,
    signals: snapshot.signals.map((signal) =>
      signal?.id === OPENALEX_SIGNAL_ID ? openAlexSignal : signal,
    ),
  }
}

export async function refreshOpenAlexSnapshot(
  snapshot,
  fetchImpl = fetch,
  fetchedAt = new Date().toISOString(),
  year = new Date(fetchedAt).getUTCFullYear(),
) {
  const openAlexSignal = await fetchOpenAlexSignal(fetchImpl, fetchedAt, year)
  return replaceOpenAlexSignal(snapshot, openAlexSignal)
}
