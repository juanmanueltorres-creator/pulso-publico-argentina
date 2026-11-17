import { useEffect, useMemo, useState } from 'react'
import type { EarthquakeDisplayMode } from '../lib/earthquakeDepth3D'
import { loadTerritorialSnapshot } from '../lib/loadTerritorialSnapshot'
import { loadWeatherSnapshot } from '../lib/loadWeatherSnapshot'
import { loadMarineSnapshot } from '../lib/loadMarineSnapshot'
import { loadAntarcticSnapshot } from '../lib/loadAntarcticSnapshot'
import type { AntarcticSnapshot, AntarcticVariable } from '../types/antarctic'
import { AntarcticDetail } from './AntarcticDetail'
import type { MarineSnapshot, MarineVariable } from '../types/marine'
import { MarineDetail } from './MarineDetail'
import { formatArgInstant } from '../lib/timeDisplay'
import { findWeatherContext } from '../lib/weatherContext'
import type {
  EarthquakeEvent,
  TerritorialSnapshot,
  ThermalHotspotEvent,
} from '../types/territorial'
import type {
  TerritorialViewMode,
  WeatherSnapshot,
  WeatherVariable,
} from '../types/weather'
import { HotspotWeatherContext } from './HotspotWeatherContext'
import { TerritorialDetail } from './TerritorialDetail'
import { TerritorialLegend } from './TerritorialLegend'
import { TerritorialMap } from './TerritorialMap'
import { WeatherDetail } from './WeatherDetail'

type EarthquakeLoader = () => Promise<TerritorialSnapshot<EarthquakeEvent>>
type HotspotLoader = () => Promise<TerritorialSnapshot<ThermalHotspotEvent>>
type WeatherLoader = () => Promise<WeatherSnapshot>
type MarineLoader = () => Promise<MarineSnapshot>
type AntarcticLoader = () => Promise<AntarcticSnapshot>

type SnapshotFreshness = {
  sourceCheckedAt: string
  freshness: {
    staleAfterMinutes: number
  }
}

interface TerritorialSectionProps {
  loadEarthquakes?: EarthquakeLoader
  loadHotspots?: HotspotLoader
  loadWeather?: WeatherLoader
  loadMarine?: MarineLoader
  loadAntarctic?: AntarcticLoader
  now?: Date
}

const defaultEarthquakeLoader: EarthquakeLoader = () => loadTerritorialSnapshot('earthquake')
const defaultHotspotLoader: HotspotLoader = () => loadTerritorialSnapshot('thermal-hotspot')
const defaultWeatherLoader: WeatherLoader = () => loadWeatherSnapshot()
const defaultMarineLoader: MarineLoader = () => loadMarineSnapshot()
const defaultAntarcticLoader: AntarcticLoader = () => loadAntarcticSnapshot()

function periodLabel(hours: number): string {
  if (hours % 24 === 0 && hours >= 48) {
    return `últimos ${hours / 24} días`
  }
  return `últimas ${hours} h`
}

function isSnapshotStale(snapshot: SnapshotFreshness, now: Date): boolean {
  const checkedAt = new Date(snapshot.sourceCheckedAt).getTime()
  if (Number.isNaN(checkedAt)) return true
  return now.getTime() - checkedAt >= snapshot.freshness.staleAfterMinutes * 60_000
}

