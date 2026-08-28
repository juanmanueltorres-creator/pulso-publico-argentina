import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import { WeatherDetail } from './WeatherDetail'

function snapshot() {
  return structuredClone(weatherSnapshotFixture())
}

describe('WeatherDetail', () => {
  it('explains one modeled weather point and frame with provenance', () => {
    const value = snapshot()
    const point = value.points[0]

    render(<WeatherDetail snapshot={value} point={point} frameIndex={10} />)

    expect(screen.getByText(/hora del modelo/i)).toBeInTheDocument()
    expect(screen.getByText(/temperatura/i)).toBeInTheDocument()
    expect(screen.getByText(/20,5 °C/i)).toBeInTheDocument()
    expect(screen.getByText(/humedad/i)).toBeInTheDocument()
    expect(screen.getByText(/50 %/i)).toBeInTheDocument()
    expect(screen.getByText(/viento/i)).toBeInTheDocument()
    expect(screen.getByText(/SSO/i)).toBeInTheDocument()
    expect(screen.getByText(/15 km\/h/i)).toBeInTheDocument()
    expect(screen.getByText(/ráfagas/i)).toBeInTheDocument()
    expect(screen.getByText(/21 km\/h/i)).toBeInTheDocument()
    expect(screen.getByText(/precipitación/i)).toBeInTheDocument()
    expect(screen.getByText(/coordenada consultada/i)).toBeInTheDocument()
    expect(screen.getByText(/-31,5.*-64/i)).toBeInTheDocument()
    expect(screen.getByText(/ECMWF IFS HRES 9 km/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open-Meteo/i })).toHaveAttribute(
      'href',
      value.source.url,
    )
    expect(screen.getByText(/datos hasta/i)).toBeInTheDocument()
    expect(screen.getByText('No es una estación de superficie.')).toBeInTheDocument()
  })

  it('uses No disponible for null values and never coerces them to zero', () => {
    const value = snapshot()
    const point = value.points[0]
    point.values.temperatureC[4] = null
    point.values.relativeHumidityPct[4] = null
    point.values.windSpeedKmh[4] = null
    point.values.windDirectionDeg[4] = null
    point.values.windGustKmh[4] = null
    point.values.precipitationMm[4] = null

    render(<WeatherDetail snapshot={value} point={point} frameIndex={4} />)

    expect(screen.getAllByText('No disponible').length).toBeGreaterThanOrEqual(5)
    expect(screen.queryByText(/^0(?:,0)? °C$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^0(?:,0)? km\/h$/)).not.toBeInTheDocument()
  })
})
