import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import { TerritorialMap } from './TerritorialMap'

const mapMocks = vi.hoisted(() => ({
  construct: vi.fn(),
}))

vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor(options: unknown) {
      mapMocks.construct(options)
    }

    on(event: string, layerOrHandler: unknown) {
      if (event === 'load' && typeof layerOrHandler === 'function') {
        layerOrHandler()
      }
      return this
    }

    getSource(id: string) {
      return {
        setData: vi.fn(),
        ...(id === 'hotspots'
          ? { getClusterExpansionZoom: vi.fn().mockResolvedValue(8) }
          : {}),
      }
    }

    setLayoutProperty() {
      return this
    }

    queryRenderedFeatures() {
      return []
    }

    remove() {}
  }

  return {
    default: { Map: MockMap },
    Map: MockMap,
    setWorkerUrl: vi.fn(),
  }
})

describe('TerritorialMap earthquake depth semantics', () => {
  it('keeps magnitude in point size and uses reported depth only for point color', () => {
    render(
      <TerritorialMap
        mode="earthquake"
        earthquakes={earthquakeEvents}
        hotspots={hotspotEvents}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    )

    const options = mapMocks.construct.mock.calls[0]?.[0] as any
    const earthquakeLayer = options.style.layers.find((layer: any) => layer.id === 'earthquake-points')
    const radiusExpression = JSON.stringify(earthquakeLayer.paint['circle-radius'])
    const colorExpression = JSON.stringify(earthquakeLayer.paint['circle-color'])

    expect(radiusExpression).toContain('magnitude')
    expect(radiusExpression).not.toContain('depthKm')
    expect(colorExpression).toContain('depthKm')
    expect(colorExpression).not.toContain('magnitude')
  })
})
