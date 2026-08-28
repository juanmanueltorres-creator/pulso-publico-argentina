# Pulso Público Argentina V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Pulso Público into one coherent black-map national + territorial publication, preserving the four V1 scalar signals while adding independently refreshed INPRES earthquakes and CONAE VIIRS thermal hotspots over an interactive Argentina map.

**Architecture:** Keep `SignalEnvelope 1.0` and `public/data/signals.json` unchanged. Add a parallel territorial contract with independent `earthquakes.json` and `hotspots.json` snapshots, source-specific acquisition scripts, shared spatial/freshness utilities, and one MapLibre map that consumes only repository-published data. Source failures fail closed and never become zero events.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 3, Testing Library, Node 24 in CI, MapLibre GL JS, Cheerio for the INPRES HTML boundary, GitHub Actions, GitHub Pages, official IGN GeoJSON/WFS geometry.

**Spec:** `docs/superpowers/specs/2026-08-28-pulso-publico-v2-design.md`

## Global Constraints

- `SignalEnvelope 1.0` and `public/data/signals.json` remain backward compatible and unchanged in shape.
- Browser code never calls INPRES, CONAE or IGN provider endpoints directly; it reads checked-in/public snapshots only.
- Territorial windows are exactly 168 hours for earthquakes and 24 hours for thermal hotspots.
- `sourceCheckedAt` is the represented successful provider check; territorial data becomes stale after 240 minutes.
- Source checks run hourly; unchanged healthy data publishes a freshness heartbeat once represented `sourceCheckedAt` reaches 180 minutes.
- A failed source/network/parser/validation run never overwrites a previous good snapshot with an empty event array.
- A successful source check may legitimately publish `events: []`.
- Earthquake magnitude is not a damage prediction; depth is context rather than a danger score.
- A CONAE hotspot is a thermal anomaly, not a confirmed wildfire. Confidence is detection confidence, not wildfire probability.
- Initial V2 does not use FRP for danger, risk, marker size or marker color and introduces no synthetic risk score.
- Argentina membership is determined with exact point-in-polygon against the checked-in official IGN boundary, never bbox alone.
- One MapLibre instance serves both territorial modes and preserves viewport across `Sismos` / `Focos de calor` changes.
- New behavior follows RED → verify RED → GREEN → verify GREEN; do not write production behavior before its failing test.
- The feature branch is not merged or deployed to production without a separate explicit user merge decision.

---

### Task 1: Territorial contracts, validation, loading and freshness

**Files:**
- Create: `src/types/territorial.ts`
- Create: `src/lib/validateTerritorialSnapshot.ts`
- Test: `src/lib/validateTerritorialSnapshot.test.ts`
- Create: `src/lib/loadTerritorialSnapshot.ts`
- Test: `src/lib/loadTerritorialSnapshot.test.ts`
- Create: `src/lib/territorialFreshness.ts`
- Test: `src/lib/territorialFreshness.test.ts`

**Interfaces:**
- Consumes: unknown JSON from `data/earthquakes.json` or `data/hotspots.json`.
- Produces:
  ```ts
  validateTerritorialSnapshot(input: unknown, expectedKind: 'earthquake'): TerritorialSnapshot<EarthquakeEvent>
  validateTerritorialSnapshot(input: unknown, expectedKind: 'thermal-hotspot'): TerritorialSnapshot<ThermalHotspotEvent>
  loadTerritorialSnapshot(kind: 'earthquake', fetcher?: typeof fetch, baseUrl?: string): Promise<TerritorialSnapshot<EarthquakeEvent>>
  loadTerritorialSnapshot(kind: 'thermal-hotspot', fetcher?: typeof fetch, baseUrl?: string): Promise<TerritorialSnapshot<ThermalHotspotEvent>>
  territorialAvailability(snapshot: TerritorialSnapshot<BaseTerritorialEvent>, now?: Date): 'available' | 'stale'
  ```
- Later tasks consume these exact field names and function names.

- [ ] **Step 1: Write failing contract and freshness tests**

Create the approved types in the test fixture shape and assert valid/invalid boundaries before implementing the validator:

```ts
const earthquakeSnapshot = {
  schemaVersion: '1.0',
  kind: 'earthquake',
  generatedAt: '2026-08-28T04:00:00.000Z',
  sourceCheckedAt: '2026-08-28T04:00:00.000Z',
  window: { hours: 168 },
  freshness: { staleAfterMinutes: 240 },
  source: { name: 'INPRES', url: 'https://www.inpres.gob.ar/sismos_consultados', kind: 'official' },
  method: { type: 'scrape', note: 'Tabla oficial de sismos recientes.' },
  limitations: ['Se cuentan epicentros dentro del límite nacional usado por Pulso Público.'],
  events: [{
    id: 'eq-1', kind: 'earthquake', occurredAt: '2026-08-28T00:15:00-03:00',
    latitude: -31.4, longitude: -68.6, magnitude: 4.2, depthKm: 86,
    place: null, province: 'San Juan', intensityText: 'II a III',
  }],
} as const

it('accepts an earthquake snapshot with the approved contract', () => {
  const result = validateTerritorialSnapshot(earthquakeSnapshot, 'earthquake')
  expect(result.events[0].magnitude).toBe(4.2)
})

it('rejects impossible coordinates and kind mismatches', () => {
  expect(() => validateTerritorialSnapshot({
    ...earthquakeSnapshot,
    events: [{ ...earthquakeSnapshot.events[0], latitude: -95 }],
  }, 'earthquake')).toThrow(/latitude/i)

  expect(() => validateTerritorialSnapshot(earthquakeSnapshot, 'thermal-hotspot')).toThrow(/kind/i)
})

it('marks a snapshot stale only after its declared threshold', () => {
  expect(territorialAvailability(earthquakeSnapshot, new Date('2026-08-28T07:59:00Z'))).toBe('available')
  expect(territorialAvailability(earthquakeSnapshot, new Date('2026-08-28T08:01:00Z'))).toBe('stale')
})
```

Also test hotspot-specific required fields, finite timestamps, finite `frpMw | null`, and the exact confidence enum `low | nominal | high | unknown`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm run test:run -- src/lib/validateTerritorialSnapshot.test.ts src/lib/territorialFreshness.test.ts
```

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement the approved types, manual validator and freshness helper**

Use the exact domain contract from the spec:

```ts
export type TerritorialKind = 'earthquake' | 'thermal-hotspot'
export type HotspotConfidence = 'low' | 'nominal' | 'high' | 'unknown'

