import { fetchInpiSignal } from './fetch-inpi.mjs'

const INPI_SIGNAL_ID = 'inpi-patents'

function replaceInpiSignal(snapshot, inpiSignal) {
  if (snapshot?.schemaVersion !== '1.0' || !Array.isArray(snapshot.signals)) {
    throw new Error('Signal snapshot must use schemaVersion 1.0 and contain signals')
  }

  if (inpiSignal?.id !== INPI_SIGNAL_ID || typeof inpiSignal.fetchedAt !== 'string') {
    throw new Error(`Replacement signal must be ${INPI_SIGNAL_ID}`)
  }

  const matches = snapshot.signals.filter((signal) => signal?.id === INPI_SIGNAL_ID).length
  if (matches !== 1) {
    throw new Error(`Snapshot must contain exactly one ${INPI_SIGNAL_ID} signal`)
  }

  return {
    ...snapshot,
    generatedAt: inpiSignal.fetchedAt,
    signals: snapshot.signals.map((signal) =>
      signal?.id === INPI_SIGNAL_ID ? inpiSignal : signal,
    ),
  }
}

export async function refreshInpiSnapshot(
  snapshot,
  fetchImpl = fetch,
  fetchedAt = new Date().toISOString(),
) {
  const inpiSignal = await fetchInpiSignal(fetchImpl, fetchedAt)
  return replaceInpiSignal(snapshot, inpiSignal)
}
