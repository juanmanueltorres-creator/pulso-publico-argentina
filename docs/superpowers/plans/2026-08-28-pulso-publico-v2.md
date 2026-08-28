# Pulso Público Argentina V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve Pulso Público into one coherent black-map national + territorial publication, preserving the four V1 scalar signals while adding independently refreshed INPRES earthquakes and CONAE VIIRS thermal hotspots over an interactive Argentina map.

**Architecture:** Keep `SignalEnvelope 1.0` and `public/data/signals.json` unchanged. Add a parallel territorial contract with independent `earthquakes.json` and `hotspots.json` snapshots, source-specific acquisition scripts, shared spatial/freshness utilities, and one MapLibre map that consumes only repository-published data. Source failures fail closed and never become zero events.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 3, Testing Library, Node 24 in CI, MapLibre GL JS, Cheerio for the INPRES HTML boundary, GitHub Actions, GitHub Pages, official IGN WFS/GeoJSON geometry.

**Spec:** `docs/superpowers/specs/2026-08-28-pulso-publico-v2-design.md`

## Global Constraints

- `SignalEnvelope 1.0` and `public/data/signals.json` remain backward compatible and unchanged in shape.
- Browser code never calls INPRES, CONAE or IGN provider endpoints directly; it reads checked-in/public snapshots only.
- Territorial windows are exactly 168 hours for earthquakes and 24 hours for thermal hotspots.
- `sourceCheckedAt` is the represented successful provider check; territorial data is stale at age `>= 240` minutes.
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

```ts
validateTerritorialSnapshot(input: unknown, expectedKind: 'earthquake'): TerritorialSnapshot<EarthquakeEvent>
validateTerritorialSnapshot(input: unknown, expectedKind: 'thermal-hotspot'): TerritorialSnapshot<ThermalHotspotEvent>
loadTerritorialSnapshot(kind: 'earthquake', fetcher?: typeof fetch, baseUrl?: string): Promise<TerritorialSnapshot<EarthquakeEvent>>
loadTerritorialSnapshot(kind: 'thermal-hotspot', fetcher?: typeof fetch, baseUrl?: string): Promise<TerritorialSnapshot<ThermalHotspotEvent>>
territorialAvailability(snapshot: TerritorialSnapshot<BaseTerritorialEvent>, now?: Date): 'available' | 'stale'
```

- [ ] **Step 1: Write failing contract tests**

Use the approved types in the test file:

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
  limitations: ['Epicentros dentro del límite nacional usado por Pulso Público.'],
  events: [{
    id: 'eq-1', kind: 'earthquake', occurredAt: '2026-08-28T00:15:00-03:00',
    latitude: -31.4, longitude: -68.6, magnitude: 4.2, depthKm: 86,
    place: null, province: 'San Juan', intensityText: 'II a III',
  }],
} satisfies TerritorialSnapshot<EarthquakeEvent>

const hotspotSnapshot = {
  schemaVersion: '1.0',
  kind: 'thermal-hotspot',
  generatedAt: '2026-08-28T04:00:00.000Z',
  sourceCheckedAt: '2026-08-28T04:00:00.000Z',
  window: { hours: 24 },
  freshness: { staleAfterMinutes: 240 },
  source: { name: 'CONAE', url: 'https://catalogos.conae.gov.ar/catalogo/catalogoGeoServiciosOGC.html', kind: 'official' },
  method: { type: 'wfs', note: 'VIIRS 24 h.' },
  limitations: ['Una anomalía térmica no implica un incendio confirmado.'],
  events: [{
    id: 'hot-1', kind: 'thermal-hotspot', occurredAt: '2026-08-28T03:10:00Z',
    latitude: -30.1, longitude: -62.2, confidence: 'high', frpMw: 18.5,
    sensor: 'VIIRS', satellite: 'NOAA20',
  }],
} satisfies TerritorialSnapshot<ThermalHotspotEvent>

it('accepts both approved territorial event contracts', () => {
  expect(validateTerritorialSnapshot(earthquakeSnapshot, 'earthquake').events[0].magnitude).toBe(4.2)
  expect(validateTerritorialSnapshot(hotspotSnapshot, 'thermal-hotspot').events[0].confidence).toBe('high')
})

it('rejects impossible coordinates, invalid confidence and kind mismatch', () => {
  expect(() => validateTerritorialSnapshot({
    ...earthquakeSnapshot,
    events: [{ ...earthquakeSnapshot.events[0], latitude: -95 }],
  }, 'earthquake')).toThrow(/latitude/i)

  expect(() => validateTerritorialSnapshot({
    ...hotspotSnapshot,
    events: [{ ...hotspotSnapshot.events[0], confidence: 'critical' }],
  }, 'thermal-hotspot')).toThrow(/confidence/i)

  expect(() => validateTerritorialSnapshot(earthquakeSnapshot, 'thermal-hotspot')).toThrow(/kind/i)
})

