import { fetchConaeHotspots } from './fetch-conae-hotspots.mjs'
import { pointInFeatureCollection } from './lib/geo.mjs'
import { prepareTerritorialPublication } from './lib/territorial-snapshot.mjs'

const WINDOW_HOURS = 24
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000
const CONAE_CATALOG_URL = 'https://catalogos.conae.gov.ar/catalogo/catalogoGeoServiciosOGC.html'

export function selectConaeHotspots(events, argentinaGeometry, checkedAt) {
  if (!Array.isArray(events)) {
    throw new Error('CONAE hotspot events must be an array')
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

export async function refreshConaeHotspotSnapshot(
  previous,
  argentinaGeometry,
  fetchImpl = fetch,
  checkedAt = new Date().toISOString(),
) {
  const events = await fetchConaeHotspots(fetchImpl)
  const selected = selectConaeHotspots(events, argentinaGeometry, checkedAt)

  const candidate = {
    schemaVersion: '1.0',
    kind: 'thermal-hotspot',
    generatedAt: checkedAt,
    sourceCheckedAt: checkedAt,
    window: { hours: WINDOW_HOURS },
    freshness: { staleAfterMinutes: 240 },
    source: {
      name: 'CONAE',
      url: CONAE_CATALOG_URL,
      kind: 'official',
    },
    method: {
      type: 'wfs',
      note: 'Capa oficial VIIRS de focos de calor de las últimas 24 horas publicada por CONAE mediante WFS.',
    },
    limitations: [
      'Un foco de calor es una anomalía térmica satelital y no implica un incendio confirmado.',
      'La confianza de detección describe la señal térmica y no equivale a probabilidad de incendio.',
      'Pulso Público conserva FRP como potencia radiativa en MW y no la convierte en una escala de peligro.',
    ],
    events: selected,
  }

  return prepareTerritorialPublication(previous, candidate, checkedAt)
}
