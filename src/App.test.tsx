import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import type { SignalEnvelope, SignalSnapshot } from './types/signal'

function unavailableSignal(
  id: string,
  category: SignalEnvelope['category'],
  title: string,
  sourceName: string,
): SignalEnvelope {
  return {
    schemaVersion: '1.0',
    id,
    category,
    title,
    value: null,
    unit: 'dato',
    periodLabel: 'Fuente declarada',
    status: 'updated',
    availability: 'unavailable',
    observedAt: null,
    publishedAt: null,
    fetchedAt: '2026-08-28T00:00:00Z',
    source: { name: sourceName, url: 'https://example.com', kind: 'official' },
    method: { type: 'api', note: 'Integración pendiente.' },
    limitations: ['No se publica un valor sin verificar la fuente.'],
  }
}

const snapshot: SignalSnapshot = {
  schemaVersion: '1.0',
  generatedAt: '2026-08-28T00:00:00Z',
  signals: [
    unavailableSignal('energy', 'energy', 'Generación renovable', 'CAMMESA'),
    unavailableSignal('science', 'science', 'Producción científica indexada', 'OpenAlex'),
    unavailableSignal('patents', 'innovation', 'Actividad de patentes', 'INPI Argentina'),
    unavailableSignal('georef', 'public-infrastructure', 'Consultas históricas a GeoRef', 'Datos Argentina'),
  ],
}

describe('App', () => {
  it('shows a loading state before the snapshot resolves', () => {
    const loadSnapshot = () => new Promise<SignalSnapshot>(() => undefined)

    render(<App loadSnapshot={loadSnapshot} />)

    expect(screen.getByText(/leyendo señales públicas/i)).toBeInTheDocument()
  })

  it('renders the four signal families from the snapshot', async () => {
    render(<App loadSnapshot={async () => snapshot} />)

    expect(await screen.findByRole('heading', { name: 'Generación renovable' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Producción científica indexada' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Actividad de patentes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Consultas históricas a GeoRef' })).toBeInTheDocument()
  })

  it('shows a clear error state when the snapshot cannot be loaded', async () => {
    render(<App loadSnapshot={async () => Promise.reject(new Error('network'))} />)

    expect(await screen.findByText(/no pudimos leer el snapshot público/i)).toBeInTheDocument()
  })
})
