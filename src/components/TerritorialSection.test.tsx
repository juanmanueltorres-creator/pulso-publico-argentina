import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import type {
  EarthquakeEvent,
  TerritorialSnapshot,
  ThermalHotspotEvent,
} from '../types/territorial'
import { TerritorialSection } from './TerritorialSection'

vi.mock('./TerritorialMap', () => ({
  TerritorialMap: () => <div data-testid="territorial-map" />,
}))

function earthquakeSnapshot(): TerritorialSnapshot<EarthquakeEvent> {
  return {
    schemaVersion: '1.0',
    kind: 'earthquake',
    generatedAt: '2026-08-28T16:00:00Z',
    sourceCheckedAt: '2026-08-28T16:00:00Z',
    window: { hours: 168 },
    freshness: { staleAfterMinutes: 180 },
    source: { name: 'INPRES', url: 'https://www.inpres.gob.ar', kind: 'official' },
    method: { type: 'scrape', note: 'Eventos recientes publicados por INPRES.' },
    limitations: ['El impacto no se deduce sólo de magnitud y profundidad.'],
    events: earthquakeEvents,
  }
}

function hotspotSnapshot(): TerritorialSnapshot<ThermalHotspotEvent> {
  return {
    schemaVersion: '1.0',
    kind: 'thermal-hotspot',
    generatedAt: '2026-08-28T16:00:00Z',
    sourceCheckedAt: '2026-08-28T16:00:00Z',
    window: { hours: 24 },
    freshness: { staleAfterMinutes: 180 },
    source: { name: 'CONAE', url: 'https://www.argentina.gob.ar/ciencia/conae', kind: 'official' },
    method: { type: 'wfs', note: 'Focos de calor VIIRS publicados por CONAE.' },
    limitations: ['Un foco de calor no equivale a un incendio confirmado.'],
    events: hotspotEvents,
  }
}

describe('TerritorialSection', () => {
  it('switches between earthquake and hotspot summaries without overstating hotspots', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
      />,
    )

    const earthquakesButton = screen.getByRole('button', { name: /sismos/i })
    expect(earthquakesButton).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText(/2 sismos registrados/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /focos de calor/i }))

    expect(screen.getByText(/3 focos de calor detectados/i)).toBeInTheDocument()
    expect(screen.getByText(/1 con confianza alta/i)).toBeInTheDocument()
    expect(screen.getByText(/una detección térmica no implica un incendio confirmado/i)).toBeInTheDocument()
  })

  it('keeps the hotspot domain usable when the earthquake source fails', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => Promise.reject(new Error('INPRES unavailable'))}
        loadHotspots={async () => hotspotSnapshot()}
      />,
    )

    expect(await screen.findByText(/no pudimos actualizar los sismos/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /focos de calor/i }))

    expect(await screen.findByText(/3 focos de calor detectados/i)).toBeInTheDocument()
    expect(screen.queryByText(/no pudimos actualizar los focos/i)).not.toBeInTheDocument()
  })
})
