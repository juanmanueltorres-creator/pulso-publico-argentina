# Pulso Público V3.1 — Enmienda de operación Open-Meteo

**Fecha:** 2026-08-28  
**Estado:** aprobada durante implementación  
**Aplica a:** `2026-08-28-pulso-hotspot-weather-context-design.md` y `2026-08-28-pulso-hotspot-weather-context.md`

## Motivo

La primera validación live del pipeline nacional llegó correctamente hasta `npm run refresh:weather`, pero Open-Meteo respondió HTTP 429 durante el recorrido de la malla de 0,5°. El pipeline fail-closed funcionó: no se publicó un snapshot parcial ni se sustituyó un archivo válido.

Open-Meteo documenta límites operativos para la API gratuita. Mantener una consulta nacional completa cada hora no aporta suficiente valor frente al costo de cuota y aumenta la probabilidad de rate limiting.

## Decisión aprobada

Esta enmienda reemplaza las partes del diseño/plan que indiquen refresh horario o stale de 180 minutos:

1. El snapshot sigue conteniendo **24 frames horarios**; no se reduce la resolución temporal de los datos publicados.
2. La ingestión nacional se ejecuta **cada 6 horas** mediante `cron: '17 */6 * * *'`.
3. `freshness.staleAfterMinutes` pasa de `180` a **`480` minutos** para tolerar un ciclo fallido sin declarar stale prematuramente.
4. Se conserva la malla nacional de **0,5°**; no se reduce densidad para ahorrar cuota.
5. Los batches continúan siendo secuenciales y agregan **pacing entre lotes**.
6. HTTP 429 y errores transitorios 5xx pueden reintentarse con backoff acotado; errores permanentes y agotamiento de retries continúan fallando toda la generación.
7. La escritura sigue siendo atómica y fail-closed: un 429 nunca produce `weather.json` parcial, vacío ni sintético.
8. El workflow meteorológico continúa independiente de CONAE.

## Parámetros iniciales de implementación

- batch size: hasta 100 puntos;
- pausa entre batches: 12 segundos;
- retries transitorios: máximo 2 por batch;
- `Retry-After`: se respeta cuando está presente;
- fallback de retry para 429: 60 segundos;
- timeout HTTP por request: 20 segundos;
- timeout total del job: 10 minutos.

Estos valores son controles operativos, no semántica científica ni parte del contrato público `WeatherSnapshot 1.0` salvo `staleAfterMinutes = 480`.

## Criterio de validación

Antes de continuar con matching/UI debe existir al menos una generación live completa de `public/data/weather.json` que:

- cubra todos los puntos esperados de la malla;
- contenga exactamente 24 timestamps comunes;
- pase `validateWeatherSnapshot`;
- conserve `null` sin coerción a cero;
- se publique sólo después de completar todos los batches.