it('rejects invalid event and snapshot timestamps', () => {
  expect(() => validateTerritorialSnapshot({
    ...earthquakeSnapshot,
    sourceCheckedAt: 'yesterday',
  }, 'earthquake')).toThrow(/sourceCheckedAt/i)

  expect(() => validateTerritorialSnapshot({
    ...earthquakeSnapshot,
    events: [{ ...earthquakeSnapshot.events[0], occurredAt: 'unknown' }],
  }, 'earthquake')).toThrow(/occurredAt/i)
})
```

- [ ] **Step 2: Run contract tests and verify RED**

```bash
npm run test:run -- src/lib/validateTerritorialSnapshot.test.ts
```

Expected: FAIL because the territorial modules do not exist.

- [ ] **Step 3: Implement approved types and validator**

Create exactly:

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

The manual validator rejects non-finite coordinates, latitude outside `[-90, 90]`, longitude outside `[-180, 180]`, invalid dates, mismatched event/snapshot kind, earthquake window other than `168`, hotspot window other than `24`, invalid confidence, non-finite numeric fields and non-positive `staleAfterMinutes`.

- [ ] **Step 4: Write failing freshness and loader tests, then implement**

```ts
it('becomes stale exactly at the declared 240-minute boundary', () => {
  expect(territorialAvailability(earthquakeSnapshot, new Date('2026-08-28T07:59:59Z'))).toBe('available')
  expect(territorialAvailability(earthquakeSnapshot, new Date('2026-08-28T08:00:00Z'))).toBe('stale')
})

it('loads earthquakes below the Vite base path', async () => {
  let requested = ''
  const fetcher = async (input: RequestInfo | URL) => {
    requested = String(input)
    return new Response(JSON.stringify(earthquakeSnapshot), { status: 200 })
  }
  await loadTerritorialSnapshot('earthquake', fetcher as typeof fetch, '/pulso-publico-argentina/')
  expect(requested).toBe('/pulso-publico-argentina/data/earthquakes.json')
})

it('throws instead of turning an HTTP failure into zero events', async () => {
  const fetcher = async () => new Response('down', { status: 503 })
  await expect(loadTerritorialSnapshot('thermal-hotspot', fetcher as typeof fetch)).rejects.toThrow(/503/)
})
```

Implement freshness with `>=`:

```ts
export function territorialAvailability(
  snapshot: TerritorialSnapshot<BaseTerritorialEvent>,
  now = new Date(),
): 'available' | 'stale' {
  const ageMs = now.getTime() - Date.parse(snapshot.sourceCheckedAt)
  return ageMs >= snapshot.freshness.staleAfterMinutes * 60_000 ? 'stale' : 'available'
}
```

Use explicit routing:

```ts
const FILE_BY_KIND = {
  earthquake: 'earthquakes.json',
  'thermal-hotspot': 'hotspots.json',
} as const
```

Fetch with `{ cache: 'no-store' }`, require `response.ok`, and validate the returned JSON.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run test:run -- src/lib/validateTerritorialSnapshot.test.ts src/lib/loadTerritorialSnapshot.test.ts src/lib/territorialFreshness.test.ts
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

```js
pointInFeatureCollection([longitude, latitude], featureCollection): boolean
validateArgentinaFeatureCollection(input): object
fetchArgentinaGeometry(fetchImpl?: typeof fetch): Promise<object>
```

Official source URL:

```text
https://wms.ign.gob.ar/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=ign:provincia&outputFormat=application%2Fjson&srsName=EPSG%3A4326
```

- [ ] **Step 1: Write failing Polygon, hole and MultiPolygon tests**

```js
const polygon = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: {
    type: 'Polygon',
    coordinates: [[[-70,-35],[-60,-35],[-60,-25],[-70,-25],[-70,-35]]],
  }}],
}

const polygonWithHole = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: {
    type: 'Polygon',
    coordinates: [
      [[-70,-35],[-60,-35],[-60,-25],[-70,-25],[-70,-35]],
      [[-66,-31],[-64,-31],[-64,-29],[-66,-29],[-66,-31]],
    ],
  }}],
}

const multi = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [[[-70,-35],[-68,-35],[-68,-33],[-70,-33],[-70,-35]]],
      [[[-58,-28],[-56,-28],[-56,-26],[-58,-26],[-58,-28]]],
    ],
  }}],
}

