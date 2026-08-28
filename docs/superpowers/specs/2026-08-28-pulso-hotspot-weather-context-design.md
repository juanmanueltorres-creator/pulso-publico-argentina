# Pulso Público V3.1 — Contexto meteorológico para focos térmicos

**Fecha:** 2026-08-28  
**Estado:** diseño aprobado; implementación pendiente  
**Rama de diseño:** `docs/pulso-weather-context-v3-1-design`  
**Base:** `main` en `7e5c8d4f015aa805447e1284658307ceebdcbbda`

## 1. Propósito

Volver el foco de Pulso Público al caso territorial de incendios/focos térmicos y agregar una capa de **contexto meteorológico modelado, espacial y temporalmente trazable** para las detecciones CONAE/VIIRS de las últimas 24 horas.

La pregunta de producto de V3.1 es:

> **¿Qué condiciones meteorológicas modeladas coexistían cerca de una detección térmica y en una hora comparable?**

V3.1 no intenta responder:

> “¿El viento, la temperatura o la humedad causaron este foco?”

La relación meteorología + foco es contextual. No constituye causalidad, riesgo calculado ni confirmación oficial de incendio.

La regla editorial central es:

> **Coincidencia en espacio y tiempo no equivale a causalidad.**

## 2. Relación con la arquitectura existente

Pulso conserva sin cambios incompatibles sus contratos públicos actuales:

- `SignalEnvelope 1.0` para Pulso Nacional;
- `TerritorialSnapshot 1.0` para eventos territoriales recientes;
- `EvidenceSnapshot 1.0` para evidencia territorial analítica histórica.

`TerritorialKind` continúa representando sólo eventos:

```text
earthquake
thermal-hotspot
```

Meteorología **no** se agrega a `TerritorialKind`. Una salida de un modelo meteorológico sobre una malla no es un evento ocurrido equivalente a un sismo o una detección VIIRS.

V3.1 agrega un contrato independiente:

```text
CONAE / VIIRS
      ↓
TerritorialSnapshot<ThermalHotspotEvent>
      ↓
hotspots.json

ECMWF IFS HRES
      ↓
Open-Meteo Historical Forecast API
      ↓
adapter de Pulso
      ↓
WeatherSnapshot 1.0
      ↓
weather.json
```

React continúa consumiendo snapshots públicos propios. El navegador no consulta directamente CONAE ni Open-Meteo.

## 3. Decisión de fuente meteorológica

### 3.1 Fuente inicial

La primera implementación usa:

- **proveedor API:** Open-Meteo;
- **dataset/modelo:** ECMWF IFS HRES;
- **resolución nominal del modelo:** 9 km;
- **producto temporal:** Historical Forecast, compuesto por las primeras horas de sucesivos runs del modelo para producir una serie horaria continua reciente;
- **variables horarias:** temperatura a 2 m, humedad relativa a 2 m, velocidad del viento a 10 m, dirección del viento a 10 m, ráfagas a 10 m y precipitación;
- **unidades públicas:** °C, %, km/h, grados y mm;
- **tiempo interno:** UTC.

Referencias técnicas verificadas durante el diseño:

- `https://open-meteo.com/en/docs/historical-forecast-api`
- `https://open-meteo.com/en/docs/ecmwf-api`
- `https://open-meteo.com/en/terms`

Open-Meteo permite múltiples coordenadas por request. El adapter debe agrupar consultas en lotes y no ejecutar una request por punto.

### 3.2 Semántica

Estos datos se presentan como **contexto meteorológico modelado**. No se etiquetan como estación, observación de superficie ni medición exacta en la ubicación del foco.

La UI debe usar expresiones como:

- `Contexto meteorológico modelado`;
- `Punto modelado cercano`;
- `Hora meteorológica comparable`.

Debe evitar:

- `Estación`;
- `Temperatura del foco`;
- `Medición en el incendio`;
- cualquier texto que sugiera causalidad.

### 3.3 Licencia y operación

