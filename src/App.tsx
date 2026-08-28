import { useEffect, useState } from 'react'
import { SectionHeading } from './components/SectionHeading'
import { SignalCard } from './components/SignalCard'
import { TerritorialSection } from './components/TerritorialSection'
import { loadSignals } from './lib/loadSignals'
import type { SignalSnapshot } from './types/signal'

type SnapshotLoader = () => Promise<SignalSnapshot>

interface AppProps {
  loadSnapshot?: SnapshotLoader
}

export function App({ loadSnapshot = loadSignals }: AppProps) {
  const [snapshot, setSnapshot] = useState<SignalSnapshot | null>(null)
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
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">ARGENTINA · DATOS PÚBLICOS</p>
        <h1>Pulso Público</h1>
        <p className="hero__lead">Qué está pasando. Dónde. Y cómo lo sabemos.</p>
        <p className="hero__principle">Datos que se mueven. Fuentes que se pueden revisar.</p>
        <p className="hero__note">
          Cada cifra conserva su fuente, fecha, método y limitaciones. Si todavía no verificamos un valor,
          mostramos <strong>Sin dato</strong> en vez de inventar precisión.
        </p>
      </header>

      <section className="product-section product-section--national" aria-label="Pulso Nacional">
        <SectionHeading
          eyebrow="SEÑALES DEL PAÍS"
          title="Pulso Nacional"
          description="Indicadores públicos que ayudan a leer actividad, producción y uso de infraestructura sin perder la fuente detrás del número."
        />

        {error ? (
          <section className="state-panel" role="alert">
            <p className="state-panel__title">No pudimos leer el snapshot público.</p>
            <p>La interfaz no reemplaza un fallo de fuente por cero. Pulso Territorial puede seguir disponible.</p>
          </section>
        ) : snapshot === null ? (
          <section className="state-panel" aria-live="polite">
            <p className="state-panel__title">Leyendo señales públicas…</p>
          </section>
        ) : (
          <div className="signal-grid" aria-label="Indicadores públicos nacionales">
            {snapshot.signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </section>

      <section className="product-section product-section--territorial" aria-label="Pulso Territorial">
        <SectionHeading
          eyebrow="TIEMPO + COORDENADA"
          title="Pulso Territorial"
          description="La misma trazabilidad, ahora aplicada a señales que ocurren en un lugar concreto del territorio argentino."
        />

        <TerritorialSection />
      </section>

      {snapshot ? (
        <footer className="snapshot-footer">
          <span>Contrato público · v{snapshot.schemaVersion}</span>
          <span>Snapshot: {new Date(snapshot.generatedAt).toLocaleString('es-AR')}</span>
        </footer>
      ) : null}
    </main>
  )
}
