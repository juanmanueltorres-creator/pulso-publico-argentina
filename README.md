# 🇦🇷 Pulso Público Argentina

**Qué está pasando. Dónde. Y cómo lo sabemos.**

Pulso Público Argentina reúne señales públicas dispersas entre APIs, planillas, catálogos y fuentes oficiales, conserva su procedencia y las publica en una interfaz común para leer **valor + tiempo + territorio + método + límites** sin convertir una señal en una conclusión automática.

> **Un dato nunca debe parecer más preciso, reciente o autoritativo que la fuente que lo sostiene.**

👉 **[Ver aplicación](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/)**

---

## Qué podés explorar

Pulso tiene tres superficies independientes que comparten la misma regla: **mostrar el dato junto con el contexto necesario para interpretarlo**.

| Superficie | Qué muestra | Fuentes principales |
| --- | --- | --- |
| **Pulso Nacional** | Indicadores públicos escalares con período, actualización y procedencia | CAMMESA · OpenAlex · INPI · GeoRef |
| **Pulso Territorial** | Señales con coordenada y tiempo sobre un único mapa de Argentina | INPRES · CONAE · Open-Meteo / ECMWF · IGN |
| **Pulso Evidencia** | Resultados analíticos o relaciones territoriales con método, limitaciones y contexto faltante | AgroENSO y fuentes declaradas |

### Pulso Nacional

Publica cuatro señales de escala nacional:

- ⚡ energía renovable generada — **CAMMESA**;
- 🔬 producción científica indexada — **OpenAlex**;
- 💡 solicitudes de patentes de invención — **INPI**;
- 🗺️ uso histórico de infraestructura geográfica pública — **GeoRef / Datos Argentina**.

Cada señal conserva valor, unidad, período, estado, fecha de observación y fuente. Una consulta nueva no vuelve reciente un dato viejo y una falla de fuente no se convierte en `0`.

### Pulso Territorial

Un mismo mapa permite alternar entre:

- 🌎 **Sismos** — eventos recientes publicados por INPRES;
- 🔥 **Focos de calor** — detecciones térmicas VIIRS publicadas por CONAE;
- 🌬️ **Meteorología** — contexto horario modelado Open-Meteo / ECMWF IFS HRES sobre una malla propia de 0,5°.

El límite nacional usado para filtrar y contextualizar eventos se deriva de geometría oficial de IGN y la pertenencia territorial se resuelve geométricamente, no sólo con un bounding box.

### Pulso Evidencia

Esta superficie está separada de los eventos recientes y de los indicadores nacionales. Su objetivo es presentar una afirmación o relación territorial junto con:

```text
claim
→ territory
→ result
→ provenance
→ method
→ limitations
→ missingContext
```

El primer caso público es **Maíz + El Niño · Villaguay, Entre Ríos**. Pulso conserva una referencia externa de AgroENSO como referencia trazable; no la presenta como cálculo propio ni como pronóstico de rendimiento.

---

## Lo importante no es sólo el valor

Pulso intenta preservar cuatro distinciones simples:

```text
missing != zero
modelled != observed
signal != conclusion
correlation != causality
```

Por eso:

- una detección térmica **no confirma por sí sola un incendio**;
- una magnitud sísmica **no predice daños**;
- meteorología modelada **no es una estación meteorológica**;
- una asociación histórica **no es un pronóstico para una campaña o un lote**;
- una fuente temporalmente caída **no borra un snapshot sano ni fabrica un valor vacío**.

---

## Cómo funciona

Las fuentes se consultan **fuera del navegador**. Los adapters validan y normalizan la información y publican snapshots estáticos versionados. La aplicación React consume esos artifacts públicos.

```text
CAMMESA / OpenAlex / INPI / GeoRef
                ↓
          signals.json

INPRES ───────────────→ earthquakes.json ─┐
CONAE ────────────────→ hotspots.json ────┼→ mapa territorial
Open-Meteo / ECMWF ──→ weather.json ──────┘
                          ↑
                    geometría IGN

fuentes analíticas
        ↓
 TerritorialEvidence
        ↓
   evidence.json

        ↓
 React + MapLibre
        ↓
   GitHub Pages
```

Los pipelines son independientes: una falla meteorológica no invalida un snapshot sísmico o térmico sano, y una falla de `evidence.json` no impide que las otras superficies sigan disponibles.

---

## Datos públicos reutilizables

La interfaz no es la única salida del proyecto. Los snapshots pueden ser consumidos por otros clientes:

### Nacional

- [`signals.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/signals.json)

### Territorial

- [`earthquakes.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/earthquakes.json)
- [`hotspots.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/hotspots.json)
- [`weather.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/weather.json)
- [`argentina-provinces.geojson`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/argentina-provinces.geojson)

### Evidencia

- [`evidence.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/evidence.json)
- [`villaguay.geojson`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/evidence/territories/villaguay.geojson)
- [`villaguay.source.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/evidence/territories/villaguay.source.json)

Los contratos conservan metadata de procedencia, generación, observación, método y limitaciones para que el artifact pueda interpretarse fuera de la UI.

---

## Stack

`React 19` · `TypeScript` · `MapLibre GL` · `Vite` · `Vitest` · `GitHub Actions`

No hay un backend propio requerido para servir la aplicación pública: los adapters y workflows producen artifacts estáticos que GitHub Pages publica junto con el frontend.

---

## Ejecutar localmente

```bash
npm install
npm run dev
```

Verificación local:

```bash
npm run test:run
npm run build
```

Refresh manual de fuentes cuando corresponde:

```bash
npm run refresh:georef
npm run refresh:openalex
npm run refresh:inpi
npm run refresh:inpres
npm run refresh:conae
npm run refresh:weather
```

La geometría oficial usada por el proyecto se actualiza mediante:

```bash
npm run data:argentina-boundary
```

---

## Fuentes y límites

Las familias de fuentes actuales incluyen **CAMMESA, OpenAlex, INPI, Datos Argentina / GeoRef, INPRES, CONAE, IGN, Open-Meteo / ECMWF IFS HRES, AgroENSO, MAGyP y NOAA CPC / ONI**.

Pulso no reemplaza a las fuentes originales y no convierte señales públicas, modelos meteorológicos o asociaciones históricas en diagnósticos automáticos.

Algunos límites deliberados del proyecto actual:

- no hay predicción de propagación de incendios;
- no hay pronóstico agrícola por lote o campaña;
- no hay score sintético de riesgo o confiabilidad;
- no hay causalidad inferida entre meteorología y focos térmicos;
- no hay runtime de IA;
- no hay integración directa con GeoPlatform.

La metodología, decisiones de diseño y contratos más detallados viven en [`docs/`](docs/), incluyendo [`docs/specs/`](docs/specs/) y [`docs/superpowers/`](docs/superpowers/).

---

## Principio del proyecto

**Un dato público sirve más cuando una persona puede entenderlo, ubicarlo, revisar de dónde salió y volver a usarlo.**

Pulso Público Argentina construye esa capa intermedia entre la fuente original y la persona que quiere saber **qué está pasando, dónde y cómo lo sabemos**.
