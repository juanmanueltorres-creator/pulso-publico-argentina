# Pulso Público V3 — Evidencia Territorial

**Fecha:** 2026-08-28  
**Estado:** diseño aprobado en conversación; implementación pendiente de revisión escrita  
**Rama:** `feat/pulso-evidence-v3`

## 1. Propósito

Agregar a Pulso Público una tercera familia de información que no represente ni un indicador nacional escalar ni un evento territorial puntual, sino una **evidencia territorial analítica**: una afirmación localizada cuya lectura conserva resultado, territorio, tiempo, procedencia, método, limitaciones y contexto faltante.

La primera evidencia será un caso agrícola inspirado en AgroENSO:

- cultivo: maíz;
- condición: fase El Niño;
- territorio: departamento Villaguay, Entre Ríos, Argentina;
- tipo de afirmación: asociación histórica;
- resultado inicial: referencia externa publicada, no cálculo propio de Pulso.

La regla de interpretación central es:

> **Asociación histórica no equivale a pronóstico de rendimiento.**

## 2. Relación con V1 y V2

Pulso conserva sin cambios sus contratos existentes:

- `SignalEnvelope 1.0` para Pulso Nacional;
- `TerritorialSnapshot 1.0` para eventos recientes como sismos y detecciones térmicas.

V3 agrega un tercer contrato independiente:

```text
Pulso Nacional
SignalEnvelope -> signals.json

Pulso Territorial
TerritorialSnapshot -> earthquakes.json / hotspots.json

Pulso Evidencia
EvidenceSnapshot -> evidence.json
```

No se agregará `agro-climate-association` a `TerritorialKind`, porque una asociación construida a partir de campañas históricas no tiene un único `occurredAt` ni una ventana reciente comparable con un sismo o una detección térmica.

Tampoco se reutilizará `SignalEnvelope`, porque un único valor no alcanza para representar territorio, significancia, insumos, método y contexto faltante.

## 3. Relación con el contrato de evidencia de GeoPlatform

El `Contrato de evidencia territorial v1` del vault sigue siendo el contrato operacional rico de GeoPlatform. Incluye revisión, movilización, corredor, control de acceso, revisión humana y linaje asociado a decisiones operativas.

Pulso no copiará ese contrato completo. V3 implementará una proyección pública mínima con la misma disciplina conceptual:

```text
fuente
+ tiempo
+ territorio
+ método
+ limitaciones
+ procedencia
+ contexto faltante
```

No habrá `review_id`, `mobilization_id`, `organization_scope`, roles ni estados de decisión en Pulso V3.

## 4. Contrato público

### 4.1 `EvidenceSnapshot`

```ts
export interface EvidenceSnapshot {
  schemaVersion: '1.0'
  generatedAt: string
  evidences: TerritorialEvidence[]
}
```

### 4.2 `TerritorialEvidence`

```ts
export interface TerritorialEvidence {
  id: string

  claim: {
    type: 'historical-association'
    title: string
    statement: string
  }

  territory: {
    countryCode: 'AR'
    province: string
    adminLevel: 'department'
    adminName: string
    adminCode: string
    geometryRef: string
  }

  subject: {
    domain: 'agriculture'
    variable: string
    condition: string
  }

  result: {
    value: number | null
    unit: string
    interpretation: string
    statisticalSignificance: boolean | null
  }

  temporalContext: {
    coverage: string
    observedAt: null
    freshness: 'historical'
  }

  provenance: {
    resultKind: 'external-reference' | 'reproduced'
    analysisName: string
    authors: string[]
    sourceUrl: string
    inputs: EvidenceInput[]
  }

  method: {
    summary: string
    processingSteps: string[]
  }

  limitations: string[]
  missingContext: string[]
}

export interface EvidenceInput {
  role: string
  sourceName: string
  sourceUrl: string
}
```

### 4.3 Invariantes

1. `claim` y `result` son conceptos separados. El número nunca sustituye a la afirmación que se está evaluando.
2. `provenance.resultKind` indica explícitamente si el resultado es una referencia externa o una reproducción propia.
3. `territory.adminCode` es obligatorio. El nombre humano no se usa como clave de unión.
4. `limitations` describe hasta dónde llega la evidencia.
5. `missingContext` describe qué información adicional sería necesaria para contestar una pregunta más concreta sobre una campaña, lote o decisión actual.
6. No existe un score genérico de confianza, riesgo, autoridad o calidad.
7. Un resultado externo nunca se presenta como calculado por Pulso.
8. Si el valor numérico publicado no puede verificarse de forma trazable, `result.value` debe ser `null`; la UI no inventará un número.

