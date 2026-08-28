import type { EvidenceSnapshot } from '../types/evidence'

export async function loadEvidence(
  _fetcher: typeof fetch = fetch,
  _baseUrl: string = import.meta.env.BASE_URL,
): Promise<EvidenceSnapshot> {
  throw new Error('Not implemented')
}