export interface BaseTerritorialEvent {
  id: string
  kind: TerritorialKind
  occurredAt: string
  latitude: number
  longitude: number
}

export interface EarthquakeEvent extends BaseTerritorialEvent {
  kind: 'earthquake'
  magnitude: number
  depthKm: number | null
  place: string | null
  province: string | null
  intensityText: string | null
}

export interface ThermalHotspotEvent extends BaseTerritorialEvent {
  kind: 'thermal-hotspot'
  confidence: HotspotConfidence
  frpMw: number | null
  sensor: string | null
  satellite: string | null
}

export interface TerritorialSnapshot<TEvent extends BaseTerritorialEvent> {
  schemaVersion: '1.0'
  kind: TerritorialKind
  generatedAt: string
  sourceCheckedAt: string
  window: { hours: number }
  freshness: { staleAfterMinutes: number }
  source: { name: string; url: string; kind: 'official' }
  method: { type: 'scrape' | 'wfs'; note: string }
  limitations: string[]
  events: TEvent[]
}
```

The validator must reject non-finite lat/lon, latitude outside `[-90, 90]`, longitude outside `[-180, 180]`, invalid ISO-like timestamps (`Number.isNaN(Date.parse(value))`), wrong snapshot/event kinds, wrong window (`168` for earthquake, `24` for hotspot), and non-positive freshness thresholds.

Implement freshness exactly from `sourceCheckedAt`:

```ts
export function territorialAvailability(
  snapshot: TerritorialSnapshot<BaseTerritorialEvent>,
  now = new Date(),
): 'available' | 'stale' {
  const ageMs = now.getTime() - Date.parse(snapshot.sourceCheckedAt)
  return ageMs > snapshot.freshness.staleAfterMinutes * 60_000 ? 'stale' : 'available'
}
```

- [ ] **Step 4: Write failing loader tests and implement the base-path loader**

Test both paths and HTTP failure:

```ts
it('loads earthquakes below the Vite base path', async () => {
  let requested = ''
  const fetcher = async (input: RequestInfo | URL) => {
    requested = String(input)
    return new Response(JSON.stringify(earthquakeSnapshot), { status: 200 })
  }
  await loadTerritorialSnapshot('earthquake', fetcher as typeof fetch, '/pulso-publico-argentina/')
  expect(requested).toBe('/pulso-publico-argentina/data/earthquakes.json')
})
```

Implement explicit file routing rather than deriving filenames from arbitrary input:

```ts
const FILE_BY_KIND = {
  earthquake: 'earthquakes.json',
  'thermal-hotspot': 'hotspots.json',
} as const
```

Fetch with `{ cache: 'no-store' }`, throw on non-OK response, and pass the JSON through `validateTerritorialSnapshot`.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npm run test:run -- src/lib/validateTerritorialSnapshot.test.ts src/lib/loadTerritorialSnapshot.test.ts src/lib/territorialFreshness.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/types/territorial.ts src/lib/validateTerritorialSnapshot.ts src/lib/validateTerritorialSnapshot.test.ts src/lib/loadTerritorialSnapshot.ts src/lib/loadTerritorialSnapshot.test.ts src/lib/territorialFreshness.ts src/lib/territorialFreshness.test.ts
git commit -m "feat: add territorial snapshot contract"
```

---

### Task 2: Official Argentina geometry and exact spatial filtering

**Files:**
- Create: `scripts/lib/geo.mjs`
- Test: `scripts/lib/geo.test.mjs`
- Create: `scripts/fetch-argentina-geometry.mjs`
- Test: `scripts/fetch-argentina-geometry.test.mjs`
- Create from official fetch: `public/data/argentina-provinces.geojson`
- Create: `public/data/argentina-provinces.source.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: GeoJSON `FeatureCollection` containing Polygon/MultiPolygon province geometry.
- Produces:
  ```js
  pointInFeatureCollection([longitude, latitude], featureCollection): boolean
  validateArgentinaFeatureCollection(input): FeatureCollection
  fetchArgentinaGeometry(fetchImpl?: typeof fetch): Promise<FeatureCollection>
  ```
- Official acquisition URL:
  `https://wms.ign.gob.ar/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ign:provincia&outputFormat=application%2Fjson&srsName=EPSG%3A4326`

- [ ] **Step 1: Write failing point-in-polygon tests**

Use synthetic Polygon, hole and MultiPolygon geometry so correctness does not depend on the network:

```js
const square = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature', properties: {},
    geometry: { type: 'Polygon', coordinates: [[[-70,-35],[-60,-35],[-60,-25],[-70,-25],[-70,-35]]] },
  }],
}

it('includes points inside polygons and excludes outside points', () => {
  expect(pointInFeatureCollection([-65, -30], square)).toBe(true)
  expect(pointInFeatureCollection([-72, -30], square)).toBe(false)
})
```

Add a Polygon-with-hole assertion and a MultiPolygon assertion.

- [ ] **Step 2: Run the spatial tests and verify RED**

Run:

```bash
npm run test:run -- scripts/lib/geo.test.mjs
```

Expected: FAIL because `geo.mjs` does not exist.

- [ ] **Step 3: Implement deterministic Polygon/MultiPolygon membership**

Implement ray casting with hole exclusion; do not add a geospatial runtime dependency:

```js
function pointInRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = ((yi > y) !== (yj > y)) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function pointInPolygon(point, coordinates) {
  if (!pointInRing(point, coordinates[0])) return false
  return !coordinates.slice(1).some((hole) => pointInRing(point, hole))
}
```

For a `MultiPolygon`, return true when any polygon contains the point. For the FeatureCollection, return true when any province feature contains the point. Reject unsupported/null geometries in `validateArgentinaFeatureCollection`.

- [ ] **Step 4: Test and implement the official IGN fetch boundary**

The network-facing function must request the exact URL above and validate:

```js
if (!response.ok) throw new Error(`IGN WFS request failed with HTTP ${response.status}`)
const data = await response.json()
if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length !== 24) {
  throw new Error('IGN provincia layer must contain 24 features')
}
```

Write a fake-fetch test with 24 generated Polygon features before production code. The CLI writes JSON atomically and adds this script to `package.json`:

```json
"data:argentina-boundary": "node scripts/fetch-argentina-geometry.mjs"
```

Record attribution in `public/data/argentina-provinces.source.json`:

