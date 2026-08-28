import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import { TerritorialMap } from './TerritorialMap'

const mapMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  setLayoutProperty: vi.fn(),
  setData: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor() {
      mapMocks.construct()
    }

    on(event: string, layerOrHandler: unknown, maybeHandler?: unknown) {
      if (event === 'load' && typeof layerOrHandler === 'function') {
        layerOrHandler()
      }
      void maybeHandler
      return this
    }

    getSource() {
      return { setData: mapMocks.setData }
    }

    setLayoutProperty(...args: unknown[]) {
      mapMocks.setLayoutProperty(...args)
      return this
    }

    remove() {
      mapMocks.remove()
    }
  }

  return {
    default: { Map: MockMap },
    Map: MockMap,
  }
})

describe('TerritorialMap', () => {
  beforeEach(() => {
    mapMocks.construct.mockClear()
    mapMocks.setLayoutProperty.mockClear()
    mapMocks.setData.mockClear()
    mapMocks.remove.mockClear()
  })

  it('keeps one MapLibre instance while mode visibility changes', () => {
    const onSelect = vi.fn()
    const { rerender } = render(
      <TerritorialMap
        mode="earthquake"
        earthquakes={earthquakeEvents}
        hotspots={hotspotEvents}
        selectedId={null}
        onSelect={onSelect}
      />,
    )

    expect(mapMocks.construct).toHaveBeenCalledTimes(1)

    rerender(
      <TerritorialMap
        mode="thermal-hotspot"
        earthquakes={earthquakeEvents}
        hotspots={hotspotEvents}
        selectedId={null}
        onSelect={onSelect}
      />,
    )

    expect(mapMocks.construct).toHaveBeenCalledTimes(1)
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('earthquake-points', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('hotspot-points', 'visibility', 'visible')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('hotspot-clusters', 'visibility', 'visible')
  })
})
