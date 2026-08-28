import { fetchConaeCatalogHotspots } from './fetch-conae-hotspots.mjs'
import { pointInFeatureCollection } from './lib/geo.mjs'
import { prepareTerritorialPublication } from './lib/territorial-snapshot.mjs'

const WINDOW_HOURS = 24
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000
const CONAE_CATALOG_URL = 'https://catalogos5.conae.gov.ar/catalogofocos/'

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
  const events = await fetchConaeCatalogHotspots(fetchImpl, checkedAt)
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
      type: 'scrape',
      note: 'Visor público oficial de focos de calor de CONAE: consulta detallada NOAA-20 y SNPP, prefiltrada por bbox y luego filtrada por la geometría argentina de IGN.',
    },
    limitations: [
      'Un foco de calor es una anomalía térmica satelital y no implica un incendio confirmado.',
      'La confianza de detección no equivale a probabilidad de incendio; las categorías visuales de Pulso siguen los cortes de confianza usados por el mapa público de CONAE.',
      'La ruta pública usada para visualizar detecciones en el mapa público no expone FRP, por lo que frpMw se conserva como null en este snapshot.',
      'El payload del mapa público no rotula explícitamente la zona horaria; Pulso interpreta esas marcas temporales como UTC para normalizarlas y declara esta limitación.',
    ],
    events: selected,
  }

  return prepareTerritorialPublication(previous, candidate, checkedAt)
}
