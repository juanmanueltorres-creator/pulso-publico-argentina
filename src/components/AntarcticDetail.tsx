import { formatArgInstant } from '../lib/timeDisplay'
import type { AntarcticPoint, AntarcticSnapshot } from '../types/antarctic'

const display = (value: number | null, unit: string) => value === null
  ? 'Sin dato' : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${unit}`

export function AntarcticDetail({ point, snapshot }: {
  point: AntarcticPoint; snapshot: AntarcticSnapshot
}) {
  return (
    <aside className="weather-detail" aria-label="Detalle de base antártica">
      <p className="weather-detail__eyebrow">ANTÁRTIDA · BASE ARGENTINA</p>
      <h3>{point.name}</h3>
      <p className="weather-detail__semantic-note">{point.site} · ubicación de referencia (IGN)</p>
      <dl>
        <div><dt>Temperatura</dt><dd>{display(point.values.temperatureC, '°C')}</dd></div>
        <div><dt>Viento</dt><dd>{display(point.values.windSpeedKmh, 'km/h')}</dd></div>
        <div><dt>Dirección del viento</dt><dd>{display(point.values.windDirectionDeg, '° (desde)')}</dd></div>
        <div><dt>Nubosidad</dt><dd>{display(point.values.cloudCoverPct, '%')}</dd></div>
        <div><dt>Hora del modelo</dt>
          <dd>{point.validAt ? formatArgInstant(point.validAt, 'model-frame') : 'Sin dato'}</dd>
        </div>
        <div><dt>Modelo</dt>
          <dd><a href={snapshot.source.url} target="_blank" rel="noreferrer">{snapshot.source.dataset}</a></dd>
        </div>
        <div><dt>Bases</dt>
          <dd><a href={snapshot.locationSource.url} target="_blank" rel="noreferrer">IGN · Dirección Nacional del Antártico</a></dd>
        </div>
      </dl>
      <p className="weather-detail__semantic-note">
        Pronóstico global, no lectura de la estación. El relieve polar puede alterar los valores locales.
        El mapa utiliza una proyección que distorsiona las altas latitudes.
      </p>
    </aside>
  )
}