it('handles Polygon, holes and MultiPolygon components', () => {
  expect(pointInFeatureCollection([-65, -30], polygon)).toBe(true)
  expect(pointInFeatureCollection([-72, -30], polygon)).toBe(false)
  expect(pointInFeatureCollection([-65, -30], polygonWithHole)).toBe(false)
  expect(pointInFeatureCollection([-57, -27], multi)).toBe(true)
})
```

- [ ] **Step 2: Run spatial test and verify RED**

```bash
npm run test:run -- scripts/lib/geo.test.mjs
```

Expected: FAIL because `geo.mjs` does not exist.

- [ ] **Step 3: Implement deterministic ray-casting membership**

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

For MultiPolygon return true when any polygon contains the point. Reject null/unsupported geometry in `validateArgentinaFeatureCollection`.

- [ ] **Step 4: Write failing official-fetch test and implement the IGN boundary**

```js
it('requires the official provincia FeatureCollection with 24 features', async () => {
  const features = Array.from({ length: 24 }, (_, index) => ({
    type: 'Feature', properties: { id: index }, geometry: {
      type: 'Polygon', coordinates: [[[-70,-35],[-69,-35],[-69,-34],[-70,-34],[-70,-35]]],
    },
  }))
  const fakeFetch = async () => new Response(JSON.stringify({ type: 'FeatureCollection', features }), { status: 200 })
  const result = await fetchArgentinaGeometry(fakeFetch)
  expect(result.features).toHaveLength(24)
})
```

Require HTTP success, `type === 'FeatureCollection'`, 24 features and only Polygon/MultiPolygon geometries. Add package script:

```json
"data:argentina-boundary": "node scripts/fetch-argentina-geometry.mjs"
```

Record `source`, `service: WFS`, `layer: ign:provincia`, `crs: EPSG:4326` and the exact URL in `public/data/argentina-provinces.source.json`. The CLI writes the GeoJSON atomically.

- [ ] **Step 5: Verify, acquire once and commit**

```bash
npm run test:run -- scripts/lib/geo.test.mjs scripts/fetch-argentina-geometry.test.mjs
npm run data:argentina-boundary
node -e "const fs=require('node:fs');const f=JSON.parse(fs.readFileSync('public/data/argentina-provinces.geojson','utf8'));console.log(f.type,f.features.length)"
```

Expected: `FeatureCollection 24`.

```bash
git add package.json scripts/lib/geo.mjs scripts/lib/geo.test.mjs scripts/fetch-argentina-geometry.mjs scripts/fetch-argentina-geometry.test.mjs public/data/argentina-provinces.geojson public/data/argentina-provinces.source.json
git commit -m "feat: add official Argentina boundary"
```

---

### Task 3: Redesign the complete V1 surface into the V2 identity

**Files:**
- Create: `src/components/SectionHeading.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/SignalCard.tsx`
- Modify: `src/components/SignalCard.test.tsx`
- Modify: `src/styles.css`

**Interfaces:** Existing `SignalSnapshot`, `SignalEnvelope`, `loadSignals` and `SignalCard` behavior remain intact.

- [ ] **Step 1: Add failing App identity assertions while keeping all V1 regressions**

```tsx
expect(await screen.findByRole('heading', { name: 'Pulso Público' })).toBeInTheDocument()
expect(screen.getByText('Qué está pasando. Dónde. Y cómo lo sabemos.')).toBeInTheDocument()
expect(screen.getByText('Datos que se mueven. Fuentes que se pueden revisar.')).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'Pulso Nacional' })).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'Pulso Territorial' })).toBeInTheDocument()
```

Retain the four existing signal-family assertions and every existing `SignalCard` provenance/count-up/reduced-motion assertion.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- src/App.test.tsx src/components/SignalCard.test.tsx
```

Expected: new hero/section assertions FAIL.

- [ ] **Step 3: Implement the unified hierarchy**

`SectionHeading`:

```tsx
interface SectionHeadingProps {
  eyebrow: string
  title: string
  description: string
}
```

Hero core:

```tsx
<header className="hero">
  <p className="eyebrow">ARGENTINA · DATOS PÚBLICOS</p>
  <h1>Pulso Público</h1>
  <p className="hero__lead">Qué está pasando. Dónde. Y cómo lo sabemos.</p>
  <p className="hero__principle">Datos que se mueven. Fuentes que se pueden revisar.</p>
</header>
```

Render `Pulso Nacional` before the existing signal grid and a real empty `Pulso Territorial` section shell after it. Do not invent territorial counts or source values.

- [ ] **Step 4: Apply the approved black/bone/amber tokens**

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

Keep thin borders, focus-visible outline, number count-up and `prefers-reduced-motion`. The four V1 cards must visually use the same tokens as the territorial shell.

- [ ] **Step 5: Verify GREEN/build and commit**

```bash
npm run test:run -- src/App.test.tsx src/components/SignalCard.test.tsx
npm run build
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

```ts
eventsToFeatureCollection(events: BaseTerritorialEvent[]): object
earthquakeRadius(magnitude: number): number
explainEarthquake(event: EarthquakeEvent): string
explainHotspot(event: ThermalHotspotEvent): string

interface TerritorialMapProps {
  mode: TerritorialKind
  earthquakes: EarthquakeEvent[]
  hotspots: ThermalHotspotEvent[]
  selectedId: string | null
  onSelect: (event: EarthquakeEvent | ThermalHotspotEvent) => void
}
```

- [ ] **Step 1: Install MapLibre and write failing pure tests**

```bash
npm install maplibre-gl
```

```ts
it('bounds earthquake marker radius', () => {
  expect(earthquakeRadius(1)).toBeGreaterThanOrEqual(3)
  expect(earthquakeRadius(8)).toBeLessThanOrEqual(18)
  expect(earthquakeRadius(5)).toBeGreaterThan(earthquakeRadius(3))
})

it('converts events to Point features with stable identity', () => {
  const fc = eventsToFeatureCollection([earthquakeEvent]) as any
  expect(fc.features[0]).toMatchObject({
    geometry: { type: 'Point', coordinates: [-68.6, -31.4] },
    properties: { id: 'eq-1', kind: 'earthquake' },
  })
})

