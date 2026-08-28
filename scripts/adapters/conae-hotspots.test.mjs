import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeHotspotConfidence, parseConaeHotspots } from './conae-hotspots.mjs'

const fixture = JSON.parse(
  await readFile(resolve(process.cwd(), 'scripts/fixtures/conae-viirs.geojson'), 'utf8'),
)

describe('normalizeHotspotConfidence', () => {
  it('maps only source-defensible categories or VIIRS codes and refuses invented percentage thresholds', () => {
    expect(normalizeHotspotConfidence(9)).toBe('high')
    expect(normalizeHotspotConfidence('Alta')).toBe('high')
    expect(normalizeHotspotConfidence(8)).toBe('nominal')
    expect(normalizeHotspotConfidence(7)).toBe('low')
    expect(normalizeHotspotConfidence(87)).toBe('unknown')
  })
})

describe('parseConaeHotspots', () => {
  it('normalizes Point coordinates, FRP, sensor, satellite and acquisition time', () => {
    const [event] = parseConaeHotspots(fixture)

    expect(event).toMatchObject({
      id: 'viirs.1',
      kind: 'thermal-hotspot',
      latitude: -30.1,
      longitude: -62.2,
      confidence: 'high',
      frpMw: 18.5,
      sensor: 'VIIRS',
      satellite: 'NOAA20',
      occurredAt: '2026-08-28T03:10:00.000Z',
    })
  })

  it('supports combined timestamps and preserves missing FRP as null', () => {
    const event = parseConaeHotspots(fixture)[2]

    expect(event).toMatchObject({
      id: 'viirs.3',
      occurredAt: '2026-08-26T02:00:00.000Z',
      confidence: 'low',
      frpMw: null,
    })
  })

  it('fails a feature with no recognized acquisition timestamp', () => {
    const bad = structuredClone(fixture)
    delete bad.features[0].properties.Fecha
    delete bad.features[0].properties.Hora

    expect(() => parseConaeHotspots(bad)).toThrow(/timestamp/i)
  })

  it('rejects non-Point geometry instead of guessing a location', () => {
    const bad = structuredClone(fixture)
    bad.features[0].geometry = {
      type: 'Polygon',
      coordinates: [[[-62, -30], [-61, -30], [-61, -29], [-62, -30]]],
    }

    expect(() => parseConaeHotspots(bad)).toThrow(/point/i)
  })
})
