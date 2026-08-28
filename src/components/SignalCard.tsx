import { useEffect, useId, useState } from 'react'
import { explainSignal } from '../lib/explainSignal'
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

const VALUE_FORMATTER = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

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

function displayValue(value: number | null): string {
  if (value === null) return 'Sin dato'
  return VALUE_FORMATTER.format(value)
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function useAnimatedValue(value: number | null): number | null {
  const [animatedValue, setAnimatedValue] = useState<number | null>(() => {
    if (value === null) return null
    return prefersReducedMotion() ? value : 0
  })

  useEffect(() => {
    if (value === null) {
      setAnimatedValue(null)
      return
    }

    if (prefersReducedMotion()) {
      setAnimatedValue(value)
      return
    }

    setAnimatedValue(0)
    const steps = 30
    const intervalMs = 30
    let step = 0

    const interval = window.setInterval(() => {
      step += 1
      const progress = Math.min(step / steps, 1)
      const easedProgress = 1 - (1 - progress) ** 3

      setAnimatedValue(value * easedProgress)

      if (step >= steps) {
        window.clearInterval(interval)
        setAnimatedValue(value)
      }
    }, intervalMs)

    return () => window.clearInterval(interval)
  }, [value])

  return animatedValue
}

interface SignalCardProps {
  signal: SignalEnvelope
}

export function SignalCard({ signal }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const detailId = useId()
  const animatedValue = useAnimatedValue(signal.value)
  const explanation = explainSignal(signal)

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

      <div className="signal-card__metric" aria-label={`${signal.title}: ${displayValue(signal.value)}`}>
        <strong data-testid="signal-value">{displayValue(animatedValue)}</strong>
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

      <div className="signal-card__plain-language">
        <p className="signal-card__plain-label">En criollo</p>
        <p className="signal-card__plain-summary">{explanation.summary}</p>
        {explanation.reference && (
          <p className="signal-card__plain-reference">
            {explanation.reference}
            {explanation.isEstimate && <span> · estimación orientativa</span>}
          </p>
        )}
      </div>

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
