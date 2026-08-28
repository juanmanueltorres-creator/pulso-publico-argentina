# Pulso Público Argentina

**Datos que se mueven. Fuentes que se pueden revisar.**

Pulso Público Argentina es un experimento abierto para mostrar indicadores públicos argentinos sin separar la cifra de su procedencia. Cada señal conserva fuente, fecha, método, estado y limitaciones.

La interfaz toma la idea de los contadores móviles, pero evita presentar una estimación o un dato viejo como si fuera una observación en vivo.

## Estado

V1 está en construcción.

El contrato y la interfaz inicial declaran cuatro familias de señales:

| Categoría | Fuente candidata | Estado V1 |
| --- | --- | --- |
| ⚡ Energía | CAMMESA | fuente declarada; obtención estructurada por confirmar |
| 🔬 Ciencia | OpenAlex | API candidata; adapter siguiente |
| 💡 Innovación | INPI Argentina | CSV oficial por verificar antes de scraping |
| 🗺️ Infraestructura digital pública | Datos Argentina / GeoRef | API candidata; adapter siguiente |

Mientras una fuente no esté integrada y verificada, la UI muestra **Sin dato**. Un error nunca se convierte en `0`.

## Estados de una señal

- `live` — observación realmente actual o casi actual.
- `updated` — último dato publicado por la fuente.
- `estimated` — cálculo derivado y rotulado explícitamente.
- `historical` — snapshot histórico que no pretende actualidad.

La disponibilidad se modela por separado como `available`, `stale` o `unavailable`.

## Arquitectura V1

```text
fuentes públicas
      ↓
adapters / scripts
      ↓
normalización
      ↓
public/data/signals.json
      ↓
React + Vite
```

La aplicación web **no consulta directamente** CAMMESA, INPI, OpenAlex o Datos Argentina. Consume un snapshot público estable. Eso permite que el mismo JSON pueda reutilizarse después desde otra interfaz, incluida GeoPlatform.

No hay backend propio, base de datos, autenticación ni IA runtime en V1.

## Contrato público

Cada señal usa `SignalEnvelope` v1.0 con, como mínimo:

```text
id
category
title
value
unit
periodLabel
status
availability
observedAt
publishedAt
fetchedAt
source
method
limitations
```

`value` puede ser `null` únicamente cuando la fuente está `unavailable`.

El snapshot completo vive en:

```text
/public/data/signals.json
```

## ¿Cómo lo sabemos?

Cada card puede desplegar sus metadatos de procedencia:

- fuente;
- estado del dato;
- fecha observada;
- fecha de consulta;
- método de obtención/transformación;
- limitaciones conocidas.

La intención es que la procedencia sea parte de la experiencia y no una nota al pie.

## Desarrollo

Requiere Node.js 20+.

```bash
npm install
npm run dev
```

Tests:

```bash
npm run test:run
```

Build:

```bash
npm run build
```

GitHub Actions ejecuta test + build en pushes y pull requests.

## Próximos adapters

Primero:

1. GeoRef / Datos Argentina.
2. OpenAlex.
3. INPI, sólo después de confirmar la descarga CSV oficial estable.
4. CAMMESA, privilegiando una fuente estructurada oficial antes que scraping frágil de la visualización en vivo.

Más adelante, **sismos e incendios** son candidatos fuertes porque agregan tiempo + coordenada y pueden convertirse en señales territoriales reutilizables por mapas y GeoPlatform Explorer.

## Principio de integración con GeoPlatform

Pulso Público debe poder vivir solo. GeoPlatform será un consumidor posterior, no una dependencia.

La primera integración prevista es deliberadamente pequeña:

```ts
fetch('.../data/signals.json')
```

Sin tocar FastAPI, Supabase, autenticación ni endpoints existentes.

## Licencia

MIT para el código de este repositorio. Los datos conservan las condiciones y atribución de sus fuentes originales; publicar un snapshot aquí no cambia la licencia del dato fuente.
