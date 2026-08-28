import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import type { ThermalHotspotEvent } from '../types/territorial'
import type { HotspotWeatherContext as HotspotWeatherContextValue } from '../lib/weatherContext'
import { HotspotWeatherContext } from './HotspotWeatherContext'
import { TerritorialDetail } from './TerritorialDetail'

function snapshot() {
  return structuredClone(weatherSnapshotFixture())
}

function context(): HotspotWeatherContextValue {
  const value = snapshot()
  return {
    hotspotId: 'hotspot-1',
    frameIndex: 10,
    frameTimestamp: value.timestamps[10],
    timeDifferenceMinutes: 23,
    primary: { point: value.points[0], distanceKm: 19.2 },
    neighbors: [
      { point: value.points[0], distanceKm: 19.2 },
      { point: value.points[1], distanceKm: 38.4 },
    ],
  }
}

function hotspot(): ThermalHotspotEvent {
  return {
    id: 'hotspot-1',
    kind: 'thermal-hotspot',
    occurredAt: '2026-08-27T10:23:00.000Z',
    latitude: -31.6,
    longitude: -64.1,
    confidence: 'high',
    frpMw: 12.4,
    sensor: 'VIIRS',
    satellite: 'NOAA-20',
  }
}

describe('HotspotWeatherContext', () => {
  it('explains spatial and temporal modeled context without implying causality', () => {
    const value = snapshot()

    render(<HotspotWeatherContext snapshot={value} context={context()} />)

    expect(screen.getByText(/contexto meteorológico modelado/i)).toBeInTheDocument()
    expect(screen.getByText(/19,2 km/i)).toBeInTheDocument()
    expect(screen.getByText(/23 min/i)).toBeInTheDocument()
    expect(screen.getByText(/temperatura/i)).toBeInTheDocument()
    expect(screen.getByText(/humedad/i)).toBeInTheDocument()
    expect(screen.getByText(/viento/i)).toBeInTheDocument()
    expect(
      screen.getByText(/no prueban su causa ni confirman por sí solas un incendio/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open-Meteo/i })).toHaveAttribute(
      'href',
      value.source.url,
    )
  })

  it('renders unavailable core variables as No disponible instead of zero', () => {
    const value = snapshot()
    const ctx = context()
    const primary = value.points[0]
    primary.values.temperatureC[ctx.frameIndex] = null
    primary.values.relativeHumidityPct[ctx.frameIndex] = null
    primary.values.windSpeedKmh[ctx.frameIndex] = null
    ctx.primary = { point: primary, distanceKm: 19.2 }
    ctx.neighbors[0] = ctx.primary

    render(<HotspotWeatherContext snapshot={value} context={ctx} />)

    expect(screen.getAllByText('No disponible').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText(/^0(?:,0)? °C$/)).not.toBeInTheDocument()
  })

  it('can be appended after the existing territorial detail through one generic slot', () => {
    const value = snapshot()

    render(
      <TerritorialDetail
        event={hotspot()}
        source={{ name: 'CONAE', url: 'https://www.argentina.gob.ar/ciencia/conae' }}
        afterDetails={<HotspotWeatherContext snapshot={value} context={context()} />}
      />,
    )

    expect(screen.getByText('Foco de calor detectado')).toBeInTheDocument()
    expect(screen.getByText(/contexto meteorológico modelado/i)).toBeInTheDocument()
  })
})
