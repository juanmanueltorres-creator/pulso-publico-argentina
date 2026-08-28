# Pulso Público Argentina

Indicadores públicos de Argentina con fuentes, trazabilidad y metodología abierta. Datos simples, verificables y reutilizables.

## V1

La primera versión usa una arquitectura estática y desacoplada:

```text
fuente pública
→ adapter
→ SignalEnvelope
→ public/data/signals.json
→ React / Vite
```

No hay backend propio, base de datos ni credenciales expuestas en el navegador.

## Señales

- **GeoRef / Datos Argentina** — integrada end-to-end mediante la API oficial de Series de Tiempo (`apis_georef_005`). El último valor publicado recuperado actualmente es histórico, por lo que se conserva pero se muestra como `historical` + `stale`.
- **OpenAlex** — integrada end-to-end con el conteo `meta.count` de works del año actual que tienen al menos una afiliación institucional argentina. Se muestra como índice bibliográfico, nunca como censo total de la ciencia argentina.
- **INPI** — integrada end-to-end mediante el endpoint JSON que usa el dashboard oficial de ingresos de patentes. La señal publica el último mes calendario completo y excluye automáticamente el mes en curso.
- **CAMMESA** — integrada end-to-end mediante la base mensual oficial de Energía Renovables. El pipeline descarga el ZIP oficial, lee el XLSX con librerías estándar de Python y toma el `Total GWh` ya agregado por CAMMESA desde `Tabla Resumen Global`. Se muestra como `updated`, nunca como `live`.

## Trazabilidad

Cada señal conserva:

- valor y unidad;
- período explícito;
- `observedAt`, `publishedAt` y `fetchedAt` cuando corresponda;
- fuente;
- método;
- limitaciones;
- estado y disponibilidad.

Un fetch exitoso no vuelve actual a una observación vieja. Para la señal semanal de GeoRef, una observación con más de 14 días se clasifica como `historical` + `stale`.

OpenAlex es distinto: el conteo se calcula al momento de consultar su índice, por lo que `observedAt` coincide con `fetchedAt`; aun así se rotula `updated`, no `live`, porque la indexación puede tener rezago y correcciones retroactivas.

INPI publica datos mensuales y puede incluir el mes en curso con valores todavía parciales. Pulso Público sólo toma el último mes calendario completo: un `0` del mes abierto no se interpreta como ausencia de solicitudes.

CAMMESA también es mensual. Pulso Público no recompone la generación sumando centrales o máquinas: conserva el total agregado que publica la propia fuente. El pipeline usa un enlace oficial estable de descarga, reintentos de red y falla de forma explícita si el archivo deja de contener el workbook, la hoja o la fila esperada.

## Desarrollo

```bash
npm install
npm run dev
npm run test:run
npm run build
```

Refresh manual de las fuentes con CLI propio:

```bash
npm run refresh:georef
npm run refresh:openalex
npm run refresh:inpi
```

CAMMESA requiere además descargar y extraer el workbook oficial, por lo que su camino operativo principal es el workflow `Refresh CAMMESA` de GitHub Actions.

GitHub Actions ejecuta tests/build. GeoRef y OpenAlex refrescan cada 12 horas; INPI y CAMMESA refrescan una vez por día porque sus fuentes son mensuales. Todos los workflows de datos comparten el concurrency group `refresh-signals` para no escribir `signals.json` en paralelo.

## Estado verificado

### GeoRef

El refresh real recuperó **264.037.620 consultas acumuladas** con `observedAt = 2024-08-27`. La fuente respondió correctamente en 2026, pero Pulso Público no confunde fecha de consulta con fecha de observación: esa señal se publica como histórica y stale.

### OpenAlex

El primer refresh real recuperó **27.994 works** para `publication_year:2026` con `institutions.country_code:AR`. La semántica pública es: **works indexados por OpenAlex con al menos una afiliación institucional argentina · 2026**.

### INPI

El endpoint estructurado usado por el dashboard oficial devolvió registros mensuales con los campos `Mes`, `Modelo de Utilidad` y `Patente de Invencion`. El primer refresh real publicó **323 solicitudes de patentes de invención ingresadas · Julio 2026**, el último mes calendario completo disponible. Agosto 2026 aparecía con valor `0`, pero fue excluido por ser un período todavía abierto.

### CAMMESA

La investigación de fuente descartó para V1 el feed embebido de `Renovables Hoy` porque no resultó suficientemente confiable desde runners automatizados. Se eligió la base mensual oficial como camino robusto.

El primer refresh end-to-end descargó **`Energía Renovables - Base de Datos 2026-07`** y publicó **1.791,245147 GWh de energía renovable generada · Julio 2026**. El valor proviene de `Tabla Resumen Global → Total GWh`; Pulso Público no lo recalcula. La señal queda `updated` + `available` y declara explícitamente que no representa generación en tiempo real.

Con estas cuatro fuentes, el snapshot V1 ya demuestra cuatro situaciones distintas de evidencia pública: API oficial con dato histórico, índice abierto actualizado, endpoint estructurado de dashboard oficial y archivo XLSX oficial mensual.
