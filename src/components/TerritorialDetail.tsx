import { explainEarthquake, explainHotspot } from '../lib/explainTerritorial'
import type { EarthquakeEvent, ThermalHotspotEvent } from '../types/territorial'

type TerritorialEvent = EarthquakeEvent | ThermalHotspotEvent

interface TerritorialDetailProps {
  event: TerritorialEvent | null
  source?: {
    name: string
    url: string
  }
  limitations?: string[]
}

const NUMBER_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

function displayTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)
}

function confidenceLabel(value: ThermalHotspotEvent['confidence']): string {
  if (value === 'high') return 'alta'
  if (value === 'nominal') return 'nominal'
  if (value === 'low') return 'baja'
  return 'no informada'
}

export function TerritorialDetail({ event, source, limitations = [] }: TerritorialDetailProps) {
  if (!event) {
    return (
      <aside className="territorial-detail territorial-detail--empty" aria-live="polite">
        <p className="territorial-detail__eyebrow">SEÑAL SELECCIONADA</p>
        <p>Seleccioná un punto del mapa para leer qué ocurrió y qué significa el dato disponible.</p>
      </aside>
    )
  }

  const explanation = event.kind === 'earthquake' ? explainEarthquake(event) : explainHotspot(event)

  return (
    <aside className="territorial-detail" aria-live="polite">
      <p className="territorial-detail__eyebrow">SEÑAL SELECCIONADA</p>
      <h3>{event.kind === 'earthquake' ? 'Sismo registrado' : 'Foco de calor detectado'}</h3>
      <p className="territorial-detail__explanation">{explanation}</p>
      <dl>
        <div>
          <dt>Fecha</dt>
          <dd>{displayTime(event.occurredAt)}</dd>
        </div>
        {event.kind === 'earthquake' ? (
          <>
            <div>
              <dt>Magnitud</dt>
              <dd>{NUMBER_FORMATTER.format(event.magnitude)}</dd>
            </div>
            <div>
              <dt>Profundidad</dt>
              <dd>{event.depthKm === null ? 'No informada' : `${NUMBER_FORMATTER.format(event.depthKm)} km`}</dd>
            </div>
            <div>
              <dt>Referencia</dt>
              <dd>{event.place ?? event.province ?? 'No informada'}</dd>
            </div>
            <div>
              <dt>Intensidad</dt>
              <dd>{event.intensityText ?? 'No informada'}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Confianza</dt>
              <dd>{confidenceLabel(event.confidence)}</dd>
            </div>
            <div>
              <dt>FRP</dt>
              <dd>{event.frpMw === null ? 'No informado' : `${NUMBER_FORMATTER.format(event.frpMw)} MW`}</dd>
            </div>
            <div>
              <dt>Sensor</dt>
              <dd>{event.sensor ?? 'No informado'}</dd>
            </div>
            <div>
              <dt>Satélite</dt>
              <dd>{event.satellite ?? 'No informado'}</dd>
            </div>
          </>
        )}
        {source ? (
          <div>
            <dt>Fuente</dt>
            <dd>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.name}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
      {limitations.length > 0 ? (
        <div className="territorial-detail__limitations">
          {limitations.map((limitation) => (
            <p key={limitation}>Limitación: {limitation}</p>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
