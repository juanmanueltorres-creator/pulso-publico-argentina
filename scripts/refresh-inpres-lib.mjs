import { fetchInpresEarthquakes, INPRES_SOURCE_URL } from './fetch-inpres.mjs'
import { pointInFeatureCollection } from './lib/geo.mjs'
import { prepareTerritorialPublication } from './lib/territorial-snapshot.mjs'

const WINDOW_HOURS = 168
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

export function selectInpresEarthquakes(events, argentinaGeometry, checkedAt) {
  if (!Array.isArray(events)) {
    throw new Error('INPRES events must be an array')
  }

  const checkedAtMs = Date.parse(checkedAt)
  if (!Number.isFinite(checkedAtMs)) {
    throw new Error('checkedAt must be a valid timestamp')
  }

  const cutoff = checkedAtMs - WINDOW_HOURS * 60 * 60 * 1000

  return events
    .filter((event) => {
      const occurredAtMs = Date.parse(event?.occurredAt)
      return (
        Number.isFinite(occurredAtMs) &&
        occurredAtMs >= cutoff &&
        occurredAtMs <= checkedAtMs + FUTURE_TOLERANCE_MS
      )
    })
    .filter((event) =>
      pointInFeatureCollection([event.longitude, event.latitude], argentinaGeometry),
    )
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
}

export async function refreshInpresSnapshot(
  previous,
  argentinaGeometry,
  fetchImpl = fetch,
  checkedAt = new Date().toISOString(),
) {
  const events = await fetchInpresEarthquakes(fetchImpl)
  const selected = selectInpresEarthquakes(events, argentinaGeometry, checkedAt)

  const candidate = {
    schemaVersion: '1.0',
    kind: 'earthquake',
    generatedAt: checkedAt,
    sourceCheckedAt: checkedAt,
    window: { hours: WINDOW_HOURS },
    freshness: { staleAfterMinutes: 240 },
    source: {
      name: 'INPRES',
      url: INPRES_SOURCE_URL,
      kind: 'official',
    },
    method: {
      type: 'scrape',
      note: 'Tabla oficial de sismos recientes publicada por INPRES.',
    },
    limitations: [
      'Se publican sólo epicentros dentro del límite nacional usado por Pulso Público.',
      'La ventana visible cubre las últimas 168 horas respecto del último chequeo exitoso.',
    ],
    events: selected,
  }

  return prepareTerritorialPublication(previous, candidate, checkedAt)
}
