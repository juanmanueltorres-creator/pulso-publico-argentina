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
  now?: Date
}

const defaultEarthquakeLoader: EarthquakeLoader = () => loadTerritorialSnapshot('earthquake')
const defaultHotspotLoader: HotspotLoader = () => loadTerritorialSnapshot('thermal-hotspot')

function periodLabel(hours: number): string {
  if (hours % 24 === 0 && hours >= 48) {
    return `últimos ${hours / 24} días`
  }
  return `últimas ${hours} h`
}

function isSnapshotStale<TEvent extends EarthquakeEvent | ThermalHotspotEvent>(
  snapshot: TerritorialSnapshot<TEvent>,
  now: Date,
): boolean {
  const checkedAt = new Date(snapshot.sourceCheckedAt).getTime()
  if (Number.isNaN(checkedAt)) return true
  return now.getTime() - checkedAt >= snapshot.freshness.staleAfterMinutes * 60_000
}

function displaySourceCheck(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)
}

export function TerritorialSection({
  loadEarthquakes = defaultEarthquakeLoader,
  loadHotspots = defaultHotspotLoader,
  now,
}: TerritorialSectionProps) {
  const [mode, setMode] = useState<TerritorialKind>('earthquake')
  const [earthquakes, setEarthquakes] = useState<TerritorialSnapshot<EarthquakeEvent> | null>(null)
  const [hotspots, setHotspots] = useState<TerritorialSnapshot<ThermalHotspotEvent> | null>(null)
  const [earthquakeError, setEarthquakeError] = useState(false)
  const [hotspotError, setHotspotError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const currentTime = now ?? new Date()

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

  const highMagnitudeCount = earthquakes?.events.filter((event) => event.magnitude >= 4).length ?? 0
  const highConfidenceCount = hotspots?.events.filter((event) => event.confidence === 'high').length ?? 0
  const activeSnapshot = mode === 'earthquake' ? earthquakes : hotspots
  const activeSource = activeSnapshot?.source
  const activeLimitations = activeSnapshot?.limitations ?? []

  function changeMode(nextMode: TerritorialKind) {
    setMode(nextMode)
    setSelectedId(null)
  }

  function staleStatus(snapshot: TerritorialSnapshot<EarthquakeEvent> | TerritorialSnapshot<ThermalHotspotEvent>) {
    if (!isSnapshotStale(snapshot, currentTime)) return null
    return (
      <span className="territorial-summary__stale">
        Datos desactualizados · Última consulta {displaySourceCheck(snapshot.sourceCheckedAt)}
      </span>
    )
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
              <strong>Fuente temporalmente no disponible</strong>
              <span>No pudimos actualizar los sismos. La otra fuente territorial puede seguir disponible.</span>
            </>
          ) : earthquakes ? (
            <>
              <strong>{earthquakes.events.length} sismos registrados · {periodLabel(earthquakes.window.hours)}</strong>
              <span>{highMagnitudeCount} de magnitud 4 o superior</span>
              <span>{earthquakes.source.name}</span>
              {staleStatus(earthquakes)}
            </>
          ) : (
            <strong>Leyendo sismos…</strong>
          )
        ) : hotspotError ? (
          <>
            <strong>Fuente temporalmente no disponible</strong>
            <span>No pudimos actualizar los focos de calor. La otra fuente territorial puede seguir disponible.</span>
          </>
        ) : hotspots ? (
          <>
            <strong>{hotspots.events.length} focos de calor detectados · {periodLabel(hotspots.window.hours)}</strong>
            <span>{highConfidenceCount} con confianza alta</span>
            <span>{hotspots.source.name}</span>
            {staleStatus(hotspots)}
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
        <TerritorialDetail
          event={selectedEvent}
          source={activeSource}
          limitations={activeLimitations}
        />
      </div>
    </div>
  )
}
