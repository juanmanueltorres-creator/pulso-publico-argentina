# Pulso Público V3.1 — Hotspot Weather Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed hourly `WeatherSnapshot 1.0` over a 0.5° Argentina grid and expose modeled 24-hour meteorological context around selected CONAE thermal hotspots without implying causality or confirmed fire.

**Architecture:** Preserve the existing territorial contracts and add weather as an independent pipeline: official Argentina geometry → deterministic Pulso grid → Open-Meteo Historical Forecast using ECMWF IFS HRES → validated `weather.json` → independent React loader → pure spatial/temporal matching → persistent MapLibre layers. The browser reads Pulso-owned static JSON only; it never calls Open-Meteo directly.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 3, Testing Library, MapLibre GL 6, Node 24 ESM scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-28-pulso-hotspot-weather-context-design.md`

## Global Constraints

- Preserve `SignalEnvelope 1.0`, `TerritorialSnapshot 1.0`, `EvidenceSnapshot 1.0`, and `TerritorialKind = 'earthquake' | 'thermal-hotspot'`.
- Weather is a separate `WeatherSnapshot 1.0`; never add `weather` to `TerritorialKind`.
- Grid spacing is exactly `0.5°`, filtered with `public/data/argentina-provinces.geojson` and existing fail-closed Polygon/MultiPolygon logic.
- Publish exactly 24 common hourly UTC frames. All weather arrays align 1:1 with the global `timestamps` array.
- Source: Open-Meteo Historical Forecast, `models=ecmwf_ifs`, ECMWF IFS HRES 9 km.
- Variables: `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `precipitation`.
- Units: °C, %, km/h, meteorological degrees, mm. Internal time is UTC.
- Missing values remain `null`; errors/missing data never become zero.
- `sourceCheckedAt` and `dataThrough` are distinct. Initial stale threshold is exactly 180 minutes.
- Hotspot mode shows weather neighbors only after hotspot selection; maximum six neighbors, with one primary reference.
- Weather mode defaults to the latest frame and offers only `Temperatura | Viento | Humedad` in V3.1.
- View changes and selections must not recreate MapLibre, reset camera/zoom, `flyTo`, or `fitBounds`.
- UI must say modeled context, not station/measurement-at-fire. Distance and time difference are always visible for hotspot context.
- Mandatory caveat: `Estas condiciones coexistían aproximadamente en espacio y tiempo con la detección. No prueban su causa ni confirman por sí solas un incendio.`
- Open-Meteo/ECMWF attribution is visible in product and README.
- Weather refresh has its own workflow/concurrency and never overwrites the last valid snapshot after failure.
- Out of scope: animation, timeline/play, future forecast, heatmap/interpolation, particles, SMN stations, NOAA direct ingest, GOES, smoke, burn scar, ML, risk score, causal inference, Evidencia redesign.
- TDD throughout. Final gate: CAMMESA Python tests, all JS/TS tests, TypeScript/Vite build, `git diff --check`, green PR CI, exact merged Pages SHA.

---

## File Map

### Create

- `src/types/weather.ts` — weather contract + `TerritorialViewMode` + `WeatherVariable`.
- `src/test/weatherFixtures.ts` — deterministic frontend fixtures.
- `src/lib/validateWeatherSnapshot.ts` / `.test.ts` — runtime contract guard.
- `src/lib/loadWeatherSnapshot.ts` / `.test.ts` — `/data/weather.json` loader.
- `src/lib/weatherContext.ts` / `.test.ts` — Haversine + temporal matching.
- `src/lib/weatherMapData.ts` / `.test.ts` — active-frame GeoJSON, neighbors, link, wind direction vectors.
- `src/components/WeatherDetail.tsx` / `.test.tsx` — selected weather point.
- `src/components/HotspotWeatherContext.tsx` / `.test.tsx` — secondary context under selected hotspot.
- `src/components/TerritorialLegend.test.tsx` — weather legend semantics; no such file exists on current `main`.
- `scripts/lib/weather-grid.mjs` / `.test.mjs` — deterministic 0.5° grid.
- `scripts/fetch-open-meteo-weather.mjs` / `.test.mjs` — provider adapter + batching.
- `scripts/refresh-weather-lib.mjs` / `.test.mjs` — common frames + validated publication candidate.
- `scripts/refresh-weather.mjs` — CLI + atomic write.
- `.github/workflows/refresh-weather.yml` — hourly independent refresh.
- `public/data/weather.json` — generated first valid snapshot.

### Modify

- `src/components/TerritorialSection.tsx` / `.test.tsx` — weather load/state/view controls/selection memory.
- `src/components/TerritorialMap.tsx` / `.test.tsx` — weather sources/layers without map recreation.
- `src/components/TerritorialMap.hotspot-selection.test.tsx` — preserve production hotspot click path with expanded props.
- `src/components/TerritorialDetail.tsx` — add an explicit post-detail slot only.
- `src/components/TerritorialLegend.tsx` — accept weather view + variable.
- `src/styles.css` — bounded weather UI styling.
- `package.json` — `refresh:weather`.
- `README.md` — source/attribution/semantics.

