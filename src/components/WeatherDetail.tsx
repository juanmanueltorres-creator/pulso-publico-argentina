import type { WeatherPoint, WeatherSnapshot } from '../types/weather'

interface WeatherDetailProps {
  snapshot: WeatherSnapshot
  point: WeatherPoint
  frameIndex: number
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

function displayTime(value: string | undefined): string {
  if (!value) return 'No disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No disponible'
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)
}

function formatNumber(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No disponible'
  return `${NUMBER_FORMATTER.format(value)} ${unit}`
}

function windDirectionLabel(value: number): string {
  const normalized = ((value % 360) + 360) % 360
  const index = Math.round(normalized / 22.5) % WIND_DIRECTIONS.length
  return WIND_DIRECTIONS[index]
}

function formatWind(speed: number | null | undefined, direction: number | null | undefined): string {
  if (speed === null || speed === undefined || !Number.isFinite(speed)) return 'No disponible'
  if (direction === null || direction === undefined || !Number.isFinite(direction)) {
    return `${NUMBER_FORMATTER.format(speed)} km/h · dirección no disponible`
  }
  return `${windDirectionLabel(direction)} · ${NUMBER_FORMATTER.format(speed)} km/h`
}

export function WeatherDetail({ snapshot, point, frameIndex }: WeatherDetailProps) {
  const frameTimestamp = snapshot.timestamps[frameIndex]
  const temperatureC = point.values.temperatureC[frameIndex]
  const relativeHumidityPct = point.values.relativeHumidityPct[frameIndex]
  const windSpeedKmh = point.values.windSpeedKmh[frameIndex]
  const windDirectionDeg = point.values.windDirectionDeg[frameIndex]
  const windGustKmh = point.values.windGustKmh[frameIndex]
  const precipitationMm = point.values.precipitationMm[frameIndex]

  return (
    <aside className="weather-detail" aria-live="polite">
      <p className="weather-detail__eyebrow">CONTEXTO METEOROLÓGICO MODELADO</p>
      <h3>Punto meteorológico</h3>
      <p className="weather-detail__semantic-note">No es una estación de superficie.</p>

      <dl>
        <div>
          <dt>Hora del modelo</dt>
          <dd>{displayTime(frameTimestamp)}</dd>
        </div>
        <div>
          <dt>Temperatura</dt>
          <dd>{formatNumber(temperatureC, '°C')}</dd>
        </div>
        <div>
          <dt>Humedad</dt>
          <dd>{formatNumber(relativeHumidityPct, '%')}</dd>
        </div>
        <div>
          <dt>Viento</dt>
          <dd>{formatWind(windSpeedKmh, windDirectionDeg)}</dd>
        </div>
        <div>
          <dt>Ráfagas</dt>
          <dd>{formatNumber(windGustKmh, 'km/h')}</dd>
        </div>
        <div>
          <dt>Precipitación</dt>
          <dd>{formatNumber(precipitationMm, 'mm')}</dd>
        </div>
        <div>
          <dt>Coordenada consultada</dt>
          <dd>
            {NUMBER_FORMATTER.format(point.queryCoordinate.latitude)} ·{' '}
            {NUMBER_FORMATTER.format(point.queryCoordinate.longitude)}
          </dd>
        </div>
        <div>
          <dt>Modelo</dt>
          <dd>{snapshot.source.dataset}</dd>
        </div>
        <div>
          <dt>Fuente</dt>
          <dd>
            <a href={snapshot.source.url} target="_blank" rel="noreferrer">
              {snapshot.source.provider}
            </a>
          </dd>
        </div>
        <div>
          <dt>Datos hasta</dt>
          <dd>{displayTime(snapshot.dataThrough)}</dd>
        </div>
      </dl>
    </aside>
  )
}