Los datos servidos por Open-Meteo requieren atribución bajo CC BY 4.0. La implementación debe mostrar atribución visible y conservarla también en README/documentación.

La API gratuita de Open-Meteo está destinada a uso no comercial y tiene límites operativos. V3.1 se diseña para el uso actual del proyecto; si Pulso pasa a un uso comercial, el acceso al proveedor debe revisarse antes de depender del free tier.

La dependencia del proveedor queda encapsulada detrás del adapter para permitir una futura migración a NOAA GFS directo, SMN u otra fuente sin modificar el contrato que consume React.

## 4. Dominio espacial

### 4.1 Malla propia de Pulso

V3.1 no usa “uno o dos puntos por provincia”. Genera una **malla nacional regular de 0,5° × 0,5°** y conserva únicamente los puntos dentro del dominio argentino que Pulso ya representa.

La generación usa:

1. el bounding box actual del mapa argentino;
2. la geometría argentina/provincial ya versionada en `public/data/argentina-provinces.geojson`;
3. point-in-polygon fail-closed;
4. orden e IDs determinísticos.

La malla cubre el dominio territorial actualmente visible en Pulso; no amplía esta iteración a dominios que el mapa actual no representa.

El número de puntos no se hardcodea. Se calcula determinísticamente desde geometría + spacing y queda registrado en `WeatherSnapshot.grid.pointCount`.

### 4.2 Punto consultado vs grilla nativa del modelo

Cada punto de Pulso conserva su **coordenada de consulta**. Si el proveedor devuelve una coordenada resuelta, puede conservarse como metadata, pero V3.1 no debe afirmar que esa coordenada representa el centro exacto de una celda nativa ECMWF salvo que la respuesta/documentación lo sostenga explícitamente.

Para distancia al foco, V3.1 utiliza la coordenada de consulta de la malla de Pulso y la etiqueta como `punto modelado`, no como estación.

## 5. Contrato `WeatherSnapshot 1.0`

El contrato propuesto es:

```ts
export interface WeatherSnapshot {
  schemaVersion: '1.0'
  generatedAt: string
  sourceCheckedAt: string
  dataThrough: string

  window: {
    hours: 24
    stepHours: 1
  }

  freshness: {
    staleAfterMinutes: number
  }

  grid: {
    spacingDegrees: 0.5
    pointCount: number
  }

  timestamps: string[]

  source: {
    provider: string
    dataset: string
    url: string
    kind: 'numerical-weather-model'
    license: string
  }

  method: {
    type: 'historical-forecast-grid'
    temporalResolutionMinutes: 60
    note: string
  }

  limitations: string[]
  points: WeatherPoint[]
}

export interface WeatherPoint {
  id: string
  queryCoordinate: {
    latitude: number
    longitude: number
  }
  providerCoordinate: {
    latitude: number
    longitude: number
  } | null
  values: {
    temperatureC: Array<number | null>
    relativeHumidityPct: Array<number | null>
    windSpeedKmh: Array<number | null>
    windDirectionDeg: Array<number | null>
    windGustKmh: Array<number | null>
    precipitationMm: Array<number | null>
  }
}
```

## 6. Invariantes del contrato

1. `schemaVersion` debe ser exactamente `1.0`.
2. `timestamps` contiene exactamente 24 frames horarios comunes a todos los puntos.
3. Los timestamps están en UTC, son válidos, únicos y estrictamente ascendentes.
4. `dataThrough` coincide con el último timestamp publicado.
5. Cada array de variables tiene exactamente la misma longitud que `timestamps`.
6. Un dato ausente se representa con `null`, nunca con `0` inventado.
7. IDs de puntos son no vacíos, únicos y determinísticos para una misma grilla.
8. Coordenadas deben ser finitas y estar dentro de rangos WGS84 válidos.
9. Humedad válida: `0–100` o `null`.
10. Velocidad de viento y ráfagas: `>= 0` o `null`.
11. Dirección del viento: `0–360` o `null`.
12. Precipitación: `>= 0` o `null`.
13. `grid.pointCount === points.length`.
14. La ausencia de un frame común de 24 horas hace fallar la generación. No se publica un snapshot temporalmente desalineado.
15. El contrato no contiene score de riesgo, causalidad ni “probabilidad de incendio”.

