import type { CSSProperties } from 'react'
import type { EarthquakeDisplayMode } from '../lib/earthquakeDepth3D'
import {
  EARTHQUAKE_DEPTH_UNKNOWN_COLOR,
  earthquakeDepthLegendGradient,
} from '../lib/earthquakeDepthScale'
import type { TerritorialViewMode, WeatherVariable } from '../types/weather'
import type { MarineVariable } from '../types/marine'
import type { AntarcticVariable } from '../types/antarctic'

interface TerritorialLegendProps {
  mode: TerritorialViewMode
  weatherVariable?: WeatherVariable
  marineVariable?: MarineVariable
  antarcticVariable?: AntarcticVariable
  earthquakeDisplayMode?: EarthquakeDisplayMode
}

const WEATHER_SCALE_STYLE: CSSProperties = {
  display: 'grid',
  gap: '0.22rem',
  minWidth: '15rem',
  padding: '0.45rem 0.55rem',
  border: '1px solid rgba(211, 164, 98, 0.18)',
  borderRadius: '0.4rem',
  background: 'rgba(255,255,255,0.018)',
}

const SCALE_BAR_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '0.55rem',
  borderRadius: '999px',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
}

const SCALE_LABELS_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.55rem',
  fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
  fontSize: '0.58rem',
}

const ARROW_EXAMPLE_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0.36rem 0.5rem',
  border: '1px solid rgba(110, 197, 233, 0.22)',
  borderRadius: '0.4rem',
  background: 'rgba(110, 197, 233, 0.035)',
}

function WeatherScale({
  ariaLabel,
  gradient,
  labels,
  direction,
}: {
  ariaLabel: string
  gradient: string
  labels: string[]
  direction: string
}) {
  return (
    <span role="img" aria-label={ariaLabel} style={WEATHER_SCALE_STYLE}>
      <span style={{ color: 'var(--muted)', fontSize: '0.63rem' }}>{direction}</span>
      <span aria-hidden="true" style={{ ...SCALE_BAR_STYLE, background: gradient }} />
      <span style={SCALE_LABELS_STYLE}>
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </span>
    </span>
  )
}

function EarthquakeDepthScale() {
  return (
    <>
      <WeatherScale
        ariaLabel="Escala visual de profundidad reportada"
        gradient={earthquakeDepthLegendGradient()}
        labels={['0 km', '70 km', '150 km', '300 km', '500+ km']}
        direction="somero ← profundidad reportada → profundo"
      />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '0.72rem',
            height: '0.72rem',
            borderRadius: '999px',
            background: EARTHQUAKE_DEPTH_UNKNOWN_COLOR,
          }}
        />
        Sin profundidad reportada = tono neutro
      </span>
    </>
  )
}

function EarthquakeDepth3DGuide() {
  const references = ['0 km', '70 km', '150 km', '300 km']

  return (
    <span
      role="img"
      aria-label="Guía visual de profundidad 3D: referencias 0, 70, 150 y 300 km"
      style={{
        display: 'inline-grid',
        gridTemplateColumns: '0.8rem auto',
        columnGap: '0.55rem',
        alignItems: 'stretch',
        padding: '0.42rem 0.55rem',
        border: '1px solid rgba(211, 164, 98, 0.16)',
        borderRadius: '0.4rem',
        background: 'rgba(255,255,255,0.014)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateRows: 'repeat(4, 1fr)',
          minHeight: '3.15rem',
          borderLeft: '1px solid rgba(240, 201, 134, 0.48)',
        }}
      >
        {references.map((reference) => (
          <span
            key={reference}
            style={{
              width: '0.55rem',
              borderTop: '1px solid rgba(240, 201, 134, 0.48)',
            }}
          />
        ))}
      </span>
      <span style={{ display: 'grid', gap: '0.14rem' }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.61rem' }}>Guía geométrica · profundidad reportada</span>
        <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: '0.58rem' }}>
          Referencias Z: 0 km · 70 km · 150 km · 300 km
        </span>
      </span>
    </span>
  )
}