Do **not** modify `src/types/territorial.ts` or `src/lib/loadTerritorialSnapshot.ts` for weather.

---

### Task 1: `WeatherSnapshot 1.0` contract and validator

**Files:**
- Create: `src/types/weather.ts`
- Create: `src/test/weatherFixtures.ts`
- Create: `src/lib/validateWeatherSnapshot.ts`
- Create: `src/lib/validateWeatherSnapshot.test.ts`

**Interfaces:**
- Produces `WeatherSnapshot`, `WeatherPoint`, `WeatherVariable`, `TerritorialViewMode`, `validateWeatherSnapshot(input: unknown): WeatherSnapshot`.
- Consumed by Tasks 2, 5–10.

- [ ] **Step 1: Write the exact contract types**

```ts
// src/types/weather.ts
import type { TerritorialKind } from './territorial'

export type TerritorialViewMode = TerritorialKind | 'weather'
export type WeatherVariable = 'temperature' | 'wind' | 'humidity'

export interface WeatherSnapshot {
  schemaVersion: '1.0'
  generatedAt: string
  sourceCheckedAt: string
  dataThrough: string
  window: { hours: 24; stepHours: 1 }
  freshness: { staleAfterMinutes: number }
  grid: { spacingDegrees: 0.5; pointCount: number }
  timestamps: string[]
  source: {
    provider: string
    dataset: string
    url: string
    kind: 'numerical-weather-model'
    license: string
  }
  method: {
    type: 'historical-forecast-grid'
    temporalResolutionMinutes: 60
    note: string
  }
  limitations: string[]
  points: WeatherPoint[]
}

export interface WeatherPoint {
  id: string
  queryCoordinate: { latitude: number; longitude: number }
  providerCoordinate: { latitude: number; longitude: number } | null
  values: {
    temperatureC: Array<number | null>
    relativeHumidityPct: Array<number | null>
    windSpeedKmh: Array<number | null>
    windDirectionDeg: Array<number | null>
    windGustKmh: Array<number | null>
    precipitationMm: Array<number | null>
  }
}
```

- [ ] **Step 2: Write RED validator tests**

```ts
it('accepts one aligned 24-frame snapshot', () => {
  const fixture = weatherSnapshotFixture()
  expect(validateWeatherSnapshot(fixture)).toEqual(fixture)
})

it('preserves null instead of coercing it to zero', () => {
  const fixture = weatherSnapshotFixture()
  fixture.points[0].values.temperatureC[4] = null
  expect(validateWeatherSnapshot(fixture).points[0].values.temperatureC[4]).toBeNull()
})
```

Add explicit failing cases for: wrong schema; invalid dates; timestamps count != 24; duplicate/unordered timestamps; `dataThrough !== timestamps[23]`; wrong window/step; stale <= 0; spacing != 0.5; duplicate/empty IDs; invalid WGS84 query/provider coordinates; pointCount mismatch; wrong series lengths; NaN/Infinity; humidity outside 0–100; negative wind/gust/precipitation; wind direction outside 0–360; invalid source/method kinds; non-string limitations.

- [ ] **Step 3: Verify RED**

Run: `npm run test:run -- src/lib/validateWeatherSnapshot.test.ts`

Expected: FAIL because validator/fixture are not implemented.

- [ ] **Step 4: Implement strict normalization**

Use local record/string/timestamp/finite-number helpers. Series guard:

```ts
function nullableFiniteSeries(value: unknown, key: string, length: number): Array<number | null> {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`${key} must contain ${length} aligned values`)
  }
  return value.map((item) => {
    if (item === null) return null
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new Error(`${key} values must be finite numbers or null`)
    }
    return item
  })
}
```

Return a newly constructed `WeatherSnapshot`; do not cast/return unknown input.

- [ ] **Step 5: Verify GREEN + type build**

```bash
npm run test:run -- src/lib/validateWeatherSnapshot.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/weather.ts src/test/weatherFixtures.ts src/lib/validateWeatherSnapshot.ts src/lib/validateWeatherSnapshot.test.ts
git commit -m "feat: add weather snapshot contract"
```

---

### Task 2: Independent weather loader

**Files:**
- Create: `src/lib/loadWeatherSnapshot.ts`
- Create: `src/lib/loadWeatherSnapshot.test.ts`

**Interface:** `loadWeatherSnapshot(fetcher?: typeof fetch, baseUrl?: string): Promise<WeatherSnapshot>`.

- [ ] **Step 1: Write RED tests**

```ts
it('loads /data/weather.json independently', async () => {
  const fixture = weatherSnapshotFixture()
  const fetcher = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }))
  await expect(loadWeatherSnapshot(fetcher as typeof fetch, '/pulso/')).resolves.toEqual(fixture)
  expect(fetcher).toHaveBeenCalledWith('/pulso/data/weather.json', { cache: 'no-store' })
})

it('rejects HTTP failure instead of returning empty weather', async () => {
  const fetcher = vi.fn(async () => new Response('down', { status: 503 }))
  await expect(loadWeatherSnapshot(fetcher as typeof fetch, '/')).rejects.toThrow('HTTP 503')
})
```

