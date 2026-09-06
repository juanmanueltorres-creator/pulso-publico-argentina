import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { EarthquakeEvent, ThermalHotspotEvent } from '../types/territorial'
import { TerritorialDetail } from './TerritorialDetail'

const earthquake: EarthquakeEvent = {
  id: 'eq-1',
  kind: 'earthquake',
  occurredAt: '2026-09-05T20:23:00-03:00',
  latitude: -31.5,
  longitude: -68.5,
  magnitude: 3.2,
  depthKm: 100,
  place: null,
  province: 'SAN JUAN',
  intensityText: null,
}

const hotspot: ThermalHotspotEvent = {
  id: 'hotspot-1',
  kind: 'thermal-hotspot',
  occurredAt: '2026-09-05T23:23:00Z',
  latitude: -31.5,
  longitude: -64.5,
  confidence: 'high',
  frpMw: null,
  sensor: 'VIIRS',
  satellite: 'NOAA20',
}

describe('TerritorialDetail temporal display', () => {
  it('shows an INPRES-style local-offset event as Argentina time', () => {
    render(<TerritorialDetail event={earthquake} />)

    expect(screen.getByText(/fecha y hora/i)).toBeInTheDocument()
    expect(screen.getByText(/5 de sept de 2026.*20:23.*hora ARG/i)).toBeInTheDocument()
  })

  it('converts a UTC event to the same Argentina display policy', () => {
    render(<TerritorialDetail event={hotspot} />)

    expect(screen.getByText(/5 de sept de 2026.*20:23.*hora ARG/i)).toBeInTheDocument()
  })
})
