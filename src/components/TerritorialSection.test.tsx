import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { weatherSnapshotFixture } from '../test/weatherFixtures'
import { earthquakeEvents, hotspotEvents } from '../test/territorialFixtures'
import type { HotspotWeatherContext } from '../lib/weatherContext'
import type {
  EarthquakeEvent,
  TerritorialSnapshot,
  ThermalHotspotEvent,
} from '../types/territorial'
import type {
  TerritorialViewMode,
  WeatherSnapshot,
  WeatherVariable,
} from '../types/weather'
import { TerritorialSection } from './TerritorialSection'

vi.mock('./TerritorialMap', () => ({
  TerritorialMap: ({
    mode,
    earthquakes,
    hotspots,
    weather,
    hotspotContext,
    selectedHotspot,
    onSelect,
    onSelectWeather,
  }: {
    mode: TerritorialViewMode
    weatherVariable?: WeatherVariable
    earthquakes: EarthquakeEvent[]
    hotspots: ThermalHotspotEvent[]
    weather?: WeatherSnapshot | null
    hotspotContext?: HotspotWeatherContext | null
    selectedHotspot?: ThermalHotspotEvent | null
    onSelect: (event: EarthquakeEvent | ThermalHotspotEvent) => void
    onSelectWeather?: (pointId: string) => void
  }) => {
    const event = mode === 'earthquake' ? earthquakes[0] : mode === 'thermal-hotspot' ? hotspots[0] : null
    return (
      <div
        data-testid="territorial-map"
        data-mode={mode}
        data-hotspot-context={hotspotContext ? 'ready' : 'none'}
        data-selected-hotspot-id={selectedHotspot?.id ?? ''}
      >
        {event ? (
          <button type="button" onClick={() => onSelect(event)}>
            Seleccionar señal del mapa
          </button>
        ) : null}
        {mode === 'weather' && weather?.points[0] && onSelectWeather ? (
          <button type="button" onClick={() => onSelectWeather(weather.points[0].id)}>
            Seleccionar meteorología del mapa
          </button>
        ) : null}
      </div>
    )
  },
}))

function earthquakeSnapshot(): TerritorialSnapshot<EarthquakeEvent> {
  return {
    schemaVersion: '1.0',
    kind: 'earthquake',
    generatedAt: '2026-08-28T04:00:00Z',
    sourceCheckedAt: '2026-08-28T04:00:00Z',
    window: { hours: 168 },
    freshness: { staleAfterMinutes: 240 },
    source: {
      name: 'INPRES',
      url: 'https://www.inpres.gob.ar/sismos_consultados',
      kind: 'official',
    },
    method: { type: 'scrape', note: 'Eventos recientes publicados por INPRES.' },
    limitations: ['El impacto no se deduce sólo de magnitud y profundidad.'],
    events: [
      { ...earthquakeEvents[0], magnitude: 4.2, depthKm: 86, intensityText: 'II a III' },
      earthquakeEvents[1],
    ],
  }
}

function hotspotSnapshot(): TerritorialSnapshot<ThermalHotspotEvent> {
  return {
    schemaVersion: '1.0',
    kind: 'thermal-hotspot',
    generatedAt: '2026-08-28T04:00:00Z',
    sourceCheckedAt: '2026-08-28T04:00:00Z',
    window: { hours: 24 },
    freshness: { staleAfterMinutes: 240 },
    source: {
      name: 'CONAE',
      url: 'https://catalogos5.conae.gov.ar/catalogofocos/',
      kind: 'official',
    },
    method: { type: 'scrape', note: 'Visor público VIIRS NOAA20 + SNPP.' },
    limitations: ['Un foco de calor no equivale a un incendio confirmado.'],
    events: [
      { ...hotspotEvents[1], frpMw: 18.5, satellite: 'NOAA20' },
      hotspotEvents[0],
      hotspotEvents[2],
    ],
  }
}

function weatherSnapshot(): WeatherSnapshot {
  return structuredClone(weatherSnapshotFixture())
}

const availableNow = new Date('2026-08-28T05:00:00Z')

