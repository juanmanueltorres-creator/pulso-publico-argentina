import { describe, expect, it } from 'vitest'
import {
  pointInFeatureCollection,
  simplifyFeatureCollection,
  validateArgentinaFeatureCollection,
} from './geo.mjs'

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

describe('simplifyFeatureCollection', () => {
  it('reduces dense rings while preserving closed Polygon and MultiPolygon geometry', () => {
    const denseRing = [
      [0, 0],
      [0.2, 0.001],
      [0.4, -0.001],
      [0.6, 0.001],
      [0.8, -0.001],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]
    const dense = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'polygon' },
          geometry: { type: 'Polygon', coordinates: [denseRing] },
        },
        {
          type: 'Feature',
          properties: { name: 'multi' },
          geometry: { type: 'MultiPolygon', coordinates: [[denseRing]] },
        },
      ],
    }

    const simplified = simplifyFeatureCollection(dense, 0.01)
    const polygonRing = simplified.features[0].geometry.coordinates[0]
    const multiRing = simplified.features[1].geometry.coordinates[0][0]

    expect(simplified.features).toHaveLength(2)
    expect(simplified.features[0].geometry.type).toBe('Polygon')
    expect(simplified.features[1].geometry.type).toBe('MultiPolygon')
    expect(polygonRing.length).toBeLessThan(denseRing.length)
    expect(multiRing.length).toBeLessThan(denseRing.length)
    expect(polygonRing[0]).toEqual(polygonRing.at(-1))
    expect(multiRing[0]).toEqual(multiRing.at(-1))
    expect(pointInFeatureCollection([0.5, 0.5], simplified)).toBe(true)
  })
})