## 5. Primer caso: Villaguay

La primera instancia pública debe representar:

- `claim.type = historical-association`;
- maíz como variable agrícola;
- El Niño como condición;
- Villaguay como departamento de Entre Ríos;
- código administrativo oficial verificado antes de publicar;
- geometría departamental vinculada mediante `geometryRef`;
- AgroENSO como análisis de referencia externa;
- MAGyP, NOAA ONI e IGN como insumos declarados cuando estén respaldados por la documentación pública de la referencia;
- resultado marcado `external-reference`;
- limitación explícita: no es un pronóstico de rendimiento del lote ni de una campaña actual.

El valor numérico y la significancia sólo se publican si se verifican contra una referencia pública identificable. Si la referencia no permite sostener alguno de esos campos, el contrato conserva `null` y la UI lo expresa como información no disponible.

## 6. Geometría

V3 no incorpora todavía un mapa agrícola nacional ni todos los departamentos del país.

Se publicará únicamente la geometría necesaria para el caso inicial:

```text
/public/data/evidence/territories/villaguay.geojson
```

Debe provenir de una fuente territorial oficial o de una API pública oficial que preserve el código administrativo. El archivo tendrá metadatos de fuente verificables y no se construirá a partir de un join por nombre.

`territory.geometryRef` apuntará al recurso público versionado dentro de Pulso.

## 7. Publicación de datos

Nuevo output:

```text
/public/data/evidence.json
```

La primera versión es un snapshot histórico revisado, no un feed horario. No se crea un GitHub Action periódico en esta iteración.

El navegador seguirá sin consultar directamente las fuentes upstream. React consume exclusivamente los snapshots públicos versionados.

## 8. UI mínima

Se agrega una tercera sección debajo de `Pulso Territorial`:

```text
RELACIÓN + TERRITORIO + EVIDENCIA
Pulso Evidencia
Qué relaciones conocemos, dónde aplican y cómo fueron construidas.
```

La primera iteración muestra una sola evidencia mediante un componente dedicado, sin selector de cultivos ni dashboard agrícola general.

La tarjeta debe hacer visibles cuatro bloques:

### Qué sabemos

- título de la afirmación;
- territorio;
- resultado reportado, si está disponible;
- indicación explícita de `Referencia externa`;
- significancia estadística sólo cuando la fuente la respalde.

### Qué significa

Texto de interpretación estrictamente descriptivo. Debe incluir que se trata de una asociación histórica y no de un pronóstico.

### Qué falta

Renderiza `missingContext`, por ejemplo agua útil, suelo, napa, fecha de siembra, estado del cultivo y meteorología reciente cuando esos faltantes estén justificados para el caso.

### Cómo lo sabemos

- análisis de referencia;
- autores;
- fuentes de entrada;
- período cubierto;
- resumen del método;
- limitaciones;
- enlaces verificables.

La UI no usa semáforos de riesgo, puntuaciones sintéticas ni lenguaje predictivo.

## 9. Componentes y archivos previstos

El diseño busca mantener unidades pequeñas y aisladas.

```text
src/types/evidence.ts
src/lib/validateEvidenceSnapshot.ts
src/lib/validateEvidenceSnapshot.test.ts
src/lib/loadEvidence.ts
src/lib/loadEvidence.test.ts
src/components/EvidenceSection.tsx
src/components/EvidenceSection.test.tsx
src/components/EvidenceCard.tsx
src/components/EvidenceCard.test.tsx
public/data/evidence.json
public/data/evidence/territories/villaguay.geojson
src/App.tsx
src/App.test.tsx
src/styles.css
README.md
```

Si durante implementación se descubre que la validación o la geometría requieren una frontera adicional, se agregará una unidad dedicada en lugar de inflar `App.tsx` o `EvidenceCard.tsx`.

## 10. Carga y aislamiento de fallos

`Pulso Evidencia` carga su snapshot de manera independiente de Pulso Nacional y Pulso Territorial.

Reglas:

