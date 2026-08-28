import { describe, expect, it } from 'vitest'
import { fetchOpenAlexSignal } from './fetch-openalex.mjs'

describe('fetchOpenAlexSignal', () => {
  it('requests the current-year works count for Argentine institutional affiliation', async () => {
    let requestedUrl = ''
    const fakeFetch = async (url) => {
      requestedUrl = String(url)
      return {
        ok: true,
        json: async () => ({ meta: { count: 18452 }, results: [] }),
      }
    }

    const signal = await fetchOpenAlexSignal(
      fakeFetch,
      '2026-08-28T03:15:00.000Z',
      2026,
    )

    const url = new URL(requestedUrl)
    expect(url.origin).toBe('https://api.openalex.org')
    expect(url.pathname).toBe('/works')
    expect(url.searchParams.get('filter')).toBe(
      'institutions.country_code:AR,publication_year:2026',
    )
    expect(url.searchParams.get('per_page')).toBe('1')
    expect(signal.value).toBe(18452)
    expect(signal.periodLabel).toBe('2026 · afiliación institucional argentina')
  })

  it('fails when OpenAlex does not return HTTP success', async () => {
    const fakeFetch = async () => ({ ok: false, status: 429 })

    await expect(
      fetchOpenAlexSignal(fakeFetch, '2026-08-28T03:15:00.000Z', 2026),
    ).rejects.toThrow(/429/)
  })
})
