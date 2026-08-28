import { useEffect, useRef } from 'react'
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { eventsToFeatureCollection } from '../lib/territorialMapData'
import type {
  EarthquakeEvent,
  TerritorialKind,
  ThermalHotspotEvent,
} from '../types/territorial'

setWorkerUrl(mapLibreWorkerUrl)

const ARGENTINA_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [-73.7, -55.3],
  [-53.5, -21.7],
]

const HOTSPOT_LAYERS = [
  'hotspot-cluster-halo',
  'hotspot-clusters',
  'hotspot-cluster-count',
  'hotspot-point-halo',
  'hotspot-points',
] as const

interface TerritorialMapProps {
  mode: TerritorialKind
  earthquakes: EarthquakeEvent[]
  hotspots: ThermalHotspotEvent[]
  selectedId: string | null
  onSelect: (event: EarthquakeEvent | ThermalHotspotEvent) => void
}

function eventData(events: EarthquakeEvent[] | ThermalHotspotEvent[]): Parameters<GeoJSONSource['setData']>[0] {
  return eventsToFeatureCollection(events) as Parameters<GeoJSONSource['setData']>[0]
}

function syncSources(
  map: MapLibreMap,
  earthquakes: EarthquakeEvent[],
  hotspots: ThermalHotspotEvent[],
) {
  const earthquakeSource = map.getSource('earthquakes') as GeoJSONSource | undefined
  const hotspotSource = map.getSource('hotspots') as GeoJSONSource | undefined

  earthquakeSource?.setData(eventData(earthquakes))
  hotspotSource?.setData(eventData(hotspots))
}

function syncVisibility(map: MapLibreMap, mode: TerritorialKind) {
  const earthquakesVisible = mode === 'earthquake' ? 'visible' : 'none'
  const hotspotsVisible = mode === 'thermal-hotspot' ? 'visible' : 'none'

  map.setLayoutProperty('earthquake-points', 'visibility', earthquakesVisible)
  for (const layer of HOTSPOT_LAYERS) {
    map.setLayoutProperty(layer, 'visibility', hotspotsVisible)
  }
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
          'circle-color': '#f0c986',
          'circle-opacity': 0.84,
          'circle-stroke-color': '#050706',
          'circle-stroke-width': 1.2,
          'circle-radius': [
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
          ],
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
    ],
  } as unknown as StyleSpecification
}

export function TerritorialMap({
  mode,
  earthquakes,
  hotspots,
  selectedId,
  onSelect,
}: TerritorialMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const loadedRef = useRef(false)
  const modeRef = useRef(mode)
  const earthquakesRef = useRef(earthquakes)
  const hotspotsRef = useRef(hotspots)
  const onSelectRef = useRef(onSelect)

  modeRef.current = mode
  earthquakesRef.current = earthquakes
  hotspotsRef.current = hotspots
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: createBlackMapStyle(),
      bounds: ARGENTINA_VIEW_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
    })
    mapRef.current = map

    map.on('load', () => {
      loadedRef.current = true
      syncSources(map, earthquakesRef.current, hotspotsRef.current)
      syncVisibility(map, modeRef.current)
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
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    syncSources(map, earthquakes, hotspots)
  }, [earthquakes, hotspots])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    syncVisibility(map, mode)
  }, [mode])

  return (
    <div
      ref={containerRef}
      className="territorial-map"
      role="region"
      aria-label="Mapa de señales territoriales de Argentina"
      data-selected-id={selectedId ?? undefined}
    />
  )
}
