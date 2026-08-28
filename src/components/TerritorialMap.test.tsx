import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import type { HotspotWeatherContext } from '../lib/weatherContext'
import { TerritorialMap } from './TerritorialMap'

const mapMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  setWorkerUrl: vi.fn(),
  setLayoutProperty: vi.fn(),
  sourceSetData: vi.fn(),
  getClusterExpansionZoom: vi.fn(),
  easeTo: vi.fn(),
  remove: vi.fn(),
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
  clickHandlers: new Map<string, (event: unknown) => unknown>(),
}))

vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor(options: unknown) {
      mapMocks.construct(options)
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
      return {
        setData: (data: unknown) => mapMocks.sourceSetData(id, data),
        ...(id === 'hotspots'
          ? { getClusterExpansionZoom: mapMocks.getClusterExpansionZoom }
          : {}),
      }
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

function weatherContext(): HotspotWeatherContext {
  const weather = weatherSnapshotFixture()
  return {
    hotspotId: hotspotEvents[0].id,
    frameIndex: 23,
    frameTimestamp: weather.timestamps[23],
    timeDifferenceMinutes: 17,
    primary: { point: weather.points[0], distanceKm: 18.4 },
    neighbors: [
      { point: weather.points[0], distanceKm: 18.4 },
      { point: weather.points[1], distanceKm: 42.7 },
    ],
  }
}

function weatherProps(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'weather' as const,
    weatherVariable: 'temperature' as const,
    earthquakes: earthquakeEvents,
    hotspots: hotspotEvents,
    weather: weatherSnapshotFixture(),
    weatherFrameIndex: 23,
    hotspotContext: weatherContext(),
    selectedHotspot: hotspotEvents[0],
    selectedWeatherPointId: null,
    onSelect: vi.fn(),
    onSelectWeather: vi.fn(),
    ...overrides,
  }
}

