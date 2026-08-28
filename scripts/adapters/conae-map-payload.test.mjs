import { describe, expect, it } from 'vitest'
import {
  normalizeCatalogConfidencePercent,
  parseConaeMapPayload,
} from './conae-hotspots.mjs'

const payload = [
  '-25.47868,-55.10352,2026-08-27 - 03:53:00,NOAA20,55',
  '-30.10000,-62.20000,2026-08-28 - 03:10:00,NOAA20,87',
  '-34.50000,-64.50000,2026-08-28 - 04:20:00,SNPP,20',
  '',
].join('\r\n')

describe('normalizeCatalogConfidencePercent', () => {
  it('uses the same confidence bands exposed by the public CONAE map', () => {
    expect(normalizeCatalogConfidencePercent(87)).toBe('high')
    expect(normalizeCatalogConfidencePercent(70)).toBe('high')
    expect(normalizeCatalogConfidencePercent(55)).toBe('nominal')
    expect(normalizeCatalogConfidencePercent(35)).toBe('nominal')
    expect(normalizeCatalogConfidencePercent(20)).toBe('low')
  })

  it('rejects values outside the documented percentage domain', () => {
    expect(() => normalizeCatalogConfidencePercent(-1)).toThrow(/confidence/i)
    expect(() => normalizeCatalogConfidencePercent(101)).toThrow(/confidence/i)
    expect(() => normalizeCatalogConfidencePercent('abc')).toThrow(/confidence/i)
  })
})

describe('parseConaeMapPayload', () => {
  it('normalizes the five public-map fields without inventing FRP', () => {
    const events = parseConaeMapPayload(payload)

    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      kind: 'thermal-hotspot',
      latitude: -25.47868,
      longitude: -55.10352,
      occurredAt: '2026-08-27T03:53:00.000Z',
      satellite: 'NOAA20',
      sensor: 'VIIRS',
      confidence: 'nominal',
      frpMw: null,
    })
    expect(events[1].confidence).toBe('high')
    expect(events[2].confidence).toBe('low')
    expect(events.every((event) => event.id.startsWith('conae-'))).toBe(true)
  })

  it('fails closed on malformed rows instead of silently dropping them', () => {
    expect(() => parseConaeMapPayload('-25,-55,bad-date,NOAA20,55')).toThrow(/timestamp/i)
    expect(() => parseConaeMapPayload('-95,-55,2026-08-27 - 03:53:00,NOAA20,55')).toThrow(/coordinate/i)
    expect(() => parseConaeMapPayload('-25,-55,2026-08-27 - 03:53:00,NOAA20')).toThrow(/five/i)
  })
})