## 7. Construcción del snapshot

Nuevo output:

```text
public/data/weather.json
```

Pipeline:

```text
argentina-provinces.geojson
        ↓
generar malla 0,5°
        ↓
filtrar puntos dentro del dominio
        ↓
consultar Open-Meteo en lotes
        ↓
normalizar unidades y UTC
        ↓
encontrar 24 timestamps completos comunes
        ↓
validar WeatherSnapshot
        ↓
escritura atómica weather.json
```

El script no debe sobrescribir el último snapshot válido si:

- falla un batch;
- la respuesta HTTP no es exitosa;
- la respuesta no puede parsearse;
- faltan puntos esperados;
- no existen 24 frames horarios comunes;
- el snapshot final no pasa validación.

La actualización debe ser fail-closed.

## 8. Actualización automática

Se agrega un workflow independiente:

```text
.github/workflows/refresh-weather.yml
```

Y un script dedicado:

```text
scripts/refresh-weather.mjs
```

Además:

```text
npm run refresh:weather
```

La cadencia de V3.1 es **horaria**, desacoplada del workflow CONAE. No comparte el grupo de concurrencia `refresh-territorial`; usa su propia concurrencia para que un refresh meteorológico lento o fallido no bloquee ni cancele el refresh de focos.

El workflow:

1. checkout;
2. instala dependencias;
3. genera/valida weather snapshot;
4. compara `public/data/weather.json`;
5. commitea sólo si el archivo cambió;
6. nunca escribe un snapshot parcial.

Aunque ECMWF IFS se actualiza por runs varias veces al día, Pulso consulta cada hora para mantener una política simple de `sourceCheckedAt`, detectar disponibilidad de nuevos frames y alinearse con la ventana móvil de 24 h del producto.

## 9. Matching foco + meteorología

V3.1 agrega una función de dominio independiente, conceptualmente:

```ts
findWeatherContext(
  hotspot: ThermalHotspotEvent,
  snapshot: WeatherSnapshot,
  neighborCount = 6,
): HotspotWeatherContext | null
```

Debe:

1. calcular distancia Haversine desde el foco a todos los puntos meteorológicos válidos;
2. ordenar por distancia ascendente;
3. conservar hasta 6 vecinos;
4. elegir el vecino más cercano como referencia principal;
5. buscar el timestamp meteorológico más cercano a `hotspot.occurredAt`;
6. conservar la diferencia temporal absoluta en minutos;
7. devolver `null` si no existe un punto/frame con datos utilizables.

No existe en V3.1 un umbral científico de “asociación”. La distancia espacial y la diferencia temporal se muestran explícitamente al usuario para que la resolución no quede oculta.

Ejemplo de salida conceptual:

```text
Foco: 18:37 UTC
Frame meteo: 19:00 UTC
Diferencia temporal: 23 min
Punto modelado: 19 km
34,2 °C · HR 21 % · viento 38 km/h O · ráfagas 55 km/h
```

## 10. View modes

La UI ofrece:

```text
Sismos | Focos de calor | Meteorología
```

Esto no modifica `TerritorialKind`. Se agrega un tipo local de vista, por ejemplo:

```ts
type TerritorialViewMode = TerritorialKind | 'weather'
```

Los contratos de datos permanecen separados.

## 11. Comportamiento del mapa

El `MapLibreMap` existente debe continuar creándose una sola vez. Cambiar de vista no debe reconstruir el mapa, ejecutar `fitBounds` automático ni perder cámara/zoom.

### 11.1 Sismos

Comportamiento actual sin cambios funcionales.

### 11.2 Focos de calor

Sin foco seleccionado:

- se muestran focos/clusters como hoy;
- no se dibuja la malla meteorológica completa.