```json
{
  "source": "Instituto Geográfico Nacional",
  "service": "WFS",
  "layer": "ign:provincia",
  "crs": "EPSG:4326",
  "url": "https://wms.ign.gob.ar/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ign:provincia&outputFormat=application%2Fjson&srsName=EPSG%3A4326"
}
```

- [ ] **Step 5: Run tests, acquire the official geometry once, inspect and commit**

Run:

```bash
npm run test:run -- scripts/lib/geo.test.mjs scripts/fetch-argentina-geometry.test.mjs
npm run data:argentina-boundary
node -e "const f=require('./public/data/argentina-provinces.geojson'); console.log(f.type, f.features.length)"
```

Expected final output contains `FeatureCollection 24`.

Commit:

```bash
git add package.json scripts/lib/geo.mjs scripts/lib/geo.test.mjs scripts/fetch-argentina-geometry.mjs scripts/fetch-argentina-geometry.test.mjs public/data/argentina-provinces.geojson public/data/argentina-provinces.source.json
git commit -m "feat: add official Argentina boundary"
```

---

### Task 3: Redesign the full V1 surface into the V2 identity

**Files:**
- Create: `src/components/SectionHeading.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/SignalCard.tsx`
- Modify: `src/components/SignalCard.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: the unchanged `SignalSnapshot` and existing `SignalCard` data.
- Produces: one coherent hero + `Pulso Nacional` + `Pulso Territorial` page shell using the approved black/bone/amber visual system.

- [ ] **Step 1: Write failing identity and regression tests**

Add App assertions before changing markup:

```tsx
expect(await screen.findByRole('heading', { name: 'Pulso Público' })).toBeInTheDocument()
expect(screen.getByText('Qué está pasando. Dónde. Y cómo lo sabemos.')).toBeInTheDocument()
expect(screen.getByText('Datos que se mueven. Fuentes que se pueden revisar.')).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'Pulso Nacional' })).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'Pulso Territorial' })).toBeInTheDocument()
```

Keep the existing four-signal assertions and all `SignalCard` provenance/count-up/reduced-motion tests.

- [ ] **Step 2: Run App/SignalCard tests and verify RED**

Run:

```bash
npm run test:run -- src/App.test.tsx src/components/SignalCard.test.tsx
```

Expected: new section/hero assertions FAIL while V1 regressions remain green.

- [ ] **Step 3: Implement the page hierarchy without fake territorial values**

Use `SectionHeading` with this interface:

```tsx
interface SectionHeadingProps {
  eyebrow: string
  title: string
  description: string
}
```

`App.tsx` renders:

```tsx
<header className="hero">
  <p className="eyebrow">ARGENTINA · DATOS PÚBLICOS</p>
  <h1>Pulso Público</h1>
  <p className="hero__lead">Qué está pasando. Dónde. Y cómo lo sabemos.</p>
  <p className="hero__principle">Datos que se mueven. Fuentes que se pueden revisar.</p>
</header>

<SectionHeading eyebrow="PULSO NACIONAL" title="Pulso Nacional" description="Cuatro señales para leer el país desde fuentes públicas." />
```

Keep the existing V1 loading/error semantics and render the four existing signal cards unchanged in data behavior. Add the `Pulso Territorial` heading/shell only; do not invent event counts before snapshots exist.

- [ ] **Step 4: Apply the V2 visual tokens and responsive hierarchy**

Replace the green-led root tokens with the approved family:

```css
:root {
  --bg: #050706;
  --panel: #0c0f0d;
  --panel-raised: #111411;
  --line: #292820;
  --line-strong: #403b2f;
  --text: #f1ede5;
  --muted: #9f9a8f;
  --soft: #716d64;
  --accent: #d3a462;
  --accent-strong: #f0c986;
  --warning: #d9b56f;
  --danger: #c99586;
}
```

Use thin borders, restrained amber emphasis, no automatic red semantic for ordinary events, and responsive card layout. Preserve focus-visible behavior and count-up reduced-motion behavior.

- [ ] **Step 5: Run tests/build and commit**

Run:

```bash
npm run test:run -- src/App.test.tsx src/components/SignalCard.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/components/SectionHeading.tsx src/App.tsx src/App.test.tsx src/components/SignalCard.tsx src/components/SignalCard.test.tsx src/styles.css
git commit -m "feat: establish V2 visual identity"
```

---

### Task 4: MapLibre black-map shell and territorial UI contracts

**Files:**
- Modify: `package.json`
- Create through install: `package-lock.json`
- Modify: `src/main.tsx`
- Create: `src/test/territorialFixtures.ts`
- Create: `src/lib/territorialMapData.ts`
- Test: `src/lib/territorialMapData.test.ts`
- Create: `src/lib/explainTerritorial.ts`
- Test: `src/lib/explainTerritorial.test.ts`
- Create: `src/components/TerritorialLegend.tsx`
- Create: `src/components/TerritorialDetail.tsx`
- Create: `src/components/TerritorialMap.tsx`
- Test: `src/components/TerritorialMap.test.tsx`
- Create: `src/components/TerritorialSection.tsx`
- Test: `src/components/TerritorialSection.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- `TerritorialSection` owns independent source loading, active mode and selected event.
- `TerritorialMap` receives both event arrays and never owns provider/network fetching.
- Produces:
  ```ts
  eventsToFeatureCollection(events: BaseTerritorialEvent[]): GeoJSON.FeatureCollection
  earthquakeRadius(magnitude: number): number
  explainEarthquake(event: EarthquakeEvent): string
  explainHotspot(event: ThermalHotspotEvent): string
  ```
- `TerritorialMap` props:
  ```ts
  interface TerritorialMapProps {
    mode: TerritorialKind
    earthquakes: EarthquakeEvent[]
    hotspots: ThermalHotspotEvent[]
    selectedId: string | null
    onSelect: (event: EarthquakeEvent | ThermalHotspotEvent) => void
  }
  ```

- [ ] **Step 1: Install MapLibre and write failing pure map-data tests**

Run:

```bash
npm install maplibre-gl
```

Then test the bounded earthquake size scale and GeoJSON conversion:

```ts
it('bounds earthquake marker radius rather than scaling without limit', () => {
  expect(earthquakeRadius(1)).toBeGreaterThanOrEqual(3)
  expect(earthquakeRadius(8)).toBeLessThanOrEqual(18)
  expect(earthquakeRadius(5)).toBeGreaterThan(earthquakeRadius(3))
})

it('puts event ids and kinds into GeoJSON properties', () => {
  const fc = eventsToFeatureCollection([earthquakeEvent])
  expect(fc.features[0]).toMatchObject({
    geometry: { type: 'Point', coordinates: [-68.6, -31.4] },
    properties: { id: 'eq-1', kind: 'earthquake' },
  })
})
```

