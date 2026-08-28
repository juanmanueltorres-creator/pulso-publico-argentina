import { describe, expect, it } from 'vitest'
import { earthquakeEvent, hotspotEvent } from '../test/territorialFixtures'
import { explainEarthquake, explainHotspot } from './explainTerritorial'

describe('explainEarthquake', () => {
  it('describes magnitude without inventing danger', () => {
    const text = explainEarthquake(earthquakeEvent)

    expect(text).toContain('magnitud 4,6')
    expect(text).toContain('87 km')
    expect(text).not.toMatch(/peligroso|riesgo alto/i)
  })
})

describe('explainHotspot', () => {
  it('explains hotspots without upgrading detections into fires', () => {
    const text = explainHotspot(hotspotEvent)

    expect(text).toContain('Una detección térmica no implica un incendio confirmado.')
    expect(text).not.toMatch(/probabilidad de incendio/i)
  })
})
