# 🇦🇷 Pulso Público Argentina

**Qué está pasando. Dónde. Y cómo lo sabemos.**

Pulso Público Argentina toma señales públicas dispersas entre APIs, planillas, catálogos y sitios oficiales, conserva su procedencia y las publica en una interfaz simple para poder entender no sólo **cuánto**, sino también **dónde ocurrió, cuándo fue observado y qué límites tiene el dato**.

La regla central del proyecto es sencilla:

> **Un dato nunca debe parecer más preciso, reciente o autoritativo que la fuente que lo sostiene.**

👉 **[Ver Pulso Público Argentina](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/)**

> La V2 territorial se desarrolla en `feat/v2-territorial-design`. La URL pública continúa mostrando `main` hasta que exista una decisión explícita de merge y despliegue.

## Dos pulsos, una misma publicación

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

## Cómo interpretar las señales territoriales

### Sismos

El tamaño visual representa **magnitud**. La profundidad, provincia o referencia e intensidad —cuando la fuente la publica— aparecen como contexto en el detalle.

**Magnitud no es una predicción de daños.** Un evento de determinada magnitud no permite inferir por sí solo impacto, riesgo o consecuencias en superficie.

### Focos de calor

Una detección VIIRS representa una **anomalía térmica detectada por satélite**.

**Una anomalía térmica no confirma por sí sola un incendio.** La confianza publicada se interpreta como confianza de detección, no como probabilidad de incendio forestal. FRP se conserva como contexto cuando está disponible, pero V2 no lo transforma en peligro, riesgo, tamaño del marcador ni score sintético.

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

## Datos reutilizables

Pulso Público publica contratos estáticos que pueden consumir otros clientes sin depender de la interfaz React.

### Pulso Nacional

- [`signals.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/signals.json)

### Pulso Territorial

Estos outputs quedan disponibles en GitHub Pages cuando V2 sea autorizada, mergeada y desplegada desde `main`:

- [`earthquakes.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/earthquakes.json)
- [`hotspots.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/hotspots.json)
- [`argentina-provinces.geojson`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/argentina-provinces.geojson)

Los snapshots territoriales incluyen `schemaVersion`, `kind`, `generatedAt`, `sourceCheckedAt`, ventana temporal, política de frescura, fuente oficial, método, limitaciones y eventos normalizados.

## Arquitectura

```text
CAMMESA / OpenAlex / INPI / GeoRef
              ↓
        SignalEnvelope 1.0
              ↓
          signals.json

INPRES → EarthquakeEvent → earthquakes.json -----\
                                                   → black map → React / Vite → GitHub Pages
CONAE  → ThermalHotspotEvent → hotspots.json -----/
                         ↑
                 geometría IGN
```

El navegador no consulta directamente a INPRES, CONAE ni IGN. Los adapters consultan las fuentes fuera del cliente, validan y normalizan la información y publican snapshots versionados en el repositorio. La aplicación consume exclusivamente esos archivos públicos.

## Fuentes y trazabilidad

Las fuentes actuales son:

- **CAMMESA** — energía renovable;
- **OpenAlex** — índice bibliográfico;
- **INPI** — actividad inventiva;
- **Datos Argentina / GeoRef** — infraestructura geográfica pública;
- **INPRES** — sismos recientes;
- **CONAE** — detecciones térmicas VIIRS;
- **IGN** — geometría oficial utilizada para el filtrado territorial.

Cada señal intenta hacer visible la cadena mínima:

```text
dato
→ fuente
→ tiempo
→ método
→ limitaciones
→ interpretación posible
```

Pulso Público no reemplaza a las fuentes oficiales ni convierte las señales en diagnósticos automáticos.

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

Los tests de CI son deterministas y no dependen de que INPRES o CONAE estén disponibles en ese instante. Los proveedores reales se validan mediante smoke checks separados; una falla real se investiga y nunca se maquilla como una publicación vacía exitosa.

## Alcance deliberadamente fuera de V2

V2 no incorpora:

- score de riesgo de incendio;
- uso de FRP como peligro;
- GOES o FIRMS como cross-check;
- overlays meteorológicos o de combustible;
- playback temporal;
- backend propio;
- runtime de IA;
- integración directa con GeoPlatform.

Esas capacidades sólo tienen sentido después de validar esta frontera pública pequeña y trazable.

## Principio del proyecto

**Un dato público sirve más cuando una persona puede entenderlo, ubicarlo, revisarlo y volver a usarlo.**

Pulso Público Argentina intenta construir esa pequeña capa entre la fuente original y la persona que quiere saber qué está pasando, dónde y cómo lo sabemos.
