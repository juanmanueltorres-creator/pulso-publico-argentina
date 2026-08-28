import type { HotspotWeatherContext as HotspotWeatherContextValue } from '../lib/weatherContext'
import type { WeatherSnapshot } from '../types/weather'

interface HotspotWeatherContextProps {
  snapshot: WeatherSnapshot
  context: HotspotWeatherContextValue
}

const NUMBER_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
const WIND_DIRECTIONS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSO',
  'SO',
  'OSO',
  'O',
  'ONO',
  'NO',
  'NNO',
] as const

function formatNumber(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No disponible'
  return `${NUMBER_FORMATTER.format(value)} ${unit}`
}

function windDirectionLabel(value: number): string {
  const normalized = ((value % 360) + 360) % 360
  return WIND_DIRECTIONS[Math.round(normalized / 22.5) % WIND_DIRECTIONS.length]
}

function formatWind(speed: number | null | undefined, direction: number | null | undefined): string {
  if (speed === null || speed === undefined || !Number.isFinite(speed)) return 'No disponible'
  if (direction === null || direction === undefined || !Number.isFinite(direction)) {
    return `${NUMBER_FORMATTER.format(speed)} km/h · dirección no disponible`
  }
  return `${windDirectionLabel(direction)} · ${NUMBER_FORMATTER.format(speed)} km/h`
}

export function HotspotWeatherContext({ snapshot, context }: HotspotWeatherContextProps) {
  const point = context.primary.point
  const frameIndex = context.frameIndex

  return (
    <section className="hotspot-weather-context" aria-label="Contexto meteorológico del foco">
      <p className="hotspot-weather-context__eyebrow">CONTEXTO METEOROLÓGICO MODELADO</p>
      <h4>Condiciones cercanas en tiempo y espacio</h4>
      <p>
        Punto de malla más cercano utilizable: {NUMBER_FORMATTER.format(context.primary.distanceKm)} km ·{' '}
        diferencia temporal {NUMBER_FORMATTER.format(context.timeDifferenceMinutes)} min.
      </p>

      <dl>
        <div>
          <dt>Temperatura</dt>
          <dd>{formatNumber(point.values.temperatureC[frameIndex], '°C')}</dd>
        </div>
        <div>
          <dt>Humedad</dt>
          <dd>{formatNumber(point.values.relativeHumidityPct[frameIndex], '%')}</dd>
        </div>
        <div>
          <dt>Viento</dt>
          <dd>{formatWind(point.values.windSpeedKmh[frameIndex], point.values.windDirectionDeg[frameIndex])}</dd>
        </div>
      </dl>

      <p className="hotspot-weather-context__caveat">
        Estas condiciones acompañan la detección en tiempo y espacio, pero no prueban su causa ni confirman por sí solas un incendio.
      </p>
      <p className="hotspot-weather-context__source">
        Fuente meteorológica:{' '}
        <a href={snapshot.source.url} target="_blank" rel="noreferrer">
          {snapshot.source.provider}
        </a>{' '}
        · {snapshot.source.dataset}
      </p>
    </section>
  )
}
