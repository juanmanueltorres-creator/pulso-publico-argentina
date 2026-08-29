import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import { TerritorialMap } from './TerritorialMap'

const mapMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  addLayer: vi.fn(),
  setPaintProperty: vi.fn(),
  setLayoutProperty: vi.fn(),
  cameraForBounds: vi.fn((..._args: unknown[]) => ({ center: [-66, -31], zoom: 4.8 })),
  easeTo: vi.fn(),
  sourceSetData: vi.fn(),
  remove: vi.fn(),
}))

const depthLayerMocks = vi.hoisted(() => ({
  setEvents: vi.fn(),
  setVisible: vi.fn(),
  triggerRepaint: vi.fn(),
}))

vi.mock('../lib/EarthquakeDepth3DLayer', () => ({
  EarthquakeDepth3DLayer: class {
    id = 'earthquake-depth-3d'
    type = 'custom' as const
    renderingMode = '3d' as const

    setEvents(...args: unknown[]) {
      depthLayerMocks.setEvents(...args)
    }

    setVisible(...args: unknown[]) {
      depthLayerMocks.setVisible(...args)
    }
  },
}))

vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor(options: unknown) {
      mapMocks.construct(options)
    }

    on(event: string, layerOrHandler: unknown) {
      if (event === 'load' && typeof layerOrHandler === 'function') layerOrHandler()
      return this
    }

    getSource(id: string) {
      return { setData: (data: unknown) => mapMocks.sourceSetData(id, data) }
    }

    addLayer(layer: unknown) {
      mapMocks.addLayer(layer)
      return this
    }

    setPaintProperty(...args: unknown[]) {
      mapMocks.setPaintProperty(...args)
      return this
    }

    setLayoutProperty(...args: unknown[]) {
      mapMocks.setLayoutProperty(...args)
      return this
    }

    cameraForBounds(...args: unknown[]) {
      return mapMocks.cameraForBounds(...args)
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
    setWorkerUrl: vi.fn(),
  }
})

describe('TerritorialMap earthquake depth 3D mode', () => {
  beforeEach(() => {
    mapMocks.construct.mockClear()
    mapMocks.addLayer.mockClear()
    mapMocks.setPaintProperty.mockClear()
    mapMocks.setLayoutProperty.mockClear()
    mapMocks.cameraForBounds.mockClear()
    mapMocks.easeTo.mockClear()
    mapMocks.sourceSetData.mockClear()
    mapMocks.remove.mockClear()
    depthLayerMocks.setEvents.mockClear()
    depthLayerMocks.setVisible.mockClear()
  })

  it('focuses the existing map on the hypocenter cloud and updates the selected 3D stem without recreating it', () => {
    const props = {
      mode: 'earthquake' as const,
      earthquakes: earthquakeEvents,
      hotspots: hotspotEvents,
      selectedId: earthquakeEvents[0].id,
      onSelect: vi.fn(),
    }

    const { rerender } = render(<TerritorialMap {...props} earthquakeDisplayMode="3d" />)

    const options = mapMocks.construct.mock.calls[0]?.[0] as any
    expect(options.maxPitch).toBeGreaterThanOrEqual(70)
    expect(options.canvasContextAttributes).toEqual(expect.objectContaining({ antialias: true }))
    expect(mapMocks.construct).toHaveBeenCalledTimes(1)
    expect(mapMocks.addLayer).toHaveBeenCalledTimes(1)
    expect(mapMocks.addLayer.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ id: 'earthquake-depth-3d', type: 'custom', renderingMode: '3d' }),
    )
    expect(depthLayerMocks.setEvents).toHaveBeenCalledWith(earthquakeEvents, earthquakeEvents[0].id)
    expect(mapMocks.cameraForBounds).toHaveBeenCalledTimes(1)
    expect(mapMocks.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [-66, -31],
        zoom: expect.any(Number),
        pitch: 70,
        bearing: -24,
      }),
    )

    depthLayerMocks.setEvents.mockClear()
    rerender(
      <TerritorialMap
        {...props}
        selectedId={earthquakeEvents[1].id}
        earthquakeDisplayMode="3d"
      />,
    )

    expect(mapMocks.construct).toHaveBeenCalledTimes(1)
    expect(depthLayerMocks.setEvents).toHaveBeenCalledWith(earthquakeEvents, earthquakeEvents[1].id)

    mapMocks.easeTo.mockClear()
    rerender(<TerritorialMap {...props} earthquakeDisplayMode="2d" />)

    expect(mapMocks.construct).toHaveBeenCalledTimes(1)
    expect(mapMocks.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ pitch: 0, bearing: 0 }),
    )
  })
})
