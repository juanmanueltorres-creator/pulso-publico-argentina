import { describe, expect, it } from 'vitest'
import {
  ARGENTINA_SIMPLIFY_TOLERANCE_DEGREES,
  ARGENTINA_WFS_URL,
  fetchArgentinaGeometry,
} from './fetch-argentina-geometry.mjs'

function provinceFeature(index) {
  const x = -73 + index * 0.1
  return {
    type: 'Feature',
    id: `provincia.${index + 1}`,
    properties: { nombre: `Provincia ${index + 1}` },
    geometry: {
      type: 'Polygon',
      coordinates: [[[x, -55], [x + 0.05, -55], [x + 0.05, -54.95], [x, -54.95], [x, -55]]],
    },
  }
}

function denseProvinceFeature(index) {
  const x = -73 + index * 0.1
  return {
    ...provinceFeature(index),
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [x, -55],
        [x + 0.01, -54.99999],
        [x + 0.02, -55.00001],
        [x + 0.03, -54.99999],
        [x + 0.04, -55.00001],
        [x + 0.05, -55],
        [x + 0.05, -54.95],
        [x, -54.95],
        [x, -55],
      ]],
    },
  }
}

const officialPayload = {
  type: 'FeatureCollection',
  features: Array.from({ length: 24 }, (_, index) => provinceFeature(index)),
}

describe('fetchArgentinaGeometry', () => {
  it('requests the official IGN provincia WFS and accepts 24 polygon features', async () => {
    let requested = ''
    const fakeFetch = async (input) => {
      requested = String(input)
      return {
        ok: true,
        status: 200,
        json: async () => officialPayload,
      }
    }

    const result = await fetchArgentinaGeometry(fakeFetch)

    expect(requested).toBe(ARGENTINA_WFS_URL)
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(24)
  })

  it('simplifies the official geometry before returning it for publication', async () => {
    const densePayload = {
      ...officialPayload,
      features: [denseProvinceFeature(0), ...officialPayload.features.slice(1)],
    }
    const rawRingLength = densePayload.features[0].geometry.coordinates[0].length
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => densePayload,
    })

    const result = await fetchArgentinaGeometry(fakeFetch)
    const simplifiedRing = result.features[0].geometry.coordinates[0]

    expect(ARGENTINA_SIMPLIFY_TOLERANCE_DEGREES).toBe(0.001)
    expect(simplifiedRing.length).toBeLessThan(rawRingLength)
    expect(simplifiedRing[0]).toEqual(simplifiedRing.at(-1))
    expect(result.features).toHaveLength(24)
  })

  it('fails closed when IGN does not return the expected 24 province features', async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ...officialPayload, features: officialPayload.features.slice(0, 23) }),
    })

    await expect(fetchArgentinaGeometry(fakeFetch)).rejects.toThrow(/24/)
  })

  it('fails closed on HTTP errors', async () => {
    const fakeFetch = async () => ({ ok: false, status: 503 })
    await expect(fetchArgentinaGeometry(fakeFetch)).rejects.toThrow(/503/)
  })
})
