import { useEffect, useState } from 'react'
import { loadEvidence } from '../lib/loadEvidence'
import type { EvidenceSnapshot } from '../types/evidence'
import { EvidenceCard } from './EvidenceCard'
import { SectionHeading } from './SectionHeading'

type EvidenceLoader = () => Promise<EvidenceSnapshot>

interface EvidenceSectionProps {
  loadSnapshot?: EvidenceLoader
}

export function EvidenceSection({ loadSnapshot = loadEvidence }: EvidenceSectionProps) {
  const [snapshot, setSnapshot] = useState<EvidenceSnapshot | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    loadSnapshot()
      .then((nextSnapshot) => {
        if (!active) return
        setSnapshot(nextSnapshot)
        setError(false)
      })
      .catch(() => {
        if (!active) return
        setError(true)
      })

    return () => {
      active = false
    }
  }, [loadSnapshot])

  return (
    <section className="product-section product-section--evidence" aria-label="Pulso Evidencia">
      <SectionHeading
        eyebrow="RELACIÓN + TERRITORIO + EVIDENCIA"
        title="Pulso Evidencia"
        description="Qué relaciones conocemos, dónde aplican y cómo fueron construidas."
      />

      {error ? (
        <section className="state-panel state-panel--evidence" role="alert">
          <p className="state-panel__title">No pudimos leer la evidencia territorial.</p>
          <p>La interfaz no reemplaza un fallo de evidencia por cero ni por una conclusión vacía.</p>
        </section>
      ) : snapshot === null ? (
        <section className="state-panel state-panel--evidence" aria-live="polite">
          <p className="state-panel__title">Leyendo evidencia territorial…</p>
        </section>
      ) : (
        <div className="evidence-list" aria-label="Evidencias territoriales">
          {snapshot.evidences.map((evidence) => (
            <EvidenceCard key={evidence.id} evidence={evidence} />
          ))}
        </div>
      )}
    </section>
  )
}
