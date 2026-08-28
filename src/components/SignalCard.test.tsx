import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

const cammesaSignal = {
  ...signal,
  title: 'Energía renovable generada',
  value: 1791.245147,
  unit: 'GWh',
  periodLabel: 'Julio 2026 · último dato publicado',
  availability: 'available' as const,
  observedAt: '2026-07-01T00:00:00.000Z',
  method: {
    type: 'xlsx' as const,
    note: 'Total GWh oficial publicado por CAMMESA.',
  },
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

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

  it('shows a plain-language explanation next to the technical metric', () => {
    render(<SignalCard signal={cammesaSignal} />)

    expect(screen.getByText('En criollo')).toBeInTheDocument()
    expect(screen.getByText(/1,79 TWh/)).toBeInTheDocument()
    expect(screen.getByText(/7,2 millones de hogares/)).toBeInTheDocument()
    expect(screen.getByText(/estimación/i)).toBeInTheDocument()
  })

  it('counts from zero to the real value once on initial render when motion is allowed', () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )

    render(<SignalCard signal={cammesaSignal} />)

    const value = screen.getByTestId('signal-value')
    expect(value).toHaveTextContent('0')

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(value).toHaveTextContent('1.791,25')
  })

  it('skips the count-up when reduced motion is requested', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )

    render(<SignalCard signal={cammesaSignal} />)

    expect(screen.getByTestId('signal-value')).toHaveTextContent('1.791,25')
  })
})
