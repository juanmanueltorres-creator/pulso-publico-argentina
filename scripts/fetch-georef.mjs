import { parseGeorefSeries } from './adapters/georef.mjs'

const GEOREF_SERIES_ENDPOINT = 'https://apis.datos.gob.ar/series/api/series/'

export function buildGeorefSeriesUrl() {
  const url = new URL(GEOREF_SERIES_ENDPOINT)
  url.searchParams.set('ids', 'apis_georef_005')
  url.searchParams.set('sort', 'desc')
  url.searchParams.set('limit', '1')
  url.searchParams.set('metadata', 'none')
  url.searchParams.set('format', 'json')
  return url
}

export async function fetchGeorefSignal(fetchImpl = fetch, fetchedAt = new Date().toISOString()) {
  const response = await fetchImpl(buildGeorefSeriesUrl(), {
    headers: { accept: 'application/json' },
  })

  if (!response?.ok) {
    throw new Error(`GeoRef Series API request failed with HTTP ${response?.status ?? 'unknown'}`)
  }

  const payload = await response.json()
  return parseGeorefSeries(payload, fetchedAt)
}
