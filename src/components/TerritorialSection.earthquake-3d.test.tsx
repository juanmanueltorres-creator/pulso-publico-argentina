import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import type {
  EarthquakeEvent,
  TerritorialSnapshot,
  ThermalHotspotEvent,
} from '../types/territorial'
import { TerritorialSection } from './TerritorialSection'

vi.mock('./TerritorialMap', () => ({
  TerritorialMap: ({ earthquakeDisplayMode = '2d' }: { earthquakeDisplayMode?: '2d' | '3d' }) => (
    <div data-testid="territorial-map" data-earthquake-display-mode={earthquakeDisplayMode} />
  ),
}))

function earthquakeSnapshot(): TerritorialSnapshot<EarthquakeEvent> {
  return {
    schemaVersion: '1.0',
    kind: 'earthquake',
    generatedAt: '2026-08-29T04:00:00Z',
    sourceCheckedAt: '2026-08-29T04:00:00Z',
    window: { hours: 168 },
    freshness: { staleAfterMinutes: 240 },
    source: { name: 'INPRES', url: 'https://www.inpres.gob.ar/sismos_consultados', kind: 'official' },
    method: { type: 'scrape', note: 'Eventos recientes publicados por INPRES.' },
    limitations: ['La profundidad es la reportada por la fuente.'],
    events: [{ ...earthquakeEvents[0], depthKm: 86 }],
  }
}

function hotspotSnapshot(): TerritorialSnapshot<ThermalHotspotEvent> {
  return {
    schemaVersion: '1.0',
    kind: 'thermal-hotspot',
    generatedAt: '2026-08-29T04:00:00Z',
    sourceCheckedAt: '2026-08-29T04:00:00Z',
    window: { hours: 24 },
    freshness: { staleAfterMinutes: 240 },
    source: { name: 'CONAE', url: 'https://catalogos5.conae.gov.ar/catalogofocos/', kind: 'official' },
    method: { type: 'scrape', note: 'Visor público.' },
    limitations: ['Una detección térmica no implica un incendio confirmado.'],
    events: [hotspotEvents[0]],
  }
}

describe('TerritorialSection earthquake depth display', () => {
  it('offers a 2D / Profundidad 3D toggle only for earthquakes and forwards the selected display mode', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => weatherSnapshotFixture()}
        now={new Date('2026-08-29T05:00:00Z')}
      />,
    )

    await screen.findByText(/1 sismo registrado|1 sismos registrados/i)

    const flat = screen.getByRole('button', { name: 'Mapa 2D' })
    const depth = screen.getByRole('button', { name: 'Profundidad 3D' })
    expect(flat).toHaveAttribute('aria-pressed', 'true')
    expect(depth).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('territorial-map')).toHaveAttribute('data-earthquake-display-mode', '2d')

    await user.click(depth)

    expect(depth).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('territorial-map')).toHaveAttribute('data-earthquake-display-mode', '3d')
    expect(screen.getByText(/superficie plana de referencia/i)).toBeInTheDocument()
    expect(screen.getByText(/sin relieve\/DEM/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /focos de calor/i }))
    expect(screen.queryByRole('button', { name: 'Mapa 2D' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Profundidad 3D' })).not.toBeInTheDocument()
  })
})
