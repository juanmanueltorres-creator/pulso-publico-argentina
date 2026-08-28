import { describe, expect, it } from 'vitest'
import { refreshGeorefSnapshot } from './refresh-georef-lib.mjs'

describe('refreshGeorefSnapshot', () => {
  it('fetches GeoRef and returns a snapshot with only that signal updated', async () => {
    const snapshot = {
      schemaVersion: '1.0',
      generatedAt: '2026-08-28T00:00:00.000Z',
      signals: [
        { id: 'cammesa-renewables', value: null },
        { id: 'georef-api-usage', value: null, availability: 'unavailable' },
      ],
    }

    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({ data: [['2026-08-24', 321]] }),
    })

    const next = await refreshGeorefSnapshot(
      snapshot,
      fakeFetch,
      '2026-08-28T03:00:00.000Z',
    )

    expect(next.generatedAt).toBe('2026-08-28T03:00:00.000Z')
    expect(next.signals[0]).toEqual({ id: 'cammesa-renewables', value: null })
    expect(next.signals[1]).toMatchObject({
      id: 'georef-api-usage',
      value: 321,
      availability: 'available',
      fetchedAt: '2026-08-28T03:00:00.000Z',
    })
  })
})
