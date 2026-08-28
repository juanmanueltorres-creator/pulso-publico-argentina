export interface EvidenceInput {
  role: string
  sourceName: string
  sourceUrl: string
}

export interface TerritorialEvidence {
  id: string

  claim: {
    type: 'historical-association'
    title: string
    statement: string
  }

  territory: {
    countryCode: 'AR'
    province: string
    adminLevel: 'department'
    adminName: string
    adminCode: string
    geometryRef: string
  }

  subject: {
    domain: 'agriculture'
    variable: string
    condition: string
  }

  result: {
    value: number | null
    unit: string
    interpretation: string
    statisticalSignificance: boolean | null
  }

  temporalContext: {
    coverage: string
    observedAt: null
    freshness: 'historical'
  }

  provenance: {
    resultKind: 'external-reference' | 'reproduced'
    analysisName: string
    authors: string[]
    sourceUrl: string
    inputs: EvidenceInput[]
  }

  method: {
    summary: string
    processingSteps: string[]
  }

  limitations: string[]
  missingContext: string[]
}

export interface EvidenceSnapshot {
  schemaVersion: '1.0'
  generatedAt: string
  evidences: TerritorialEvidence[]
}
