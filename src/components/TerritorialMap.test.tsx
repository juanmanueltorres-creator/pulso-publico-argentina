import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import { TerritorialMap } from './TerritorialMap'

const mapMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  setLayoutProperty: vi.fn(),
  setData: vi.fn(),
  remove: vi.fn(),
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  clickHandlers: new Map<string, (event: unknown) => void>(),
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
      if (event === 'click' && typeof layerOrHandler === 'string' && typeof maybeHandler === 'function') {
        mapMocks.clickHandlers.set(layerOrHandler, maybeHandler as (event: unknown) => void)
      }
      return this
    }

    getSource() {
      return { setData: mapMocks.setData }
    }

    setLayoutProperty(...args: unknown[]) {
      mapMocks.setLayoutProperty(...args)
      return this
    }

    flyTo(...args: unknown[]) {
      mapMocks.flyTo(...args)
      return this
    }

    fitBounds(...args: unknown[]) {
      mapMocks.fitBounds(...args)
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
    mapMocks.flyTo.mockClear()
    mapMocks.fitBounds.mockClear()
    mapMocks.clickHandlers.clear()
  })

  it('keeps one MapLibre instance while mode visibility changes and exposes an accessible map region', () => {
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

    expect(screen.getByRole('region', { name: 'Mapa de señales territoriales de Argentina' })).toBeInTheDocument()
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

  it('selects only exact ids from the registered active data layers without moving the camera', () => {
    const onSelect = vi.fn()
    render(
      <TerritorialMap
        mode="earthquake"
        earthquakes={earthquakeEvents}
        hotspots={hotspotEvents}
        selectedId={null}
        onSelect={onSelect}
      />,
    )

    mapMocks.clickHandlers.get('earthquake-points')?.({
      features: [{ properties: { id: earthquakeEvents[0].id } }],
    })
    expect(onSelect).toHaveBeenLastCalledWith(earthquakeEvents[0])

    mapMocks.clickHandlers.get('hotspot-points')?.({
      features: [{ properties: { id: hotspotEvents[1].id } }],
    })
    expect(onSelect).toHaveBeenLastCalledWith(hotspotEvents[1])

    mapMocks.clickHandlers.get('earthquake-points')?.({
      features: [{ properties: { id: 'not-an-event' } }],
    })
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(mapMocks.flyTo).not.toHaveBeenCalled()
    expect(mapMocks.fitBounds).not.toHaveBeenCalled()
  })
})
