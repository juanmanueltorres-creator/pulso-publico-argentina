import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import { TerritorialMap } from './TerritorialMap'

const mapMocks = vi.hoisted(() => ({
  construct: vi.fn(),
  addLayer: vi.fn(),
  setPaintProperty: vi.fn(),
  setLayoutProperty: vi.fn(),
  easeTo: vi.fn(),
  sourceSetData: vi.fn(),
  remove: vi.fn(),
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
    mapMocks.easeTo.mockClear()
    mapMocks.sourceSetData.mockClear()
    mapMocks.remove.mockClear()
  })

  it('adds one custom 3D hypocenter layer and tilts the existing map without recreating it', () => {
    const props = {
      mode: 'earthquake' as const,
      earthquakes: earthquakeEvents,
      hotspots: hotspotEvents,
      selectedId: null,
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
    expect(mapMocks.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ pitch: expect.any(Number), bearing: expect.any(Number) }),
    )

    mapMocks.easeTo.mockClear()
    rerender(<TerritorialMap {...props} earthquakeDisplayMode="2d" />)

    expect(mapMocks.construct).toHaveBeenCalledTimes(1)
    expect(mapMocks.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ pitch: 0, bearing: 0 }),
    )
  })
})