Also test malformed JSON and valid JSON that fails semantic validation.

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/lib/loadWeatherSnapshot.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export async function loadWeatherSnapshot(
  fetcher: typeof fetch = fetch,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<WeatherSnapshot> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const response = await fetcher(`${base}data/weather.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Failed to load weather snapshot: HTTP ${response.status}`)
  return validateWeatherSnapshot(await response.json())
}
```

- [ ] **Step 4: GREEN + commit**

```bash
npm run test:run -- src/lib/loadWeatherSnapshot.test.ts
git add src/lib/loadWeatherSnapshot.ts src/lib/loadWeatherSnapshot.test.ts
git commit -m "feat: load weather snapshot independently"
```

---

### Task 3: Deterministic 0.5° national grid

**Files:**
- Create: `scripts/lib/weather-grid.mjs`
- Create: `scripts/lib/weather-grid.test.mjs`
- Reuse unchanged: `scripts/lib/geo.mjs`

**Interface:** `generateWeatherGrid(argentinaGeometry, spacingDegrees = 0.5): Array<{id, latitude, longitude}>`.

- [ ] **Step 1: RED Polygon/MultiPolygon/hole/order tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateWeatherGrid } from './weather-grid.mjs'

test('is deterministic and keeps only points inside the geometry', () => {
  const first = generateWeatherGrid(geometryFixture, 0.5)
  const second = generateWeatherGrid(geometryFixture, 0.5)
  assert.deepEqual(first, second)
  assert.ok(first.every((p) => p.id === `wx:${p.latitude.toFixed(2)}:${p.longitude.toFixed(2)}`))
})
```

Add MultiPolygon, hole exclusion, spacing <= 0, and stable ordering tests.

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/lib/weather-grid.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement exact current Pulso bounds + snapping**

```js
import { pointInFeatureCollection } from './geo.mjs'

const VIEW_BOUNDS = {
  minLongitude: -73.7,
  minLatitude: -55.3,
  maxLongitude: -53.5,
  maxLatitude: -21.7,
}

function snapUp(value, spacing) {
  return Math.ceil(value / spacing) * spacing
}
function snapDown(value, spacing) {
  return Math.floor(value / spacing) * spacing
}

export function generateWeatherGrid(argentinaGeometry, spacingDegrees = 0.5) {
  if (!Number.isFinite(spacingDegrees) || spacingDegrees <= 0) {
    throw new Error('weather grid spacing must be a positive finite number')
  }
  const points = []
  for (
    let lat = snapUp(VIEW_BOUNDS.minLatitude, spacingDegrees);
    lat <= snapDown(VIEW_BOUNDS.maxLatitude, spacingDegrees) + 1e-9;
    lat += spacingDegrees
  ) {
    for (
      let lon = snapUp(VIEW_BOUNDS.minLongitude, spacingDegrees);
      lon <= snapDown(VIEW_BOUNDS.maxLongitude, spacingDegrees) + 1e-9;
      lon += spacingDegrees
    ) {
      const latitude = Number(lat.toFixed(6))
      const longitude = Number(lon.toFixed(6))
      if (!pointInFeatureCollection([longitude, latitude], argentinaGeometry)) continue
      points.push({ id: `wx:${latitude.toFixed(2)}:${longitude.toFixed(2)}`, latitude, longitude })
    }
  }
  return points.sort((a, b) => a.latitude - b.latitude || a.longitude - b.longitude)
}
```

- [ ] **Step 4: GREEN + real-geometry smoke check**

```bash
node --test scripts/lib/weather-grid.test.mjs
node -e "import('./scripts/lib/weather-grid.mjs').then(async ({generateWeatherGrid})=>{const fs=await import('node:fs/promises');const g=JSON.parse(await fs.readFile('public/data/argentina-provinces.geojson','utf8'));const p=generateWeatherGrid(g);console.log(p.length,p[0],p.at(-1));if(p.length<500||p.length>3000)process.exit(1)})"
```

