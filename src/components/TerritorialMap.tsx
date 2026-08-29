import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type DataDrivenPropertyValueSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { EarthquakeDepth3DLayer } from '../lib/EarthquakeDepth3DLayer'
import type { EarthquakeDisplayMode } from '../lib/earthquakeDepth3D'
import { earthquakeDepthColorExpression } from '../lib/earthquakeDepthScale'
import { eventsToFeatureCollection } from '../lib/territorialMapData'
import type { HotspotWeatherContext } from '../lib/weatherContext'
import {
  selectedHotspotToFeatureCollection,
  weatherFrameToFeatureCollection,
  weatherLinkToFeatureCollection,
  weatherNeighborsToFeatureCollection,
  weatherWindVectorsToFeatureCollection,
} from '../lib/weatherMapData'
import type {
  EarthquakeEvent,
  ThermalHotspotEvent,
} from '../types/territorial'
import type {
  TerritorialViewMode,
  WeatherSnapshot,
  WeatherVariable,
} from '../types/weather'

setWorkerUrl(mapLibreWorkerUrl)

const ARGENTINA_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [-73.7, -55.3],
  [-53.5, -21.7],
]

const EARTHQUAKE_RADIUS_EXPRESSION = [
  'interpolate',
  ['exponential', 1.55],
  ['get', 'magnitude'],
  1,
  3,
  2,
  4,
  3,
  6,
  4,
  10,
  5,
  16,
  6,
  24,
  7,
  34,
  8,
  46,
] as unknown as DataDrivenPropertyValueSpecification<number>

const HOTSPOT_LAYERS = [
  'hotspot-cluster-halo',
  'hotspot-clusters',
  'hotspot-cluster-count',
  'hotspot-point-halo',
  'hotspot-points',
] as const

const WEATHER_CONTEXT_LAYERS = [
  'weather-neighbor-points',
  'weather-primary-point',
  'weather-context-link',
] as const

interface TerritorialMapProps {
  mode: TerritorialViewMode
  earthquakeDisplayMode?: EarthquakeDisplayMode
  weatherVariable?: WeatherVariable
  earthquakes: EarthquakeEvent[]
  hotspots: ThermalHotspotEvent[]
  weather?: WeatherSnapshot | null
  weatherFrameIndex?: number
  hotspotContext?: HotspotWeatherContext | null
  selectedHotspot?: ThermalHotspotEvent | null
  selectedWeatherPointId?: string | null
  /** Temporary compatibility bridge until TerritorialSection is migrated in Task 10. */
  selectedId?: string | null
  onSelect: (event: EarthquakeEvent | ThermalHotspotEvent) => void
  onSelectWeather?: (pointId: string) => void
}

type EarthquakeDepthLayerState = {
  layer: EarthquakeDepth3DLayer | null
  added: boolean
  active: boolean
}

const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
} as const

const noopSelectWeather = () => undefined

function sourceData(value: object): Parameters<GeoJSONSource['setData']>[0] {
  return value as Parameters<GeoJSONSource['setData']>[0]
}

function eventData(events: EarthquakeEvent[] | ThermalHotspotEvent[]): Parameters<GeoJSONSource['setData']>[0] {
  return sourceData(eventsToFeatureCollection(events))
}

