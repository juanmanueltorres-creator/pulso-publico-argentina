import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TerritorialEvidence } from '../types/evidence'
import { EvidenceCard } from './EvidenceCard'

function villaguayEvidence(value: number | null = 24): TerritorialEvidence {
  return {
    id: 'agroenso-maize-nino-villaguay',
    claim: {
      type: 'historical-association',
      title: 'Maíz + El Niño en Villaguay',
      statement: 'AgroENSO reporta una asociación histórica positiva en Villaguay.',
    },
    territory: {
      countryCode: 'AR',
      province: 'Entre Ríos',
      adminLevel: 'department',
      adminName: 'Villaguay',
      adminCode: '30113',
      geometryRef: '/data/evidence/territories/villaguay.geojson',
    },
    subject: {
      domain: 'agriculture',
      variable: 'Maíz',
      condition: 'El Niño',
    },
    result: {
      value,
      unit: '%',
      interpretation: 'Referencia externa aproximada publicada por AgroENSO.',
      statisticalSignificance: null,
    },
    temporalContext: {
      coverage: '1990/91–2025/26',
      observedAt: null,
      freshness: 'historical',
    },
    provenance: {
      resultKind: 'external-reference',
      analysisName: 'AgroENSO',
      authors: ['Juan Pablo Monzon', 'Fernando Aramburu-Merlos', 'Jorge Luis Mercau'],
      sourceUrl: 'https://www.argentina.gob.ar/agroenso-reference',
      inputs: [
        { role: 'Rendimientos agrícolas', sourceName: 'MAGyP', sourceUrl: 'https://datos.magyp.gob.ar/' },
        { role: 'Fase ENSO', sourceName: 'NOAA ONI', sourceUrl: 'https://www.cpc.ncep.noaa.gov/' },
        { role: 'Territorio', sourceName: 'IGN / GeoRef', sourceUrl: 'https://www.argentina.gob.ar/georef/' },
      ],
    },
    method: {
      summary: 'Pulso publica una referencia trazable; no recalcula el resultado.',
      processingSteps: ['Serie histórica', 'Clasificación ENSO', 'Join por código INDEC'],
    },
    limitations: [
      'Es una asociación histórica; no es un pronóstico de rendimiento.',
      'El resultado no fue calculado por Pulso.',
    ],
    missingContext: ['Agua útil actual', 'Tipo y condición del suelo', 'Estado actual del cultivo'],
  }
}

describe('EvidenceCard', () => {
  it('renders the Villaguay claim as an external historical association with clear evidence blocks', () => {
    render(<EvidenceCard evidence={villaguayEvidence()} />)

    expect(screen.getByText(/Maíz \+ El Niño en Villaguay/i)).toBeInTheDocument()
    expect(screen.getByText(/Villaguay · Entre Ríos/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Referencia externa/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/\+24%/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Asociación histórica/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/no es un pronóstico de rendimiento/i)).toBeInTheDocument()

    for (const heading of ['Qué sabemos', 'Qué significa', 'Qué falta', 'Cómo lo sabemos']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  it('explains the value, its national relevance, current update status and uncertainty in human language', () => {
    render(<EvidenceCard evidence={villaguayEvidence()} />)

    expect(screen.getByRole('heading', { name: /qué quiere decir \+24%/i })).toBeInTheDocument()
    expect(screen.getByText(/muchos años juntos/i)).toBeInTheDocument()
    expect(screen.getByText(/no quiere decir que la próxima cosecha vaya a rendir 24% más/i)).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: /por qué importa fuera de Villaguay/i })).toBeInTheDocument()
    expect(screen.getByText(/no sirve para toda Argentina/i)).toBeInTheDocument()
    expect(screen.getByText(/más fuerte, más débil o no aparecer/i)).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: /esto cambia solo/i })).toBeInTheDocument()
    expect(screen.getByText(/hoy no/i)).toBeInTheDocument()
    expect(screen.getByText(/no cambia automáticamente ni permite elegir otra zona todavía/i)).toBeInTheDocument()
    expect(screen.getByText(/qué tan sólida es estadísticamente la señal de Villaguay/i)).toBeInTheDocument()
  })

  it('keeps provenance, method, missing context and limitations visible and traceable', () => {
    render(<EvidenceCard evidence={villaguayEvidence()} />)

    const how = screen.getByTestId('evidence-how')
    expect(within(how).getByText(/AgroENSO/i)).toBeInTheDocument()
    expect(within(how).getByText(/Juan Pablo Monzon/i)).toBeInTheDocument()
    expect(within(how).getByText(/Fernando Aramburu-Merlos/i)).toBeInTheDocument()
    expect(within(how).getByText(/Jorge Luis Mercau/i)).toBeInTheDocument()
    expect(within(how).getByText(/MAGyP/i)).toBeInTheDocument()
    expect(within(how).getByText(/NOAA ONI/i)).toBeInTheDocument()
    expect(within(how).getByText(/IGN \/ GeoRef/i)).toBeInTheDocument()
    expect(within(how).getByText(/1990\/91–2025\/26/i)).toBeInTheDocument()
    expect(within(how).getByText(/no recalcula el resultado/i)).toBeInTheDocument()

    const missing = screen.getByTestId('evidence-missing')
    expect(within(missing).getByText(/Agua útil actual/i)).toBeInTheDocument()
    expect(within(missing).getByText(/Tipo y condición del suelo/i)).toBeInTheDocument()

    expect(screen.getByText(/El resultado no fue calculado por Pulso/i)).toBeInTheDocument()
  })

  it('provides compact top and bottom evidence rails for small screens without inventing app navigation', () => {
    render(<EvidenceCard evidence={villaguayEvidence()} />)

    const topRail = screen.getByTestId('evidence-top-rail')
    expect(within(topRail).getByText(/Referencia externa/i)).toBeInTheDocument()
    expect(within(topRail).getByText(/Maíz · El Niño/i)).toBeInTheDocument()

    const actions = screen.getByRole('navigation', { name: /accesos de evidencia/i })
    expect(within(actions).getByRole('link', { name: /Fuente/i })).toHaveAttribute(
      'href',
      'https://www.argentina.gob.ar/agroenso-reference',
    )
    expect(within(actions).getByRole('link', { name: /Método/i })).toHaveAttribute(
      'href',
      '#evidence-method-agroenso-maize-nino-villaguay',
    )
    expect(within(actions).getByRole('link', { name: /Territorio/i })).toHaveAttribute(
      'href',
      '/data/evidence/territories/villaguay.geojson',
    )
  })

  it('renders an unavailable result as Sin dato instead of zero', () => {
    render(<EvidenceCard evidence={villaguayEvidence(null)} />)

    expect(screen.getByTestId('evidence-value')).toHaveTextContent('Sin dato')
    expect(screen.queryByText(/^0%$/)).not.toBeInTheDocument()
  })

  it('does not introduce synthetic risk or score language', () => {
    const { container } = render(<EvidenceCard evidence={villaguayEvidence()} />)
    const text = container.textContent ?? ''

    expect(text).not.toMatch(/riesgo:\s*(alto|medio|bajo)/i)
    expect(text).not.toMatch(/score\s*[:=]/i)
    expect(text).not.toMatch(/resultado\s+calculado\s+por\s+Pulso/i)
  })
})
