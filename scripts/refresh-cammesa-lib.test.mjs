import { describe, expect, it } from 'vitest'
import { refreshCammesaSnapshot } from './refresh-cammesa-lib.mjs'

const extracted = { period: '2026-07', totalGwh: 1791.245147 }
const fetchedAt = '2026-08-28T03:25:00.000Z'

describe('refreshCammesaSnapshot', () => {
  it('replaces only the CAMMESA signal and advances generatedAt', () => {
    const snapshot = {
      schemaVersion: '1.0',
      generatedAt: '2026-08-28T03:00:00.000Z',
      signals: [
        { id: 'cammesa-renewables', value: null, availability: 'unavailable' },
        { id: 'openalex-argentina-works', value: 27994, availability: 'available' },
      ],
    }

    const next = refreshCammesaSnapshot(snapshot, extracted, fetchedAt)

    expect(next.generatedAt).toBe(fetchedAt)
    expect(next.signals[0]).toMatchObject({
      id: 'cammesa-renewables',
      value: 1791.245147,
      unit: 'GWh',
      availability: 'available',
      fetchedAt,
    })
    expect(next.signals[1]).toEqual({
      id: 'openalex-argentina-works',
      value: 27994,
      availability: 'available',
    })
  })

  it('fails closed when the CAMMESA target signal is missing', () => {
    const snapshot = {
      schemaVersion: '1.0',
      generatedAt: '2026-08-28T03:00:00.000Z',
      signals: [{ id: 'openalex-argentina-works', value: 27994 }],
    }

    expect(() => refreshCammesaSnapshot(snapshot, extracted, fetchedAt)).toThrow(
      /cammesa-renewables/i,
    )
  })
})
