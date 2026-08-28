import {
  parseConaeHotspots,
  parseConaeMapPayload,
} from './adapters/conae-hotspots.mjs'

export const CONAE_WFS_URL = 'https://geoservicios.conae.gov.ar/geoserver/GeoServiciosCONAE/wfs'
export const CONAE_VIIRS_LAYER = 'GeoServiciosCONAE:FocosDeCalorVIIRS'
export const CONAE_CATALOG_BASE_URL = 'https://catalogos5.conae.gov.ar/catalogofocos/'
export const CONAE_PUBLIC_MAP_SATELLITES = ['NOAA20', 'SNPP']

const ARGENTINA_PREFILTER_BBOX = '-21.7_-73.7_-55.2_-53.5'
const WINDOW_HOURS = 24

function buildWfsUrl(params) {
  const url = new URL(CONAE_WFS_URL)
  url.search = new URLSearchParams(params).toString()
  return url.toString()
}

async function requireOk(response, label) {
  if (!response?.ok) {
    throw new Error(`CONAE ${label} request failed with HTTP ${response?.status ?? 'unknown'}`)
  }
  return response
}

export function buildConaeCatalogSearchUrl(satellite, startDate, endDate) {
  if (!CONAE_PUBLIC_MAP_SATELLITES.includes(satellite)) {
    throw new Error(`Unsupported CONAE public-map satellite: ${satellite}`)
  }

  const url = new URL('search_date.aspx', CONAE_CATALOG_BASE_URL)
  url.search = new URLSearchParams({
    dateStart: startDate,
    dateEnd: endDate,
    satelite: satellite,
    Confianza: '0',
    Coordenadas: ARGENTINA_PREFILTER_BBOX,
    tipoA: 'dib',
    prov: '',
    dpto: '',
    formato: 'csv',
    tipoTot: 'det',
    idTot: '',
    nAgrup: 'agrupSin',
  }).toString()
  return url.toString()
}

export function extractConaePublicMapToken(html) {
  if (typeof html !== 'string') {
    throw new Error('CONAE catalog result must be HTML text')
  }

  const match = html.match(
    /formData\.append\(\s*["']p["']\s*,\s*["']([^"']+)["']\s*\)/,
  )
  if (!match) {
    throw new Error('CONAE public map token was not found in catalog result')
  }
  return match[1]
}

function catalogDateRange(checkedAt) {
  const checkedAtMs = Date.parse(checkedAt)
  if (!Number.isFinite(checkedAtMs)) {
    throw new Error('checkedAt must be a valid timestamp')
  }

  const start = new Date(checkedAtMs - WINDOW_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const end = new Date(checkedAtMs).toISOString().slice(0, 10)
  return { start, end }
}

export async function fetchConaeCatalogHotspots(
  fetchImpl = fetch,
  checkedAt = new Date().toISOString(),
) {
  const { start, end } = catalogDateRange(checkedAt)
  const events = []

  for (const satellite of CONAE_PUBLIC_MAP_SATELLITES) {
    const searchUrl = buildConaeCatalogSearchUrl(satellite, start, end)
    const searchResponse = await requireOk(
      await fetchImpl(searchUrl, {
        headers: { accept: 'text/html,*/*' },
      }),
      `catalog search (${satellite})`,
    )
    const html = await searchResponse.text()
    const token = extractConaePublicMapToken(html)

    const mapUrl = new URL('descarga.aspx', CONAE_CATALOG_BASE_URL).toString()
    const body = new URLSearchParams({ datosMapa: '1', p: token }).toString()
    const mapResponse = await requireOk(
      await fetchImpl(mapUrl, {
        method: 'POST',
        headers: {
          accept: 'text/plain,*/*',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      }),
      `public map (${satellite})`,
    )

    events.push(...parseConaeMapPayload(await mapResponse.text()))
  }

  const deduped = new Map(events.map((event) => [event.id, event]))
  return [...deduped.values()].sort(
    (a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id),
  )
}

export async function fetchConaeHotspots(fetchImpl = fetch) {
  const capabilitiesUrl = buildWfsUrl({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetCapabilities',
  })

  const capabilitiesResponse = await requireOk(
    await fetchImpl(capabilitiesUrl, {
      headers: { accept: 'application/xml,text/xml,*/*' },
    }),
    'GetCapabilities',
  )
  const capabilities = await capabilitiesResponse.text()

  if (!capabilities.includes(`<Name>${CONAE_VIIRS_LAYER}</Name>`)) {
    throw new Error(`CONAE WFS does not advertise required layer ${CONAE_VIIRS_LAYER}`)
  }

  const featureUrl = buildWfsUrl({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: CONAE_VIIRS_LAYER,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
  })

  const featureResponse = await requireOk(
    await fetchImpl(featureUrl, {
      headers: { accept: 'application/json' },
    }),
    'GetFeature',
  )

  let featureCollection
  try {
    featureCollection = await featureResponse.json()
  } catch (error) {
    throw new Error(`CONAE GetFeature did not return valid GeoJSON: ${error instanceof Error ? error.message : String(error)}`)
  }

  return parseConaeHotspots(featureCollection)
}
