import { describe, expect, it } from 'vitest'
import { earthquakeEvents } from '../test/territorialFixtures'
import {
  EARTHQUAKE_DEPTH_VERTICAL_EXAGGERATION,
  buildEarthquakeDepth3DGeometry,
} from './earthquakeDepth3D'

describe('earthquake depth 3D geometry', () => {
  it('projects reported depth below a zero-elevation reference surface without terrain reinterpretation', () => {
    const events = [
      { ...earthquakeEvents[0], depthKm: 86, magnitude: 4.2 },
      { ...earthquakeEvents[1], depthKm: null, magnitude: 2.8 },
    ]

    const geometry = buildEarthquakeDepth3DGeometry(events)

    expect(EARTHQUAKE_DEPTH_VERTICAL_EXAGGERATION).toBe(1)
    expect(geometry.points).toHaveLength(1)
    expect(geometry.stems).toHaveLength(2)
    expect(geometry.stems[0].elevation).toBe(0)
    expect(geometry.stems[1].elevation).toBe(-86_000)
    expect(geometry.points[0].elevation).toBe(-86_000)
    expect(geometry.points[0].x).toBeGreaterThanOrEqual(0)
    expect(geometry.points[0].x).toBeLessThanOrEqual(1)
    expect(geometry.points[0].y).toBeGreaterThanOrEqual(0)
    expect(geometry.points[0].y).toBeLessThanOrEqual(1)
  })

  it('preserves negative reported depths as positions above the reference surface instead of clamping the source value', () => {
    const geometry = buildEarthquakeDepth3DGeometry([
      { ...earthquakeEvents[0], depthKm: -1.5 },
    ])

    expect(geometry.points[0].elevation).toBe(1500)
  })
})
