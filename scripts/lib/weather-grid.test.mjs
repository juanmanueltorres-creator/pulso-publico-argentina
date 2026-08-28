import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { generateWeatherGrid } from './weather-grid.mjs'

const polygonWithHole = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[-65.25, -32.25], [-63.75, -32.25], [-63.75, -30.75], [-65.25, -30.75], [-65.25, -32.25]],
          [[-64.75, -31.75], [-64.25, -31.75], [-64.25, -31.25], [-64.75, -31.25], [-64.75, -31.75]],
        ],
      },
    },
  ],
}

const multiPolygon = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[-70.25, -40.25], [-69.75, -40.25], [-69.75, -39.75], [-70.25, -39.75], [-70.25, -40.25]]],
          [[[-58.25, -27.25], [-57.75, -27.25], [-57.75, -26.75], [-58.25, -26.75], [-58.25, -27.25]]],
        ],
      },
    },
  ],
}

describe('generateWeatherGrid', () => {
  it('generates deterministic 0.5 degree points and excludes polygon holes', () => {
    const first = generateWeatherGrid(polygonWithHole)
    const second = generateWeatherGrid(polygonWithHole)

    expect(first).toEqual(second)
    expect(first).toHaveLength(8)
    expect(first.map((point) => point.id)).toEqual([
      'wx:-32.00:-65.00',
      'wx:-32.00:-64.50',
      'wx:-32.00:-64.00',
      'wx:-31.50:-65.00',
      'wx:-31.50:-64.00',
      'wx:-31.00:-65.00',
      'wx:-31.00:-64.50',
      'wx:-31.00:-64.00',
    ])
    expect(first.some((point) => point.latitude === -31.5 && point.longitude === -64.5)).toBe(false)
  })

  it('supports MultiPolygon components separated across Argentina', () => {
    expect(generateWeatherGrid(multiPolygon)).toEqual([
      { id: 'wx:-40.00:-70.00', latitude: -40, longitude: -70 },
      { id: 'wx:-27.00:-58.00', latitude: -27, longitude: -58 },
    ])
  })

  it('sorts points by latitude and then longitude for stable publication', () => {
    const points = generateWeatherGrid(polygonWithHole)

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]
      const current = points[index]
      expect(
        current.latitude > previous.latitude ||
          (current.latitude === previous.latitude && current.longitude > previous.longitude),
      ).toBe(true)
    }
  })

  it.each([0, -0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid spacing %s',
    (spacing) => {
      expect(() => generateWeatherGrid(polygonWithHole, spacing)).toThrow(/spacing/i)
    },
  )

  it('produces a bounded national grid from the versioned Argentina geometry', async () => {
    const geometry = JSON.parse(
      await readFile(new URL('../../public/data/argentina-provinces.geojson', import.meta.url), 'utf8'),
    )

    const points = generateWeatherGrid(geometry)

    expect(points.length).toBeGreaterThanOrEqual(500)
    expect(points.length).toBeLessThanOrEqual(3000)
    expect(new Set(points.map((point) => point.id)).size).toBe(points.length)
  })
})