Con foco seleccionado:

- el foco seleccionado permanece protagonista;
- se muestran hasta 6 puntos meteorológicos vecinos;
- el vecino principal tiene una distinción sutil;
- puede mostrarse una línea tenue foco → vecino principal;
- el mapa no hace `flyTo` ni `fitBounds` automático por selección;
- el panel agrega contexto meteorológico si está disponible.

### 11.3 Meteorología

- se muestra la malla meteorológica completa;
- se usa por defecto el último frame completo de `timestamps`;
- si existía un foco seleccionado en la vista Focos, ese foco permanece como referencia secundaria;
- la cámara y zoom se conservan al entrar/salir;
- seleccionar un punto meteorológico abre su detalle sin borrar la memoria del foco previamente seleccionado;
- al volver a Focos, se restaura el detalle del foco conservado.

La selección de foco y la selección meteorológica son estados distintos.

## 12. Variables visibles en V3.1

El subselector meteorológico inicial ofrece únicamente:

```text
Temperatura | Viento | Humedad
```

El contrato ya conserva ráfagas y precipitación para el detalle y para futuras iteraciones, pero no se agregan pestañas/mapas dedicados a esas variables en V3.1.

### Temperatura

- puntos de malla;
- escala secuencial sobria;
- sin heatmap continuo ni interpolación visual entre celdas.

### Humedad

- puntos de malla;
- escala secuencial sobria independiente;
- sin semántica de riesgo.

### Viento

- símbolo/vector simple cuya orientación representa dirección;
- velocidad visible en detalle;
- no se implementan partículas animadas;
- no se interpreta visualmente como trayectoria del fuego.

Las rampas no deben convertir valores meteorológicos en categorías implícitas de peligro.

## 13. Panel de detalle

### 13.1 Foco seleccionado

El detalle conserva primero la evidencia térmica existente:

```text
DETECCIÓN TÉRMICA
Fecha/hora
Confianza
FRP
Sensor
Satélite
Fuente CONAE
```

Luego agrega un bloque separado:

```text
CONTEXTO METEOROLÓGICO MODELADO
Hora del frame
Temperatura
Humedad
Viento + dirección
Ráfagas
Precipitación
Distancia al punto modelado
Diferencia temporal
Fuente/modelo
```

Caveat obligatorio:

> Estas condiciones coexistían aproximadamente en espacio y tiempo con la detección. No prueban su causa ni confirman por sí solas un incendio.

### 13.2 Punto meteorológico seleccionado

`WeatherDetail` muestra:

- hora del frame activo;
- temperatura;
- humedad;
- viento y dirección;
- ráfagas;
- precipitación;
- coordenada de consulta;
- proveedor/modelo;
- `dataThrough`;
- limitación explícita de que es contexto modelado, no una estación.

## 14. Componentes y fronteras previstas

El diseño evita inflar `TerritorialDetail` y `TerritorialMap` con lógica de dominio.

Archivos nuevos previstos:

```text
src/types/weather.ts
src/lib/validateWeatherSnapshot.ts
src/lib/validateWeatherSnapshot.test.ts
src/lib/loadWeatherSnapshot.ts
src/lib/loadWeatherSnapshot.test.ts
src/lib/weatherContext.ts
src/lib/weatherContext.test.ts
src/lib/weatherMapData.ts
src/lib/weatherMapData.test.ts
src/components/WeatherDetail.tsx
src/components/WeatherDetail.test.tsx
src/components/HotspotWeatherContext.tsx
src/components/HotspotWeatherContext.test.tsx
scripts/refresh-weather.mjs
.github/workflows/refresh-weather.yml
public/data/weather.json
```

Archivos existentes con cambios previstos:

```text
src/components/TerritorialSection.tsx
src/components/TerritorialSection.test.tsx
src/components/TerritorialMap.tsx
src/components/TerritorialMap.test.tsx
src/components/TerritorialDetail.tsx
src/styles.css
package.json
README.md
```