describe('TerritorialSection', () => {
  it('derives real-contract counters from each independent snapshot without overstating hotspots', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => weatherSnapshot()}
        now={availableNow}
      />,
    )

    const earthquakesButton = screen.getByRole('button', { name: /sismos/i })
    expect(earthquakesButton).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('2 sismos registrados · últimos 7 días')).toBeInTheDocument()
    expect(screen.getByText('1 de magnitud 4 o superior')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /focos de calor/i }))

    expect(screen.getByText('3 focos de calor detectados · últimas 24 h')).toBeInTheDocument()
    expect(screen.getByText('1 con confianza alta')).toBeInTheDocument()
    expect(screen.getByText(/una detección térmica no implica un incendio confirmado/i)).toBeInTheDocument()
    expect(screen.queryByText(/incendios activos/i)).not.toBeInTheDocument()
    expect(screen.getByText(/confianza de detección no equivale a probabilidad de incendio/i)).toBeInTheDocument()
  })

  it('adds an independent Meteorología view with modeled-source summary and variable controls', async () => {
    const user = userEvent.setup()
    const weather = weatherSnapshot()

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => weather}
        now={availableNow}
      />,
    )

    await screen.findByText('2 sismos registrados · últimos 7 días')
    const weatherButton = screen.getByRole('button', { name: 'Meteorología' })
    expect(weatherButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(weatherButton)

    expect(weatherButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 puntos modelados · últimas 24 h')).toBeInTheDocument()
    expect(screen.getByText('ECMWF IFS HRES 9 km')).toBeInTheDocument()
    expect(screen.getByText(/datos hasta/i)).toBeInTheDocument()
    expect(screen.getByText(/modelo meteorológico.*no es una estación de superficie/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open-Meteo' })).toHaveAttribute('href', weather.source.url)

    const temperature = screen.getByRole('button', { name: 'Temperatura' })
    const wind = screen.getByRole('button', { name: 'Viento' })
    const humidity = screen.getByRole('button', { name: 'Humedad' })
    expect(temperature).toHaveAttribute('aria-pressed', 'true')
    expect(wind).toHaveAttribute('aria-pressed', 'false')
    expect(humidity).toHaveAttribute('aria-pressed', 'false')

    await user.click(wind)
    expect(wind).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/dirección desde la que sopla el viento/i)).toBeInTheDocument()
  })

  it('uses the weather snapshot freshness contract instead of a hardcoded threshold', async () => {
    const user = userEvent.setup()
    const weather = weatherSnapshot()
    weather.freshness.staleAfterMinutes = 60

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => weather}
        now={new Date('2026-08-28T02:00:00Z')}
      />,
    )

    await screen.findByText('2 sismos registrados · últimos 7 días')
    await user.click(screen.getByRole('button', { name: 'Meteorología' }))

    expect(screen.getByText(/Datos desactualizados.*Última consulta/i)).toBeInTheDocument()
  })

  it('marks a ready snapshot stale exactly from sourceCheckedAt and shows the represented check', async () => {
    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => weatherSnapshot()}
        now={new Date('2026-08-28T08:00:00Z')}
      />,
    )

    expect(await screen.findByText('2 sismos registrados · últimos 7 días')).toBeInTheDocument()
    expect(screen.getByText(/Datos desactualizados.*Última consulta/i)).toBeInTheDocument()
  })

  it('keeps earthquakes usable when the hotspot source fails instead of converting failure into zero', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => Promise.reject(new Error('CONAE unavailable'))}
        loadWeather={async () => weatherSnapshot()}
        now={availableNow}
      />,
    )

    expect(await screen.findByText('2 sismos registrados · últimos 7 días')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /focos de calor/i }))

    expect(await screen.findByText('Fuente temporalmente no disponible')).toBeInTheDocument()
    expect(screen.queryByText(/0 focos de calor/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /sismos/i }))
    expect(screen.getByText('2 sismos registrados · últimos 7 días')).toBeInTheDocument()
  })

  it('keeps hotspots usable when weather fails and never invents zero-valued weather', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => Promise.reject(new Error('weather unavailable'))}
        now={availableNow}
      />,
    )

    await screen.findByText('2 sismos registrados · últimos 7 días')
    await user.click(screen.getByRole('button', { name: /focos de calor/i }))
    await user.click(screen.getByRole('button', { name: /seleccionar señal del mapa/i }))

    expect(screen.getByRole('heading', { name: 'Foco de calor detectado' })).toBeInTheDocument()
    expect(screen.getByText('18,5 MW')).toBeInTheDocument()
    expect(screen.getByText('Contexto meteorológico temporalmente no disponible')).toBeInTheDocument()
    expect(screen.queryByText(/^0(?:,0)? °C$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^0(?:,0)? km\/h$/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Meteorología' }))
    expect(screen.getByText('Contexto meteorológico temporalmente no disponible')).toBeInTheDocument()
    expect(screen.queryByText(/0 puntos modelados/i)).not.toBeInTheDocument()
  })

  it('remembers hotspot and weather selections independently across mode changes', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => weatherSnapshot()}
        now={availableNow}
      />,
    )

    await screen.findByText('2 sismos registrados · últimos 7 días')
    await user.click(screen.getByRole('button', { name: /focos de calor/i }))
    await user.click(screen.getByRole('button', { name: /seleccionar señal del mapa/i }))

    expect(screen.getByRole('heading', { name: 'Foco de calor detectado' })).toBeInTheDocument()
    expect(screen.getByText('18,5 MW')).toBeInTheDocument()
    expect(screen.getByText(/contexto meteorológico modelado/i)).toBeInTheDocument()
    expect(screen.getByTestId('territorial-map')).toHaveAttribute('data-hotspot-context', 'ready')

    await user.click(screen.getByRole('button', { name: 'Meteorología' }))
    expect(screen.getByTestId('territorial-map')).toHaveAttribute(
      'data-selected-hotspot-id',
      hotspotSnapshot().events[0].id,
    )
    expect(screen.getByText(/seleccioná un punto meteorológico/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /seleccionar meteorología del mapa/i }))
    expect(screen.getByRole('heading', { name: 'Punto meteorológico' })).toBeInTheDocument()
    expect(screen.getByText('No es una estación de superficie.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /focos de calor/i }))
    expect(screen.getByRole('heading', { name: 'Foco de calor detectado' })).toBeInTheDocument()
    expect(screen.getByText('18,5 MW')).toBeInTheDocument()
  })

  it('shows earthquake context, intensity and official source after map selection', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => weatherSnapshot()}
        now={availableNow}
      />,
    )

    await screen.findByText('2 sismos registrados · últimos 7 días')
    await user.click(screen.getByRole('button', { name: /seleccionar señal del mapa/i }))

    expect(screen.getByRole('heading', { name: 'Sismo registrado' })).toBeInTheDocument()
    expect(screen.getByText('4,2')).toBeInTheDocument()
    expect(screen.getByText('86 km')).toBeInTheDocument()
    expect(screen.getAllByText('San Juan').length).toBeGreaterThan(0)
    expect(screen.getByText('II a III')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /INPRES/i })).toHaveAttribute(
      'href',
      'https://www.inpres.gob.ar/sismos_consultados',
    )
  })

  it('shows hotspot confidence, FRP when present, sensor, satellite, caveat and official source', async () => {
    const user = userEvent.setup()

    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => weatherSnapshot()}
        now={availableNow}
      />,
    )

    await screen.findByText('2 sismos registrados · últimos 7 días')
    await user.click(screen.getByRole('button', { name: /focos de calor/i }))
    await user.click(screen.getByRole('button', { name: /seleccionar señal del mapa/i }))

    expect(screen.getByRole('heading', { name: 'Foco de calor detectado' })).toBeInTheDocument()
    expect(screen.getByText('alta')).toBeInTheDocument()
    expect(screen.getByText('18,5 MW')).toBeInTheDocument()
    expect(screen.getByText('VIIRS')).toBeInTheDocument()
    expect(screen.getByText('NOAA20')).toBeInTheDocument()
    expect(screen.getByText('Una detección térmica no implica un incendio confirmado.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /CONAE/i })).toHaveAttribute(
      'href',
      'https://catalogos5.conae.gov.ar/catalogofocos/',
    )
  })

  it('exposes a keyboard-reachable map reading guide', async () => {
    render(
      <TerritorialSection
        loadEarthquakes={async () => earthquakeSnapshot()}
        loadHotspots={async () => hotspotSnapshot()}
        loadWeather={async () => weatherSnapshot()}
        now={availableNow}
      />,
    )

    await screen.findByText('2 sismos registrados · últimos 7 días')
    expect(screen.getByText('Cómo leer este mapa')).toBeInTheDocument()
    expect(screen.getByText('Tamaño = magnitud')).toBeInTheDocument()
  })
})
