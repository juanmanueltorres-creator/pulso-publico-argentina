import { describe, expect, it } from 'vitest'
import { pointInFeatureCollection, validateArgentinaFeatureCollection } from './geo.mjs'

const polygon = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[-70, -35], [-60, -35], [-60, -25], [-70, -25], [-70, -35]]],
      },
    },
  ],
}

const polygonWithHole = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[-70, -35], [-60, -35], [-60, -25], [-70, -25], [-70, -35]],
          [[-66, -31], [-64, -31], [-64, -29], [-66, -29], [-66, -31]],
        ],
      },
    },
  ],
}

const multi = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[-70, -35], [-68, -35], [-68, -33], [-70, -33], [-70, -35]]],
          [[[-58, -28], [-56, -28], [-56, -26], [-58, -26], [-58, -28]]],
        ],
      },
    },
  ],
}

describe('pointInFeatureCollection', () => {
  it('handles Polygon, holes and MultiPolygon components', () => {
    expect(pointInFeatureCollection([-65, -30], polygon)).toBe(true)
    expect(pointInFeatureCollection([-72, -30], polygon)).toBe(false)
    expect(pointInFeatureCollection([-65, -30], polygonWithHole)).toBe(false)
    expect(pointInFeatureCollection([-57, -27], multi)).toBe(true)
  })

  it('rejects unsupported or malformed geometries at the boundary', () => {
    expect(() =>
      validateArgentinaFeatureCollection({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: null }],
      }),
    ).toThrow(/geometry/i)
  })
})