- [ ] **Step 2: Run the pure tests and verify RED, then implement them**

Run:

```bash
npm run test:run -- src/lib/territorialMapData.test.ts src/lib/explainTerritorial.test.ts
```

Expected: FAIL because modules do not exist.

Implement a capped linear visual helper:

```ts
export function earthquakeRadius(magnitude: number): number {
  return Math.max(3, Math.min(18, 2 + magnitude * 2))
}
```

`explainHotspot` must contain `Una detección térmica no implica un incendio confirmado.` and must not contain `probabilidad de incendio` or `incendio confirmado` as a positive classification.

- [ ] **Step 3: Write failing TerritorialSection behavior tests**

Using deterministic test fixtures and mocking `TerritorialMap`, assert:

```tsx
expect(screen.getByRole('button', { name: /sismos/i })).toHaveAttribute('aria-pressed', 'true')
expect(screen.getByText(/2 sismos registrados/i)).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: /focos de calor/i }))
expect(screen.getByText(/3 focos de calor detectados/i)).toBeInTheDocument()
expect(screen.getByText(/1 con confianza alta/i)).toBeInTheDocument()
expect(screen.getByText(/detección térmica no implica un incendio confirmado/i)).toBeInTheDocument()
```

Also assert that an earthquake loader rejection does not prevent a successful hotspot mode from rendering.

- [ ] **Step 4: Implement one persistent MapLibre instance with local geometry and two event sources**

Import MapLibre CSS from `src/main.tsx`:

```ts
import 'maplibre-gl/dist/maplibre-gl.css'
```

Initialize the map once in `TerritorialMap` using a minimal style and fixed South American Argentina fit bounds:

```ts
const ARGENTINA_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [-73.7, -55.3],
  [-53.5, -21.7],
]
```

Use local source data `${import.meta.env.BASE_URL}data/argentina-provinces.geojson`. Add separate GeoJSON sources for `earthquakes` (`cluster: false`) and `hotspots` (`cluster: true`, `clusterRadius: 40`) so mode changes require only layer visibility updates and never recreate the map.

Map layers:

```text
argentina-fill
argentina-province-lines
earthquake-points
hotspot-clusters
hotspot-cluster-count
hotspot-points
```

Do not add roads, POIs or a commercial tile source. On mode changes call `setLayoutProperty(..., 'visibility', ...)`; do not call `fitBounds`, thereby preserving viewport. Reset selected event in `TerritorialSection` when the domain mode changes, but preserve map camera state.

- [ ] **Step 5: Test MapLibre lifecycle contract, run full focused suite and commit**

Mock `maplibre-gl` in `TerritorialMap.test.tsx` and assert the `Map` constructor runs once across a rerender from earthquake to hotspot mode and that `setLayoutProperty` changes visibility without a second constructor call.

Run:

```bash
npm run test:run -- src/lib/territorialMapData.test.ts src/lib/explainTerritorial.test.ts src/components/TerritorialMap.test.tsx src/components/TerritorialSection.test.tsx src/App.test.tsx
npm run build
```

Expected: PASS.

Commit:

```bash
git add package.json package-lock.json src/main.tsx src/test/territorialFixtures.ts src/lib/territorialMapData.ts src/lib/territorialMapData.test.ts src/lib/explainTerritorial.ts src/lib/explainTerritorial.test.ts src/components/TerritorialLegend.tsx src/components/TerritorialDetail.tsx src/components/TerritorialMap.tsx src/components/TerritorialMap.test.tsx src/components/TerritorialSection.tsx src/components/TerritorialSection.test.tsx src/App.tsx src/styles.css
git commit -m "feat: add territorial black map shell"
```

---

### Task 5: Shared territorial publication and freshness-heartbeat logic

**Files:**
- Create: `scripts/lib/territorial-snapshot.mjs`
- Test: `scripts/lib/territorial-snapshot.test.mjs`
- Create: `scripts/lib/write-json-atomic.mjs`
- Test: `scripts/lib/write-json-atomic.test.mjs`

**Interfaces:**
- Consumes: previous published snapshot, newly normalized source candidate and successful check time.
- Produces:
  ```js
  semanticTerritorialPayload(snapshot): object
  territorialPayloadEqual(a, b): boolean
  prepareTerritorialPublication(previous, candidate, checkedAt, heartbeatMinutes = 180): { publish: boolean, snapshot: object }
  writeJsonAtomic(path, value): Promise<void>
  ```

- [ ] **Step 1: Write failing material-change and heartbeat tests**

```js
it('publishes immediately when event content changes', () => {
  const result = prepareTerritorialPublication(previous, { ...previous, events: [newEvent] }, '2026-08-28T05:00:00Z')
  expect(result.publish).toBe(true)
  expect(result.snapshot.sourceCheckedAt).toBe('2026-08-28T05:00:00Z')
})

it('suppresses an unchanged hourly timestamp-only write', () => {
  const result = prepareTerritorialPublication(previous, previous, '2026-08-28T05:00:00Z')
  expect(result.publish).toBe(false)
  expect(result.snapshot).toEqual(previous)
})

it('publishes an unchanged healthy heartbeat after 180 minutes', () => {
  const result = prepareTerritorialPublication(previous, previous, '2026-08-28T07:00:00Z')
  expect(result.publish).toBe(true)
  expect(result.snapshot.sourceCheckedAt).toBe('2026-08-28T07:00:00Z')
})
```

Use a previous `sourceCheckedAt` of `2026-08-28T04:00:00Z`.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
npm run test:run -- scripts/lib/territorial-snapshot.test.mjs scripts/lib/write-json-atomic.test.mjs
```

Expected: FAIL because shared publication modules do not exist.

- [ ] **Step 3: Implement semantic comparison and heartbeat exactly**

Exclude only `generatedAt` and `sourceCheckedAt` from semantic comparison:

```js
export function semanticTerritorialPayload(snapshot) {
  const { generatedAt: _generatedAt, sourceCheckedAt: _sourceCheckedAt, ...semantic } = snapshot
  return semantic
}

