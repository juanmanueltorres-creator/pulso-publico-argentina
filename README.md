# 🇦🇷 Pulso Público Argentina

**Qué está pasando. Dónde. Y cómo lo sabemos.**

Pulso Público Argentina toma señales públicas dispersas entre APIs, planillas, catálogos y sitios oficiales, conserva su procedencia y las publica en una interfaz simple para poder entender no sólo **cuánto**, sino también **dónde ocurrió, cuándo fue observado, cómo fue construido y qué límites tiene el dato**.

La regla central del proyecto es sencilla:

> **Un dato nunca debe parecer más preciso, reciente o autoritativo que la fuente que lo sostiene.**

👉 **[Ver Pulso Público Argentina](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/)**

## Tres pulsos, una misma publicación

### Pulso Nacional

Conserva las cuatro señales escalares de V1 y el contrato `SignalEnvelope 1.0`:

- ⚡ **CAMMESA** — energía renovable generada, usando la base mensual oficial.
- 🔬 **OpenAlex** — trabajos indexados del año con al menos una afiliación institucional argentina.
- 💡 **INPI** — solicitudes de patentes de invención ingresadas durante el último mes calendario completo disponible.
- 🗺️ **GeoRef / Datos Argentina** — consultas históricas acumuladas a la infraestructura pública GeoRef.

Cada tarjeta conserva valor, unidad, período, estado, disponibilidad, fechas relevantes, fuente, método y limitaciones. Una consulta hecha hoy no vuelve actual una observación vieja y una fuente fallida nunca se convierte en un `0` inventado.

### Pulso Territorial

La V2 agrega señales que tienen **valor + tiempo + coordenada** y las representa sobre un único mapa de Argentina:

- 🌎 **INPRES — sismos registrados durante los últimos 7 días (168 h)**.
- 🔥 **CONAE — detecciones térmicas VIIRS durante las últimas 24 h**.

El límite nacional utilizado para filtrar eventos se deriva de geometría oficial de **IGN** y la pertenencia a Argentina se determina mediante point-in-polygon sobre esa geometría, no sólo mediante un bounding box.

El mapa mantiene una sola instancia MapLibre para `Sismos` y `Focos de calor`, preserva el viewport al cambiar de modo y permite seleccionar eventos para leer sus detalles fuera del canvas.

### Pulso Evidencia

La V3 agrega una tercera familia independiente para resultados analíticos o relaciones territoriales que no deben fingir ser eventos recientes ni simples contadores.

Su contrato público es `EvidenceSnapshot 1.0` y cada `TerritorialEvidence` separa explícitamente:

```text
claim
→ territory
→ result
→ provenance
→ method
→ limitations
→ missingContext
```

El primer caso es **Maíz + El Niño · Villaguay, Entre Ríos**, identificado por el código territorial oficial `30113`.

Pulso conserva una referencia externa de AgroENSO cercana a **+24%** para Villaguay durante fases El Niño. Ese valor se publica como `external-reference`: **no fue calculado ni reproducido por Pulso**. La significancia estadística individual permanece sin afirmar (`null`) mientras no exista una verificación pública explícita para ese departamento.

**Una asociación histórica no es un pronóstico de rendimiento.** Para interpretar una campaña o un lote concreto todavía hacen falta, entre otros factores, agua útil, suelo, napa, posición en el paisaje, fecha de siembra, estado del cultivo y meteorología reciente.

## Cómo interpretar las señales territoriales

### Sismos

El tamaño visual representa **magnitud**. La profundidad, provincia o referencia e intensidad —cuando la fuente la publica— aparecen como contexto en el detalle.

**Magnitud no es una predicción de daños.** Un evento de determinada magnitud no permite inferir por sí solo impacto, riesgo o consecuencias en superficie.

### Focos de calor

Una detección VIIRS representa una **anomalía térmica detectada por satélite**.

**Una anomalía térmica no confirma por sí sola un incendio.** La confianza publicada se interpreta como confianza de detección, no como probabilidad de incendio forestal. FRP se conserva como contexto cuando está disponible, pero Pulso no lo transforma en peligro, riesgo ni score sintético.

En clusters de focos, el tamaño representa cantidad de detecciones y el tono representa la proporción de detecciones con confianza alta. Los umbrales visuales son categorías de legibilidad, no umbrales oficiales de riesgo.

## Frescura y fallos de fuente

INPRES y CONAE tienen pipelines independientes.

- ventana INPRES: **168 horas**;
- ventana CONAE: **24 horas**;
- revisión prevista de cada fuente territorial: **cada hora**;
- heartbeat de publicación cuando no cambian los eventos: **180 minutos**;
- un snapshot pasa a estado stale a los **240 minutos** desde `sourceCheckedAt`;
- una falla HTTP, de red, parser o validación **no sobrescribe** el último snapshot sano con un array vacío;
- una consulta exitosa sí puede publicar legítimamente `events: []` cuando la fuente realmente devuelve cero eventos dentro de la ventana.

La interfaz trata los estados de INPRES y CONAE por separado: una fuente temporalmente no disponible no borra ni falsea la otra.

`Pulso Evidencia` también carga su snapshot de forma independiente. Si `/data/evidence.json` falla o no valida, la sección falla cerrada sin fabricar `0`, una evidencia vacía o una conclusión sustituta; Pulso Nacional y Pulso Territorial pueden seguir funcionando.

## Datos reutilizables

Pulso Público publica contratos estáticos que pueden consumir otros clientes sin depender de la interfaz React.

### Pulso Nacional