Expected: deterministic national count in the approximate `10^3` order of magnitude.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/weather-grid.mjs scripts/lib/weather-grid.test.mjs
git commit -m "feat: generate argentina weather grid"
```

---

### Task 4: Open-Meteo / ECMWF batch adapter

**Files:**
- Create: `scripts/fetch-open-meteo-weather.mjs`
- Create: `scripts/fetch-open-meteo-weather.test.mjs`

**Interfaces:**
- `buildOpenMeteoUrl(points, checkedAt): URL`
- `fetchOpenMeteoBatch(points, fetchImpl, checkedAt): Promise<NormalizedWeatherLocation[]>`
- `fetchOpenMeteoWeather(points, fetchImpl, checkedAt, batchSize = 100): Promise<NormalizedWeatherLocation[]>`

- [ ] **Step 1: RED URL tests**

Assert exactly:

```text
https://historical-forecast-api.open-meteo.com/v1/forecast
models=ecmwf_ifs
hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation
timezone=UTC
temperature_unit=celsius
wind_speed_unit=kmh
precipitation_unit=mm
cell_selection=nearest
```

Latitude/longitude are comma-separated in matching order. `start_date` is the UTC date containing `checkedAt - 30h`; `end_date` is the UTC date containing `checkedAt`. The later snapshot builder, not the date range, chooses exactly 24 frames.

```js
assert.equal(url.searchParams.get('models'), 'ecmwf_ifs')
assert.equal(url.searchParams.get('timezone'), 'UTC')
assert.equal(url.searchParams.get('cell_selection'), 'nearest')
```

- [ ] **Step 2: RED response/batching tests**

For two locations assert exact response-count matching, query IDs/order, provider coordinates, all six arrays, UTC timestamp normalization, and `null` preservation. Reject non-2xx, missing hourly block/variable, wrong multi-location response count, and any failed batch.

- [ ] **Step 3: Verify RED**

Run: `node --test scripts/fetch-open-meteo-weather.test.mjs`

Expected: FAIL.

- [ ] **Step 4: Implement normalized shape**

```js
{
  id: point.id,
  queryCoordinate: { latitude: point.latitude, longitude: point.longitude },
  providerCoordinate: Number.isFinite(response.latitude) && Number.isFinite(response.longitude)
    ? { latitude: response.latitude, longitude: response.longitude }
    : null,
  timestamps: response.hourly.time.map((time) => `${time}:00Z`),
  values: {
    temperatureC: response.hourly.temperature_2m,
    relativeHumidityPct: response.hourly.relative_humidity_2m,
    windSpeedKmh: response.hourly.wind_speed_10m,
    windDirectionDeg: response.hourly.wind_direction_10m,
    windGustKmh: response.hourly.wind_gusts_10m,
    precipitationMm: response.hourly.precipitation,
  },
}
```

Validate timestamp strings with `Date.parse` after appending UTC. Keep batches sequential or with a small fixed concurrency; never one HTTP request per point.

- [ ] **Step 5: GREEN + commit**

```bash
node --test scripts/fetch-open-meteo-weather.test.mjs
git add scripts/fetch-open-meteo-weather.mjs scripts/fetch-open-meteo-weather.test.mjs
git commit -m "feat: fetch ecmwf weather batches"
```

---

### Task 5: Fail-closed snapshot publication + hourly workflow

**Files:**
- Create: `scripts/refresh-weather-lib.mjs`
- Create: `scripts/refresh-weather-lib.test.mjs`
- Create: `scripts/refresh-weather.mjs`
- Create: `.github/workflows/refresh-weather.yml`
- Modify: `package.json`
- Generate: `public/data/weather.json`
- Modify: `src/lib/validateWeatherSnapshot.test.ts`

**Interfaces:**
- `selectCommonTimestamps(locations): string[]`
- `buildWeatherSnapshot(locations, checkedAt): WeatherSnapshot`
- `refreshWeatherSnapshot(previous, geometry, fetchImpl, checkedAt): Promise<{publish:boolean,snapshot:WeatherSnapshot}>`

Node version is 24; `refresh-weather-lib.mjs` imports the same runtime validator from `../src/lib/validateWeatherSnapshot.ts` using Node 24 native TypeScript stripping. Do not maintain a second divergent contract validator.

- [ ] **Step 1: RED common-frame tests**

```js
test('selects the newest 24 hourly timestamps shared by every point', () => {
  const selected = selectCommonTimestamps(locationFixtures)
  assert.equal(selected.length, 24)
  assert.deepEqual(selected, [...selected].sort())
})
```

Reject fewer than 24 common frames, missing expected grid points, mismatched variable lengths, invalid final snapshot, and any adapter error.

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/refresh-weather-lib.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement common timestamp selection**

```js
export function selectCommonTimestamps(locations) {
  const counts = new Map()
  for (const location of locations) {
    for (const timestamp of new Set(location.timestamps)) {
      counts.set(timestamp, (counts.get(timestamp) ?? 0) + 1)
    }
  }
  const common = [...counts]
    .filter(([, count]) => count === locations.length)
    .map(([timestamp]) => timestamp)
    .sort()
  if (common.length < 24) throw new Error('weather source does not contain 24 common hourly frames')
  return common.slice(-24)
}
```

Map selected timestamps back to each point's source indices. Missing index is fatal; present `null` is valid.

- [ ] **Step 4: Build the exact candidate and validate it before returning**

```js
const candidate = {
  schemaVersion: '1.0',
  generatedAt: checkedAt,
  sourceCheckedAt: checkedAt,
  dataThrough: timestamps.at(-1),
  window: { hours: 24, stepHours: 1 },
  freshness: { staleAfterMinutes: 180 },
  grid: { spacingDegrees: 0.5, pointCount: points.length },
  timestamps,
  source: {
    provider: 'Open-Meteo',
    dataset: 'ECMWF IFS HRES 9 km',
    url: 'https://open-meteo.com/en/docs/historical-forecast-api',
    kind: 'numerical-weather-model',
    license: 'CC BY 4.0',
  },
  method: {
    type: 'historical-forecast-grid',
    temporalResolutionMinutes: 60,
    note: 'Malla Pulso de 0,5° filtrada por geometría argentina; series horarias Open-Meteo Historical Forecast usando ECMWF IFS HRES.',
  },
  limitations: [
    'Es contexto meteorológico modelado y no una medición de estación en la coordenada exacta.',
    'La coincidencia espacial y temporal con una detección térmica no demuestra causalidad ni confirma un incendio.',
    'La malla Pulso es de 0,5° y no representa la resolución espacial nativa exacta del modelo.',
  ],
  points,
}
return validateWeatherSnapshot(candidate)
```

- [ ] **Step 5: Implement atomic CLI**

`refresh-weather.mjs` reads previous `public/data/weather.json` if present and `public/data/argentina-provinces.geojson`, uses a 20 s fetch timeout, runs the refresh function, and calls existing `writeJsonAtomic` only after complete success. An exception logs `Weather refresh failed: ...`, exits 1, and leaves previous file untouched.

- [ ] **Step 6: Add npm command + independent workflow**

`package.json`:

```json
"refresh:weather": "node scripts/refresh-weather.mjs"
```

`.github/workflows/refresh-weather.yml`:

```yaml
name: Refresh Weather
on:
  workflow_dispatch:
  schedule:
    - cron: '17 * * * *'
