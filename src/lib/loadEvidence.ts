import type { EvidenceSnapshot } from '../types/evidence'
import { validateEvidenceSnapshot } from './validateEvidenceSnapshot'

function snapshotUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${normalizedBase}data/evidence.json`
}

export async function loadEvidence(
  fetcher: typeof fetch = fetch,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<EvidenceSnapshot> {
  const response = await fetcher(snapshotUrl(baseUrl), { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load public evidence snapshot: HTTP ${response.status}`)
  }

  return validateEvidenceSnapshot(await response.json())
}
