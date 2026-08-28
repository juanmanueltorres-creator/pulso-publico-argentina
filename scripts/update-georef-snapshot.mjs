const GEOREF_SIGNAL_ID = 'georef-api-usage'

export function updateGeorefSnapshot(snapshot, georefSignal) {
  if (snapshot?.schemaVersion !== '1.0' || !Array.isArray(snapshot.signals)) {
    throw new Error('Signal snapshot must use schemaVersion 1.0 and contain signals')
  }

  if (georefSignal?.id !== GEOREF_SIGNAL_ID || typeof georefSignal.fetchedAt !== 'string') {
    throw new Error(`Replacement signal must be ${GEOREF_SIGNAL_ID}`)
  }

  const matches = snapshot.signals.filter((signal) => signal?.id === GEOREF_SIGNAL_ID).length
  if (matches !== 1) {
    throw new Error(`Snapshot must contain exactly one ${GEOREF_SIGNAL_ID} signal`)
  }

  return {
    ...snapshot,
    generatedAt: georefSignal.fetchedAt,
    signals: snapshot.signals.map((signal) =>
      signal?.id === GEOREF_SIGNAL_ID ? georefSignal : signal,
    ),
  }
}