export function territorialPayloadEqual(a, b) {
  return JSON.stringify(semanticTerritorialPayload(a)) === JSON.stringify(semanticTerritorialPayload(b))
}
```

`prepareTerritorialPublication` publishes when no previous snapshot exists, when semantic payload differs, or when `checkedAt - previous.sourceCheckedAt >= 180 minutes`. A published candidate sets both `generatedAt` and `sourceCheckedAt` to the successful `checkedAt`. A suppressed publication returns the previous object unchanged.

`writeJsonAtomic` writes `${path}.tmp` and renames over the destination, matching the existing source-refresh safety pattern.

- [ ] **Step 4: Run GREEN and commit**

Run:

```bash
npm run test:run -- scripts/lib/territorial-snapshot.test.mjs scripts/lib/write-json-atomic.test.mjs
```

Expected: PASS.

Commit:

```bash
git add scripts/lib/territorial-snapshot.mjs scripts/lib/territorial-snapshot.test.mjs scripts/lib/write-json-atomic.mjs scripts/lib/write-json-atomic.test.mjs
git commit -m "feat: add territorial snapshot publication rules"
```

---

### Task 6: INPRES earthquakes end to end

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/fixtures/inpres-recent.html`
- Create: `scripts/adapters/inpres.mjs`
- Test: `scripts/adapters/inpres.test.mjs`
- Create: `scripts/fetch-inpres.mjs`
- Test: `scripts/fetch-inpres.test.mjs`
- Create: `scripts/refresh-inpres-lib.mjs`
- Test: `scripts/refresh-inpres-lib.test.mjs`
- Create: `scripts/refresh-inpres.mjs`
- Create: `.github/workflows/refresh-inpres.yml`
- Create from successful real refresh: `public/data/earthquakes.json`

**Interfaces:**
- Official source: `https://www.inpres.gob.ar/sismos_consultados`.
- Produces:
  ```js
  parseInpresEarthquakes(html): EarthquakeEventLike[]
  fetchInpresEarthquakes(fetchImpl?: typeof fetch): Promise<EarthquakeEventLike[]>
  selectInpresEarthquakes(events, argentinaGeometry, checkedAt): EarthquakeEventLike[]
  refreshInpresSnapshot(previous, argentinaGeometry, fetchImpl, checkedAt): Promise<{ publish: boolean, snapshot: object }>
  ```

- [ ] **Step 1: Install Cheerio and create a representative HTML fixture**

Run:

```bash
npm install --save-dev cheerio
```

Check in a small fixture containing the exact required table headings and at least three rows: one San Juan event, one older-than-seven-days event, and one Chile event. The parser must identify columns by normalized heading text, not hard-coded column positions.

Required normalized headings:

```js
['fecha y hora', 'latitud', 'longitud', 'prof.', 'magn.', 'intensidad', 'provincia']
```

- [ ] **Step 2: Write failing parser tests**

```js
it('parses official local earthquake time with Argentina UTC-3 offset', () => {
  expect(parseInpresLocalDate('28/08/2026 01:15:30')).toBe('2026-08-28T01:15:30-03:00')
})

it('normalizes magnitude, depth, province and intensity', () => {
  const events = parseInpresEarthquakes(fixture)
  expect(events[0]).toMatchObject({
    kind: 'earthquake', magnitude: 4.2, depthKm: 86,
    province: 'San Juan', intensityText: 'II a III', place: null,
  })
})

it('fails closed when a required heading disappears', () => {
  expect(() => parseInpresEarthquakes(fixture.replace('Magn.', 'Valor'))).toThrow(/required heading/i)
})
```

`parseInpresLocalDate` accepts `DD/MM/YYYY HH:mm:ss` and `DD/MM/YYYY HH:mm`, always emitting the explicit `-03:00` offset used by INPRES local-time publication.

Generate deterministic fallback ids from normalized `occurredAt|lat|lon|depth|magnitude` using Node SHA-256 truncated to 16 hex characters. Do not use row order as identity.

- [ ] **Step 3: Run parser tests RED, implement parser, rerun GREEN**

Run before implementation:

```bash
npm run test:run -- scripts/adapters/inpres.test.mjs
```

Expected: FAIL.

Core deterministic id implementation:

```js
import { createHash } from 'node:crypto'

function earthquakeId(event) {
  const key = [event.occurredAt, event.latitude, event.longitude, event.depthKm ?? '', event.magnitude].join('|')
  return `inpres-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`
}
```

After implementation rerun the same command and expect PASS.

- [ ] **Step 4: Write failing fetch/filter/refresh tests and implement the source boundary**

`fetchInpresEarthquakes` must require HTTP success and text HTML. `selectInpresEarthquakes` must:

```js
const cutoff = Date.parse(checkedAt) - 168 * 60 * 60 * 1000
return events
  .filter((event) => Date.parse(event.occurredAt) >= cutoff && Date.parse(event.occurredAt) <= Date.parse(checkedAt) + 5 * 60_000)
  .filter((event) => pointInFeatureCollection([event.longitude, event.latitude], argentinaGeometry))
  .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
```

The Chile fixture row must be excluded by geometry even if its source text looks regionally relevant. A source fetch/parser failure must reject before `writeJsonAtomic` is called.

Build the snapshot with:

```js
{
  schemaVersion: '1.0', kind: 'earthquake', generatedAt: checkedAt, sourceCheckedAt: checkedAt,
  window: { hours: 168 }, freshness: { staleAfterMinutes: 240 },
  source: { name: 'INPRES', url: 'https://www.inpres.gob.ar/sismos_consultados', kind: 'official' },
  method: { type: 'scrape', note: 'Tabla oficial de sismos recientes de INPRES, normalizada por Pulso Público.' },
  limitations: ['El conteo de Argentina incluye epicentros dentro del límite nacional usado por Pulso Público; eventos cercanos fuera del país quedan excluidos.'],
  events,
}
```

Pass it through `prepareTerritorialPublication`.

- [ ] **Step 5: Add CLI/workflow, run the real source once and commit**

Add package script:

```json
"refresh:inpres": "node scripts/refresh-inpres.mjs"
```

Workflow essentials:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: '7 * * * *'
concurrency:
  group: refresh-territorial
  cancel-in-progress: false