function syncSources(
  map: MapLibreMap,
  earthquakes: EarthquakeEvent[],
  hotspots: ThermalHotspotEvent[],
  weather: WeatherSnapshot | null,
  weatherFrameIndex: number,
  weatherVariable: WeatherVariable,
  hotspotContext: HotspotWeatherContext | null,
  selectedHotspot: ThermalHotspotEvent | null,
) {
  const earthquakeSource = map.getSource('earthquakes') as GeoJSONSource | undefined
  const hotspotSource = map.getSource('hotspots') as GeoJSONSource | undefined
  const weatherGridSource = map.getSource('weather-grid') as GeoJSONSource | undefined
  const weatherWindSource = map.getSource('weather-wind-vectors') as GeoJSONSource | undefined
  const weatherNeighborsSource = map.getSource('weather-neighbors') as GeoJSONSource | undefined
  const weatherLinkSource = map.getSource('weather-link') as GeoJSONSource | undefined
  const selectedHotspotSource = map.getSource('selected-hotspot-reference') as GeoJSONSource | undefined

  earthquakeSource?.setData(eventData(earthquakes))
  hotspotSource?.setData(eventData(hotspots))

  const hasUsableFrame =
    weather !== null &&
    weatherFrameIndex >= 0 &&
    weatherFrameIndex < weather.timestamps.length

  weatherGridSource?.setData(
    sourceData(
      hasUsableFrame
        ? weatherFrameToFeatureCollection(weather, weatherFrameIndex, weatherVariable)
        : EMPTY_FEATURE_COLLECTION,
    ),
  )
  weatherWindSource?.setData(
    sourceData(
      hasUsableFrame
        ? weatherWindVectorsToFeatureCollection(weather, weatherFrameIndex)
        : EMPTY_FEATURE_COLLECTION,
    ),
  )
  weatherNeighborsSource?.setData(
    sourceData(
      hotspotContext
        ? weatherNeighborsToFeatureCollection(hotspotContext, hotspotContext.frameIndex)
        : EMPTY_FEATURE_COLLECTION,
    ),
  )
  weatherLinkSource?.setData(
    sourceData(
      hotspotContext && selectedHotspot
        ? weatherLinkToFeatureCollection(selectedHotspot, hotspotContext)
        : EMPTY_FEATURE_COLLECTION,
    ),
  )
  selectedHotspotSource?.setData(sourceData(selectedHotspotToFeatureCollection(selectedHotspot)))
}

function syncVisibility(
  map: MapLibreMap,
  mode: TerritorialViewMode,
  weatherVariable: WeatherVariable,
  hasHotspotContext: boolean,
  hasSelectedHotspot: boolean,
) {
  const earthquakesVisible = mode === 'earthquake' ? 'visible' : 'none'
  const hotspotsVisible = mode === 'thermal-hotspot' ? 'visible' : 'none'
  const weatherMode = mode === 'weather'
  const contextVisible = hasHotspotContext && mode !== 'earthquake' ? 'visible' : 'none'

  map.setLayoutProperty('earthquake-points', 'visibility', earthquakesVisible)
  for (const layer of HOTSPOT_LAYERS) {
    map.setLayoutProperty(layer, 'visibility', hotspotsVisible)
  }

  map.setLayoutProperty(
    'weather-temperature-points',
    'visibility',
    weatherMode && weatherVariable === 'temperature' ? 'visible' : 'none',
  )
  map.setLayoutProperty(
    'weather-humidity-points',
    'visibility',
    weatherMode && weatherVariable === 'humidity' ? 'visible' : 'none',
  )
  map.setLayoutProperty(
    'weather-wind-origins',
    'visibility',
    weatherMode && weatherVariable === 'wind' ? 'visible' : 'none',
  )
  map.setLayoutProperty(
    'weather-wind-vectors',
    'visibility',
    weatherMode && weatherVariable === 'wind' ? 'visible' : 'none',
  )

  for (const layer of WEATHER_CONTEXT_LAYERS) {
    map.setLayoutProperty(layer, 'visibility', contextVisible)
  }

  map.setLayoutProperty(
    'selected-hotspot-reference',
    'visibility',
    weatherMode && hasSelectedHotspot ? 'visible' : 'none',
  )
}

function earthquakeCloudBounds(events: EarthquakeEvent[]): [[number, number], [number, number]] | null {
  const valid = events.filter(
    (event) =>
      event.depthKm !== null &&
      Number.isFinite(event.depthKm) &&
      Number.isFinite(event.longitude) &&
      Number.isFinite(event.latitude),
  )
  if (valid.length === 0) return null

  let minLongitude = valid[0].longitude
  let maxLongitude = valid[0].longitude
  let minLatitude = valid[0].latitude
  let maxLatitude = valid[0].latitude

  for (const event of valid.slice(1)) {
    minLongitude = Math.min(minLongitude, event.longitude)
    maxLongitude = Math.max(maxLongitude, event.longitude)
    minLatitude = Math.min(minLatitude, event.latitude)
    maxLatitude = Math.max(maxLatitude, event.latitude)
  }

  if (minLongitude === maxLongitude) {
    minLongitude -= 0.5
    maxLongitude += 0.5
  }
  if (minLatitude === maxLatitude) {
    minLatitude -= 0.5
    maxLatitude += 0.5
  }

  return [
    [minLongitude, minLatitude],
    [maxLongitude, maxLatitude],
  ]
}

