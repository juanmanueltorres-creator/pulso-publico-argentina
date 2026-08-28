# 🇦🇷 Pulso Público Argentina

**Datos públicos para entender mejor qué está pasando en Argentina.**

Hay muchísima información pública disponible, pero muchas veces está repartida entre APIs, planillas, dashboards y sitios difíciles de leer.

Pulso Público toma algunos de esos datos, conserva su fuente y su fecha, y los presenta de una forma que permita entender no sólo **cuánto**, sino también **qué significa y por qué importa**.

👉 **[Ver Pulso Público Argentina](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/)**

## ¿Para qué sirve?

La idea es simple: que una persona no tenga que ser especialista para entender un dato público.

Un estudiante puede ver cuánta energía renovable se generó y hacerse una idea de su escala. Un docente puede usar un dato científico en clase. Un periodista puede revisar la fuente original. Un desarrollador puede reutilizar el snapshot público. Y cualquier persona puede abrir **¿Cómo lo sabemos?** para ver de dónde salió cada número, cuándo fue observado y qué limitaciones tiene.

Pulso Público no intenta convertir cualquier número en una buena noticia. Si un dato no alcanza para decir que algo mejoró, no lo dice. El objetivo es mostrar señales valiosas de forma clara, sin perder el contexto que permite interpretarlas.

## ¿Qué muestra hoy?

La V1 reúne cuatro señales distintas:

- ⚡ **Energía renovable** — cuánto generaron las fuentes renovables según CAMMESA y cómo imaginar esa cantidad en una escala cotidiana.
- 🔬 **Ciencia** — trabajos indexados por OpenAlex vinculados con instituciones argentinas, como una ventana a la capacidad científica del país.
- 💡 **Actividad inventiva** — solicitudes de patentes de invención ingresadas al INPI durante el último mes completo disponible.
- 🗺️ **Infraestructura digital pública** — uso acumulado de GeoRef / Datos Argentina, mostrando también cuando el último dato oficial disponible es antiguo.

Cada tarjeta intenta responder tres preguntas:

**¿Qué pasó? → ¿Qué significa? → ¿Cómo lo sabemos?**

## Fuentes y trazabilidad

Los datos vienen de fuentes públicas y abiertas. En esta primera versión usamos:

- **CAMMESA** para energía renovable;
- **OpenAlex** para producción científica vinculada con instituciones argentinas;
- **INPI** para solicitudes de patentes de invención;
- **Datos Argentina / GeoRef** para uso de la infraestructura geográfica pública.

Cada señal conserva su valor, unidad, período, fuente, método, fechas relevantes y limitaciones.

Una descarga hecha hoy no convierte automáticamente en actual un dato observado hace años. Un `0` en un mes todavía abierto no se trata como si significara que no pasó nada. Y un dato mensual no se presenta como si estuviera cambiando en tiempo real.

Ese criterio es parte del producto: **el número importa, pero también importa saber qué representa y hasta dónde se puede confiar en él.**

## Datos reutilizables

La interfaz consume un snapshot JSON público y versionado:

👉 **[Ver `signals.json`](https://juanmanueltorres-creator.github.io/pulso-publico-argentina/data/signals.json)**

Esto permite que la misma información pueda reutilizarse más adelante en otras visualizaciones, proyectos educativos o plataformas sin depender de esta interfaz.

## Cómo funciona

Pulso Público es deliberadamente simple. No necesita un backend propio para mostrar la V1:

```text
fuente pública
→ adapter
→ SignalEnvelope
→ public/data/signals.json
→ React / Vite
→ GitHub Pages
```

Los adapters consultan o descargan cada fuente, normalizan los datos y generan el mismo contrato de salida. GitHub Actions refresca las fuentes automáticamente y vuelve a publicar la web cuando cambia el snapshot.

Los errores de una fuente no se reemplazan por números inventados. Si algo no se pudo obtener o quedó viejo, el estado se muestra como tal.

## Desarrollo

```bash
npm install
npm run dev
npm run test:run
npm run build
```

Refresh manual de las fuentes disponibles por CLI:

```bash
npm run refresh:georef
npm run refresh:openalex
npm run refresh:inpi
```

CAMMESA utiliza la base mensual oficial en XLSX y su camino operativo principal es el workflow `Refresh CAMMESA` de GitHub Actions.

GeoRef y OpenAlex se consultan cada 12 horas. INPI y CAMMESA se revisan una vez por día porque sus fuentes publican datos con una frecuencia mucho menor. Los refreshes comparten un mismo lock para evitar que dos procesos intenten escribir `signals.json` al mismo tiempo.

## Principio del proyecto

**Un dato público sirve más cuando una persona puede entenderlo, revisarlo y volver a usarlo.**

Pulso Público Argentina busca construir justamente esa pequeña capa entre la fuente original y la persona que quiere saber qué está pasando.