- si falla `signals.json`, Evidencia puede seguir visible;
- si falla `evidence.json`, Nacional y Territorial siguen funcionando;
- un fallo de carga no se transforma en evidencia vacía presentada como verdad;
- `result.value = null` se renderiza como dato no disponible, nunca como `0`;
- campos inválidos hacen fallar la validación del snapshot antes de renderizar la evidencia;
- un error de geometría no autoriza a degradar silenciosamente el territorio a un join por nombre.

## 11. Validación

`validateEvidenceSnapshot` debe ser fail-closed y verificar como mínimo:

- `schemaVersion === '1.0'`;
- fecha `generatedAt` válida;
- IDs no vacíos y únicos;
- `claim.type` dentro del vocabulario permitido;
- `countryCode === 'AR'` para V3;
- `adminLevel === 'department'`;
- `adminCode` no vacío;
- `geometryRef` no vacío;
- `result.value` número finito o `null`;
- `statisticalSignificance` boolean o `null`;
- `freshness === 'historical'`;
- `resultKind` válido;
- URLs de procedencia no vacías;
- listas `limitations` y `missingContext` presentes;
- prohibición de convertir un resultado `external-reference` en texto que afirme que fue calculado por Pulso.

## 12. Testing

Implementación por TDD.

### Contrato

Tests de validación para snapshot sano y casos inválidos: versión incorrecta, ID duplicado, código territorial ausente, resultado no finito, procedencia incompleta y arrays obligatorios ausentes.

### Loader

- carga correcta de `/data/evidence.json`;
- error HTTP produce rechazo;
- JSON inválido produce rechazo;
- snapshot semánticamente inválido produce rechazo.

### UI

La evidencia Villaguay debe mostrar:

- `Pulso Evidencia`;
- Villaguay y Entre Ríos;
- Maíz y El Niño;
- `Referencia externa`;
- `Asociación histórica` o redacción equivalente;
- advertencia explícita de que no es un pronóstico de rendimiento;
- bloques `Qué sabemos`, `Qué falta` y `Cómo lo sabemos`;
- ausencia de lenguaje de riesgo o score sintético.

### Integración

`App` debe demostrar con tests que un fallo del loader de evidencia no rompe los otros dos pulsos.

## 13. No objetivos de esta iteración

Quedan explícitamente fuera de V3 inicial:

- reimplementar el motor estadístico completo de AgroENSO;
- calcular un resultado propio MAGyP + ONI;
- scrapear la aplicación AgroENSO;
- publicar todos los cultivos;
- publicar todos los departamentos;
- selector de fase ENSO;
- pronóstico ENSO futuro;
- agua útil actual;
- modelos de rendimiento;
- score de riesgo o confianza;
- mapa coroplético nacional;
- automatización periódica del snapshot histórico;
- integración con GeoPlatform.

## 14. Iteración posterior

Una V3.1 puede agregar una segunda evidencia `reproduced` producida por Pulso mediante un pipeline verificable MAGyP + NOAA ONI + geometría administrativa. La referencia externa y la reproducción propia deben coexistir como evidencias distintas y comparables; una nunca sobrescribe a la otra.

La comparación puede exponer diferencia entre resultados, pero no debe presentar equivalencia metodológica mientras no se haya reproducido de forma demostrable la misma cadena de procesamiento y correcciones.

## 15. Criterios de aceptación

La iteración está terminada sólo cuando:

1. V1 y V2 conservan sus contratos públicos sin cambios incompatibles.
2. Existe `EvidenceSnapshot 1.0` validado y publicado en `/data/evidence.json`.
3. Existe una única evidencia inicial para maíz + El Niño + Villaguay.
4. El territorio usa un código administrativo oficial y geometría trazable.
5. El resultado está marcado `external-reference` y nunca se atribuye a Pulso.
6. Si un valor o significancia no puede verificarse, se publica `null` y la UI lo expresa honestamente.
7. La nueva sección distingue claramente `Qué sabemos`, `Qué falta` y `Cómo lo sabemos`.
8. La UI declara que la asociación histórica no constituye pronóstico de rendimiento.
9. Un fallo de Evidencia no rompe Pulso Nacional ni Pulso Territorial.
10. Tests, TypeScript y build pasan en CI antes de merge.
11. El deploy de GitHub Pages se verifica contra el SHA exacto mergeado.
12. No se agrega scraping de AgroENSO ni motor estadístico propio en esta iteración.
