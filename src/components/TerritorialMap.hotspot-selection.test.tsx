import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import { TerritorialMap } from './TerritorialMap'

const mapMocks = vi.hoisted(() => ({
  setWorkerUrl: vi.fn(),
  setData: vi.fn(),
  setLayoutProperty: vi.fn(),
  getClusterExpansionZoom: vi.fn().mockResolvedValue(8),
  easeTo: vi.fn(),
  remove: vi.fn(),
  queryRenderedFeatures: vi.fn(),
  globalClick: null as null | ((event: { point: unknown }) => unknown),
}))

vi.mock('maplibre-gl', () => {
  class MockMap {
    on(event: string, layerOrHandler: unknown, maybeHandler?: unknown) {
      if (event === 'load' && typeof layerOrHandler === 'function') {
        layerOrHandler()
      }
      if (event === 'click' && typeof layerOrHandler === 'function' && maybeHandler === undefined) {
        mapMocks.globalClick = layerOrHandler as (event: { point: unknown }) => unknown
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

    queryRenderedFeatures(...args: unknown[]) {
      return mapMocks.queryRenderedFeatures(...args)
    }

    setLayoutProperty(...args: unknown[]) {
      mapMocks.setLayoutProperty(...args)
      return this
    }

    easeTo(...args: unknown[]) {
      mapMocks.easeTo(...args)
      return this
    }

    remove() {
      mapMocks.remove()
    }
  }

  return {
    Map: MockMap,
    setWorkerUrl: mapMocks.setWorkerUrl,
  }
})

describe('TerritorialMap hotspot production click path', () => {
  beforeEach(() => {
    mapMocks.globalClick = null
    mapMocks.queryRenderedFeatures.mockReset()
  })

  it('queries the rendered hotspot point at the click position and selects its exact event', () => {
    const onSelect = vi.fn()
    const point = { x: 120, y: 80 }
    mapMocks.queryRenderedFeatures.mockReturnValue([
      {
        id: hotspotEvents[0].id,
        properties: { id: hotspotEvents[0].id },
        geometry: {
          type: 'Point',
          coordinates: [hotspotEvents[0].longitude, hotspotEvents[0].latitude],
        },
      },
    ])

    render(
      <TerritorialMap
        mode="thermal-hotspot"
        earthquakes={earthquakeEvents}
        hotspots={hotspotEvents}
        selectedId={null}
        onSelect={onSelect}
      />,
    )

    expect(mapMocks.globalClick).toBeTypeOf('function')
    mapMocks.globalClick?.({ point })

    expect(mapMocks.queryRenderedFeatures).toHaveBeenCalledWith(point, {
      layers: ['hotspot-points'],
    })
    expect(onSelect).toHaveBeenCalledWith(hotspotEvents[0])
  })
})