it('explains hotspots without upgrading detections into fires', () => {
  const text = explainHotspot(hotspotEvent)
  expect(text).toContain('Una detección térmica no implica un incendio confirmado.')
  expect(text).not.toMatch(/probabilidad de incendio/i)
})
```

- [ ] **Step 2: Verify RED, implement pure helpers, verify GREEN**

```bash
npm run test:run -- src/lib/territorialMapData.test.ts src/lib/explainTerritorial.test.ts
```

Expected: FAIL before implementation.

Implement:

```ts
export function earthquakeRadius(magnitude: number): number {
  return Math.max(3, Math.min(18, 2 + magnitude * 2))
}
```

`eventsToFeatureCollection` uses `[longitude, latitude]` and copies only display properties needed by map layers.

Rerun the same focused command; expected PASS.

- [ ] **Step 3: Write failing section-mode tests**

With deterministic loaders returning 2 earthquakes and 3 hotspots:

```tsx
expect(screen.getByRole('button', { name: /sismos/i })).toHaveAttribute('aria-pressed', 'true')
expect(screen.getByText(/2 sismos registrados/i)).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: /focos de calor/i }))
expect(screen.getByText(/3 focos de calor detectados/i)).toBeInTheDocument()
expect(screen.getByText(/1 con confianza alta/i)).toBeInTheDocument()
expect(screen.getByText(/detección térmica no implica un incendio confirmado/i)).toBeInTheDocument()
```

A second test rejects the earthquake loader, resolves the hotspot loader, switches to hotspots and asserts the hotspot count remains usable.

- [ ] **Step 4: Implement one persistent MapLibre instance**

Import CSS once:

```ts
import 'maplibre-gl/dist/maplibre-gl.css'
```

Use fixed initial fit bounds for South American Argentina:

```ts
const ARGENTINA_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [-73.7, -55.3],
  [-53.5, -21.7],
]
```

Map style uses black background and local `${import.meta.env.BASE_URL}data/argentina-provinces.geojson`, with no commercial/runtime tile provider. Create separate sources:

```text
earthquakes: cluster=false
hotspots: cluster=true, clusterRadius=40
```

Create these layers:

```text
argentina-fill
argentina-province-lines
earthquake-points
hotspot-clusters
hotspot-cluster-count
hotspot-points
```

Mode changes call `setLayoutProperty(layer, 'visibility', ...)` and never recreate the map or call `fitBounds`. `TerritorialSection` clears selected event id on domain change but leaves camera untouched.

- [ ] **Step 5: Test map persistence, build and commit**

Mock `maplibre-gl` and assert `new Map()` executes once across a rerender from earthquake to hotspot while visibility calls change.

```bash
npm run test:run -- src/lib/territorialMapData.test.ts src/lib/explainTerritorial.test.ts src/components/TerritorialMap.test.tsx src/components/TerritorialSection.test.tsx src/App.test.tsx
npm run build
git add package.json package-lock.json src/main.tsx src/test/territorialFixtures.ts src/lib/territorialMapData.ts src/lib/territorialMapData.test.ts src/lib/explainTerritorial.ts src/lib/explainTerritorial.test.ts src/components/TerritorialLegend.tsx src/components/TerritorialDetail.tsx src/components/TerritorialMap.tsx src/components/TerritorialMap.test.tsx src/components/TerritorialSection.tsx src/components/TerritorialSection.test.tsx src/App.tsx src/styles.css
git commit -m "feat: add territorial black map shell"
```

---

### Task 5: Shared territorial publication and freshness heartbeat

**Files:**
- Create: `scripts/lib/territorial-snapshot.mjs`
- Test: `scripts/lib/territorial-snapshot.test.mjs`
- Create: `scripts/lib/write-json-atomic.mjs`
- Test: `scripts/lib/write-json-atomic.test.mjs`

**Interfaces:**

```js
semanticTerritorialPayload(snapshot): object
territorialPayloadEqual(a, b): boolean
prepareTerritorialPublication(previous, candidate, checkedAt, heartbeatMinutes = 180): { publish: boolean, snapshot: object }
writeJsonAtomic(path, value): Promise<void>
```

- [ ] **Step 1: Write failing material-change/heartbeat tests**

With previous `sourceCheckedAt = 2026-08-28T04:00:00Z`:

```js
it('publishes material event changes immediately', () => {
  const result = prepareTerritorialPublication(previous, { ...previous, events: [newEvent] }, '2026-08-28T05:00:00Z')
  expect(result.publish).toBe(true)
  expect(result.snapshot.sourceCheckedAt).toBe('2026-08-28T05:00:00Z')
})

it('suppresses an unchanged hourly timestamp-only write', () => {
  const result = prepareTerritorialPublication(previous, previous, '2026-08-28T05:00:00Z')
  expect(result.publish).toBe(false)
  expect(result.snapshot).toEqual(previous)
})

it('publishes the freshness heartbeat exactly at 180 minutes', () => {
  const result = prepareTerritorialPublication(previous, previous, '2026-08-28T07:00:00Z')
  expect(result.publish).toBe(true)
  expect(result.snapshot.sourceCheckedAt).toBe('2026-08-28T07:00:00Z')
})
```

Write an atomic-file test in a temporary directory, call `writeJsonAtomic`, read the destination JSON and assert no `.tmp` remains.

- [ ] **Step 2: Verify RED**

```bash
npm run test:run -- scripts/lib/territorial-snapshot.test.mjs scripts/lib/write-json-atomic.test.mjs
```

- [ ] **Step 3: Implement semantic comparison and heartbeat**

```js
export function semanticTerritorialPayload(snapshot) {
  const { generatedAt: _generatedAt, sourceCheckedAt: _sourceCheckedAt, ...semantic } = snapshot
  return semantic
}

