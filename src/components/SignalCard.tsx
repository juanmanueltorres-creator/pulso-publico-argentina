import { useId, useState } from 'react'
import type { SignalEnvelope } from '../types/signal'

const CATEGORY_ICON: Record<SignalEnvelope['category'], string> = {
  energy: '⚡',
  science: '🔬',
  innovation: '💡',
  'public-infrastructure': '🗺️',
}

const STATUS_LABEL: Record<SignalEnvelope['status'], string> = {
  live: 'EN VIVO',
  updated: 'ACTUALIZADO',
  estimated: 'ESTIMADO',
  historical: 'HISTÓRICO',
}

function displayDate(value: string | null): string {
  if (!value) return 'No informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: value.includes('T') ? 'short' : undefined,
    timeZone: 'UTC',
  }).format(date)
}

function displayValue(signal: SignalEnvelope): string {
  if (signal.value === null) return 'Sin dato'
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(signal.value)
}

interface SignalCardProps {
  signal: SignalEnvelope
}

export function SignalCard({ signal }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const detailId = useId()

  return (
    <article className="signal-card">
      <div className="signal-card__topline">
        <span className="signal-card__icon" aria-hidden="true">
          {CATEGORY_ICON[signal.category]}
        </span>
        <span className={`signal-badge signal-badge--${signal.status}`}>
          {STATUS_LABEL[signal.status]}
        </span>
      </div>

      <div className="signal-card__metric" aria-label={`${signal.title}: ${displayValue(signal)}`}>
        <strong>{displayValue(signal)}</strong>
        {signal.value !== null && <span>{signal.unit}</span>}
      </div>

      <h2>{signal.title}</h2>
      <p className="signal-card__period">{signal.periodLabel}</p>
      <p className="signal-card__source">{signal.source.name}</p>

      {signal.availability !== 'available' && (
        <p className={`availability availability--${signal.availability}`}>
          {signal.availability === 'stale' ? 'Último dato desactualizado' : 'Fuente declarada · integración pendiente'}
        </p>
      )}

      <button
        className="signal-card__toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((current) => !current)}
      >
        ¿Cómo lo sabemos?
        <span aria-hidden="true">{expanded ? ' −' : ' +'}</span>
      </button>

      {expanded && (
        <div className="signal-card__details" id={detailId}>
          <dl>
            <div>
              <dt>Fuente</dt>
              <dd>
                <a href={signal.source.url} target="_blank" rel="noreferrer">
                  {signal.source.name}
                </a>
              </dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{STATUS_LABEL[signal.status]}</dd>
            </div>
            <div>
              <dt>Observado</dt>
              <dd>{displayDate(signal.observedAt)}</dd>
            </div>
            <div>
              <dt>Consultado</dt>
              <dd>{displayDate(signal.fetchedAt)}</dd>
            </div>
            <div>
              <dt>Método</dt>
              <dd>{signal.method.note}</dd>
            </div>
          </dl>

          <div className="signal-card__limitations">
            <h3>Limitaciones</h3>
            {signal.limitations.length === 0 ? (
              <p>Sin limitaciones adicionales declaradas.</p>
            ) : (
              <ul>
                {signal.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
