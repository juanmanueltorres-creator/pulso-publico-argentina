import { parseInpresEarthquakes } from './adapters/inpres.mjs'

export const INPRES_SOURCE_URL = 'https://www.inpres.gob.ar/sismos_consultados'

export async function fetchInpresEarthquakes(fetchImpl = fetch) {
  const response = await fetchImpl(INPRES_SOURCE_URL, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response?.ok) {
    throw new Error(`INPRES request failed with HTTP ${response?.status ?? 'unknown'}`)
  }

  const html = await response.text()
  return parseInpresEarthquakes(html)
}
