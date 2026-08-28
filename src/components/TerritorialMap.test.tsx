import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import { TerritorialMap } from './TerritorialMap'

const mapMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  setWorkerUrl: vi.fn(),
  setLayoutProperty: vi.fn(),
  setData: vi.fn(),
  getClusterExpansionZoom: vi.fn(),
  easeTo: vi.fn(),
  remove: vi.fn(),
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  clickHandlers: new Map<string, (event: unknown) => unknown>(),
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
        mapMocks.clickHandlers.set(layerOrHandler, maybeHandler as (event: unknown) => unknown)
      }
      return this
    }

    getSource(id: string) {
      if (id === 'hotspots') {
        return {
          setData: mapMocks.setData,
          getClusterExpansionZoom: mapMocks.getClusterExpansionZoom,
        }
      }
      return { setData: mapMocks.setData }
    }

    setLayoutProperty(...args: unknown[]) {
      mapMocks.setLayoutProperty(...args)
      return this
    }

    easeTo(...args: unknown[]) {
      mapMocks.easeTo(...args)
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
    setWorkerUrl: mapMocks.setWorkerUrl,
  }
})

describe('TerritorialMap', () => {
  beforeEach(() => {
    mapMocks.construct.mockClear()
    mapMocks.setLayoutProperty.mockClear()
    mapMocks.setData.mockClear()
    mapMocks.getClusterExpansionZoom.mockReset()
    mapMocks.getClusterExpansionZoom.mockResolvedValue(8)
    mapMocks.easeTo.mockClear()
    mapMocks.remove.mockClear()
    mapMocks.flyTo.mockClear()
    mapMocks.fitBounds.mockClear()
    mapMocks.clickHandlers.clear()
  })

  it('configures an explicit MapLibre worker URL for bundled production builds', () => {
    expect(mapMocks.setWorkerUrl).toHaveBeenCalledTimes(1)
    expect(mapMocks.setWorkerUrl).toHaveBeenCalledWith(expect.stringContaining('worker'))
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

  it('expands hotspot clusters on click so individual detections can be selected', async () => {
    const onSelect = vi.fn()
    render(
      <TerritorialMap
        mode="thermal-hotspot"
        earthquakes={earthquakeEvents}
        hotspots={hotspotEvents}
        selectedId={null}
        onSelect={onSelect}
      />,
    )

    const clusterEvent = {
      features: [
        {
          properties: { cluster_id: 42 },
          geometry: { type: 'Point', coordinates: [-64.2, -31.4] },
        },
      ],
    }

    await mapMocks.clickHandlers.get('hotspot-clusters')?.(clusterEvent)

    expect(mapMocks.getClusterExpansionZoom).toHaveBeenCalledWith(42)
    expect(mapMocks.easeTo).toHaveBeenCalledWith({ center: [-64.2, -31.4], zoom: 8 })
    expect(mapMocks.clickHandlers.has('hotspot-cluster-count')).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
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
