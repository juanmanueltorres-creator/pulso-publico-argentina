import type { EvidenceInput, EvidenceSnapshot, TerritorialEvidence } from '../types/evidence'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} must be a non-empty string`)
  }
  return value
}

function requireEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = record[key]
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${key} has an unsupported value`)
  }
  return value as T
}

function requireStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${key} must be an array of strings`)
  }
  return [...value]
}

function requireRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key]
  if (!isRecord(value)) throw new Error(`${key} must be an object`)
  return value
}

function validateInput(input: unknown): EvidenceInput {
  if (!isRecord(input)) throw new Error('provenance input must be an object')
  return {
    role: requireString(input, 'role'),
    sourceName: requireString(input, 'sourceName'),
    sourceUrl: requireString(input, 'sourceUrl'),
  }
}

function validateEvidence(input: unknown): TerritorialEvidence {
  if (!isRecord(input)) throw new Error('evidence must be an object')

  const claim = requireRecord(input, 'claim')
  const territory = requireRecord(input, 'territory')
  const subject = requireRecord(input, 'subject')
  const result = requireRecord(input, 'result')
  const temporalContext = requireRecord(input, 'temporalContext')
  const provenance = requireRecord(input, 'provenance')
  const method = requireRecord(input, 'method')

  const rawValue = result.value
  if (rawValue !== null && (typeof rawValue !== 'number' || !Number.isFinite(rawValue))) {
    throw new Error('result.value must be a finite number or null')
  }

  const statisticalSignificance = result.statisticalSignificance
  if (statisticalSignificance !== null && typeof statisticalSignificance !== 'boolean') {
    throw new Error('statisticalSignificance must be a boolean or null')
  }

  if (temporalContext.observedAt !== null) {
    throw new Error('observedAt must be null for historical evidence')
  }

  if (!Array.isArray(provenance.inputs)) {
    throw new Error('inputs must be an array')
  }

  return {
    id: requireString(input, 'id'),
    claim: {
      type: requireEnum(claim, 'type', ['historical-association'] as const),
      title: requireString(claim, 'title'),
      statement: requireString(claim, 'statement'),
    },
    territory: {
      countryCode: requireEnum(territory, 'countryCode', ['AR'] as const),
      province: requireString(territory, 'province'),
      adminLevel: requireEnum(territory, 'adminLevel', ['department'] as const),
      adminName: requireString(territory, 'adminName'),
      adminCode: requireString(territory, 'adminCode'),
      geometryRef: requireString(territory, 'geometryRef'),
    },
    subject: {
      domain: requireEnum(subject, 'domain', ['agriculture'] as const),
      variable: requireString(subject, 'variable'),
      condition: requireString(subject, 'condition'),
    },
    result: {
      value: rawValue,
      unit: requireString(result, 'unit'),
      interpretation: requireString(result, 'interpretation'),
      statisticalSignificance,
    },
    temporalContext: {
      coverage: requireString(temporalContext, 'coverage'),
      observedAt: null,
      freshness: requireEnum(temporalContext, 'freshness', ['historical'] as const),
    },
    provenance: {
      resultKind: requireEnum(provenance, 'resultKind', ['external-reference', 'reproduced'] as const),
      analysisName: requireString(provenance, 'analysisName'),
      authors: requireStringArray(provenance, 'authors'),
      sourceUrl: requireString(provenance, 'sourceUrl'),
      inputs: provenance.inputs.map(validateInput),
    },
    method: {
      summary: requireString(method, 'summary'),
      processingSteps: requireStringArray(method, 'processingSteps'),
    },
    limitations: requireStringArray(input, 'limitations'),
    missingContext: requireStringArray(input, 'missingContext'),
  }
}

export function validateEvidenceSnapshot(input: unknown): EvidenceSnapshot {
  if (!isRecord(input)) throw new Error('snapshot must be an object')
  if (input.schemaVersion !== '1.0') throw new Error('snapshot schemaVersion must be 1.0')

  const generatedAt = requireString(input, 'generatedAt')
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('generatedAt must be a valid date')
  }

  if (!Array.isArray(input.evidences)) throw new Error('evidences must be an array')

  const evidences = input.evidences.map(validateEvidence)
  const seen = new Set<string>()
  for (const evidence of evidences) {
    if (seen.has(evidence.id)) throw new Error(`duplicate evidence id: ${evidence.id}`)
    seen.add(evidence.id)
  }

  return {
    schemaVersion: '1.0',
    generatedAt,
    evidences,
  }
}