export function TerritorialSection({
  loadEarthquakes = defaultEarthquakeLoader,
  loadHotspots = defaultHotspotLoader,
  loadWeather = defaultWeatherLoader,
  loadMarine = defaultMarineLoader,
  loadAntarctic = defaultAntarcticLoader,
  now,
}: TerritorialSectionProps) {
  const [mode, setMode] = useState<TerritorialViewMode>('earthquake')
  const [earthquakeDisplayMode, setEarthquakeDisplayMode] = useState<EarthquakeDisplayMode>('2d')
  const [weatherVariable, setWeatherVariable] = useState<WeatherVariable>('temperature')
  const [marineVariable, setMarineVariable] = useState<MarineVariable>('waves')
  const [antarcticVariable, setAntarcticVariable] = useState<AntarcticVariable>('temperature')
  const [earthquakes, setEarthquakes] = useState<TerritorialSnapshot<EarthquakeEvent> | null>(null)
  const [hotspots, setHotspots] = useState<TerritorialSnapshot<ThermalHotspotEvent> | null>(null)
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const [marine, setMarine] = useState<MarineSnapshot | null>(null)
  const [antarctic, setAntarctic] = useState<AntarcticSnapshot | null>(null)
  const [earthquakeError, setEarthquakeError] = useState(false)
  const [hotspotError, setHotspotError] = useState(false)
  const [weatherError, setWeatherError] = useState(false)
  const [marineError, setMarineError] = useState(false)
  const [antarcticError, setAntarcticError] = useState(false)
  const [selectedEarthquakeId, setSelectedEarthquakeId] = useState<string | null>(null)
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null)
  const [selectedWeatherPointId, setSelectedWeatherPointId] = useState<string | null>(null)
  const [selectedMarinePointId, setSelectedMarinePointId] = useState<string | null>(null)
  const [selectedAntarcticPointId, setSelectedAntarcticPointId] = useState<string | null>(null)
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

  useEffect(() => {
    let active = true

    loadWeather()
      .then((snapshot) => {
        if (!active) return
        setWeather(snapshot)
        setWeatherError(false)
      })
      .catch(() => {
        if (!active) return
        setWeatherError(true)
      })

    return () => {
      active = false
    }
  }, [loadWeather])

  useEffect(() => {
    let active = true
    loadMarine()
      .then((snapshot) => {
        if (!active) return
        setMarine(snapshot)
        setSelectedMarinePointId((previous) =>
          snapshot.points.some((point) => point.id === previous) ? previous : snapshot.points[0]?.id ?? null)
        setMarineError(false)
      })
      .catch(() => {
        if (!active) return
        setMarineError(true)
      })
    return () => { active = false }
  }, [loadMarine])

  useEffect(() => {
    let active = true
    loadAntarctic()
      .then((snapshot) => {
        if (!active) return
        setAntarctic(snapshot)
        setSelectedAntarcticPointId((previous) =>
          snapshot.points.some((point) => point.id === previous) ? previous : snapshot.points[0]?.id ?? null)
        setAntarcticError(false)
      })
      .catch(() => {
        if (!active) return
        setAntarcticError(true)
      })
    return () => { active = false }
  }, [loadAntarctic])

  const selectedEarthquake = useMemo(
    () => earthquakes?.events.find((event) => event.id === selectedEarthquakeId) ?? null,
    [earthquakes, selectedEarthquakeId],
  )
  const selectedHotspot = useMemo(
    () => hotspots?.events.find((event) => event.id === selectedHotspotId) ?? null,
    [hotspots, selectedHotspotId],
  )
  const selectedWeatherPoint = useMemo(
    () => weather?.points.find((point) => point.id === selectedWeatherPointId) ?? null,
    [weather, selectedWeatherPointId],
  )
  const selectedMarinePoint = useMemo(
    () => marine?.points.find((point) => point.id === selectedMarinePointId) ?? null,
    [marine, selectedMarinePointId],
  )
  const selectedAntarcticPoint = useMemo(
    () => antarctic?.points.find((point) => point.id === selectedAntarcticPointId) ?? null,
    [antarctic, selectedAntarcticPointId],
  )
  const hotspotContext = useMemo(
    () => (selectedHotspot && weather ? findWeatherContext(selectedHotspot, weather) : null),
    [selectedHotspot, weather],
  )

  const weatherFrameIndex = weather ? weather.timestamps.length - 1 : -1
  const highMagnitudeCount = earthquakes?.events.filter((event) => event.magnitude >= 4).length ?? 0
  const highConfidenceCount = hotspots?.events.filter((event) => event.confidence === 'high').length ?? 0

  function staleStatus(snapshot: SnapshotFreshness) {
    if (!isSnapshotStale(snapshot, currentTime)) return null
    return (
      <span className="territorial-summary__stale">
        Sin actualización reciente · Última actualización de Pulso {formatArgInstant(snapshot.sourceCheckedAt, 'fetch')}
      </span>
    )
  }

  const hotspotWeatherExtension = selectedHotspot ? (
    weatherError ? (
      <p className="hotspot-weather-context__unavailable">
        Contexto meteorológico temporalmente no disponible
      </p>
    ) : weather && hotspotContext ? (
      <HotspotWeatherContext snapshot={weather} context={hotspotContext} />
    ) : weather ? (
      <p className="hotspot-weather-context__unavailable">
        No hay contexto meteorológico utilizable para esta detección.
      </p>
    ) : (
      <p className="hotspot-weather-context__unavailable">Leyendo contexto meteorológico…</p>
    )
  ) : null

  return (
    <div className="territorial-experience">
      <div className="territorial-toolbar" aria-label="Selector de señales territoriales">
        <button
          type="button"
          className="territorial-mode"
          aria-pressed={mode === 'earthquake'}
          onClick={() => setMode('earthquake')}
        >
          Sismos
        </button>
        <button
          type="button"
          className="territorial-mode"
          aria-pressed={mode === 'thermal-hotspot'}
          onClick={() => setMode('thermal-hotspot')}
        >
          Focos de calor
        </button>
        <button
          type="button"
          className="territorial-mode"
          aria-pressed={mode === 'weather'}
          onClick={() => setMode('weather')}
        >
          Meteorología
        </button>
        <button
          type="button"
          className="territorial-mode"
          aria-pressed={mode === 'marine'}
          onClick={() => setMode('marine')}
        >
          Mar Argentino
        </button>
        <button
          type="button"
          className="territorial-mode"
          aria-pressed={mode === 'antarctic'}
          onClick={() => setMode('antarctic')}
        >
          Antártida
        </button>
      </div>

      {mode === 'earthquake' ? (
        <div className="territorial-weather-variables" aria-label="Representación sísmica">
          <button
            type="button"
            className="territorial-weather-variable"
            aria-pressed={earthquakeDisplayMode === '2d'}
            onClick={() => setEarthquakeDisplayMode('2d')}
          >
            Mapa 2D
          </button>
          <button
            type="button"
            className="territorial-weather-variable"
            aria-pressed={earthquakeDisplayMode === '3d'}
            onClick={() => setEarthquakeDisplayMode('3d')}
          >
            Profundidad 3D
          </button>
        </div>
      ) : mode === 'weather' ? (
        <div className="territorial-weather-variables" aria-label="Variable meteorológica">
          <button
            type="button"
            className="territorial-weather-variable"
            aria-pressed={weatherVariable === 'temperature'}
            onClick={() => setWeatherVariable('temperature')}
          >
            Temperatura
          </button>
          <button
            type="button"
            className="territorial-weather-variable"
            aria-pressed={weatherVariable === 'wind'}
            onClick={() => setWeatherVariable('wind')}
          >
            Viento
          </button>
          <button
            type="button"
            className="territorial-weather-variable"
            aria-pressed={weatherVariable === 'humidity'}
            onClick={() => setWeatherVariable('humidity')}
          >
            Humedad
          </button>
          <button
            type="button"
            className="territorial-weather-variable"
            aria-pressed={weatherVariable === 'clouds'}
            onClick={() => setWeatherVariable('clouds')}
          >
            Nubosidad
          </button>
        </div>
      ) : mode === 'marine' ? (
        <div className="territorial-weather-variables" aria-label="Variable oceánica">
          {([
            ['waves', 'Oleaje'],
            ['currents', 'Corrientes'],
            ['temperature', 'Temperatura del mar'],
          ] as const).map(([variable, label]) => (
            <button
              key={variable}
              type="button"
              className="territorial-weather-variable"
              aria-pressed={marineVariable === variable}
              onClick={() => setMarineVariable(variable)}
            >
              {label}
            </button>
          ))}
          <label className="territorial-location-picker">
            <span>Punto de consulta</span>
            <select
              aria-label="Punto marino de referencia"
              value={selectedMarinePointId ?? ''}
              onChange={(event) => setSelectedMarinePointId(event.target.value || null)}
              disabled={!marine?.points.length}
            >
              <option value="">Elegí un punto</option>
              {marine?.points.map((point) => (
                <option key={point.id} value={point.id}>{point.name}</option>
              ))}
            </select>
          </label>
        </div>
      ) : mode === 'antarctic' ? (
        <div className="territorial-weather-variables" aria-label="Variable antártica">
          {([
            ['temperature', 'Temperatura'],
            ['wind', 'Viento'],
            ['clouds', 'Nubosidad'],
          ] as const).map(([variable, label]) => (
            <button
              key={variable}
              type="button"
              className="territorial-weather-variable"
              aria-pressed={antarcticVariable === variable}
              onClick={() => setAntarcticVariable(variable)}
            >
              {label}
            </button>
          ))}
          <label className="territorial-location-picker">
            <span>Base de referencia</span>
            <select
              aria-label="Base antártica de referencia"
              value={selectedAntarcticPointId ?? ''}
              onChange={(event) => setSelectedAntarcticPointId(event.target.value || null)}
              disabled={!antarctic?.points.length}
            >
              <option value="">Elegí una base</option>
              {antarctic?.points.map((point) => (
                <option key={point.id} value={point.id}>{point.name}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="territorial-summary" aria-live="polite">
        {mode === 'earthquake' ? (
          earthquakeError ? (
            <>
              <strong>Fuente temporalmente no disponible</strong>
              <span>No pudimos actualizar los sismos. Las otras fuentes territoriales pueden seguir disponibles.</span>
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
        ) : mode === 'thermal-hotspot' ? (
          hotspotError ? (
            <>
              <strong>Fuente temporalmente no disponible</strong>
              <span>No pudimos actualizar los focos de calor. Las otras fuentes territoriales pueden seguir disponibles.</span>
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
          )
        ) : mode === 'antarctic' ? (
          antarcticError ? (
            <>
              <strong>Contexto antártico temporalmente no disponible</strong>
              <span>Los otros mapas siguen siendo fuentes independientes.</span>
            </>
          ) : antarctic ? (
            <>
              <strong>{antarctic.points.length} bases antárticas argentinas</strong>
              <span>{antarctic.source.dataset}</span>
              {antarctic.sourceCheckedAt ? (
                <span>Consulta del modelo: {formatArgInstant(antarctic.sourceCheckedAt, 'fetch')}</span>
              ) : (
                <span>Esperando la primera consulta meteorológica para estas bases.</span>
              )}
              <span><a href={antarctic.locationSource.url} target="_blank" rel="noreferrer">Ubicaciones: IGN</a></span>
              <span className="territorial-summary__caution">
                Pronóstico global, no medición en las bases. Mercator distorsiona las regiones polares.
              </span>
            </>
          ) : (
            <strong>Leyendo contexto antártico…</strong>
          )
        ) : mode === 'marine' ? (
          marineError ? (
            <>
              <strong>Contexto marino temporalmente no disponible</strong>
              <span>La meteorología continental y las demás señales siguen disponibles.</span>
            </>
          ) : marine ? (
            <>
              <strong>{marine.points.length} puntos marinos de referencia</strong>
              <span>{marine.source.dataset}</span>
              {marine.sourceCheckedAt ? (
                <span>Consulta del modelo: {formatArgInstant(marine.sourceCheckedAt, 'fetch')}</span>
              ) : (
                <span>Esperando la primera actualización de datos marinos. Los puntos no son estaciones.</span>
              )}
              <span><a href={marine.source.url} target="_blank" rel="noreferrer">Fuente: Open-Meteo Marine API</a></span>
              <span className="territorial-summary__caution">
                Pronóstico modelado · precisión costera limitada · no apto para navegación.
              </span>
            </>
          ) : (
            <strong>Leyendo contexto marino…</strong>
          )
        ) : weatherError ? (
          <>
            <strong>Contexto meteorológico temporalmente no disponible</strong>
            <span>Los sismos y focos de calor siguen siendo fuentes independientes.</span>
          </>
        ) : weather ? (
          <>
            <strong>{weather.grid.pointCount} puntos modelados · últimas 24 h</strong>
            <span>{weather.source.dataset}</span>
            <span>Hora representada {formatArgInstant(weather.dataThrough, 'model-frame')}</span>
            {weatherVariable === 'clouds' && !weather.points.some((point) => point.values.cloudCoverPct?.some((value) => value !== null && Number.isFinite(value))) ? (
              <span>El snapshot publicado todavía no incluye cobertura nubosa; se habilitará con la próxima actualización de datos.</span>
            ) : null}
            <span>
              <a href={weather.source.url} target="_blank" rel="noreferrer">
                {weather.source.provider}
              </a>
            </span>
            {staleStatus(weather)}
            <span className="territorial-summary__caution">
              Este modelo meteorológico ofrece contexto horario; no es una estación de superficie.
            </span>
          </>
        ) : (
          <strong>Leyendo contexto meteorológico…</strong>
        )}
      </div>

      <TerritorialLegend
        mode={mode}
        weatherVariable={weatherVariable}
        marineVariable={marineVariable}
        antarcticVariable={antarcticVariable}
        earthquakeDisplayMode={earthquakeDisplayMode}
      />

      <div className="territorial-layout">
        <TerritorialMap
          mode={mode}
          earthquakeDisplayMode={earthquakeDisplayMode}
          weatherVariable={weatherVariable}
          earthquakes={earthquakes?.events ?? []}
          hotspots={hotspots?.events ?? []}
          weather={weather}
          marine={marine}
          marineVariable={marineVariable}
          selectedMarinePointId={selectedMarinePointId}
          onSelectMarine={setSelectedMarinePointId}
          antarctic={antarctic}
          antarcticVariable={antarcticVariable}
          selectedAntarcticPointId={selectedAntarcticPointId}
          onSelectAntarctic={setSelectedAntarcticPointId}
          weatherFrameIndex={weatherFrameIndex}
          hotspotContext={hotspotContext}
          selectedHotspot={selectedHotspot}
          selectedWeatherPointId={selectedWeatherPointId}
          onSelect={(event) => {
            if (event.kind === 'earthquake') {
              setSelectedEarthquakeId(event.id)
            } else {
              setSelectedHotspotId(event.id)
            }
          }}
          onSelectWeather={setSelectedWeatherPointId}
        />

        {mode === 'earthquake' ? (
          <TerritorialDetail
            event={selectedEarthquake}
            source={earthquakes?.source}
            limitations={earthquakes?.limitations ?? []}
          />
        ) : mode === 'thermal-hotspot' ? (
          <TerritorialDetail
            event={selectedHotspot}
            source={hotspots?.source}
            limitations={hotspots?.limitations ?? []}
            afterDetails={hotspotWeatherExtension}
          />
        ) : mode === 'antarctic' ? (
          antarctic && selectedAntarcticPoint ? (
            <AntarcticDetail snapshot={antarctic} point={selectedAntarcticPoint} />
          ) : (
            <aside className="territorial-detail territorial-detail--empty" aria-live="polite">
              <p className="territorial-detail__eyebrow">ANTÁRTIDA</p>
              <p>Seleccioná una base para ver temperatura, viento y nubosidad del modelo. No son datos de las estaciones.</p>
            </aside>
          )
        ) : mode === 'marine' ? (
          marine && selectedMarinePoint ? (
            <MarineDetail snapshot={marine} point={selectedMarinePoint} />
          ) : (
            <aside className="territorial-detail territorial-detail--empty" aria-live="polite">
              <p className="territorial-detail__eyebrow">MAR ARGENTINO</p>
              <p>Seleccioná un punto en el mar para consultar oleaje, corrientes y temperatura superficial modelados.</p>
            </aside>
          )
        ) : weatherError ? (
          <aside className="territorial-detail territorial-detail--empty" aria-live="polite">
            <p className="territorial-detail__eyebrow">METEOROLOGÍA</p>
            <p>La fuente modelada no está disponible para inspeccionar puntos en este momento.</p>
          </aside>
        ) : weather && selectedWeatherPoint ? (
          <WeatherDetail snapshot={weather} point={selectedWeatherPoint} frameIndex={weatherFrameIndex} />
        ) : (
          <aside className="territorial-detail territorial-detail--empty" aria-live="polite">
            <p className="territorial-detail__eyebrow">METEOROLOGÍA</p>
            <p>Seleccioná un punto meteorológico del mapa para leer las condiciones modeladas.</p>
          </aside>
        )}
      </div>
    </div>
  )
}