- [`signals.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/signals.json)

### Pulso Territorial

- [`earthquakes.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/earthquakes.json)
- [`hotspots.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/hotspots.json)
- [`argentina-provinces.geojson`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/argentina-provinces.geojson)

Los snapshots territoriales incluyen `schemaVersion`, `kind`, `generatedAt`, `sourceCheckedAt`, ventana temporal, política de frescura, fuente oficial, método, limitaciones y eventos normalizados.

### Pulso Evidencia

- [`evidence.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/evidence.json)
- [`villaguay.geojson`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/evidence/territories/villaguay.geojson)
- [`villaguay.source.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/evidence/territories/villaguay.source.json)

La geometría de Villaguay es una simplificación explícitamente documentada para referencia territorial. La identidad administrativa se conserva mediante el código `30113`; no se usa el nombre del departamento como clave de join.

## Referencia externa vs reproducción

`TerritorialEvidence.provenance.resultKind` distingue dos situaciones:

- `external-reference`: Pulso conserva y presenta un resultado publicado por otra fuente, con su procedencia y sus límites;
- `reproduced`: reservado para un resultado que Pulso haya reconstruido mediante un pipeline propio verificable.

V3.0 utiliza exclusivamente la primera opción para AgroENSO. No se atribuye a Pulso el cálculo de `+24%`.

La primera candidata para V3.1 es una reproducción verificable basada en **MAGyP + NOAA ONI**, comparada contra AgroENSO sin sobrescribir la referencia externa original.

## Arquitectura

```text
CAMMESA / OpenAlex / INPI / GeoRef
              ↓
        SignalEnvelope 1.0
              ↓
          signals.json

INPRES → EarthquakeEvent → earthquakes.json -----\
                                                   → black map
CONAE  → ThermalHotspotEvent → hotspots.json -----/
                         ↑
                 geometría IGN

AgroENSO / fuentes declaradas
              ↓
       TerritorialEvidence
              ↓
          evidence.json
              ↓
  Qué sabemos / Qué significa /
  Qué falta / Cómo lo sabemos

              ↓
        React / Vite
              ↓
        GitHub Pages
```

El navegador no consulta directamente a INPRES, CONAE ni IGN para construir los snapshots territoriales. Los adapters consultan las fuentes fuera del cliente, validan y normalizan la información y publican snapshots versionados en el repositorio. La aplicación consume esos archivos públicos.

En V3.0, AgroENSO se consume como **referencia pública trazable**, no mediante scraping de su interfaz y no como API implícita.

## Fuentes y trazabilidad

Las fuentes actuales incluyen:

- **CAMMESA** — energía renovable;
- **OpenAlex** — índice bibliográfico;
- **INPI** — actividad inventiva;
- **Datos Argentina / GeoRef** — infraestructura geográfica pública;
- **INPRES** — sismos recientes;
- **CONAE** — detecciones térmicas VIIRS;
- **IGN** — geometría oficial utilizada para el filtrado territorial;
- **AgroENSO** — referencia analítica histórica del primer caso de Pulso Evidencia;
- **MAGyP** — rendimientos agrícolas departamentales declarados por AgroENSO;
- **NOAA CPC / ONI** — clasificación histórica ENSO declarada por AgroENSO.

Cada señal o evidencia intenta hacer visible una cadena mínima:

```text
dato o afirmación
→ fuente
→ territorio / tiempo
→ método
→ limitaciones
→ contexto faltante
→ interpretación posible
```

Pulso Público no reemplaza a las fuentes oficiales ni convierte señales o asociaciones históricas en diagnósticos automáticos.

## Desarrollo

```bash
npm install
npm run dev
npm run test:run
npm run build
```

Refresh manual de fuentes:

```bash
npm run refresh:georef
npm run refresh:openalex
npm run refresh:inpi
npm run refresh:inpres
npm run refresh:conae
```

Actualización de la geometría oficial de Argentina:

```bash
npm run data:argentina-boundary
```

CAMMESA utiliza la base mensual oficial en XLSX y su camino operativo principal continúa siendo el workflow `Refresh CAMMESA` de GitHub Actions.

Los pipelines nacionales y territoriales conservan sus propias frecuencias según la cadencia de la fuente. Los refreshes que escriben un mismo snapshot utilizan grupos de concurrencia para evitar escrituras simultáneas.

## Verificación

CI usa Node 24 y ejecuta:

```text
python3 scripts/cammesa_xlsx_test.py
npm install --no-audit --no-fund
npm run test:run
npm run build
```

Los tests de CI son deterministas y no dependen de que INPRES, CONAE o AgroENSO estén disponibles en ese instante. Los snapshots públicos checked-in se validan como contratos; una falla real se investiga y nunca se maquilla como una publicación vacía exitosa.

## Alcance deliberadamente fuera de V3.0

V3.0 no incorpora:

- reproducción estadística completa de AgroENSO;
- pronóstico de rendimiento por campaña o lote;
- score sintético de riesgo, confianza o confiabilidad;
- mapa o selector agrícola completo;
- GOES o FIRMS como cross-check de focos térmicos;
- overlays meteorológicos o de combustible;
- playback temporal;
- backend propio para Pulso Evidencia;
- runtime de IA;
- integración directa con GeoPlatform.

Esas capacidades sólo tienen sentido después de validar esta frontera pública pequeña, trazable y reutilizable.

## Principio del proyecto

**Un dato público sirve más cuando una persona puede entenderlo, ubicarlo, revisarlo y volver a usarlo.**

Pulso Público Argentina intenta construir esa pequeña capa entre la fuente original y la persona que quiere saber qué está pasando, dónde y cómo lo sabemos.
