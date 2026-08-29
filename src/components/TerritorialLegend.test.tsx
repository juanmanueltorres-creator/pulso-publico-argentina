import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TerritorialLegend } from './TerritorialLegend'

describe('TerritorialLegend earthquake mode', () => {
  it('explains magnitude as size and reported depth as color with an explicit scale', () => {
    render(<TerritorialLegend mode="earthquake" />)

    expect(screen.getByText(/tamaño = magnitud/i)).toBeInTheDocument()
    expect(screen.getByText(/color = profundidad reportada/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /escala visual de profundidad reportada/i })).toBeInTheDocument()
    expect(screen.getByText(/somero/i)).toBeInTheDocument()
    expect(screen.getByText(/profundo/i)).toBeInTheDocument()
    expect(screen.getByText('0 km')).toBeInTheDocument()
    expect(screen.getByText('70 km')).toBeInTheDocument()
    expect(screen.getByText('150 km')).toBeInTheDocument()
    expect(screen.getByText('300 km')).toBeInTheDocument()
    expect(screen.getByText('500+ km')).toBeInTheDocument()
    expect(screen.getByText(/sin profundidad reportada/i)).toBeInTheDocument()
    expect(screen.getByText(/no representa daño previsto/i)).toBeInTheDocument()
  })
})

describe('TerritorialLegend weather mode', () => {
  it('explains temperature colors with an explicit visual scale', () => {
    render(<TerritorialLegend mode="weather" weatherVariable="temperature" />)

    expect(screen.getByText(/modelo meteorológico/i)).toBeInTheDocument()
    expect(screen.getByText(/no estación de superficie/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /escala visual de temperatura/i })).toBeInTheDocument()
    expect(screen.getByText(/más frío/i)).toBeInTheDocument()
    expect(screen.getByText(/más cálido/i)).toBeInTheDocument()
    expect(screen.getByText('0 °C')).toBeInTheDocument()
    expect(screen.getByText('20 °C')).toBeInTheDocument()
    expect(screen.getByText('40 °C')).toBeInTheDocument()
    expect(screen.queryByText(/peligro|riesgo/i)).not.toBeInTheDocument()
  })

  it('explains humidity colors with a distinct dry-to-humid scale', () => {
    render(<TerritorialLegend mode="weather" weatherVariable="humidity" />)

    expect(screen.getByRole('img', { name: /escala visual de humedad/i })).toBeInTheDocument()
    expect(screen.getByText(/más seco/i)).toBeInTheDocument()
    expect(screen.getByText(/más húmedo/i)).toBeInTheDocument()
    expect(screen.getByText('0 %')).toBeInTheDocument()
    expect(screen.getByText('50 %')).toBeInTheDocument()
    expect(screen.getByText('100 %')).toBeInTheDocument()
    expect(screen.queryByText(/peligro|riesgo/i)).not.toBeInTheDocument()
  })

  it('explains wind arrow head, tail, speed colors and constant length without risk language', () => {
    render(<TerritorialLegend mode="weather" weatherVariable="wind" />)

    expect(screen.getByText(/dirección textual.*de dónde sopla/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /ejemplo de flecha de viento/i })).toBeInTheDocument()
    expect(screen.getByText(/cola.*de dónde viene/i)).toBeInTheDocument()
    expect(screen.getByText(/punta.*hacia dónde se mueve/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /escala visual de velocidad del viento/i })).toBeInTheDocument()
    expect(screen.getByText('0 km/h')).toBeInTheDocument()
    expect(screen.getByText('30 km/h')).toBeInTheDocument()
    expect(screen.getByText('60 km/h')).toBeInTheDocument()
    expect(screen.getByText(/longitud visual.*constante.*no representa velocidad/i)).toBeInTheDocument()
    expect(screen.getByText(/color.*velocidad/i)).toBeInTheDocument()
    expect(screen.queryByText(/peligro|riesgo/i)).not.toBeInTheDocument()
  })
})
