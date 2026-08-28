import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { EvidenceSnapshot, TerritorialEvidence } from '../types/evidence'
import { EvidenceSection } from './EvidenceSection'

function villaguayEvidence(): TerritorialEvidence {
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
      value: 24,
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
      sourceUrl: 'https://example.com/agroenso',
      inputs: [
        { role: 'Rendimientos agrícolas', sourceName: 'MAGyP', sourceUrl: 'https://example.com/magyp' },
        { role: 'Fase ENSO', sourceName: 'NOAA ONI', sourceUrl: 'https://example.com/noaa' },
        { role: 'Territorio', sourceName: 'IGN / GeoRef', sourceUrl: 'https://example.com/georef' },
      ],
    },
    method: {
      summary: 'Pulso publica una referencia trazable; no recalcula el resultado.',
      processingSteps: ['Serie histórica', 'Clasificación ENSO', 'Join por código INDEC'],
    },
    limitations: ['Es una asociación histórica; no es un pronóstico de rendimiento.'],
    missingContext: ['Agua útil actual', 'Tipo y condición del suelo'],
  }
}

const snapshot: EvidenceSnapshot = {
  schemaVersion: '1.0',
  generatedAt: '2026-08-28T00:00:00Z',
  evidences: [villaguayEvidence()],
}

describe('EvidenceSection', () => {
  it('shows an evidence-specific loading state while its snapshot is pending', () => {
    const loadSnapshot = () => new Promise<EvidenceSnapshot>(() => undefined)

    render(<EvidenceSection loadSnapshot={loadSnapshot} />)

    expect(screen.getByRole('heading', { name: 'Pulso Evidencia' })).toBeInTheDocument()
    expect(screen.getByText(/leyendo evidencia territorial/i)).toBeInTheDocument()
  })

  it('renders the validated evidence without changing its external-reference semantics', async () => {
    render(<EvidenceSection loadSnapshot={async () => snapshot} />)

    expect(await screen.findByRole('heading', { name: 'Maíz + El Niño en Villaguay' })).toBeInTheDocument()
    expect(screen.getAllByText(/Referencia externa/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Qué relaciones conocemos, dónde aplican y cómo fueron construidas/i)).toBeInTheDocument()
  })

  it('fails closed inside the section when evidence cannot be loaded', async () => {
    render(<EvidenceSection loadSnapshot={async () => Promise.reject(new Error('network'))} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos leer la evidencia territorial/i)
    expect(screen.queryByRole('heading', { name: 'Maíz + El Niño en Villaguay' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^0%$/)).not.toBeInTheDocument()
  })
})
