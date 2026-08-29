import { describe, expect, it } from 'vitest'
import { earthquakeEvents } from '../test/territorialFixtures'
import { EarthquakeDepth3DLayer } from './EarthquakeDepth3DLayer'

describe('EarthquakeDepth3DLayer draw ranges', () => {
  it('reserves the first WebGL line range for the three in-scene depth guide frames', () => {
    const layer = new EarthquakeDepth3DLayer()

    layer.setEvents(earthquakeEvents, earthquakeEvents[0].id)

    const internal = layer as unknown as {
      guideVertexCount?: number
      lineVertexCount: number
      anchorVertexCount: number
      pointVertexCount: number
      data: Float32Array
    }

    expect(internal.guideVertexCount).toBe(24)
    expect(internal.lineVertexCount).toBe(2)
    expect(internal.anchorVertexCount).toBe(1)
    expect(internal.pointVertexCount).toBe(2)
    expect(internal.data.length).toBe((24 + 2 + 1 + 2) * 7)
  })
})