export function territorialPayloadEqual(a, b) {
  return JSON.stringify(semanticTerritorialPayload(a)) === JSON.stringify(semanticTerritorialPayload(b))
}
```

Publish when there is no previous snapshot, semantic payload differs, or `checkedAt - previous.sourceCheckedAt >= 180 min`. On publish set both `generatedAt` and `sourceCheckedAt` to `checkedAt`; on suppression return the previous object unchanged. `writeJsonAtomic` writes `<path>.tmp` then renames it.

- [ ] **Step 4: Verify GREEN and commit**

```bash
npm run test:run -- scripts/lib/territorial-snapshot.test.mjs scripts/lib/write-json-atomic.test.mjs
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
- Create from real successful refresh: `public/data/earthquakes.json`

**Interfaces:**

```js
parseInpresLocalDate(value): string
parseInpresEarthquakes(html): object[]
fetchInpresEarthquakes(fetchImpl?: typeof fetch): Promise<object[]>
selectInpresEarthquakes(events, argentinaGeometry, checkedAt): object[]
refreshInpresSnapshot(previous, argentinaGeometry, fetchImpl, checkedAt): Promise<{ publish: boolean, snapshot: object }>
```

Source: `https://www.inpres.gob.ar/sismos_consultados`.

- [ ] **Step 1: Install Cheerio and create the deterministic HTML fixture**

```bash
npm install --save-dev cheerio
```

Fixture core:

```html
<table>
  <thead><tr><th>Nro</th><th>Fecha y hora</th><th>Latitud</th><th>Longitud</th><th>Prof.</th><th>Magn.</th><th>Intensidad</th><th>Provincia</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>28/08/2026 01:15:30</td><td>-31.400</td><td>-68.600</td><td>86</td><td>4.2</td><td>II a III</td><td>San Juan</td></tr>
    <tr><td>2</td><td>19/08/2026 08:00:00</td><td>-32.000</td><td>-68.000</td><td>20</td><td>2.5</td><td></td><td>Mendoza</td></tr>
    <tr><td>3</td><td>28/08/2026 00:20:00</td><td>-31.500</td><td>-70.500</td><td>40</td><td>3.1</td><td></td><td>Chile</td></tr>
  </tbody>
</table>
```

- [ ] **Step 2: Write failing parser tests**

```js
it('normalizes INPRES local time with explicit UTC-3 offset', () => {
  expect(parseInpresLocalDate('28/08/2026 01:15:30')).toBe('2026-08-28T01:15:30-03:00')
})

it('parses magnitude, depth, province and intensity', () => {
  const [event] = parseInpresEarthquakes(fixture)
  expect(event).toMatchObject({
    kind: 'earthquake', magnitude: 4.2, depthKm: 86,
    province: 'San Juan', intensityText: 'II a III', place: null,
  })
})

it('fails closed when a required heading changes', () => {
  expect(() => parseInpresEarthquakes(fixture.replace('Magn.', 'Valor'))).toThrow(/required heading/i)
})
```

Parser identifies columns by normalized headings `fecha y hora`, `latitud`, `longitud`, `prof.`, `magn.`, `intensidad`, `provincia`; no fixed column positions. Accept `DD/MM/YYYY HH:mm:ss` and `DD/MM/YYYY HH:mm`.

- [ ] **Step 3: Verify RED, implement parser with deterministic ids, verify GREEN**

```bash
npm run test:run -- scripts/adapters/inpres.test.mjs
```

Use SHA-256 fallback identity:

```js
import { createHash } from 'node:crypto'
function earthquakeId(event) {
  const key = [event.occurredAt, event.latitude, event.longitude, event.depthKm ?? '', event.magnitude].join('|')
  return `inpres-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`
}
```

Rerun the focused test; expected PASS.

- [ ] **Step 4: Write failing fetch/filter/publication tests and implement**

```js
it('filters by 168 hours and exact Argentina polygon', () => {
  const selected = selectInpresEarthquakes(parsedEvents, argentinaFixture, '2026-08-28T05:00:00Z')
  expect(selected).toHaveLength(1)
  expect(selected[0].province).toBe('San Juan')
})

it('rejects source HTTP failure instead of publishing zero', async () => {
  const down = async () => new Response('down', { status: 503 })
  await expect(refreshInpresSnapshot(previous, argentinaFixture, down, '2026-08-28T05:00:00Z')).rejects.toThrow(/503/)
})
```

Selection implementation:

```js
const cutoff = Date.parse(checkedAt) - 168 * 60 * 60 * 1000
return events
  .filter((event) => Date.parse(event.occurredAt) >= cutoff && Date.parse(event.occurredAt) <= Date.parse(checkedAt) + 5 * 60_000)
  .filter((event) => pointInFeatureCollection([event.longitude, event.latitude], argentinaGeometry))
  .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
```

Snapshot metadata is exactly: kind `earthquake`, window `168`, stale `240`, source name `INPRES`, method `scrape`, source URL above. Pass candidate through `prepareTerritorialPublication`.

- [ ] **Step 5: Add CLI/workflow, run live source once and commit**

Package script:

```json
"refresh:inpres": "node scripts/refresh-inpres.mjs"
```

Workflow:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: '7 * * * *'
concurrency:
  group: refresh-territorial
  cancel-in-progress: false
