const GEOREF_SOURCE_URL = 'https://www.datos.gob.ar/dataset/jgm_8/archivo/jgm_8.24'

function toObservedAt(rawDate) {
  if (typeof rawDate !== 'string') {
    throw new Error('GeoRef latest datapoint must include an ISO date')
  }

  const date = rawDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('GeoRef latest datapoint must include an ISO date')
  }

  const observedAt = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error('GeoRef latest datapoint must include a valid date')
  }

  return { date, observedAt: observedAt.toISOString() }
}

export function parseGeorefSeries(payload, fetchedAt = new Date().toISOString()) {
  const latest = payload?.data?.[0]

  if (!Array.isArray(latest) || latest.length < 2) {
    throw new Error('GeoRef response does not contain a latest datapoint')
  }

  const [rawDate, value] = latest
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('GeoRef latest datapoint value must be numeric')
  }

  const { date, observedAt } = toObservedAt(rawDate)

  return {
    schemaVersion: '1.0',
    id: 'georef-api-usage',
    category: 'public-infrastructure',
    title: 'Consultas históricas a GeoRef',
    value,
    unit: 'consultas',
    periodLabel: `Acumulado al ${date}`,
    status: 'updated',
    availability: 'available',
    observedAt,
    publishedAt: null,
    fetchedAt,
    source: {
      name: 'Datos Argentina · GeoRef',
      url: GEOREF_SOURCE_URL,
      kind: 'official',
    },
    method: {
      type: 'api',
      note: 'Último valor publicado de la serie oficial apis_georef_005, solicitado con sort=desc y limit=1.',
    },
    limitations: [
      'El recurso declara frecuencia de actualización semanal; no representa actividad en tiempo real.',
      'Es un acumulado histórico de consultas y no equivale a usuarios únicos ni a consultas del período actual.',
    ],
  }
}