```

Use checkout@v7, setup-node@v7 with Node 24, `npm install --no-audit --no-fund`, run `npm run refresh:inpres`, and commit/push only when `public/data/earthquakes.json` changed. The script reads `public/data/argentina-provinces.geojson`, reads previous snapshot only if it exists, and writes only when `publish === true`.

Run:

```bash
npm run test:run -- scripts/adapters/inpres.test.mjs scripts/fetch-inpres.test.mjs scripts/refresh-inpres-lib.test.mjs
npm run refresh:inpres
npm run test:run -- src/lib/validateTerritorialSnapshot.test.ts
```

Inspect `public/data/earthquakes.json`: `kind` must be `earthquake`, window `168`, stale threshold `240`, and every event must pass the Argentina polygon filter.

Commit:

```bash
git add package.json package-lock.json scripts/fixtures/inpres-recent.html scripts/adapters/inpres.mjs scripts/adapters/inpres.test.mjs scripts/fetch-inpres.mjs scripts/fetch-inpres.test.mjs scripts/refresh-inpres-lib.mjs scripts/refresh-inpres-lib.test.mjs scripts/refresh-inpres.mjs .github/workflows/refresh-inpres.yml public/data/earthquakes.json
git commit -m "feat: add INPRES earthquake pipeline"
```

---

### Task 7: CONAE VIIRS thermal hotspots end to end

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/fixtures/conae-capabilities.xml`
- Create: `scripts/fixtures/conae-viirs.geojson`
- Create: `scripts/adapters/conae-hotspots.mjs`
- Test: `scripts/adapters/conae-hotspots.test.mjs`
- Create: `scripts/fetch-conae-hotspots.mjs`
- Test: `scripts/fetch-conae-hotspots.test.mjs`
- Create: `scripts/refresh-conae-hotspots-lib.mjs`
- Test: `scripts/refresh-conae-hotspots-lib.test.mjs`
- Create: `scripts/refresh-conae-hotspots.mjs`
- Create: `.github/workflows/refresh-conae-hotspots.yml`
- Create from successful real refresh: `public/data/hotspots.json`

**Interfaces:**
- WFS base: `https://geoservicios.conae.gov.ar/geoserver/GeoServiciosCONAE/wfs`.
- Required layer: `GeoServiciosCONAE:FocosDeCalorVIIRS`.
- Produces:
  ```js
  normalizeHotspotConfidence(raw): 'low' | 'nominal' | 'high' | 'unknown'
  parseConaeHotspots(featureCollection): ThermalHotspotEventLike[]
  fetchConaeHotspots(fetchImpl?: typeof fetch): Promise<ThermalHotspotEventLike[]>
  selectConaeHotspots(events, argentinaGeometry, checkedAt): ThermalHotspotEventLike[]
  refreshConaeHotspotSnapshot(previous, argentinaGeometry, fetchImpl, checkedAt): Promise<{ publish: boolean, snapshot: object }>
  ```

- [ ] **Step 1: Check in representative WFS fixtures and write failing adapter tests**

The capabilities fixture must contain the exact layer name. The GeoJSON fixture must contain at least: one Argentine detection, one foreign detection inside the coarse regional extent, one high-confidence text/category example, one `FP_Confidence` numeric code `8`, one nullable FRP case, and documented `Satelite` / `Instrumento` properties.

Confidence normalization is intentionally conservative and exact:

```js
const text = String(raw ?? '').trim().toLowerCase()
if (['low', 'baja', 'bajo'].includes(text) || Number(raw) === 7) return 'low'
if (['nominal', 'media', 'medio'].includes(text) || Number(raw) === 8) return 'nominal'
if (['high', 'alta', 'alto'].includes(text) || Number(raw) === 9) return 'high'
return 'unknown'
```

Do not invent percentage cutoffs. A numeric confidence percentage that is not the categorical code `7`, `8` or `9` remains `unknown` in V2.

Test:

```js
expect(normalizeHotspotConfidence(9)).toBe('high')
expect(normalizeHotspotConfidence('Alta')).toBe('high')
expect(normalizeHotspotConfidence(87)).toBe('unknown')
```

- [ ] **Step 2: Run adapter tests RED and implement feature parsing**

Run:

```bash
npm run test:run -- scripts/adapters/conae-hotspots.test.mjs
```

Expected: FAIL.

Parse only Point geometries with finite `[longitude, latitude]`. Recognize these source-property aliases case-insensitively:

```text
FRP: FP_Power, frp, FRP
confidence: FP_Confidence, confidence
satellite: Satelite, satellite
sensor: Instrumento, instrument, sensor
combined time: FechaHora, fecha_hora, datetime, timestamp
separate date: Fecha, fecha, acq_date
separate time: Hora, hora, acq_time
```

For a combined time value, require `Date.parse(value)` to succeed. For separate date/time, accept `YYYY-MM-DD` or `DD/MM/YYYY` plus `HH:mm[:ss]` and normalize it as UTC acquisition time. If neither recognized representation exists, fail the feature parse rather than substituting `sourceCheckedAt` as occurrence time.

Preserve `FP_Power` as `frpMw` only when finite; blank/missing becomes `null`.

- [ ] **Step 3: Write failing WFS boundary tests and implement capabilities + GetFeature calls**

Build exact URLs with `URL`/`searchParams`:

```js
const WFS_BASE = 'https://geoservicios.conae.gov.ar/geoserver/GeoServiciosCONAE/wfs'
const LAYER = 'GeoServiciosCONAE:FocosDeCalorVIIRS'
```

First request:

```text
service=WFS&version=2.0.0&request=GetCapabilities
```

Require the capabilities text to contain `GeoServiciosCONAE:FocosDeCalorVIIRS`. Then request:

```text
service=WFS&version=2.0.0&request=GetFeature&typeNames=GeoServiciosCONAE:FocosDeCalorVIIRS&outputFormat=application/json&srsName=EPSG:4326
```

The tests must prove a missing layer or non-OK GetFeature response rejects the refresh.

- [ ] **Step 4: Implement 24-hour + Argentina filtering and publication rules**

Use the same exact polygon function as INPRES:

```js
const cutoff = Date.parse(checkedAt) - 24 * 60 * 60 * 1000
const selected = events
  .filter((event) => Date.parse(event.occurredAt) >= cutoff && Date.parse(event.occurredAt) <= Date.parse(checkedAt) + 5 * 60_000)
  .filter((event) => pointInFeatureCollection([event.longitude, event.latitude], argentinaGeometry))
  .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
```

Build snapshot:

```js
{
  schemaVersion: '1.0', kind: 'thermal-hotspot', generatedAt: checkedAt, sourceCheckedAt: checkedAt,
  window: { hours: 24 }, freshness: { staleAfterMinutes: 240 },
  source: { name: 'CONAE', url: 'https://catalogos.conae.gov.ar/catalogo/catalogoGeoServiciosOGC.html', kind: 'official' },
  method: { type: 'wfs', note: 'Capa VIIRS de focos de calor de las últimas 24 horas publicada por CONAE vía WFS.' },
  limitations: [
    'Un foco de calor es una anomalía térmica detectada por satélite y no implica un incendio confirmado.',
    'La confianza describe la detección térmica; no es probabilidad de incendio.',
    'Pulso Público no convierte FRP en un nivel de peligro en V2.'
  ],
  events,
}
```