permissions:
  contents: write
concurrency:
  group: refresh-weather
  cancel-in-progress: false
jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v7
      - name: Setup Node
        uses: actions/setup-node@v7
        with:
          node-version: 24
      - name: Install dependencies
        run: npm install --no-audit --no-fund
      - name: Refresh weather snapshot
        run: npm run refresh:weather
      - name: Commit refreshed snapshot
        shell: bash
        run: |
          if [ -z "$(git status --porcelain -- public/data/weather.json)" ]; then
            echo 'Weather snapshot unchanged.'
            exit 0
          fi
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add public/data/weather.json
          git commit -m 'data: refresh weather context'
          git push origin "HEAD:${GITHUB_REF_NAME}"
```

- [ ] **Step 7: GREEN offline tests, then one live generation**

```bash
node --test scripts/lib/weather-grid.test.mjs scripts/fetch-open-meteo-weather.test.mjs scripts/refresh-weather-lib.test.mjs
npm run refresh:weather
npm run test:run -- src/lib/validateWeatherSnapshot.test.ts
```

Add to `validateWeatherSnapshot.test.ts` a test that imports/parses `../../public/data/weather.json` and validates the generated artifact. Expected: 24 frames, `pointCount === points.length`, valid contract.

- [ ] **Step 8: Commit**

```bash
git add scripts/refresh-weather-lib.mjs scripts/refresh-weather-lib.test.mjs scripts/refresh-weather.mjs .github/workflows/refresh-weather.yml package.json public/data/weather.json src/lib/validateWeatherSnapshot.test.ts
git commit -m "feat: publish hourly weather context"
```

---

### Task 6: Spatial + temporal hotspot/weather matching

**Files:**
- Create: `src/lib/weatherContext.ts`
- Create: `src/lib/weatherContext.test.ts`

**Interfaces:**

```ts
export interface WeatherNeighbor {
  point: WeatherPoint
  distanceKm: number
}

export interface HotspotWeatherContext {
  hotspotId: string
  frameIndex: number
  frameTimestamp: string
  timeDifferenceMinutes: number
  primary: WeatherNeighbor
  neighbors: WeatherNeighbor[]
}

export function haversineKm(a: Coordinate, b: Coordinate): number
export function findWeatherContext(
  hotspot: ThermalHotspotEvent,
  snapshot: WeatherSnapshot,
  neighborCount?: number,
): HotspotWeatherContext | null
```

- [ ] **Step 1: RED tests**

Cover known Haversine distance, ordered neighbors, hard cap of six, nearest timestamp, deterministic earlier timestamp on exact tie, absolute minute difference, and no usable context → `null`.

Define `primary` precisely: start from neighbors ordered by distance and choose the first whose chosen frame has at least one non-null core value among temperature, humidity, wind speed. Preserve up to six spatial neighbors in `neighbors`; if none are usable at that frame, return `null`.

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/lib/weatherContext.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement Haversine + matching**

```ts
const EARTH_RADIUS_KM = 6371.0088

