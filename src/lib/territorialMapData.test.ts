import { describe, expect, it } from 'vitest'
import { earthquakeEvent, hotspotEvent } from '../test/territorialFixtures'
import { earthquakeRadius, eventsToFeatureCollection } from './territorialMapData'

describe('earthquakeRadius', () => {
  it('bounds marker radius and increases it with magnitude', () => {
    expect(earthquakeRadius(1)).toBeGreaterThanOrEqual(3)
    expect(earthquakeRadius(8)).toBeLessThanOrEqual(18)
    expect(earthquakeRadius(5)).toBeGreaterThan(earthquakeRadius(3))
  })
})

describe('eventsToFeatureCollection', () => {
  it('converts events to Point features with stable identity', () => {
    const fc = eventsToFeatureCollection([earthquakeEvent]) as {
      features: Array<{ geometry: unknown; properties: Record<string, unknown> }>
    }

    expect(fc.features[0]).toMatchObject({
      geometry: { type: 'Point', coordinates: [-68.6, -31.4] },
      properties: { id: 'eq-1', kind: 'earthquake' },
    })
  })

  it('copies hotspot display properties without changing coordinates', () => {
    const fc = eventsToFeatureCollection([hotspotEvent]) as {
      features: Array<{ geometry: unknown; properties: Record<string, unknown> }>
    }

    expect(fc.features[0]).toMatchObject({
      geometry: { type: 'Point', coordinates: [-58.92, -27.45] },
      properties: {
        id: 'hot-1',
        kind: 'thermal-hotspot',
        confidence: 'nominal',
        frpMw: 46,
        sensor: 'VIIRS',
      },
    })
  })
})
