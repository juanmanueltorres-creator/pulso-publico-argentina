import { describe, expect, it } from 'vitest'
import { earthquakeEvents } from '../test/territorialFixtures'
import {
  EARTHQUAKE_DEPTH_VERTICAL_EXAGGERATION,
  buildEarthquakeDepth3DGeometry,
} from './earthquakeDepth3D'

describe('earthquake depth 3D geometry', () => {
  it('renders every valid hypocenter at 2x visual depth but only stems the selected event', () => {
    const selected = { ...earthquakeEvents[0], depthKm: 86, magnitude: 4.2 }
    const other = { ...earthquakeEvents[1], depthKm: 32, magnitude: 2.8 }
    const events = [selected, other]

    const geometry = buildEarthquakeDepth3DGeometry(events, selected.id)

    expect(EARTHQUAKE_DEPTH_VERTICAL_EXAGGERATION).toBe(2)
    expect(geometry.points).toHaveLength(2)
    expect(geometry.stems).toHaveLength(2)
    expect(geometry.stems[0].elevation).toBe(0)
    expect(geometry.stems[1].elevation).toBe(-172_000)
    expect(geometry.points[0].elevation).toBe(-172_000)
    expect(geometry.points[1].elevation).toBe(-64_000)
    expect(geometry.points[0].x).toBeGreaterThanOrEqual(0)
    expect(geometry.points[0].x).toBeLessThanOrEqual(1)
    expect(geometry.points[0].y).toBeGreaterThanOrEqual(0)
    expect(geometry.points[0].y).toBeLessThanOrEqual(1)
  })

  it('keeps the hypocenter cloud without drawing stems when nothing is selected and skips missing depth', () => {
    const events = [
      { ...earthquakeEvents[0], depthKm: 86 },
      { ...earthquakeEvents[1], depthKm: null },
    ]

    const geometry = buildEarthquakeDepth3DGeometry(events, null)

    expect(geometry.points).toHaveLength(1)
    expect(geometry.stems).toHaveLength(0)
  })

  it('preserves negative reported depths instead of clamping the source value', () => {
    const event = { ...earthquakeEvents[0], depthKm: -1.5 }
    const geometry = buildEarthquakeDepth3DGeometry([event], event.id)

    expect(geometry.points[0].elevation).toBe(3000)
  })
})