export function haversineKm(a: Coordinate, b: Coordinate): number {
  const radians = (n: number) => n * Math.PI / 180
  const dLat = radians(b.latitude - a.latitude)
  const dLon = radians(b.longitude - a.longitude)
  const lat1 = radians(a.latitude)
  const lat2 = radians(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}
```

Use `queryCoordinate`, not provider coordinate, for displayed matching distance.

- [ ] **Step 4: GREEN + commit**

```bash
npm run test:run -- src/lib/weatherContext.test.ts
git add src/lib/weatherContext.ts src/lib/weatherContext.test.ts
git commit -m "feat: match hotspots with weather context"
```

---

### Task 7: Active-frame GeoJSON and wind-direction vectors

**Files:**
- Create: `src/lib/weatherMapData.ts`
- Create: `src/lib/weatherMapData.test.ts`

**Interfaces:**
- `weatherFrameToFeatureCollection(snapshot, frameIndex, variable)` — grid points for temperature/humidity; wind origins for wind.
- `weatherWindVectorsToFeatureCollection(snapshot, frameIndex)` — constant-length LineStrings showing meteorological **from-direction**; length does not encode speed.
- `weatherNeighborsToFeatureCollection(context, frameIndex)`.
- `weatherLinkToFeatureCollection(hotspot, context)`.
- `selectedHotspotToFeatureCollection(hotspot | null)`.

- [ ] **Step 1: RED properties/null tests**

```ts
const temperature = weatherFrameToFeatureCollection(snapshot, 23, 'temperature')
expect(temperature.features[0].properties).toMatchObject({
  id: 'wx:-31.50:-64.00',
  frameIndex: 23,
  weatherValue: expect.any(Number),
})
```

Selected display variable `null` omits that point rather than emitting zero. Wind vector requires both speed and direction non-null.

- [ ] **Step 2: RED vector semantics test**

A north wind (`windDirectionDeg = 0`) produces a short line from the query point toward geographic north because the line indicates where the wind is **from**, not fire movement. All vector lengths are constant; speed stays a property/detail value.

- [ ] **Step 3: Verify RED**

Run: `npm run test:run -- src/lib/weatherMapData.test.ts`

Expected: FAIL.

- [ ] **Step 4: Implement pure GeoJSON transforms**

Use an approximately constant `0.12°` visual segment and spherical bearing math for the second coordinate. Neighbor features expose `rank`, `distanceKm`, `isPrimary`; context link is one LineString hotspot → primary query coordinate; selected hotspot is zero or one Point feature.

- [ ] **Step 5: GREEN + commit**

```bash
npm run test:run -- src/lib/weatherMapData.test.ts
git add src/lib/weatherMapData.ts src/lib/weatherMapData.test.ts
git commit -m "feat: prepare weather map data"
```

---

### Task 8: Weather detail + hotspot context UI

**Files:**
- Create: `src/components/WeatherDetail.tsx`
- Create: `src/components/WeatherDetail.test.tsx`
- Create: `src/components/HotspotWeatherContext.tsx`
- Create: `src/components/HotspotWeatherContext.test.tsx`
- Modify: `src/components/TerritorialDetail.tsx`

**Interfaces:**
- `WeatherDetail({ snapshot, point, frameIndex })`.
- `HotspotWeatherContext({ snapshot, context })`.
- `TerritorialDetail` gains exactly `afterDetails?: ReactNode`; it does not import weather matching logic.

- [ ] **Step 1: RED hotspot-context test**

```tsx
render(<HotspotWeatherContext snapshot={snapshot} context={context} />)
expect(screen.getByText(/contexto meteorológico modelado/i)).toBeInTheDocument()
expect(screen.getByText(/19 km/i)).toBeInTheDocument()
expect(screen.getByText(/23 min/i)).toBeInTheDocument()
expect(screen.getByText(/no prueban su causa ni confirman por sí solas un incendio/i)).toBeInTheDocument()
expect(screen.getByRole('link', { name: /Open-Meteo/i })).toBeInTheDocument()
```

Assert null variable → `No disponible`, never `0`.

- [ ] **Step 2: RED WeatherDetail test**

Assert frame UTC time, temperature, humidity, wind direction+speed, gusts, precipitation, query coordinate, provider/dataset, `dataThrough`, and exact semantic line `No es una estación de superficie.`

- [ ] **Step 3: Verify RED**

Run: `npm run test:run -- src/components/HotspotWeatherContext.test.tsx src/components/WeatherDetail.test.tsx`

Expected: FAIL.

- [ ] **Step 4: Implement leaf components**

Use `Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })`. Convert wind degrees to 16-point cardinal text while retaining numeric speed. Required caveat appears verbatim.

- [ ] **Step 5: Add exact `afterDetails` slot**

```tsx
import type { ReactNode } from 'react'

interface TerritorialDetailProps {
  // existing props...
  afterDetails?: ReactNode
}
```

Render `{afterDetails}` after the existing `<dl>`/limitations block. Do not import `WeatherSnapshot` or `findWeatherContext` into this component.

- [ ] **Step 6: GREEN + regression + commit**

```bash
npm run test:run -- src/components/HotspotWeatherContext.test.tsx src/components/WeatherDetail.test.tsx src/components/TerritorialSection.test.tsx
git add src/components/WeatherDetail.tsx src/components/WeatherDetail.test.tsx src/components/HotspotWeatherContext.tsx src/components/HotspotWeatherContext.test.tsx src/components/TerritorialDetail.tsx
git commit -m "feat: explain modeled hotspot weather context"
```

---

### Task 9: Persistent MapLibre weather layers

**Files:**
- Modify: `src/components/TerritorialMap.tsx`
- Modify: `src/components/TerritorialMap.test.tsx`
- Modify: `src/components/TerritorialMap.hotspot-selection.test.tsx`

**Props after this task:**

```ts
interface TerritorialMapProps {
  mode: TerritorialViewMode
  weatherVariable: WeatherVariable
  earthquakes: EarthquakeEvent[]
  hotspots: ThermalHotspotEvent[]
  weather: WeatherSnapshot | null
  weatherFrameIndex: number
  hotspotContext: HotspotWeatherContext | null
  selectedHotspot: ThermalHotspotEvent | null
  selectedWeatherPointId: string | null
  onSelect: (event: EarthquakeEvent | ThermalHotspotEvent) => void
  onSelectWeather: (pointId: string) => void
}
```

- [ ] **Step 1: Extend existing mocks and write RED lifecycle tests**

Across rerender hotspot → weather → hotspot: constructor count remains 1; `flyTo`/`fitBounds` remain uncalled. Test full weather layer hidden in hotspot mode without selection; neighbor/link visible only with context; weather grid visible in weather mode; only selected hotspot reference appears there.

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- src/components/TerritorialMap.test.tsx src/components/TerritorialMap.hotspot-selection.test.tsx`