function WindArrowExample() {
  return (
    <span role="img" aria-label="Ejemplo de flecha de viento: cola y punta" style={ARROW_EXAMPLE_STYLE}>
      <span>cola = de dónde viene</span>
      <span aria-hidden="true" style={{ color: '#64c7c0', fontSize: '1.1rem', letterSpacing: '-0.15em' }}>
        ───▶
      </span>
      <span>punta = hacia dónde se mueve</span>
    </span>
  )
}

export function TerritorialLegend({
  mode,
  weatherVariable = 'temperature',
  marineVariable = 'waves',
  antarcticVariable = 'temperature',
  earthquakeDisplayMode = '2d',
}: TerritorialLegendProps) {
  if (mode === 'earthquake') {
    return (
      <div className="territorial-legend" aria-label="Leyenda de sismos" tabIndex={0}>
        <strong>Cómo leer este mapa</strong>
        <span className="territorial-legend__mark territorial-legend__mark--earthquake" aria-hidden="true" />
        <span>Tamaño = magnitud</span>
        <span>Color = profundidad reportada</span>
        <EarthquakeDepthScale />
        {earthquakeDisplayMode === '3d' ? (
          <>
            <span>Vista 3D: el sismo seleccionado conecta superficie → hipocentro reportado.</span>
            <span>Exageración vertical 6× · superficie plana de referencia · sin relieve/DEM.</span>
            <EarthquakeDepth3DGuide />
            <span>No corrige la profundidad reportada por altitud local.</span>
          </>
        ) : null}
        <span>Escala visual reforzada desde M4+; el tamaño no representa daño previsto.</span>
        <span>La profundidad exacta y la intensidad aparecen en el detalle.</span>
      </div>
    )
  }

  if (mode === 'antarctic') {
    return (
      <div className="territorial-legend" aria-label="Leyenda antártica" tabIndex={0}>
        <strong>Cómo leer este mapa</strong>
        <span>Seis bases permanentes argentinas · coordenadas publicadas por el IGN.</span>
        <span>{antarcticVariable === 'temperature' ? 'Temperatura modelada en °C.' :
          antarcticVariable === 'wind' ? 'Velocidad del viento modelada en km/h.' :
            'Cobertura nubosa total modelada en porcentaje.'}</span>
        <span>Seleccioná una base para conocer su ubicación, hora, modelo y variables.</span>
        <span>No son lecturas de las estaciones ni una malla continua del territorio antártico.</span>
        <span>Mercator distorsiona las superficies polares. No usar para navegación ni operaciones.</span>
      </div>
    )
  }

  if (mode === 'marine') {
    return (
      <div className="territorial-legend" aria-label="Leyenda marina" tabIndex={0}>
        <strong>Cómo leer este mapa</strong>
        <span>Seis puntos de consulta mar adentro · Marine API de Open-Meteo.</span>
        <span>
          {marineVariable === 'waves' ? 'Altura significativa de olas en metros (m).' :
           marineVariable === 'currents' ? 'Velocidad de corrientes oceánicas en kilómetros por hora (km/h).' :
             'Temperatura superficial del mar en grados Celsius (°C).'}
        </span>
        <span>Los puntos no son boyas ni mediciones de puerto. Seleccioná uno para leer todas las variables y su hora.</span>
        <span>Datos modelados, con precisión costera limitada. No utilizar para navegación.</span>
      </div>
    )
  }

  if (mode === 'weather') {
    return (
      <div className="territorial-legend" aria-label="Leyenda meteorológica" tabIndex={0}>
        <strong>Cómo leer este mapa</strong>
        <span>Modelo meteorológico ECMWF distribuido mediante Open-Meteo.</span>
        <span>Contexto modelado sobre la malla Pulso; no estación de superficie.</span>

        {weatherVariable === 'temperature' ? (
          <>
            <span>Temperatura modelada para la hora activa. Los números sobre el mapa son puntos de referencia del modelo, no promedios provinciales; tocá un punto para el valor exacto.</span>
            <WeatherScale
              ariaLabel="Escala visual de temperatura"
              gradient="linear-gradient(90deg, #4f7cac 0%, #73bfb8 35%, #f2c14e 68%, #ef8a47 84%, #d95d39 100%)"
              labels={['0 °C', '10 °C', '20 °C', '30 °C', '40 °C']}
              direction="más frío ← temperatura → más cálido"
            />
          </>
        ) : weatherVariable === 'humidity' ? (
          <>
            <span>Humedad relativa modelada para la hora activa. Los porcentajes indican puntos de referencia del modelo, no nubosidad ni promedios provinciales.</span>
            <WeatherScale
              ariaLabel="Escala visual de humedad"
              gradient="linear-gradient(90deg, #6b5547 0%, #b59b5b 30%, #5f9d87 60%, #4f9fbf 82%, #8bd3dd 100%)"
              labels={['0 %', '50 %', '100 %']}
              direction="más seco ← humedad relativa → más húmedo"
            />
          </>
        ) : weatherVariable === 'clouds' ? (
          <>
            <span>Las nubecitas muestran cobertura nubosa total modelada para la hora indicada. El porcentaje se toma de un punto real de la malla, no es un promedio regional ni una imagen satelital.</span>
            <WeatherScale
              ariaLabel="Escala visual de cobertura nubosa"
              gradient="linear-gradient(90deg, #506777 0%, #8ca5b5 40%, #e1ebf3 75%, #f4f8fa 100%)"
              labels={['0 % despejado', '50 %', '100 % cubierto']}
              direction="menos nubes ← cobertura → más nubes"
            />
            <span>No se dibujan nubecitas por debajo de 20 %; los puntos tenues siguen siendo consultables. La humedad no determina la cobertura nubosa.</span>
          </>
        ) : (
          <>
            <span>La dirección textual indica la dirección desde la que sopla el viento; es decir, de dónde sopla.</span>
            <WindArrowExample />
            <WeatherScale
              ariaLabel="Escala visual de velocidad del viento"
              gradient="linear-gradient(90deg, #7aa6b8 0%, #64c7c0 35%, #f2c14e 67%, #ef8354 100%)"
              labels={['0 km/h', '30 km/h', '60 km/h']}
              direction="menor ← velocidad del viento → mayor"
            />
            <span>La longitud visual de cada vector es constante y no representa velocidad. Los números sobre el mapa expresan km/h en puntos seleccionados de la malla; se omite la unidad junto a cada número para evitar superposiciones.</span>
            <span>El color representa velocidad modelada; velocidad y ráfagas exactas se leen en el detalle.</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="territorial-legend" aria-label="Leyenda de focos de calor" tabIndex={0}>
      <strong>Cómo leer este mapa</strong>
      <span>Tamaño = cantidad de detecciones agrupadas</span>
      <span>Tono = proporción de detecciones con confianza alta</span>
      <span className="territorial-legend__tone-scale" aria-label="Escala de tono de confianza alta">
        <span className="territorial-legend__tone-tier">
          <span className="territorial-legend__mark territorial-legend__mark--hotspot-low" aria-hidden="true" />
          <span>&lt; 1% alta</span>
        </span>
        <span className="territorial-legend__tone-tier">
          <span className="territorial-legend__mark territorial-legend__mark--hotspot-medium" aria-hidden="true" />
          <span>1–3% alta</span>
        </span>
        <span className="territorial-legend__tone-tier">
          <span className="territorial-legend__mark territorial-legend__mark--hotspot-high" aria-hidden="true" />
          <span>≥ 3% alta</span>
        </span>
      </span>
      <span>En puntos individuales, el tono refleja la confianza de esa detección.</span>
      <span>Más grande no significa más peligro. Confianza de detección no equivale a probabilidad de incendio.</span>
      <span>FRP aporta contexto en el detalle; no representa peligro ni confirma un incendio.</span>
    </div>
  )
}
