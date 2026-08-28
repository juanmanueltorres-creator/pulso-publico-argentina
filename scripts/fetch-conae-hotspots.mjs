import { parseConaeHotspots } from './adapters/conae-hotspots.mjs'

export const CONAE_WFS_URL = 'https://geoservicios.conae.gov.ar/geoserver/GeoServiciosCONAE/wfs'
export const CONAE_VIIRS_LAYER = 'GeoServiciosCONAE:FocosDeCalorVIIRS'

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
