import { formatArgInstant } from '../lib/timeDisplay'
import type { MarinePoint, MarineSnapshot } from '../types/marine'

interface MarineDetailProps {
  point: MarinePoint
  snapshot: MarineSnapshot
}

const value = (number: number | null, unit: string) =>
  number === null ? 'Sin dato' : `${number.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${unit}`

export function MarineDetail({ point, snapshot }: MarineDetailProps) {
  return (
    <aside className="weather-detail" aria-label="Detalle marino">
      <p className="weather-detail__eyebrow">MAR ARGENTINO · MODELO OCEÁNICO</p>
      <h3>{point.name}</h3>
      <p className="weather-detail__semantic-note">{point.region} · consulta mar adentro</p>
      <dl>
        <div><dt>Olas</dt><dd>{value(point.values.waveHeightM, 'm')}</dd></div>
        <div><dt>Período</dt><dd>{value(point.values.wavePeriodS, 's')}</dd></div>
        <div><dt>Dirección de olas</dt><dd>{value(point.values.waveDirectionDeg, '° (desde)')}</dd></div>
        <div><dt>Corrientes</dt><dd>{value(point.values.currentVelocityKmh, 'km/h')}</dd></div>
        <div><dt>Dirección de corriente</dt><dd>{value(point.values.currentDirectionDeg, '° (hacia)')}</dd></div>
        <div><dt>Temperatura del mar</dt><dd>{value(point.values.seaSurfaceTemperatureC, '°C')}</dd></div>
        <div><dt>Hora del modelo</dt>
          <dd>{point.validAt ? formatArgInstant(point.validAt, 'model-frame') : 'Sin dato'}</dd>
        </div>
        <div><dt>Fuente</dt><dd><a href={snapshot.source.url} target="_blank" rel="noreferrer">Open-Meteo Marine API</a></dd></div>
      </dl>
      <p className="weather-detail__semantic-note">
        Modelos oceánicos de selección automática; no son mediciones en puertos ni boyas.
        La precisión cerca de la costa es limitada. No usar para navegación.
      </p>
    </aside>
  )
}
