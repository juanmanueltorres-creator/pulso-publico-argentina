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
- **INPI** — pendiente de confirmar descarga CSV estable antes de implementar.
- **CAMMESA** — pendiente de confirmar una fuente estructurada estable; no se promete `live` mientras eso no esté verificado.

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

## Desarrollo

```bash
npm install
npm run dev
npm run test:run
npm run build
```

Refresh manual de las fuentes implementadas:

```bash
npm run refresh:georef
npm run refresh:openalex
```

GitHub Actions ejecuta tests/build y refresca GeoRef y OpenAlex cada 12 horas. Los workflows comparten el concurrency group `refresh-signals` para no escribir `signals.json` en paralelo.

## Estado verificado

### GeoRef

El refresh real recuperó **264.037.620 consultas acumuladas** con `observedAt = 2024-08-27`. La fuente respondió correctamente en 2026, pero Pulso Público no confunde fecha de consulta con fecha de observación: esa señal se publica como histórica y stale.

### OpenAlex

El primer refresh real recuperó **27.994 works** para `publication_year:2026` con `institutions.country_code:AR`. La semántica pública es: **works indexados por OpenAlex con al menos una afiliación institucional argentina · 2026**.

Los próximos source slices son **INPI** y **CAMMESA**, ambos condicionados a verificar primero una fuente estructurada estable.
