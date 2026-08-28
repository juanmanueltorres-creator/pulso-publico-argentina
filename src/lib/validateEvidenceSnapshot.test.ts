import { describe, expect, it } from 'vitest'
import { validateEvidenceSnapshot } from './validateEvidenceSnapshot'

function validSnapshot() {
  return {
    schemaVersion: '1.0',
    generatedAt: '2026-08-28T19:30:00.000Z',
    evidences: [
      {
        id: 'agroenso-maize-nino-villaguay',
        claim: {
          type: 'historical-association',
          title: 'Maíz + El Niño en Villaguay',
          statement: 'Asociación histórica positiva reportada para Villaguay.',
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
          interpretation: 'Referencia externa aproximada.',
          statisticalSignificance: null,
        },
        temporalContext: {
          coverage: '35 campañas históricas',
          observedAt: null,
          freshness: 'historical',
        },
        provenance: {
          resultKind: 'external-reference',
          analysisName: 'AgroENSO',
          authors: ['Juan Pablo Monzon'],
          sourceUrl: 'https://www.argentina.gob.ar/example',
          inputs: [
            {
              role: 'yield-data',
              sourceName: 'MAGyP',
              sourceUrl: 'https://datos.magyp.gob.ar/example',
            },
          ],
        },
        method: {
          summary: 'Análisis histórico reportado por la fuente.',
          processingSteps: ['Serie histórica', 'Comparación por fase ENSO'],
        },
        limitations: ['No es un pronóstico de rendimiento.'],
        missingContext: ['Agua útil actual'],
      },
    ],
  }
}

describe('validateEvidenceSnapshot', () => {
  it('accepts a valid evidence snapshot', () => {
    const input = validSnapshot()
    expect(validateEvidenceSnapshot(input)).toEqual(input)
  })

  it('rejects unsupported snapshot metadata and vocabularies', () => {
    const cases: Array<[string, (input: ReturnType<typeof validSnapshot>) => void]> = [
      ['schemaVersion', (input) => { input.schemaVersion = '2.0' }],
      ['generatedAt', (input) => { input.generatedAt = 'not-a-date' }],
      ['claim.type', (input) => { input.evidences[0].claim.type = 'forecast' }],
      ['countryCode', (input) => { input.evidences[0].territory.countryCode = 'UY' }],
      ['adminLevel', (input) => { input.evidences[0].territory.adminLevel = 'province' }],
      ['freshness', (input) => { input.evidences[0].temporalContext.freshness = 'live' }],
      ['resultKind', (input) => { input.evidences[0].provenance.resultKind = 'calculated-by-pulso' }],
    ]

    for (const [label, mutate] of cases) {
      const input = validSnapshot()
      mutate(input)
      expect(() => validateEvidenceSnapshot(input), label).toThrow()
    }
  })

  it('rejects empty or duplicate evidence identities', () => {
    const empty = validSnapshot()
    empty.evidences[0].id = '   '
    expect(() => validateEvidenceSnapshot(empty)).toThrow(/id/i)

    const duplicate = validSnapshot()
    duplicate.evidences.push(structuredClone(duplicate.evidences[0]))
    expect(() => validateEvidenceSnapshot(duplicate)).toThrow(/duplicate/i)
  })

  it('requires territorial identity and geometry reference', () => {
    for (const key of ['adminCode', 'geometryRef'] as const) {
      const input = validSnapshot()
      input.evidences[0].territory[key] = ''
      expect(() => validateEvidenceSnapshot(input)).toThrow(new RegExp(key, 'i'))
    }
  })

  it('requires finite result values and nullable boolean significance', () => {
    const nonFinite = validSnapshot()
    nonFinite.evidences[0].result.value = Number.POSITIVE_INFINITY
    expect(() => validateEvidenceSnapshot(nonFinite)).toThrow(/finite/i)

    const invalidSignificance = validSnapshot()
    invalidSignificance.evidences[0].result.statisticalSignificance = 'yes'
    expect(() => validateEvidenceSnapshot(invalidSignificance)).toThrow(/statisticalSignificance/i)
  })

  it('requires provenance URLs and valid input sources', () => {
    const missingSourceUrl = validSnapshot()
    missingSourceUrl.evidences[0].provenance.sourceUrl = ''
    expect(() => validateEvidenceSnapshot(missingSourceUrl)).toThrow(/sourceUrl/i)

    const badInput = validSnapshot()
    badInput.evidences[0].provenance.inputs[0].sourceUrl = ''
    expect(() => validateEvidenceSnapshot(badInput)).toThrow(/sourceUrl/i)
  })

  it('requires limitations and missingContext arrays', () => {
    const missingLimitations = validSnapshot() as Record<string, unknown>
    const evidence = (missingLimitations.evidences as Array<Record<string, unknown>>)[0]
    delete evidence.limitations
    expect(() => validateEvidenceSnapshot(missingLimitations)).toThrow(/limitations/i)

    const missingContext = validSnapshot() as Record<string, unknown>
    const secondEvidence = (missingContext.evidences as Array<Record<string, unknown>>)[0]
    delete secondEvidence.missingContext
    expect(() => validateEvidenceSnapshot(missingContext)).toThrow(/missingContext/i)
  })
})