function syncEarthquakeDepthDisplay(
  map: MapLibreMap,
  mode: TerritorialViewMode,
  displayMode: EarthquakeDisplayMode,
  earthquakes: EarthquakeEvent[],
  selectedId: string | null,
  state: EarthquakeDepthLayerState,
) {
  const active = mode === 'earthquake' && displayMode === '3d'

  if (active && !state.layer) {
    state.layer = new EarthquakeDepth3DLayer()
    state.layer.setEvents(earthquakes, selectedId)
  }
  if (active && state.layer && !state.added) {
    state.layer.setVisible(true)
    map.addLayer(state.layer)
    state.added = true
  } else {
    state.layer?.setVisible(active)
  }

  if (active === state.active) return

  map.setPaintProperty('earthquake-points', 'circle-radius', active ? 3.6 : EARTHQUAKE_RADIUS_EXPRESSION)
  map.setPaintProperty('earthquake-points', 'circle-opacity', active ? 0.34 : 0.84)
  map.setPaintProperty('earthquake-points', 'circle-stroke-width', active ? 0.65 : 1.2)

  if (active) {
    const bounds = earthquakeCloudBounds(earthquakes)
    const camera = bounds ? map.cameraForBounds(bounds, { padding: 44 }) : undefined
    map.easeTo({
      ...(camera?.center ? { center: camera.center } : {}),
      ...(typeof camera?.zoom === 'number' ? { zoom: Math.min(camera.zoom, 5.2) } : {}),
      pitch: 70,
      bearing: -24,
      duration: 700,
    })
  } else {
    map.easeTo({ pitch: 0, bearing: 0, duration: 650 })
  }

  state.active = active
}

async function expandHotspotCluster(map: MapLibreMap, event: MapLayerMouseEvent) {
  const feature = event.features?.[0]
  const clusterId = Number(feature?.properties?.cluster_id)

  if (!feature || feature.geometry.type !== 'Point' || !Number.isFinite(clusterId)) return

  const hotspotSource = map.getSource('hotspots') as GeoJSONSource | undefined
  if (!hotspotSource) return

  const zoom = await hotspotSource.getClusterExpansionZoom(clusterId)
  const [longitude, latitude] = feature.geometry.coordinates

  map.easeTo({
    center: [longitude, latitude],
    zoom,
  })
}