```

Use checkout@v7, setup-node@v7 Node 24, `npm install --no-audit --no-fund`, run refresh, and commit only when `public/data/earthquakes.json` changed.

```bash
npm run test:run -- scripts/adapters/inpres.test.mjs scripts/fetch-inpres.test.mjs scripts/refresh-inpres-lib.test.mjs
npm run refresh:inpres
npm run test:run
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
- Create from real successful refresh: `public/data/hotspots.json`

**Interfaces:**

```js
normalizeHotspotConfidence(raw): 'low' | 'nominal' | 'high' | 'unknown'
parseConaeHotspots(featureCollection): object[]
fetchConaeHotspots(fetchImpl?: typeof fetch): Promise<object[]>
selectConaeHotspots(events, argentinaGeometry, checkedAt): object[]
refreshConaeHotspotSnapshot(previous, argentinaGeometry, fetchImpl, checkedAt): Promise<{ publish: boolean, snapshot: object }>
```

WFS base: `https://geoservicios.conae.gov.ar/geoserver/GeoServiciosCONAE/wfs`  
Layer: `GeoServiciosCONAE:FocosDeCalorVIIRS`

- [ ] **Step 1: Create deterministic capabilities/GeoJSON fixtures and failing confidence tests**

Capabilities core:

```xml
<WFS_Capabilities><FeatureTypeList><FeatureType><Name>GeoServiciosCONAE:FocosDeCalorVIIRS</Name></FeatureType></FeatureTypeList></WFS_Capabilities>
```

GeoJSON core:

```json
{
  "type": "FeatureCollection",
  "features": [
    {"type":"Feature","id":"viirs.1","geometry":{"type":"Point","coordinates":[-62.2,-30.1]},"properties":{"Fecha":"2026-08-28","Hora":"03:10:00","FP_Confidence":"Alta","FP_Power":18.5,"Satelite":"NOAA20","Instrumento":"VIIRS"}},
    {"type":"Feature","id":"viirs.2","geometry":{"type":"Point","coordinates":[-70.5,-31.5]},"properties":{"Fecha":"2026-08-28","Hora":"03:20:00","FP_Confidence":8,"FP_Power":null,"Satelite":"SNPP","Instrumento":"VIIRS"}}
  ]
}
```

Confidence mapping:

```js
it('maps only source-defensible categories/codes and refuses percentage thresholds', () => {
  expect(normalizeHotspotConfidence(9)).toBe('high')
  expect(normalizeHotspotConfidence('Alta')).toBe('high')
  expect(normalizeHotspotConfidence(8)).toBe('nominal')
  expect(normalizeHotspotConfidence(87)).toBe('unknown')
})
```

No `0–100` threshold is invented.

- [ ] **Step 2: Write failing feature parser tests, verify RED, implement parser**

```js
it('normalizes Point coordinates, FRP, sensor, satellite and time', () => {
  const [event] = parseConaeHotspots(fixture)
  expect(event).toMatchObject({
    kind: 'thermal-hotspot', latitude: -30.1, longitude: -62.2,
    confidence: 'high', frpMw: 18.5, sensor: 'VIIRS', satellite: 'NOAA20',
    occurredAt: '2026-08-28T03:10:00.000Z',
  })
})

it('fails a feature with no recognized acquisition timestamp', () => {
  const bad = structuredClone(fixture)
  delete bad.features[0].properties.Fecha
  delete bad.features[0].properties.Hora
  expect(() => parseConaeHotspots(bad)).toThrow(/timestamp/i)
})
```

```bash
npm run test:run -- scripts/adapters/conae-hotspots.test.mjs
```

Recognize properties case-insensitively:

```text
FRP: FP_Power, frp, FRP
confidence: FP_Confidence, confidence
satellite: Satelite, satellite
sensor: Instrumento, instrument, sensor
combined time: FechaHora, fecha_hora, datetime, timestamp
separate date: Fecha, fecha, acq_date
separate time: Hora, hora, acq_time
```

Combined timestamps must pass `Date.parse`. Separate `Fecha`/`Hora` supports `YYYY-MM-DD` or `DD/MM/YYYY` + `HH:mm[:ss]` and is normalized as UTC acquisition time. Missing/unparseable time throws; never substitute `sourceCheckedAt` for observation time. Only Point geometry is accepted. Blank/missing FRP becomes `null`.

- [ ] **Step 3: Write failing WFS boundary tests and implement capabilities + GetFeature**

```js
it('fails closed when the advertised VIIRS layer is missing', async () => {
  const fakeFetch = vi.fn().mockResolvedValueOnce(new Response('<WFS_Capabilities/>', { status: 200 }))
  await expect(fetchConaeHotspots(fakeFetch)).rejects.toThrow(/FocosDeCalorVIIRS/)
})
```

Build URLs with `URLSearchParams`. Request 1: `service=WFS`, `version=2.0.0`, `request=GetCapabilities`. Require exact layer name. Request 2: `service=WFS`, `version=2.0.0`, `request=GetFeature`, `typeNames=GeoServiciosCONAE:FocosDeCalorVIIRS`, `outputFormat=application/json`, `srsName=EPSG:4326`. Require both HTTP responses to be OK.

- [ ] **Step 4: Write failing 24-hour/polygon/publication tests and implement**

