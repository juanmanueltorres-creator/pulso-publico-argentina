import { CONAE_WFS_URL, fetchConaeHotspotsWithFallback } from './fetch-conae-hotspots.mjs'
import { NASA_FIRMS_NOAA20_URL, fetchNasaFirmsNoaa20Hotspots } from './fetch-nasa-firms-hotspots.mjs'
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
  let result
  try {
    result = await fetchConaeHotspotsWithFallback(fetchImpl, checkedAt)
  } catch (conaeError) {
    try {
      const events = await fetchNasaFirmsNoaa20Hotspots(fetchImpl, checkedAt)
      console.warn('CONAE sources unavailable; using NASA FIRMS NOAA-20 regional VIIRS detections.')
      result = { events, method: 'nasa-firms' }
    } catch (nasaError) {
      const describe = (error) => error instanceof Error ? error.message : String(error)
      throw new Error(
        'Thermal hotspot sources unavailable: CONAE (' + describe(conaeError) +
        '); NASA FIRMS (' + describe(nasaError) + ')',
        { cause: new AggregateError([conaeError, nasaError], 'All hotspot sources failed') },
      )
    }
  }
  const { events, method: sourceMethod } = result
  const selected = selectConaeHotspots(events, argentinaGeometry, checkedAt)

  const candidate = {
    schemaVersion: '1.0',
    kind: 'thermal-hotspot',
    generatedAt: checkedAt,
    sourceCheckedAt: checkedAt,
    window: { hours: WINDOW_HOURS },
    freshness: { staleAfterMinutes: 240 },
    source: {
      name: sourceMethod === 'nasa-firms' ? 'NASA FIRMS' : 'CONAE',
      url: sourceMethod === 'catalog' ? CONAE_CATALOG_URL :
        sourceMethod === 'wfs' ? CONAE_WFS_URL : NASA_FIRMS_NOAA20_URL,
      kind: 'official',
    },
    method: sourceMethod === 'nasa-firms'
      ? {
          type: 'csv',
          note: 'NASA FIRMS VIIRS NOAA-20, archivo CSV público de Sudamérica (24 h). Puntos prefiltrados por bbox y limitados por hora UTC y geometría de IGN. No incluye automáticamente SNPP.',
        }
      : sourceMethod === 'catalog'
      ? {
          type: 'scrape',
          note: 'Visor público oficial de focos de calor de CONAE: consulta detallada NOAA-20 y SNPP, prefiltrada por bbox y luego filtrada por la geometría argentina de IGN.',
        }
      : {
          type: 'wfs',
          note: 'Servicio WFS oficial de CONAE: capa VIIRS de las últimas 24 horas, filtrada por tiempo y geometría argentina de IGN.',
        },
    limitations: sourceMethod === 'nasa-firms'
      ? [
          'Fuente de respaldo NASA FIRMS; no equivale a cobertura ni validación propia de CONAE.',
          'Se incluyen sólo detecciones VIIRS NOAA-20: otros satélites y posibles observaciones adicionales no están representados.',
          'Un foco de calor es una anomalía térmica satelital, no un incendio confirmado ni una superficie quemada.',
          'La confianza es una categoría de detección de VIIRS y no la probabilidad de un incendio.',
          'La potencia radiativa FRP (MW) es contexto observacional y no mide peligro ni riesgo.',
          'Fechas y horas NASA FIRMS se interpretan en UTC según su especificación.',
        ]
      : sourceMethod === 'catalog'
      ? [
          'Un foco de calor es una anomalía térmica satelital y no implica un incendio confirmado.',
          'La confianza de detección no equivale a probabilidad de incendio; las categorías visuales de Pulso siguen los cortes de confianza usados por el mapa público de CONAE.',
          'La ruta pública usada para visualizar detecciones en el mapa público no expone FRP, por lo que frpMw se conserva como null en este snapshot.',
          'El payload del mapa público no rotula explícitamente la zona horaria; Pulso interpreta esas marcas temporales como UTC para normalizarlas y declara esta limitación.',
        ]
      : [
          'Un foco de calor es una anomalía térmica satelital y no implica un incendio confirmado.',
          'La confianza VIIRS de la capa WFS no equivale a probabilidad de incendio y puede utilizar categorías distintas a las del mapa público.',
          'La potencia radiativa (FRP) se conserva como información contextual cuando la capa la proporciona; no es un índice de peligro.',
          'Las fechas de la capa WFS sin zona horaria explícita se interpretan como UTC; esta convención debe verificarse con CONAE.',
        ],
    events: selected,
  }

  return prepareTerritorialPublication(previous, candidate, checkedAt)
}