`loadTerritorialSnapshot` no se reutiliza para meteorología. Se mantiene limitado a sismos/focos.

La lógica Haversine, selección de vecinos, selección temporal y transformación a GeoJSON debe vivir en helpers testeables fuera del componente React.

## 15. Carga y aislamiento de fallos

Meteorología posee estado de carga/error propio.

Reglas:

- si falla `weather.json`, Sismos y Focos continúan funcionando;
- un fallo meteorológico no se transforma en `0 °C`, `0 %` o `0 km/h`;
- si existe foco seleccionado y no hay meteorología disponible, el bloque dice `Contexto meteorológico temporalmente no disponible`;
- si el snapshot está stale, se muestra estado desactualizado y última consulta;
- `weather.json` inválido falla antes de renderizar datos;
- un error de Open-Meteo no borra el snapshot previamente válido en el repositorio;
- un error de CONAE no se interpreta como “0 focos”, aunque meteorología siga disponible.

## 16. Freshness

`sourceCheckedAt` representa cuándo Pulso consultó la fuente meteorológica.

`dataThrough` representa hasta qué frame meteorológico llegan los datos publicados.

No son el mismo concepto y ambos deben poder mostrarse/diagnosticarse.

V3.1 usará una tolerancia de stale coherente con un refresh horario y con fallos transitorios; el valor inicial del snapshot será **180 minutos**.

El estado stale no elimina los datos históricos visibles: los marca como desactualizados.

## 17. Testing

La implementación se hará por TDD.

### 17.1 Contrato

`validateWeatherSnapshot` cubre:

- versión incorrecta;
- timestamps inválidos/desordenados/duplicados;
- cantidad distinta de 24;
- `dataThrough` inconsistente;
- IDs duplicados;
- coordenadas inválidas;
- `pointCount` inconsistente;
- arrays con longitudes diferentes;
- NaN/infinito;
- humedad fuera de rango;
- viento negativo;
- dirección fuera de rango;
- precipitación negativa;
- `null` permitido sin coerción a cero.

### 17.2 Malla

Tests determinísticos con geometría fixture:

- spacing 0,5°;
- puntos interiores incluidos;
- exteriores excluidos;
- Polygon y MultiPolygon;
- IDs estables;
- mismo input → mismo orden/output.

### 17.3 Adapter/refresh

Tests con fixtures, sin depender de red en CI:

- múltiples ubicaciones;
- batching;
- normalización UTC;
- variables esperadas;
- intersección de timestamps comunes;
- batch faltante hace fallar;
- respuesta parcial no se publica;
- archivo existente no se sustituye ante error.

### 17.4 Matching

- Haversine correcto con fixtures conocidos;
- vecinos ordenados;
- máximo 6 vecinos;
- timestamp más cercano;
- diferencia temporal correcta;
- datos nulos manejados sin score artificial;
- sin contexto devuelve `null`.

### 17.5 UI

Tests de interacción para:

- selector `Sismos | Focos de calor | Meteorología`;
- foco seleccionado conserva contexto al cambiar de vista;
- cámara no se resetea por cambio de modo;
- sin foco no se muestran vecinos meteo en Focos;
- con foco se muestran hasta 6 vecinos;
- detalle expone distancia y diferencia temporal;
- caveat de no causalidad visible;
- error meteorológico no rompe focos;
- stale visible;
- `Temperatura | Viento | Humedad` cambia representación sin cambiar contrato.

### 17.6 Regresión

Antes de merge deben pasar:

- tests existentes de Pulso Nacional;
- tests territoriales INPRES/CONAE;
- tests de Evidencia;
- tests nuevos de Weather;
- TypeScript;
- Vite production build;
- `git diff --check`.

## 18. Rendimiento

La malla de 0,5° produce un orden aproximado de magnitud de `10^3` puntos, no decenas de miles. El número exacto se deriva de la geometría.

El snapshot evita repetir timestamps dentro de cada punto: usa un array global de 24 timestamps y arrays de valores por punto.

