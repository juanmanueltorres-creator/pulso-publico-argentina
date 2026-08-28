import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SignalCard } from './SignalCard'

const signal = {
  schemaVersion: '1.0' as const,
  id: 'cammesa-renewables',
  category: 'energy' as const,
  title: 'Generación renovable',
  value: null,
  unit: 'MW',
  periodLabel: 'Fuente pendiente de integración',
  status: 'updated' as const,
  availability: 'unavailable' as const,
  observedAt: null,
  publishedAt: null,
  fetchedAt: '2026-08-28T00:00:00Z',
  source: {
    name: 'CAMMESA',
    url: 'https://cammesaweb.cammesa.com/inicio-renovables/',
    kind: 'official' as const,
  },
  method: {
    type: 'csv' as const,
    note: 'No se publica un valor hasta verificar la fuente.',
  },
  limitations: ['No se publica un valor hasta verificar la fuente.'],
}

describe('SignalCard', () => {
  it('renders Sin dato instead of zero for unavailable signals', () => {
    render(<SignalCard signal={signal} />)

    expect(screen.getByText('Sin dato')).toBeInTheDocument()
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument()
  })

  it('reveals provenance and limitations', async () => {
    const user = userEvent.setup()
    render(<SignalCard signal={signal} />)

    await user.click(screen.getByRole('button', { name: /cómo lo sabemos/i }))

    expect(screen.getByRole('link', { name: 'CAMMESA' })).toHaveAttribute(
      'href',
      'https://cammesaweb.cammesa.com/inicio-renovables/',
    )
    expect(screen.getAllByText(/No se publica un valor hasta verificar la fuente/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Método/i)).toBeInTheDocument()
  })
})
