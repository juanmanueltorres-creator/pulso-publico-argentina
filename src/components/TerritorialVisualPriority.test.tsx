import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TerritorialLegend } from './TerritorialLegend'
import { TerritorialMap } from './TerritorialMap'

const mapMocks = vi.hoisted(() => ({
  options: null as null | { style?: { sources?: Record<string, unknown>; layers?: Array<Record<string, unknown>> } },
  setWorkerUrl: vi.fn(),
}))

vi.mock('maplibre-gl', () => {
  class MockMap {
    constructor(options: unknown) {
      mapMocks.options = options as typeof mapMocks.options
    }

    on(event: string, layerOrHandler: unknown) {
      if (event === 'load' && typeof layerOrHandler === 'function') layerOrHandler()
      return this
    }

    getSource(id: string) {
      if (id === 'hotspots') {
        return {
          setData: vi.fn(),
          getClusterExpansionZoom: vi.fn().mockResolvedValue(8),
        }
      }
      return { setData: vi.fn() }
    }

    setLayoutProperty() { return this }
    queryRenderedFeatures() { return [] }
    easeTo() { return this }
    remove() {}
  }

  return {
    Map: MockMap,
    setWorkerUrl: mapMocks.setWorkerUrl,
  }
})

describe('territorial visual priority semantics', () => {
  beforeEach(() => {
    mapMocks.options = null
  })

  it('explains the visual encoding and its limits in the references', () => {
    const { rerender } = render(<TerritorialLegend mode="earthquake" />)

    expect(screen.getByText('Tamaño = magnitud')).toBeInTheDocument()
    expect(screen.getByText(/M4\+/i)).toBeInTheDocument()
    expect(screen.getByText(/no representa daño previsto/i)).toBeInTheDocument()

    rerender(<TerritorialLegend mode="thermal-hotspot" />)

    expect(screen.getByText(/Tamaño = cantidad de detecciones agrupadas/i)).toBeInTheDocument()
    expect(screen.getByText(/Brillo = proporción de detecciones con confianza alta/i)).toBeInTheDocument()
    expect(screen.getByText(/puntos individuales/i)).toBeInTheDocument()
    expect(screen.getByText(/Más grande no significa más peligro/i)).toBeInTheDocument()
    expect(screen.getByText(/confianza de detección no equivale a probabilidad de incendio/i)).toBeInTheDocument()
  })

  it('uses stronger earthquake sizing and aggregates high-confidence hotspot counts for clusters', () => {
    render(
      <TerritorialMap
        mode="thermal-hotspot"
        earthquakes={[]}
        hotspots={[]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    )

    const style = mapMocks.options?.style
    expect(style).toBeTruthy()

    const sources = style?.sources as Record<string, { clusterProperties?: Record<string, unknown> }>
    expect(sources.hotspots.clusterProperties).toHaveProperty('high_count')

    const layers = style?.layers ?? []
    const earthquakeLayer = layers.find((layer) => layer.id === 'earthquake-points')
    const clusterLayer = layers.find((layer) => layer.id === 'hotspot-clusters')
    const hotspotLayer = layers.find((layer) => layer.id === 'hotspot-points')

    expect(JSON.stringify(earthquakeLayer)).toContain('24')
    expect(JSON.stringify(earthquakeLayer)).toContain('34')
    expect(JSON.stringify(clusterLayer)).toContain('high_count')
    expect(JSON.stringify(clusterLayer)).toContain('point_count')
    expect(JSON.stringify(hotspotLayer)).toContain('circle-opacity')
  })
})