Expected: FAIL until props/layers exist.

- [ ] **Step 3: Add empty sources once in map style**

```text
weather-grid
weather-wind-vectors
weather-neighbors
weather-link
selected-hotspot-reference
```

`syncSources` supplies only the active frame, never all `points × 24` features.

- [ ] **Step 4: Add restrained layers**

- `weather-temperature-points`: circle, sequential value ramp, no danger semantics.
- `weather-humidity-points`: circle, separate sequential ramp, no danger semantics.
- `weather-wind-origins`: small neutral circles.
- `weather-wind-vectors`: thin lines generated in Task 7; direction only, constant visual length.
- `weather-neighbor-points`: subtle circles.
- `weather-primary-point`: slightly stronger secondary marker.
- `weather-context-link`: thin low-opacity line.
- `selected-hotspot-reference`: small existing-hotspot-family color.

No continuous surface and no particles.

- [ ] **Step 5: Visibility is pure layer toggling**

Implement `syncVisibility(map, mode, weatherVariable, hasHotspotContext, hasSelectedHotspot)`; mode changes never instantiate a new map.

- [ ] **Step 6: Weather click path**

In weather mode, clicks on the visible weather point/origin layer resolve `properties.id` and call `onSelectWeather(id)`. Do not clear selected hotspot. Preserve current global hotspot production-click fallback and its dedicated test.

- [ ] **Step 7: GREEN + commit**

```bash
npm run test:run -- src/components/TerritorialMap.test.tsx src/components/TerritorialMap.hotspot-selection.test.tsx
git add src/components/TerritorialMap.tsx src/components/TerritorialMap.test.tsx src/components/TerritorialMap.hotspot-selection.test.tsx
git commit -m "feat: render weather context on territorial map"
```

---

### Task 10: Section integration, legend, accessibility, styling, attribution

**Files:**
- Modify: `src/components/TerritorialSection.tsx`
- Modify: `src/components/TerritorialSection.test.tsx`
- Modify: `src/components/TerritorialLegend.tsx`
- Create: `src/components/TerritorialLegend.test.tsx`
- Modify: `src/styles.css`
- Modify: `README.md`

**Interfaces:** complete `Sismos | Focos de calor | Meteorología` experience.

- [ ] **Step 1: RED independent-load/failure tests**

Add prop:

```ts
type WeatherLoader = () => Promise<WeatherSnapshot>
loadWeather?: WeatherLoader
```

Test weather rejection while earthquakes/hotspots remain usable. In weather mode show `Contexto meteorológico temporalmente no disponible`; assert no false `0 °C`/`0 km/h`.

- [ ] **Step 2: RED selection-memory flow**

Test sequence: Focos → select hotspot → context appears → Meteorología → select weather point → WeatherDetail → Focos → original hotspot detail restored. Hotspot and weather selections are separate states.

- [ ] **Step 3: RED controls/freshness/accessibility**

Assert `Sismos | Focos de calor | Meteorología`; weather-only `Temperatura | Viento | Humedad`; all buttons have `aria-pressed`; stale becomes true exactly at `sourceCheckedAt + 180 min`; weather summary exposes model, `dataThrough`, point count, last source check.

- [ ] **Step 4: RED legend test**

```tsx
render(<TerritorialLegend mode="weather" weatherVariable="wind" />)
expect(screen.getByText(/modelo meteorológico/i)).toBeInTheDocument()
expect(screen.getByText(/no estación de superficie/i)).toBeInTheDocument()
expect(screen.getByText(/dirección desde la que sopla el viento/i)).toBeInTheDocument()
expect(screen.queryByText(/riesgo/i)).not.toBeInTheDocument()
```

- [ ] **Step 5: Verify RED**

```bash
npm run test:run -- src/components/TerritorialSection.test.tsx src/components/TerritorialLegend.test.tsx
```

Expected: FAIL.

- [ ] **Step 6: Implement explicit independent state**

```ts
const [mode, setMode] = useState<TerritorialViewMode>('earthquake')
const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
const [weatherError, setWeatherError] = useState(false)
const [weatherVariable, setWeatherVariable] = useState<WeatherVariable>('temperature')
const [selectedEarthquakeId, setSelectedEarthquakeId] = useState<string | null>(null)
const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null)
const [selectedWeatherPointId, setSelectedWeatherPointId] = useState<string | null>(null)
const weatherFrameIndex = weather ? weather.timestamps.length - 1 : -1
```

Load weather in its own `useEffect`. Compute selected hotspot, selected weather point, and `findWeatherContext` with `useMemo`. Switching view does **not** clear hotspot/weather selections.