Pass through `prepareTerritorialPublication` so failure preserves last-good data and unchanged healthy sources obey the 180-minute heartbeat.

- [ ] **Step 5: Add CLI/workflow, run the real source once and commit**

Package script:

```json
"refresh:conae": "node scripts/refresh-conae-hotspots.mjs"
```

Workflow schedule and concurrency:

```yaml
schedule:
  - cron: '37 * * * *'
concurrency:
  group: refresh-territorial
  cancel-in-progress: false
```

Use Node 24 and `npm install --no-audit --no-fund`, run the refresh, and commit only `public/data/hotspots.json` when changed.

Run:

```bash
npm run test:run -- scripts/adapters/conae-hotspots.test.mjs scripts/fetch-conae-hotspots.test.mjs scripts/refresh-conae-hotspots-lib.test.mjs
npm run refresh:conae
```

Inspect that every published point is inside the exact Argentina geometry; `kind` is `thermal-hotspot`; window is `24`; stale threshold is `240`; no event contains a synthetic fire-probability/risk field.

Commit:

```bash
git add package.json package-lock.json scripts/fixtures/conae-capabilities.xml scripts/fixtures/conae-viirs.geojson scripts/adapters/conae-hotspots.mjs scripts/adapters/conae-hotspots.test.mjs scripts/fetch-conae-hotspots.mjs scripts/fetch-conae-hotspots.test.mjs scripts/refresh-conae-hotspots-lib.mjs scripts/refresh-conae-hotspots-lib.test.mjs scripts/refresh-conae-hotspots.mjs .github/workflows/refresh-conae-hotspots.yml public/data/hotspots.json
git commit -m "feat: add CONAE hotspot pipeline"
```

---

### Task 8: Integrate real territorial data, selection, stale/error states and accessibility

**Files:**
- Modify: `src/components/TerritorialSection.tsx`
- Modify: `src/components/TerritorialSection.test.tsx`
- Modify: `src/components/TerritorialMap.tsx`
- Modify: `src/components/TerritorialMap.test.tsx`
- Modify: `src/components/TerritorialDetail.tsx`
- Modify: `src/components/TerritorialLegend.tsx`
- Modify: `src/lib/explainTerritorial.ts`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`
- Modify if needed for stable browser mocks: `src/test/setup.ts`

**Interfaces:**
- `TerritorialSection` defaults to `loadTerritorialSnapshot('earthquake')` and `loadTerritorialSnapshot('thermal-hotspot')` independently.
- Active snapshot availability is derived using `territorialAvailability`, while loader rejection is represented as UI `unavailable` state rather than an empty array.
- Marker click calls `onSelect` and renders textual detail outside the map canvas.

- [ ] **Step 1: Write failing integration tests for counters, semantics and independent failures**

Test real contract-shaped fixtures:

```tsx
expect(screen.getByText('2 sismos registrados · últimos 7 días')).toBeInTheDocument()
expect(screen.getByText('1 de magnitud 4 o superior')).toBeInTheDocument()
```

After hotspot mode:

```tsx
expect(screen.getByText('3 focos de calor detectados · últimas 24 h')).toBeInTheDocument()
expect(screen.getByText('1 con confianza alta')).toBeInTheDocument()
expect(screen.queryByText(/incendios activos/i)).not.toBeInTheDocument()
expect(screen.queryByText(/probabilidad de incendio/i)).not.toBeInTheDocument()
```

For stale data, inject `now` after the 240-minute threshold and assert a visible `Datos desactualizados` state plus the last successful `sourceCheckedAt`. For a rejected CONAE loader, assert `Fuente temporalmente no disponible` while Pulso Nacional and Sismos remain present.

- [ ] **Step 2: Write failing selection/detail tests**

Simulate map `onSelect` using the mocked map component and assert earthquake details expose magnitude, depth, province/time, intensity when non-null, and source link `INPRES`.

For hotspot selection assert confidence, FRP in MW when non-null, sensor/satellite, source link `CONAE`, and the exact caveat:

```text
Una detección térmica no implica un incendio confirmado.
```

- [ ] **Step 3: Implement independent source state and accessible mode controls**

Use separate state objects rather than one `Promise.all` failure domain:

```ts
type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: T }
  | { status: 'error' }
```

Start each loader independently in the same effect. Mode buttons use `type="button"`, `aria-pressed`, visible focus, and reset selected id on mode change. Headline counters derive only from `snapshot.events`.

`Cómo leer este mapa` must be a semantic disclosure/button with mode-specific text. Color cannot be the only encoding: earthquake marker size communicates magnitude and details state the magnitude numerically; hotspot detail/legend states confidence textually.

- [ ] **Step 4: Wire marker selection and reduced-motion behavior**

Map click handlers must query only point layers (`earthquake-points`, `hotspot-points`), extract the exact event `id`, locate the source event in props, and call `onSelect(event)`. A first event click selects but does not call `fitBounds` or `flyTo`.

Layer transition CSS/MapLibre paint updates use roughly 200–300 ms only when `prefers-reduced-motion: no-preference`; reduced-motion mode applies state immediately.

The map container must expose an accessible label such as:

```tsx
<div aria-label="Mapa de señales territoriales de Argentina" role="region" ref={containerRef} />
```

- [ ] **Step 5: Run integration regression suite/build and commit**

Run:

```bash
npm run test:run -- src/components/TerritorialSection.test.tsx src/components/TerritorialMap.test.tsx src/lib/explainTerritorial.test.ts src/App.test.tsx src/components/SignalCard.test.tsx src/lib/loadSignals.test.ts src/lib/validateSnapshot.test.ts
npm run build
```

Expected: PASS, including the unchanged V1 contract regressions.

Commit:

```bash
git add src/components/TerritorialSection.tsx src/components/TerritorialSection.test.tsx src/components/TerritorialMap.tsx src/components/TerritorialMap.test.tsx src/components/TerritorialDetail.tsx src/components/TerritorialLegend.tsx src/lib/explainTerritorial.ts src/styles.css src/App.test.tsx src/test/setup.ts
git commit -m "feat: integrate territorial interactions and states"
```

If `src/test/setup.ts` is unchanged, omit it from `git add` rather than creating a no-op edit.

---

### Task 9: Documentation, CI hardening, final verification and release gate

**Files:**
- Modify: `README.md`
- Modify only if required by new test commands: `.github/workflows/ci.yml`
- Verify without unnecessary edit: `.github/workflows/deploy-pages-preview.yml`
- Verify: `.github/workflows/refresh-inpres.yml`
- Verify: `.github/workflows/refresh-conae-hotspots.yml`

**Interfaces:**
- Produces: documented public V2 datasets and a verified feature-branch candidate ready for PR/review.
- Public data endpoints after production merge:
  ```text
  /data/signals.json
  /data/earthquakes.json
  /data/hotspots.json
  /data/argentina-provinces.geojson
  ```

- [ ] **Step 1: Write README changes that match the implemented semantics**

README must describe the two product sections and the exact territorial meaning:

```text
Pulso Nacional → CAMMESA, OpenAlex, INPI, GeoRef
Pulso Territorial → INPRES sismos (7 días), CONAE VIIRS focos de calor (24 h)
```

Add public JSON links, explain that a hotspot is a thermal anomaly rather than a confirmed fire, explain that marker size represents earthquake magnitude rather than expected damage, and document hourly checks + 180-minute freshness heartbeat + 240-minute stale threshold.

Update the architecture diagram to:

```text
fuentes nacionales -> SignalEnvelope -> signals.json
INPRES -> EarthquakeEvent -> earthquakes.json --\
                                            -> black map -> React/Vite -> GitHub Pages
