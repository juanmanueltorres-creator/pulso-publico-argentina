import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TerritorialLegend } from './TerritorialLegend'

describe('TerritorialLegend weather mode', () => {
  it('explains modeled wind semantics without risk language', () => {
    render(<TerritorialLegend mode="weather" weatherVariable="wind" />)

    expect(screen.getByText(/modelo meteorológico/i)).toBeInTheDocument()
    expect(screen.getByText(/no estación de superficie/i)).toBeInTheDocument()
    expect(screen.getByText(/dirección desde la que sopla el viento/i)).toBeInTheDocument()
    expect(screen.getByText(/longitud visual.*no representa velocidad/i)).toBeInTheDocument()
    expect(screen.queryByText(/riesgo/i)).not.toBeInTheDocument()
  })

  it('keeps temperature and humidity as modeled variables without danger thresholds', () => {
    const { rerender } = render(<TerritorialLegend mode="weather" weatherVariable="temperature" />)
    expect(screen.getByText(/temperatura modelada/i)).toBeInTheDocument()
    expect(screen.queryByText(/peligro|riesgo/i)).not.toBeInTheDocument()

    rerender(<TerritorialLegend mode="weather" weatherVariable="humidity" />)
    expect(screen.getByText(/humedad relativa modelada/i)).toBeInTheDocument()
    expect(screen.queryByText(/peligro|riesgo/i)).not.toBeInTheDocument()
  })
})
