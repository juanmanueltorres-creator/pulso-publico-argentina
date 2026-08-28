import { describe, expect, it } from 'vitest'
import { fetchGeorefSignal } from './fetch-georef.mjs'

describe('fetchGeorefSignal', () => {
  it('requests only the latest apis_georef_005 value and parses it', async () => {
    let requestedUrl = ''
    const fakeFetch = async (url) => {
      requestedUrl = String(url)
      return {
        ok: true,
        json: async () => ({ data: [['2026-08-24', 987654321]] }),
      }
    }

    const signal = await fetchGeorefSignal(fakeFetch, '2026-08-28T02:45:00.000Z')

    expect(requestedUrl).toContain('https://apis.datos.gob.ar/series/api/series')
    expect(requestedUrl).toContain('ids=apis_georef_005')
    expect(requestedUrl).toContain('sort=desc')
    expect(requestedUrl).toContain('limit=1')
    expect(requestedUrl).toContain('metadata=none')
    expect(signal.value).toBe(987654321)
    expect(signal.observedAt).toBe('2026-08-24T00:00:00.000Z')
  })

  it('fails when the official endpoint does not return HTTP success', async () => {
    const fakeFetch = async () => ({ ok: false, status: 503 })

    await expect(fetchGeorefSignal(fakeFetch, '2026-08-28T02:45:00.000Z')).rejects.toThrow(
      /503/,
    )
  })
})