describe('TerritorialMap', () => {
  beforeEach(() => {
    mapMocks.construct.mockClear()
    mapMocks.setLayoutProperty.mockClear()
    mapMocks.sourceSetData.mockClear()
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

  it('creates the five persistent weather sources and restrained weather layers once', () => {
    render(<TerritorialMap {...weatherProps()} />)

    const options = mapMocks.construct.mock.calls[0]?.[0] as any
    expect(options.style.sources).toEqual(
      expect.objectContaining({
        'weather-grid': expect.objectContaining({ type: 'geojson' }),
        'weather-wind-vectors': expect.objectContaining({ type: 'geojson' }),
        'weather-neighbors': expect.objectContaining({ type: 'geojson' }),
        'weather-link': expect.objectContaining({ type: 'geojson' }),
        'selected-hotspot-reference': expect.objectContaining({ type: 'geojson' }),
      }),
    )
    expect(options.style.layers.map((layer: any) => layer.id)).toEqual(
      expect.arrayContaining([
        'weather-temperature-points',
        'weather-humidity-points',
        'weather-wind-origins',
        'weather-wind-vectors',
        'weather-neighbor-points',
        'weather-primary-point',
        'weather-context-link',
        'selected-hotspot-reference',
      ]),
    )
  })

  it('keeps one MapLibre instance across hotspot → weather → hotspot without moving the camera', () => {
    const onSelect = vi.fn()
    const onSelectWeather = vi.fn()
    const { rerender } = render(
      <TerritorialMap
        {...weatherProps({
          mode: 'thermal-hotspot',
          hotspotContext: null,
          selectedHotspot: null,
          onSelect,
          onSelectWeather,
        })}
      />,
    )

    expect(screen.getByRole('region', { name: 'Mapa de señales territoriales de Argentina' })).toBeInTheDocument()
    expect(mapMocks.construct).toHaveBeenCalledTimes(1)

    rerender(
      <TerritorialMap
        {...weatherProps({
          mode: 'weather',
          weatherVariable: 'temperature',
          onSelect,
          onSelectWeather,
        })}
      />,
    )
    rerender(
      <TerritorialMap
        {...weatherProps({
          mode: 'thermal-hotspot',
          hotspotContext: null,
          selectedHotspot: null,
          onSelect,
          onSelectWeather,
        })}
      />,
    )

    expect(mapMocks.construct).toHaveBeenCalledTimes(1)
    expect(mapMocks.flyTo).not.toHaveBeenCalled()
    expect(mapMocks.fitBounds).not.toHaveBeenCalled()
  })

  it('keeps the full weather layer hidden in hotspot mode and shows context overlays only when context exists', () => {
    const props = weatherProps({
      mode: 'thermal-hotspot',
      hotspotContext: null,
      selectedHotspot: hotspotEvents[0],
    })
    const { rerender } = render(<TerritorialMap {...props} />)

    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('hotspot-points', 'visibility', 'visible')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-temperature-points', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-humidity-points', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-wind-origins', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-wind-vectors', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-neighbor-points', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-context-link', 'visibility', 'none')

    mapMocks.setLayoutProperty.mockClear()
    rerender(<TerritorialMap {...weatherProps({ mode: 'thermal-hotspot' })} />)

    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-neighbor-points', 'visibility', 'visible')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-primary-point', 'visibility', 'visible')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-context-link', 'visibility', 'visible')
  })

  it('shows only the active weather variable and the selected hotspot reference in weather mode', () => {
    const { rerender } = render(<TerritorialMap {...weatherProps({ weatherVariable: 'temperature' })} />)

    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('earthquake-points', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('hotspot-points', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-temperature-points', 'visibility', 'visible')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-humidity-points', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-wind-origins', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('selected-hotspot-reference', 'visibility', 'visible')

    mapMocks.setLayoutProperty.mockClear()
    rerender(<TerritorialMap {...weatherProps({ weatherVariable: 'wind' })} />)

    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-temperature-points', 'visibility', 'none')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-wind-origins', 'visibility', 'visible')
    expect(mapMocks.setLayoutProperty).toHaveBeenCalledWith('weather-wind-vectors', 'visibility', 'visible')
  })

  it('syncs only the active weather frame plus bounded context sources', () => {
    render(<TerritorialMap {...weatherProps()} />)

    expect(mapMocks.sourceSetData).toHaveBeenCalledWith(
      'weather-grid',
      expect.objectContaining({
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({ properties: expect.objectContaining({ frameIndex: 23 }) }),
        ]),
      }),
    )
    expect(mapMocks.sourceSetData).toHaveBeenCalledWith(
      'weather-neighbors',
      expect.objectContaining({ type: 'FeatureCollection', features: expect.any(Array) }),
    )
    expect(mapMocks.sourceSetData).toHaveBeenCalledWith(
      'weather-link',
      expect.objectContaining({ type: 'FeatureCollection', features: [expect.any(Object)] }),
    )
    expect(mapMocks.sourceSetData).toHaveBeenCalledWith(
      'selected-hotspot-reference',
      expect.objectContaining({ type: 'FeatureCollection', features: [expect.any(Object)] }),
    )
  })

  it('selects weather points through the visible weather point path without clearing the hotspot selection', () => {
    const onSelect = vi.fn()
    const onSelectWeather = vi.fn()
    const weather = weatherSnapshotFixture()

    render(<TerritorialMap {...weatherProps({ weather, onSelect, onSelectWeather })} />)

    mapMocks.clickHandlers.get('weather-temperature-points')?.({
      features: [{ properties: { id: weather.points[0].id } }],
    })

    expect(onSelectWeather).toHaveBeenCalledWith(weather.points[0].id)
    expect(onSelect).not.toHaveBeenCalled()
    expect(mapMocks.sourceSetData).toHaveBeenCalledWith(
      'selected-hotspot-reference',
      expect.objectContaining({ features: [expect.any(Object)] }),
    )
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
