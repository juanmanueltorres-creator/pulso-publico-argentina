import { parseCammesaRenewables } from './adapters/cammesa.mjs'

const CAMMESA_SIGNAL_ID = 'cammesa-renewables'

export function refreshCammesaSnapshot(snapshot, extracted, fetchedAt = new Date().toISOString()) {
  if (snapshot?.schemaVersion !== '1.0' || !Array.isArray(snapshot.signals)) {
    throw new Error('Signal snapshot must use schemaVersion 1.0 and contain signals')
  }

  const matches = snapshot.signals.filter((signal) => signal?.id === CAMMESA_SIGNAL_ID).length
  if (matches !== 1) {
    throw new Error(`Snapshot must contain exactly one ${CAMMESA_SIGNAL_ID} signal`)
  }

  const cammesaSignal = parseCammesaRenewables(extracted, fetchedAt)

  return {
    ...snapshot,
    generatedAt: cammesaSignal.fetchedAt,
    signals: snapshot.signals.map((signal) =>
      signal?.id === CAMMESA_SIGNAL_ID ? cammesaSignal : signal,
    ),
  }
}