- [ ] **Step 7: Wire details + summary + map**

Hotspot detail keeps CONAE evidence first and passes `<HotspotWeatherContext ... />` through `afterDetails` when available. On weather failure, `afterDetails` becomes a compact unavailable-state message. Weather mode renders `WeatherDetail` for selected point or a weather-specific empty-state prompt.

- [ ] **Step 8: Implement legend + bounded styles**

`TerritorialLegend` props become:

```ts
interface TerritorialLegendProps {
  mode: TerritorialViewMode
  weatherVariable?: WeatherVariable
}
```

Add only required weather classes to existing Pulso design language. Minimum responsive rules:

```css
.territorial-weather-variables {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
}
.weather-context__caveat { max-width: 52ch; }
```

Keep existing keyboard focus treatment; no danger colors/threshold labels.

- [ ] **Step 9: Add visible attribution + README copy**

README states:

```text
Meteorología: Open-Meteo Historical Forecast · ECMWF IFS HRES 9 km · CC BY 4.0.
Los valores son contexto meteorológico modelado sobre una malla Pulso de 0,5°; no son estaciones ni mediciones exactas en cada foco.
```

UI includes an Open-Meteo source link and dataset label in weather summary/detail.

- [ ] **Step 10: GREEN integration + build**

```bash
npm run test:run -- src/components/TerritorialSection.test.tsx src/components/TerritorialLegend.test.tsx src/components/TerritorialMap.test.tsx src/components/TerritorialMap.hotspot-selection.test.tsx src/components/HotspotWeatherContext.test.tsx src/components/WeatherDetail.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/components/TerritorialSection.tsx src/components/TerritorialSection.test.tsx src/components/TerritorialLegend.tsx src/components/TerritorialLegend.test.tsx src/styles.css README.md
git commit -m "feat: add weather territorial view"
```

---

### Task 11: Full regression, review, PR, merge, exact deploy

**Files:** no new feature files. Do not add scope here.

- [ ] **Step 1: Run all data-adapter tests explicitly**

```bash
node --test scripts/lib/weather-grid.test.mjs scripts/fetch-open-meteo-weather.test.mjs scripts/refresh-weather-lib.test.mjs
```

Expected: PASS. Existing CI already runs the repository Vitest suite; explicit Node invocation makes the new refresh boundary independently visible in this final gate.

- [ ] **Step 2: Run complete local regression**

```bash
python3 scripts/cammesa_xlsx_test.py
npm run test:run
npm run build
git diff --check
```

Expected: all green; only the pre-existing Vite chunk-size warning is acceptable; `git diff --check` emits nothing.

- [ ] **Step 3: Validate generated artifact explicitly**

```bash
node -e "const fs=require('fs');const w=JSON.parse(fs.readFileSync('public/data/weather.json','utf8'));if(w.timestamps.length!==24)throw new Error('not 24 frames');if(w.grid.pointCount!==w.points.length)throw new Error('point count mismatch');if(w.dataThrough!==w.timestamps.at(-1))throw new Error('dataThrough mismatch');console.log(w.grid.pointCount,w.timestamps[0],w.dataThrough)"
```

- [ ] **Step 4: Review against spec before PR**

Reject the change if any of these are true: `TerritorialKind` changed; browser calls Open-Meteo; missing values become zero; causal/risk language appears; map is recreated/reset on view change; weather failure breaks hotspot reading; attribution is absent; `weather.json` is hand-authored demo data; animation/forecast/GOES entered scope.

- [ ] **Step 5: Push implementation branch + open PR**

```bash
git push -u origin feat/pulso-weather-context-v3-1
```

PR title:

```text
feat: add modeled weather context to thermal hotspots
```

PR body records separate contract, 0.5° grid, 24 UTC frames, Open-Meteo/ECMWF source, spatial/temporal matching, fail-closed refresh, non-causality semantics, and exact verification commands/results.

- [ ] **Step 6: Require exact-head green CI before merge**

Record PR head SHA and verify CI success on that SHA. Do not merge based only on local tests.

- [ ] **Step 7: Merge and verify exact Pages SHA**

Record merge SHA, then verify: `main` CI green; Pages build/deploy green; deployed Pages build version equals merge SHA; public app loads `weather.json`; Meteorología renders; Focos still functions when weather is unavailable.

---

## Execution Order

```text
1 Contract + validator
2 Loader
3 Grid
4 Open-Meteo adapter
5 Snapshot + workflow
6 Spatial/temporal context
7 Map-data transforms
8 Detail UI
9 Persistent MapLibre layers
10 Section/legend/styles/docs
11 Regression + PR + exact deploy
```

Reviewer checkpoints after Tasks **1, 5, 7, 10, 11** close the contract, ingestion, map-data, product, and production boundaries.

## Definition of Done

V3.1 is done only when a selected CONAE hotspot can show a traceable nearby modeled weather frame with visible spatial/time separation; Meteorología renders the latest national 0.5° grid for temperature/wind/humidity without resetting the map; weather refresh is independently fail-closed; wording never overclaims causality or fire confirmation; Open-Meteo/ECMWF attribution is visible; the full regression gate is green; and GitHub Pages is verified against the exact merged SHA.