```js
it('keeps only last-24-hour detections inside Argentina', () => {
  const selected = selectConaeHotspots(parsedEvents, argentinaFixture, '2026-08-28T05:00:00Z')
  expect(selected.map((event) => event.id)).toEqual(['viirs.1'])
})

it('does not publish a synthetic empty snapshot on provider failure', async () => {
  const down = async () => new Response('down', { status: 503 })
  await expect(refreshConaeHotspotSnapshot(previous, argentinaFixture, down, '2026-08-28T05:00:00Z')).rejects.toThrow()
})
```

Selection:

```js
const cutoff = Date.parse(checkedAt) - 24 * 60 * 60 * 1000
return events
  .filter((event) => Date.parse(event.occurredAt) >= cutoff && Date.parse(event.occurredAt) <= Date.parse(checkedAt) + 5 * 60_000)
  .filter((event) => pointInFeatureCollection([event.longitude, event.latitude], argentinaGeometry))
  .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
```

Snapshot metadata is exactly: kind `thermal-hotspot`, window `24`, stale `240`, source name `CONAE`, method `wfs`, catalog source URL. Limitations state: thermal anomaly ≠ confirmed fire; confidence ≠ wildfire probability; V2 does not turn FRP into danger. Pass candidate through `prepareTerritorialPublication`.

- [ ] **Step 5: Add CLI/workflow, run live WFS once and commit**

Package script:

```json
"refresh:conae": "node scripts/refresh-conae-hotspots.mjs"
```

Workflow:

```yaml
schedule:
  - cron: '37 * * * *'
concurrency:
  group: refresh-territorial
  cancel-in-progress: false
```

Use checkout@v7, setup-node@v7 Node 24, `npm install --no-audit --no-fund`, run refresh, commit only changed `public/data/hotspots.json`.

```bash
npm run test:run -- scripts/adapters/conae-hotspots.test.mjs scripts/fetch-conae-hotspots.test.mjs scripts/refresh-conae-hotspots-lib.test.mjs
npm run refresh:conae
npm run test:run
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
- Modify only if needed by map mocks: `src/test/setup.ts`

**Interfaces:** Independent load states per territorial source. Loader rejection maps to UI `unavailable`, not `events: []`. Stale is derived only from `sourceCheckedAt`.

- [ ] **Step 1: Write failing real-contract counter/failure/stale tests**

```tsx
expect(screen.getByText('2 sismos registrados · últimos 7 días')).toBeInTheDocument()
expect(screen.getByText('1 de magnitud 4 o superior')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: /focos de calor/i }))
expect(screen.getByText('3 focos de calor detectados · últimas 24 h')).toBeInTheDocument()
expect(screen.getByText('1 con confianza alta')).toBeInTheDocument()
expect(screen.queryByText(/incendios activos/i)).not.toBeInTheDocument()
expect(screen.queryByText(/probabilidad de incendio/i)).not.toBeInTheDocument()
```

For stale, inject `now = 2026-08-28T08:00:00Z` for `sourceCheckedAt = 04:00` and assert `Datos desactualizados` plus the represented last check. For rejected CONAE loader assert `Fuente temporalmente no disponible` while Pulso Nacional and Sismos remain visible.

- [ ] **Step 2: Write failing selection/detail tests**

Earthquake selection must expose `Magnitud 4,2`, `86 km`, `San Juan`, `II a III`, occurrence time and an INPRES source link. Hotspot selection must expose `Confianza alta`, `18,5 MW`, `VIIRS`, `NOAA20`, occurrence time, CONAE source link and:

```text
Una detección térmica no implica un incendio confirmado.
```

- [ ] **Step 3: Implement independent source state and accessible controls**

```ts
type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; snapshot: T }
  | { status: 'error' }
```

Start each loader independently; do not use a failure-coupled `Promise.all`. Buttons use `type="button"`, `aria-pressed`, visible focus, and reset selection when switching domain. Counts derive only from the active snapshot event array.

- [ ] **Step 4: Wire selection and reduced motion**

Map click handlers query only `earthquake-points` or `hotspot-points`, resolve the exact `id` against props, and call `onSelect`. First event selection never calls `fitBounds`/`flyTo`. Map region:

```tsx
<div role="region" aria-label="Mapa de señales territoriales de Argentina" ref={containerRef} />
```

`Cómo leer este mapa` is keyboard reachable. Earthquake legend text is `Tamaño = magnitud`; hotspot legend text is `Más marcado = mayor confianza de detección`. Layer transitions apply only under `prefers-reduced-motion: no-preference`.

- [ ] **Step 5: Verify GREEN/regressions/build and commit**

```bash
npm run test:run -- src/components/TerritorialSection.test.tsx src/components/TerritorialMap.test.tsx src/lib/explainTerritorial.test.ts src/App.test.tsx src/components/SignalCard.test.tsx src/lib/loadSignals.test.ts src/lib/validateSnapshot.test.ts
npm run build
git add src/components/TerritorialSection.tsx src/components/TerritorialSection.test.tsx src/components/TerritorialMap.tsx src/components/TerritorialMap.test.tsx src/components/TerritorialDetail.tsx src/components/TerritorialLegend.tsx src/lib/explainTerritorial.ts src/styles.css src/App.test.tsx
git add src/test/setup.ts 2>/dev/null || true
git commit -m "feat: integrate territorial interactions and states"
```

Before commit, unstage `src/test/setup.ts` if it is unchanged.

---

### Task 9: Documentation, full verification, PR and production release gate

**Files:**
- Modify: `README.md`
- Modify only if the existing commands do not cover new tests: `.github/workflows/ci.yml`
- Verify without gratuitous edit: `.github/workflows/deploy-pages-preview.yml`
- Verify: `.github/workflows/refresh-inpres.yml`
- Verify: `.github/workflows/refresh-conae-hotspots.yml`

**Public outputs after production merge:**

```text
/data/signals.json
/data/earthquakes.json
/data/hotspots.json
/data/argentina-provinces.geojson
```

- [ ] **Step 1: Update README to match V2 truthfully**

Document:

```text
Pulso Nacional → CAMMESA, OpenAlex, INPI, GeoRef
Pulso Territorial → INPRES sismos (7 días), CONAE VIIRS focos de calor (24 h)
```

Add links to all public JSON/GeoJSON outputs. State explicitly that thermal detections are not confirmed fires, magnitude is not predicted damage, source checks are hourly, heartbeat is 180 minutes and stale threshold is 240 minutes.

Architecture diagram:

```text
fuentes nacionales -> SignalEnvelope -> signals.json
INPRES -> EarthquakeEvent -> earthquakes.json --\
                                            -> black map -> React/Vite -> GitHub Pages
