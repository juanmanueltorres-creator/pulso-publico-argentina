import { useEffect, useMemo, useState } from 'react'
import { loadTerritorialSnapshot } from '../lib/loadTerritorialSnapshot'
import type {
  EarthquakeEvent,
  TerritorialKind,
  TerritorialSnapshot,
  ThermalHotspotEvent,
} from '../types/territorial'
import { TerritorialDetail } from './TerritorialDetail'
import { TerritorialLegend } from './TerritorialLegend'
import { TerritorialMap } from './TerritorialMap'

type EarthquakeLoader = () => Promise<TerritorialSnapshot<EarthquakeEvent>>
type HotspotLoader = () => Promise<TerritorialSnapshot<ThermalHotspotEvent>>

interface TerritorialSectionProps {
  loadEarthquakes?: EarthquakeLoader
  loadHotspots?: HotspotLoader
}

const defaultEarthquakeLoader: EarthquakeLoader = () => loadTerritorialSnapshot('earthquake')
const defaultHotspotLoader: HotspotLoader = () => loadTerritorialSnapshot('thermal-hotspot')

function periodLabel(hours: number): string {
  if (hours % 24 === 0 && hours >= 48) {
    return `últimos ${hours / 24} días`
  }
  return `últimas ${hours} h`
}

export function TerritorialSection({
  loadEarthquakes = defaultEarthquakeLoader,
  loadHotspots = defaultHotspotLoader,
}: TerritorialSectionProps) {
  const [mode, setMode] = useState<TerritorialKind>('earthquake')
  const [earthquakes, setEarthquakes] = useState<TerritorialSnapshot<EarthquakeEvent> | null>(null)
  const [hotspots, setHotspots] = useState<TerritorialSnapshot<ThermalHotspotEvent> | null>(null)
  const [earthquakeError, setEarthquakeError] = useState(false)
  const [hotspotError, setHotspotError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    loadEarthquakes()
      .then((snapshot) => {
        if (!active) return
        setEarthquakes(snapshot)
        setEarthquakeError(false)
      })
      .catch(() => {
        if (!active) return
        setEarthquakeError(true)
      })

    return () => {
      active = false
    }
  }, [loadEarthquakes])

  useEffect(() => {
    let active = true

    loadHotspots()
      .then((snapshot) => {
        if (!active) return
        setHotspots(snapshot)
        setHotspotError(false)
      })
      .catch(() => {
        if (!active) return
        setHotspotError(true)
      })

    return () => {
      active = false
    }
  }, [loadHotspots])

  const selectedEvent = useMemo(() => {
    if (!selectedId) return null
    if (mode === 'earthquake') {
      return earthquakes?.events.find((event) => event.id === selectedId) ?? null
    }
    return hotspots?.events.find((event) => event.id === selectedId) ?? null
  }, [earthquakes, hotspots, mode, selectedId])

  const highConfidenceCount = hotspots?.events.filter((event) => event.confidence === 'high').length ?? 0

  function changeMode(nextMode: TerritorialKind) {
    setMode(nextMode)
    setSelectedId(null)
  }

  return (
    <div className="territorial-experience">
      <div className="territorial-toolbar" aria-label="Selector de señales territoriales">
        <button
          type="button"
          className="territorial-mode"
          aria-pressed={mode === 'earthquake'}
          onClick={() => changeMode('earthquake')}
        >
          Sismos
        </button>
        <button
          type="button"
          className="territorial-mode"
          aria-pressed={mode === 'thermal-hotspot'}
          onClick={() => changeMode('thermal-hotspot')}
        >
          Focos de calor
        </button>
      </div>

      <div className="territorial-summary" aria-live="polite">
        {mode === 'earthquake' ? (
          earthquakeError ? (
            <>
              <strong>No pudimos actualizar los sismos.</strong>
              <span>La otra fuente territorial puede seguir disponible.</span>
            </>
          ) : earthquakes ? (
            <>
              <strong>{earthquakes.events.length} sismos registrados</strong>
              <span>{periodLabel(earthquakes.window.hours)} · {earthquakes.source.name}</span>
            </>
          ) : (
            <strong>Leyendo sismos…</strong>
          )
        ) : hotspotError ? (
          <>
            <strong>No pudimos actualizar los focos de calor.</strong>
            <span>La otra fuente territorial puede seguir disponible.</span>
          </>
        ) : hotspots ? (
          <>
            <strong>{hotspots.events.length} focos de calor detectados</strong>
            <span>{highConfidenceCount} con confianza alta · {periodLabel(hotspots.window.hours)} · {hotspots.source.name}</span>
            <span className="territorial-summary__caution">Una detección térmica no implica un incendio confirmado.</span>
          </>
        ) : (
          <strong>Leyendo focos de calor…</strong>
        )}
      </div>

      <TerritorialLegend mode={mode} />

      <div className="territorial-layout">
        <TerritorialMap
          mode={mode}
          earthquakes={earthquakes?.events ?? []}
          hotspots={hotspots?.events ?? []}
          selectedId={selectedId}
          onSelect={(event) => setSelectedId(event.id)}
        />
        <TerritorialDetail event={selectedEvent} />
      </div>
    </div>
  )
}
