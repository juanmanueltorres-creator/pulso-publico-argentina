import { describe, expect, it } from 'vitest'
import { updateGeorefSnapshot } from './update-georef-snapshot.mjs'

const previousGeoref = {
  id: 'georef-api-usage',
  value: null,
  availability: 'unavailable',
}

const updatedGeoref = {
  id: 'georef-api-usage',
  value: 123456789,
  availability: 'available',
  fetchedAt: '2026-08-28T02:30:00.000Z',
}

describe('updateGeorefSnapshot', () => {
  it('replaces only the GeoRef signal and advances generatedAt', () => {
    const snapshot = {
      schemaVersion: '1.0',
      generatedAt: '2026-08-28T00:00:00.000Z',
      signals: [
        { id: 'cammesa-renewables', value: null },
        previousGeoref,
        { id: 'inpi-patents', value: null },
      ],
    }

    const next = updateGeorefSnapshot(snapshot, updatedGeoref)

    expect(next.generatedAt).toBe(updatedGeoref.fetchedAt)
    expect(next.signals).toEqual([
      { id: 'cammesa-renewables', value: null },
      updatedGeoref,
      { id: 'inpi-patents', value: null },
    ])
  })

  it('fails closed when the target signal is missing', () => {
    const snapshot = {
      schemaVersion: '1.0',
      generatedAt: '2026-08-28T00:00:00.000Z',
      signals: [{ id: 'cammesa-renewables', value: null }],
    }

    expect(() => updateGeorefSnapshot(snapshot, updatedGeoref)).toThrow(/georef-api-usage/i)
  })
})
