import { parseOpenAlexWorks } from './adapters/openalex.mjs'

const OPENALEX_WORKS_ENDPOINT = 'https://api.openalex.org/works'

export function buildOpenAlexWorksUrl(year = new Date().getUTCFullYear()) {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new Error('OpenAlex publication year must be a valid integer year')
  }

  const url = new URL(OPENALEX_WORKS_ENDPOINT)
  url.searchParams.set('filter', `institutions.country_code:AR,publication_year:${year}`)
  url.searchParams.set('per_page', '1')
  return url
}

export async function fetchOpenAlexSignal(
  fetchImpl = fetch,
  fetchedAt = new Date().toISOString(),
  year = new Date(fetchedAt).getUTCFullYear(),
) {
  const response = await fetchImpl(buildOpenAlexWorksUrl(year), {
    headers: { accept: 'application/json' },
  })

  if (!response?.ok) {
    throw new Error(`OpenAlex API request failed with HTTP ${response?.status ?? 'unknown'}`)
  }

  const payload = await response.json()
  return parseOpenAlexWorks(payload, fetchedAt, year)
}
