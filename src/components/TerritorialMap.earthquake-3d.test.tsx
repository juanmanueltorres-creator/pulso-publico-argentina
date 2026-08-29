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

const popupMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  setLngLat: vi.fn(),
  setText: vi.fn(),
  addTo: vi.fn(),
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
  class MockPopup {
    constructor(options: unknown) {
      popupMocks.construct(options)
    }

    setLngLat(...args: unknown[]) {
      popupMocks.setLngLat(...args)
      return this
    }

    setText(...args: unknown[]) {
      popupMocks.setText(...args)
      return this
    }

    addTo(...args: unknown[]) {
      popupMocks.addTo(...args)
      return this
    }

    remove() {
      popupMocks.remove()
      return this
    }
  }

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
    Popup: MockPopup,
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
    popupMocks.construct.mockClear()
    popupMocks.setLngLat.mockClear()
    popupMocks.setText.mockClear()
    popupMocks.addTo.mockClear()
    popupMocks.remove.mockClear()
    depthLayerMocks.setEvents.mockClear()
    depthLayerMocks.setVisible.mockClear()
  })

  it('focuses the existing map on the hypocenter cloud and keeps an INPRES depth label on the selected surface anchor', () => {
    const props = {
      mode: 'earthquake' as const,
      earthquakes: earthquakeEvents,
      hotspots: hotspotEvents,
      selectedId: earthquakeEvents[0].id,
      onSelect: vi.fn(),
    }

    const { rerender } = render(<TerritorialMap {...props} earthquakeDisplayMode="3d" />)

    const options = mapMocks.construct.mock.calls[0]?.[0] as any
    expect(options.maxPitch).toBeGreaterThanOrEqual(60)
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
        pitch: 60,
        bearing: -22,
      }),
    )
    expect(popupMocks.construct).toHaveBeenCalledTimes(1)
    expect(popupMocks.construct).toHaveBeenCalledWith(
      expect.objectContaining({
        closeButton: false,
        closeOnClick: false,
        className: 'earthquake-depth-3d-label',
      }),
    )
    expect(popupMocks.setLngLat).toHaveBeenLastCalledWith([
      earthquakeEvents[0].longitude,
      earthquakeEvents[0].latitude,
    ])
    expect(popupMocks.setText).toHaveBeenLastCalledWith('87 km · INPRES')
    expect(popupMocks.addTo).toHaveBeenCalledTimes(1)

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
    expect(popupMocks.construct).toHaveBeenCalledTimes(1)
    expect(popupMocks.setLngLat).toHaveBeenLastCalledWith([
      earthquakeEvents[1].longitude,
      earthquakeEvents[1].latitude,
    ])
    expect(popupMocks.setText).toHaveBeenLastCalledWith('18 km · INPRES')

    mapMocks.easeTo.mockClear()
    rerender(<TerritorialMap {...props} earthquakeDisplayMode="2d" />)

    expect(mapMocks.construct).toHaveBeenCalledTimes(1)
    expect(mapMocks.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ pitch: 0, bearing: 0 }),
    )
    expect(popupMocks.remove).toHaveBeenCalled()
  })
})