function createBlackMapStyle(): StyleSpecification {
  const baseUrl = import.meta.env.BASE_URL
  const emptyEvents = eventsToFeatureCollection([])

  return {
    version: 8,
    sources: {
      argentina: {
        type: 'geojson',
        data: `${baseUrl}data/argentina-provinces.geojson`,
      },
      earthquakes: {
        type: 'geojson',
        data: emptyEvents,
      },
      hotspots: {
        type: 'geojson',
        data: emptyEvents,
        cluster: true,
        clusterRadius: 40,
        clusterProperties: {
          high_count: ['+', ['case', ['==', ['get', 'confidence'], 'high'], 1, 0]],
        },
      },
      'weather-grid': {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      },
      'weather-wind-vectors': {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      },
      'weather-neighbors': {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      },
      'weather-link': {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      },
      'selected-hotspot-reference': {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      },
    },
    layers: [
      {
        id: 'argentina-fill',
        type: 'fill',
        source: 'argentina',
        paint: {
          'fill-color': '#0c0f0d',
          'fill-opacity': 0.96,
        },
      },
      {
        id: 'argentina-province-lines',
        type: 'line',
        source: 'argentina',
        paint: {
          'line-color': '#403b2f',
          'line-width': 0.8,
          'line-opacity': 0.82,
        },
      },
      {
        id: 'earthquake-points',
        type: 'circle',
        source: 'earthquakes',
        paint: {
          'circle-color': earthquakeDepthColorExpression(),
          'circle-opacity': 0.84,
          'circle-stroke-color': '#050706',
          'circle-stroke-width': 1.2,
          'circle-radius': EARTHQUAKE_RADIUS_EXPRESSION,
        },
      },
      {
        id: 'hotspot-cluster-halo',
        type: 'circle',
        source: 'hotspots',
        filter: ['has', 'point_count'],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#ffd27a',
          'circle-opacity': [
            'case',
            ['>=', ['/', ['get', 'high_count'], ['get', 'point_count']], 0.03],
            0.28,
            0,
          ],
          'circle-blur': 0.72,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            17,
            10,
            23,
            50,
            29,
            200,
            36,
            500,
            44,
          ],
        },
      },
      {
        id: 'hotspot-clusters',
        type: 'circle',
        source: 'hotspots',
        filter: ['has', 'point_count'],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': [
            'step',
            ['/', ['get', 'high_count'], ['get', 'point_count']],
            '#4a3924',
            0.01,
            '#b77a32',
            0.03,
            '#ffd27a',
          ],
          'circle-opacity': 0.94,
          'circle-stroke-color': [
            'step',
            ['/', ['get', 'high_count'], ['get', 'point_count']],
            '#765b38',
            0.01,
            '#e2a653',
            0.03,
            '#fff0c4',
          ],
          'circle-stroke-width': [
            'step',
            ['/', ['get', 'high_count'], ['get', 'point_count']],
            1,
            0.01,
            1.35,
            0.03,
            1.8,
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            12,
            10,
            18,
            50,
            24,
            200,
            31,
            500,
            38,
          ],
        },
      },
      {
        id: 'hotspot-cluster-count',
        type: 'symbol',
        source: 'hotspots',
        filter: ['has', 'point_count'],
        layout: {
          visibility: 'none',
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 10,
        },
        paint: {
          'text-color': '#f8f1e4',
        },
      },
      {
        id: 'hotspot-point-halo',
        type: 'circle',
        source: 'hotspots',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'confidence'], 'high']],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#ffd27a',
          'circle-radius': 9.5,
          'circle-opacity': 0.26,
          'circle-blur': 0.72,
        },
      },
      {
        id: 'hotspot-points',
        type: 'circle',
        source: 'hotspots',
        filter: ['!', ['has', 'point_count']],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': [
            'match',
            ['get', 'confidence'],
            'high',
            '#ffd27a',
            'nominal',
            '#b77a32',
            'low',
            '#4a3924',
            '#75624a',
          ],
          'circle-radius': 5.5,
          'circle-opacity': 0.96,
          'circle-stroke-color': '#050706',
          'circle-stroke-width': 1,
        },
      },
      {
        id: 'weather-temperature-points',
        type: 'circle',
        source: 'weather-grid',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'weatherValue'],
            -10,
            '#4f7cac',
            10,
            '#73bfb8',
            25,
            '#f2c14e',
            35,
            '#ef8a47',
            45,
            '#d95d39',
          ],
          'circle-radius': 3.8,
          'circle-opacity': 0.9,
          'circle-stroke-color': '#080a09',
          'circle-stroke-width': 0.55,
        },
      },
      {
        id: 'weather-humidity-points',
        type: 'circle',
        source: 'weather-grid',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'weatherValue'],
            0,
            '#6b5547',
            25,
            '#b59b5b',
            50,
            '#5f9d87',
            75,
            '#4f9fbf',
            100,
            '#8bd3dd',
          ],
          'circle-radius': 3.8,
          'circle-opacity': 0.9,
          'circle-stroke-color': '#080a09',
          'circle-stroke-width': 0.55,
        },
      },
      {
        id: 'weather-wind-origins',
        type: 'circle',
        source: 'weather-grid',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'weatherValue'],
            0,
            '#7aa6b8',
            20,
            '#64c7c0',
            40,
            '#f2c14e',
            60,
            '#ef8354',
          ],
          'circle-radius': 2.6,
          'circle-opacity': 0.9,
          'circle-stroke-color': '#080a09',
          'circle-stroke-width': 0.45,
        },
      },
      {
        id: 'weather-wind-vectors',
        type: 'line',
        source: 'weather-wind-vectors',
        layout: { visibility: 'none' },
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'windSpeedKmh'],
            0,
            '#7aa6b8',
            20,
            '#64c7c0',
            40,
            '#f2c14e',
            60,
            '#ef8354',
          ],
          'line-width': 1.35,
          'line-opacity': 0.9,
        },
      },
      {
        id: 'weather-neighbor-points',
        type: 'circle',
        source: 'weather-neighbors',
        filter: ['!=', ['get', 'isPrimary'], true],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#837b6c',
          'circle-radius': 3.2,
          'circle-opacity': 0.62,
          'circle-stroke-color': '#181713',
          'circle-stroke-width': 0.8,
        },
      },
      {
        id: 'weather-primary-point',
        type: 'circle',
        source: 'weather-neighbors',
        filter: ['==', ['get', 'isPrimary'], true],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#f0c986',
          'circle-radius': 5,
          'circle-opacity': 0.94,
          'circle-stroke-color': '#050706',
          'circle-stroke-width': 1.1,
        },
      },
      {
        id: 'weather-context-link',
        type: 'line',
        source: 'weather-link',
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#9b9079',
          'line-width': 1,
          'line-opacity': 0.46,
          'line-dasharray': [2, 2],
        },
      },
      {
        id: 'selected-hotspot-reference',
        type: 'circle',
        source: 'selected-hotspot-reference',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': '#ffd27a',
          'circle-radius': 5.5,
          'circle-opacity': 0.96,
          'circle-stroke-color': '#fff0c4',
          'circle-stroke-width': 1.2,
        },
      },
    ],
  } as unknown as StyleSpecification
}