CONAE  -> ThermalHotspotEvent -> hotspots.json --/
```

- [ ] **Step 2: Confirm CI coverage rather than adding live-provider tests**

Required existing CI sequence remains:

```yaml
- run: python3 scripts/cammesa_xlsx_test.py
- run: npm install --no-audit --no-fund
- run: npm run test:run
- run: npm run build
```

`npm run test:run` must discover the new TS/TSX/MJS deterministic tests. Do not make CI depend on live INPRES/CONAE network availability.

- [ ] **Step 3: Run fresh final verification on exact feature HEAD**

```bash
npm install --no-audit --no-fund
python3 scripts/cammesa_xlsx_test.py
npm run test:run
npm run build -- --base=/pulso-publico-argentina/
git diff --check
npm run refresh:inpres
npm run refresh:conae
npm run test:run
npm run build -- --base=/pulso-publico-argentina/
git diff --check
```

A real provider/schema failure remains a failed verification and is investigated; it is never converted to an empty successful snapshot. If live refresh legitimately changes a snapshot, inspect it, rerun tests/build and commit that source update before declaring the feature HEAD verified.

- [ ] **Step 4: Commit README and any legitimate verification-owned data change**

```bash
git add README.md public/data/earthquakes.json public/data/hotspots.json
git diff --cached --check
git commit -m "docs: document Pulso Publico V2"
```

Stage `.github/workflows/ci.yml` only if it actually changed.

- [ ] **Step 5: Open PR, verify exact PR HEAD and stop before merge**

PR summary must mention the unified black-map identity, unchanged `SignalEnvelope 1.0`, INPRES 7-day pipeline, CONAE VIIRS 24-hour pipeline, IGN polygon filtering, independent stale/failure semantics, heartbeat and one-map Sismos/Focos interaction.

Wait for CI on the exact PR HEAD. Report PR link, final SHA, CI status, real-source smoke result and source limitations. Do not merge without a separate explicit user decision.

- [ ] **Step 6: Production completion gate after explicit merge authorization only**

After an explicitly authorized merge, verify the exact resulting `main` HEAD:

```text
CI green on final main HEAD
GitHub Pages deploy green on that production HEAD
/data/signals.json reachable
/data/earthquakes.json reachable
/data/hotspots.json reachable
/data/argentina-provinces.geojson reachable
```

Visually inspect desktop and mobile production: Pulso Nacional and Pulso Territorial share one black/bone/amber identity; Sismos/Focos switching preserves viewport; selected-event details are readable outside the canvas; hotspot copy does not claim fire confirmation/probability. V2 is not called production-complete before this gate succeeds.

---

## Self-review

### Spec coverage

- Full V2 identity and `Pulso Nacional / Pulso Territorial`: Task 3.
- Unchanged scalar V1 contract/regressions: Tasks 1, 3, 8.
- Territorial contracts/loaders/freshness: Task 1.
- Official IGN geometry and exact country filtering: Task 2.
- One MapLibre black map, clusters and preserved viewport: Task 4.
- Material-change publication + 180-minute heartbeat: Task 5.
- INPRES 168-hour earthquake pipeline: Task 6.
- CONAE VIIRS 24-hour hotspot pipeline and conservative confidence semantics: Task 7.
- Independent loading/stale/unavailable states, selection, accessibility and reduced motion: Task 8.
- Documentation, regression, live-source smoke, PR and production verification gate: Task 9.
- Deferred features remain absent: no fire-risk score, GOES, FIRMS cross-check, weather/fuel overlays, playback, backend, AI runtime or direct GeoPlatform integration.

### Type consistency

All tasks use the approved names: `TerritorialKind`, `EarthquakeEvent`, `ThermalHotspotEvent`, `TerritorialSnapshot`, `sourceCheckedAt`, `staleAfterMinutes`, `confidence`, `frpMw`, `sensor`, `satellite`, `depthKm`, `province`, `intensityText`.

### Execution discipline

Each new behavior begins with a focused failing test, verifies RED, implements the smallest specified contract, verifies GREEN and ends at a reviewable commit. Live provider smoke checks occur only after deterministic fixture coverage. Merge and production deployment remain a separate explicit decision.