CONAE  -> ThermalHotspotEvent -> hotspots.json --/
```

- [ ] **Step 2: Ensure CI executes all Node/Vitest and existing Python tests**

The existing `npm run test:run` discovers `.ts`, `.tsx` and `.mjs` Vitest tests, so keep CI simple. Required CI sequence remains:

```yaml
- run: python3 scripts/cammesa_xlsx_test.py
- run: npm install --no-audit --no-fund
- run: npm run test:run
- run: npm run build
```

Only modify `.github/workflows/ci.yml` if implementation introduced a test not reached by those commands. Do not add live INPRES/CONAE calls to unit-test CI; live source checks belong to their scheduled workflows and final smoke verification.

- [ ] **Step 3: Run the full local verification on the exact feature HEAD**

Run fresh commands:

```bash
npm install --no-audit --no-fund
python3 scripts/cammesa_xlsx_test.py
npm run test:run
npm run build -- --base=/pulso-publico-argentina/
git diff --check
```

Then exercise both real adapters:

```bash
npm run refresh:inpres
npm run refresh:conae
npm run test:run
npm run build -- --base=/pulso-publico-argentina/
git diff --check
```

If a real refresh changes a checked-in snapshot, inspect it, rerun validation/tests, and commit that legitimate source update before the final verification. Never suppress a source/schema failure to obtain a green run.

- [ ] **Step 4: Commit documentation/verification-owned file changes**

```bash
git add README.md .github/workflows/ci.yml public/data/earthquakes.json public/data/hotspots.json
git diff --cached --check
git commit -m "docs: document Pulso Publico V2"
```

Stage only files that actually changed; omit unchanged CI/snapshot paths.

- [ ] **Step 5: Create PR and verify feature-branch CI; stop before merge**

Open a PR from `feat/v2-territorial-design` to `main` with a summary covering:

```text
- unified V2 black-map identity
- unchanged SignalEnvelope 1.0 / four Pulso Nacional signals
- INPRES 7-day earthquake snapshot
- CONAE VIIRS 24-hour hotspot snapshot
- exact IGN polygon filtering
- independent stale/failure semantics and heartbeat
- MapLibre one-map Sismos/Focos interaction
```

Wait for CI on the exact PR HEAD and inspect the test/build result. Do **not** merge in this task. Present the PR, final commit SHA, CI result, real-source smoke result and known source limitations to the user for an explicit merge decision.

- [ ] **Step 6: Production completion gate only after explicit merge authorization**

If and only if the user separately authorizes merge, merge using the chosen reviewed strategy. Then verify the exact resulting `main` HEAD:

```text
CI green on final main HEAD
GitHub Pages deploy green on the same production HEAD
/data/signals.json reachable
/data/earthquakes.json reachable
/data/hotspots.json reachable
/data/argentina-provinces.geojson reachable
```

Visually inspect desktop and mobile production: Pulso Nacional and Pulso Territorial must read as one black/bone/amber product; Sismos/Focos switching must preserve viewport; stale/unavailable copy must be visible when forced/tested; no hotspot copy may claim confirmed fire or fire probability.

V2 is not called production-complete before this post-merge Pages verification succeeds.

---

## Self-review checklist

### Spec coverage

- Product/visual identity: Task 3.
- Unchanged scalar V1 contract: Tasks 1, 3 and 8 regression tests.
- Separate territorial contracts/loaders: Task 1.
- Official IGN geometry + exact point-in-polygon: Task 2.
- One MapLibre black map, persistent viewport, mode-specific layers and clusters: Task 4.
- INPRES parser, 168-hour window, magnitude/depth/province/intensity and foreign-event exclusion: Task 6.
- CONAE VIIRS WFS, 24-hour window, confidence/FRP/sensor/satellite and thermal-anomaly semantics: Task 7.
- Derived headline counts rather than second count APIs: Tasks 4 and 8.
- Independent unavailable/stale states and 240-minute threshold: Tasks 1 and 8.
- Hourly source checks, 180-minute heartbeat and fail-closed writes: Tasks 5–7.
- Accessibility/reduced motion/selection outside the map canvas: Task 8.
- Documentation, full regression, real-source smoke, PR and production release gate: Task 9.
- Explicitly deferred features remain absent: no risk score, GOES, FIRMS cross-check, weather/fuel overlays, playback, AI runtime, backend or direct GeoPlatform integration.

### Type consistency

The plan consistently uses `TerritorialKind = 'earthquake' | 'thermal-hotspot'`, `EarthquakeEvent`, `ThermalHotspotEvent`, `TerritorialSnapshot`, `sourceCheckedAt`, `staleAfterMinutes`, `confidence`, `frpMw`, `sensor`, `satellite`, `depthKm`, `province` and `intensityText` exactly as defined in the approved spec.

### Execution discipline

Every new behavior starts with a failing focused test, verifies RED, implements the minimum contract, verifies GREEN, and ends at a reviewable commit. Live source smoke tests occur only after deterministic fixture/unit coverage. Merge and production deployment remain a separate explicit user decision.