export function TerritorialMap({
  mode,
  earthquakeDisplayMode = '2d',
  weatherVariable = 'temperature',
  earthquakes,
  hotspots,
  weather = null,
  weatherFrameIndex = -1,
  hotspotContext = null,
  selectedHotspot = null,
  selectedWeatherPointId = null,
  selectedId = null,
  onSelect,
  onSelectWeather = noopSelectWeather,
}: TerritorialMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const loadedRef = useRef(false)
  const modeRef = useRef(mode)
  const earthquakeDisplayModeRef = useRef(earthquakeDisplayMode)
  const weatherVariableRef = useRef(weatherVariable)
  const earthquakesRef = useRef(earthquakes)
  const hotspotsRef = useRef(hotspots)
  const weatherRef = useRef(weather)
  const weatherFrameIndexRef = useRef(weatherFrameIndex)
  const hotspotContextRef = useRef(hotspotContext)
  const selectedHotspotRef = useRef(selectedHotspot)
  const selectedIdRef = useRef(selectedId)
  const onSelectRef = useRef(onSelect)
  const onSelectWeatherRef = useRef(onSelectWeather)
  const earthquakeDepthLayerStateRef = useRef<EarthquakeDepthLayerState>({
    layer: null,
    added: false,
    active: false,
  })

  modeRef.current = mode
  earthquakeDisplayModeRef.current = earthquakeDisplayMode
  weatherVariableRef.current = weatherVariable
  earthquakesRef.current = earthquakes
  hotspotsRef.current = hotspots
  weatherRef.current = weather
  weatherFrameIndexRef.current = weatherFrameIndex
  hotspotContextRef.current = hotspotContext
  selectedHotspotRef.current = selectedHotspot
  selectedIdRef.current = selectedId
  onSelectRef.current = onSelect
  onSelectWeatherRef.current = onSelectWeather

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: createBlackMapStyle(),
      bounds: ARGENTINA_VIEW_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
      maxPitch: 75,
      canvasContextAttributes: { antialias: true },
    })
    mapRef.current = map

    map.on('load', () => {
      loadedRef.current = true
      syncSources(
        map,
        earthquakesRef.current,
        hotspotsRef.current,
        weatherRef.current,
        weatherFrameIndexRef.current,
        weatherVariableRef.current,
        hotspotContextRef.current,
        selectedHotspotRef.current,
      )
      syncVisibility(
        map,
        modeRef.current,
        weatherVariableRef.current,
        hotspotContextRef.current !== null,
        selectedHotspotRef.current !== null,
      )
      syncEarthquakeDepthDisplay(
        map,
        modeRef.current,
        earthquakeDisplayModeRef.current,
        earthquakesRef.current,
        selectedIdRef.current,
        earthquakeDepthLayerStateRef.current,
      )
    })

    map.on('click', 'earthquake-points', (event: MapLayerMouseEvent) => {
      const id = String(event.features?.[0]?.properties?.id ?? '')
      const selected = earthquakesRef.current.find((item) => item.id === id)
      if (selected) onSelectRef.current(selected)
    })

    const handleHotspotClusterClick = (event: MapLayerMouseEvent) => expandHotspotCluster(map, event)
    map.on('click', 'hotspot-cluster-halo', handleHotspotClusterClick)
    map.on('click', 'hotspot-clusters', handleHotspotClusterClick)
    map.on('click', 'hotspot-cluster-count', handleHotspotClusterClick)

    map.on('click', 'hotspot-points', (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      const id = String(feature?.properties?.id ?? feature?.id ?? '')
      const selected = hotspotsRef.current.find((item) => item.id === id)
      if (selected) onSelectRef.current(selected)
    })

    const handleWeatherPointClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      const id = String(feature?.properties?.id ?? feature?.id ?? '')
      if (!id || !weatherRef.current?.points.some((point) => point.id === id)) return
      onSelectWeatherRef.current(id)
    }
    map.on('click', 'weather-temperature-points', handleWeatherPointClick)
    map.on('click', 'weather-humidity-points', handleWeatherPointClick)
    map.on('click', 'weather-wind-origins', handleWeatherPointClick)

    map.on('click', (event) => {
      if (modeRef.current !== 'thermal-hotspot') return

      const feature = map.queryRenderedFeatures(event.point, {
        layers: ['hotspot-points'],
      })[0]
      const id = String(feature?.properties?.id ?? feature?.id ?? '')
      const selected = hotspotsRef.current.find((item) => item.id === id)
      if (selected) onSelectRef.current(selected)
    })

    return () => {
      loadedRef.current = false
      mapRef.current = null
      earthquakeDepthLayerStateRef.current = { layer: null, added: false, active: false }
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    syncSources(
      map,
      earthquakes,
      hotspots,
      weather,
      weatherFrameIndex,
      weatherVariable,
      hotspotContext,
      selectedHotspot,
    )
    earthquakeDepthLayerStateRef.current.layer?.setEvents(earthquakes, selectedId)
  }, [
    earthquakes,
    hotspots,
    weather,
    weatherFrameIndex,
    weatherVariable,
    hotspotContext,
    selectedHotspot,
    selectedId,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    syncVisibility(
      map,
      mode,
      weatherVariable,
      hotspotContext !== null,
      selectedHotspot !== null,
    )
  }, [mode, weatherVariable, hotspotContext, selectedHotspot])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    syncEarthquakeDepthDisplay(
      map,
      mode,
      earthquakeDisplayMode,
      earthquakes,
      selectedId,
      earthquakeDepthLayerStateRef.current,
    )
  }, [mode, earthquakeDisplayMode, earthquakes, selectedId])

  return (
    <div
      ref={containerRef}
      className="territorial-map"
      role="region"
      aria-label="Mapa de señales territoriales de Argentina"
      data-selected-id={selectedId ?? selectedHotspot?.id ?? undefined}
      data-selected-weather-point-id={selectedWeatherPointId ?? undefined}
      data-earthquake-display-mode={earthquakeDisplayMode}
    />
  )
}
