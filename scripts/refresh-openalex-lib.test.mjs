import { describe, expect, it } from 'vitest'
import { refreshOpenAlexSnapshot } from './refresh-openalex-lib.mjs'

describe('refreshOpenAlexSnapshot', () => {
  it('replaces only the OpenAlex signal and advances generatedAt', async () => {
    const snapshot = {
      schemaVersion: '1.0',
      generatedAt: '2026-08-28T00:00:00.000Z',
      signals: [
        { id: 'cammesa-renewables', value: null },
        { id: 'openalex-argentina-works', value: null, availability: 'unavailable' },
        { id: 'georef-api-usage', value: 264037620, availability: 'stale' },
      ],
    }

    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({ meta: { count: 18452 }, results: [] }),
    })

    const next = await refreshOpenAlexSnapshot(
      snapshot,
      fakeFetch,
      '2026-08-28T03:30:00.000Z',
      2026,
    )

    expect(next.generatedAt).toBe('2026-08-28T03:30:00.000Z')
    expect(next.signals[0]).toEqual({ id: 'cammesa-renewables', value: null })
    expect(next.signals[1]).toMatchObject({
      id: 'openalex-argentina-works',
      value: 18452,
      availability: 'available',
      fetchedAt: '2026-08-28T03:30:00.000Z',
    })
    expect(next.signals[2]).toEqual({
      id: 'georef-api-usage',
      value: 264037620,
      availability: 'stale',
    })
  })

  it('fails closed when the OpenAlex target signal is missing', async () => {
    const snapshot = {
      schemaVersion: '1.0',
      generatedAt: '2026-08-28T00:00:00.000Z',
      signals: [{ id: 'cammesa-renewables', value: null }],
    }

    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({ meta: { count: 18452 }, results: [] }),
    })

    await expect(
      refreshOpenAlexSnapshot(snapshot, fakeFetch, '2026-08-28T03:30:00.000Z', 2026),
    ).rejects.toThrow(/openalex-argentina-works/i)
  })
})