El frontend sólo transforma al frame activo las propiedades necesarias para MapLibre. No debe crear una feature por punto × hora simultáneamente.

En V3.1 no se implementa almacenamiento histórico de múltiples snapshots en el frontend.

## 19. Accesibilidad y lenguaje

La pestaña Meteorología y el subselector deben ser controles accesibles por teclado y expresar estado seleccionado.

La representación visual nunca es la única fuente del valor: el detalle textual contiene número + unidad + hora.

Todo lenguaje de producto debe diferenciar:

```text
detección térmica
contexto meteorológico modelado
confirmación oficial
```

No deben colapsarse en un único concepto de “incendio”.

## 20. No objetivos de V3.1

Queda explícitamente fuera:

- animación/play de las últimas 24 h;
- timeline interactiva;
- partículas de viento;
- heatmap continuo;
- interpolación propia de superficies;
- pronóstico futuro;
- estaciones SMN;
- NOAA GFS directo;
- GOES;
- humo;
- burn scar Sentinel;
- meses/años históricos almacenados en GitHub;
- correlación estadística foco-meteorología;
- inferencia causal;
- machine learning;
- score de riesgo;
- “probabilidad de incendio”;
- backend propio o base de datos;
- consulta Open-Meteo desde el navegador;
- rediseño de Pulso Evidencia.

## 21. Evolución prevista

### V3.2 — mejorar evidencia de fuego activo

Mantener la escalera epistemológica separada de meteorología:

```text
Detectado — VIIRS
    ↓
Corroborado — otro sensor
    ↓
Persistente — observación temporal / GOES
    ↓
Compatible con fuego activo — calor + persistencia + evidencia adicional
    ↓
Impacto observado — burn scar posterior
    ↓
Confirmado oficialmente — autoridad competente
```

V3.2 no debe convertir FRP ni meteorología en un score sintético.

### V3.3 — animación 24 h

`WeatherSnapshot 1.0` nace con 24 frames para que una iteración posterior pueda agregar:

```text
23 h atrás ─────────────── ahora
           ◀  ▶  pausa/play
```

La animación podrá cambiar el índice temporal de la malla y hacer aparecer detecciones según `occurredAt`, sin cambiar el contrato base.

## 22. Criterios de aceptación

V3.1 está terminada únicamente cuando:

1. `TerritorialKind` y `TerritorialSnapshot 1.0` mantienen compatibilidad.
2. Existe `WeatherSnapshot 1.0` separado y validado.
3. `weather.json` contiene una malla nacional de 0,5° filtrada por la geometría argentina usada por Pulso.
4. El snapshot contiene exactamente 24 frames horarios comunes y alineados.
5. Se publican temperatura, humedad, viento, dirección, ráfagas y precipitación con `null` para faltantes.
6. La UI ofrece `Sismos | Focos de calor | Meteorología` sin reconstruir el mapa ni resetear cámara.
7. La vista Focos sólo muestra contexto meteorológico cercano cuando hay un foco seleccionado.
8. Se muestran hasta 6 vecinos y uno se usa como referencia principal.
9. Distancia espacial y diferencia temporal son visibles en el detalle.
10. La vista Meteorología muestra la malla completa para el último frame y permite `Temperatura | Viento | Humedad`.
11. Un foco previamente seleccionado permanece como referencia al entrar a Meteorología.
12. Meteorología se identifica siempre como modelada, no como estación/observación exacta.
13. La UI muestra el caveat explícito de no causalidad/no confirmación de incendio.
14. Open-Meteo/ECMWF queda atribuido de forma visible.
15. `refresh-weather` es independiente de CONAE y no sobrescribe un snapshot válido ante fallos.
16. Un fallo meteorológico no rompe Sismos ni Focos ni produce falsos ceros.
17. No se agrega animación, forecast, GOES, heatmap, ML ni score de riesgo en esta iteración.
18. Tests, TypeScript, build y `git diff --check` pasan antes de merge.
19. El deploy final se verifica contra el SHA exacto mergeado.
