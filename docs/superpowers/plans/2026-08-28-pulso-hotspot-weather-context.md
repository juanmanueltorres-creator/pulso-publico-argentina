# Pulso Público V3.1 — Hotspot Weather Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed, hourly `WeatherSnapshot 1.0` over a 0.5° Argentina grid and expose modeled 24-hour meteorological context around selected CONAE thermal hotspots without implying causality or confirmed fire.

**Architecture:** Keep `TerritorialSnapshot` unchanged for earthquakes/hotspots and add a separate weather pipeline: Argentina geometry → deterministic grid → Open-Meteo Historical Forecast / ECMWF IFS HRES adapter → validated `weather.json` → independent React loader → MapLibre weather layers and hotspot-weather context. The browser only reads Pulso-owned static JSON; source refresh, spatial matching, temporal matching, and rendering transforms stay in small testable helpers.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 3, Testing Library, MapLibre GL 6, Node 24 ESM scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-28-pulso-hotspot-weather-context-design.md`

## Global Constraints

- Preserve `SignalEnvelope 1.0`, `TerritorialSnapshot 1.0`, `EvidenceSnapshot 1.0`, `TerritorialKind = 'earthquake' | 'thermal-hotspot'`, and all current public data paths.
- Add weather through a separate `WeatherSnapshot 1.0`; do not add `weather` to `TerritorialKind`.
- Grid spacing is exactly `0.5` degrees and is filtered by `public/data/argentina-provinces.geojson` with fail-closed point-in-polygon behavior.
- Publish exactly 24 common hourly UTC timestamps per snapshot; every weather value array must align 1:1 with that global timestamp array.
- Weather source for V3.1 is Open-Meteo Historical Forecast with model `ecmwf_ifs` (ECMWF IFS HRES 9 km), queried server-side only.
- Required weather variables: `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `precipitation`.
- Public units: Celsius, percent, km/h, degrees, millimeters; internal timestamps UTC.
- `null` means missing. Never coerce source failure or missing weather into zero.
- `sourceCheckedAt` is the Pulso source-check time; `dataThrough` is the latest represented weather frame. Do not conflate them.
- Weather stale threshold starts at exactly 180 minutes.
- In hotspot mode, show weather neighbors only when a hotspot is selected; show at most six neighbors and one nearest reference point.
- In weather mode, default to the latest complete frame and expose only `Temperatura | Viento | Humedad` as map variable controls in V3.1.
- Do not reset map camera/zoom, recreate MapLibre, `flyTo`, or `fitBounds` when switching view modes or selecting an item.
- UI language must say modeled context, not station/measurement-at-fire; spatial distance and time difference must be visible.
- Mandatory caveat: `Estas condiciones coexistían aproximadamente en espacio y tiempo con la detección. No prueban su causa ni confirman por sí solas un incendio.`
- Open-Meteo/ECMWF attribution must be visible in the product and documented in README.
- Keep refresh-weather independent of CONAE refresh and preserve the last valid weather snapshot on any refresh failure.
- No animation, timeline/play, forecast, heatmap interpolation, particles, SMN stations, NOAA direct ingest, GOES, smoke, burn scar, ML, risk score, causal inference, or redesign of Pulso Evidencia in V3.1.
- TDD for every task. Before merge: all Vitest/Node tests, TypeScript build, Vite production build, CAMMESA Python tests, and `git diff --check` must pass.

---

## File Structure

### New domain/frontend files

- `src/types/weather.ts` — public weather contract and UI view types.
- `src/test/weatherFixtures.ts` — deterministic WeatherSnapshot fixtures shared by tests.
- `src/lib/validateWeatherSnapshot.ts` — runtime fail-closed contract validation.
- `src/lib/validateWeatherSnapshot.test.ts` — contract invariants.
- `src/lib/loadWeatherSnapshot.ts` — fetch `/data/weather.json` and validate.
- `src/lib/loadWeatherSnapshot.test.ts` — HTTP/JSON/semantic load failures.
- `src/lib/weatherContext.ts` — Haversine neighbor matching and nearest timestamp selection.
- `src/lib/weatherContext.test.ts` — spatial/temporal matching tests.
- `src/lib/weatherMapData.ts` — convert one weather frame / neighbor set / link into GeoJSON.
- `src/lib/weatherMapData.test.ts` — rendering-data semantics without MapLibre.
- `src/components/WeatherDetail.tsx` — detail for a selected grid point.
- `src/components/WeatherDetail.test.tsx` — textual/semantic rendering.
- `src/components/HotspotWeatherContext.tsx` — secondary modeled-context block under a hotspot.
- `src/components/HotspotWeatherContext.test.tsx` — caveat/distance/time/source rendering.

### New refresh files

- `scripts/lib/weather-grid.mjs` — deterministic 0.5° national grid generator.
- `scripts/lib/weather-grid.test.mjs` — Polygon/MultiPolygon/filter/order tests.
- `scripts/fetch-open-meteo-weather.mjs` — URL builder, batched API fetch, raw-response normalization.
- `scripts/fetch-open-meteo-weather.test.mjs` — batching/query/partial-response tests.
- `scripts/refresh-weather-lib.mjs` — common-frame selection and candidate snapshot builder.
- `scripts/refresh-weather-lib.test.mjs` — fail-closed publication logic.
- `scripts/refresh-weather.mjs` — CLI orchestration and atomic write.
- `.github/workflows/refresh-weather.yml` — independent hourly scheduled refresh.
- `public/data/weather.json` — generated valid initial snapshot.

### Existing files to modify

- `src/components/TerritorialSection.tsx` — independent weather load/state, `TerritorialViewMode`, separate hotspot/weather selection memory.
- `src/components/TerritorialSection.test.tsx` — mode/error/freshness/selection integration tests.
- `src/components/TerritorialMap.tsx` — persistent weather sources/layers and view-specific visibility.
- `src/components/TerritorialMap.test.tsx` — source/layer and camera-preservation behavior.
- `src/components/TerritorialDetail.tsx` — keep core thermal/earthquake detail and accept the weather-context child without moving domain logic inside it.
- `src/components/TerritorialLegend.tsx` and tests — weather-mode reading guidance without danger semantics.
- `src/styles.css` — controls, grid symbols, vector arrows, context/detail hierarchy.
- `package.json` — add `refresh:weather`.
- `.github/workflows/ci.yml` — explicitly include Node ESM script tests if current Vitest discovery does not execute them; verify before modifying.
- `README.md` — weather source, attribution, meaning and limitations.

---

### Task 1: Define and validate `WeatherSnapshot 1.0`

**Files:**
- Create: `src/types/weather.ts`
- Create: `src/test/weatherFixtures.ts`
- Create: `src/lib/validateWeatherSnapshot.ts`
- Create: `src/lib/validateWeatherSnapshot.test.ts`

**Interfaces:**
- Produces: `WeatherSnapshot`, `WeatherPoint`, `WeatherVariable`, `TerritorialViewMode`, `validateWeatherSnapshot(input: unknown): WeatherSnapshot`.
- Consumers: Tasks 2, 5, 6, 7, 8, 9.

- [ ] **Step 1: Write the contract types exactly as approved**

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

- [ ] **Step 2: Write failing validator tests for the valid fixture and every invariant**

```ts
it('accepts an aligned 24-frame WeatherSnapshot', () => {
  expect(validateWeatherSnapshot(weatherSnapshotFixture())).toEqual(weatherSnapshotFixture())
})

it.each([
  ['relativeHumidityPct', 101],
  ['windSpeedKmh', -1],
  ['windDirectionDeg', 361],
  ['windGustKmh', -1],
  ['precipitationMm', -0.1],
] as const)('rejects invalid %s values', (key, invalid) => {
  const payload = weatherSnapshotFixture()
  payload.points[0].values[key][0] = invalid
  expect(() => validateWeatherSnapshot(payload)).toThrow()
})

it('preserves null instead of coercing it to zero', () => {
  const payload = weatherSnapshotFixture()
  payload.points[0].values.temperatureC[3] = null
  expect(validateWeatherSnapshot(payload).points[0].values.temperatureC[3]).toBeNull()
})
```

Also add explicit tests for: schema version, valid timestamps, exactly 24 timestamps, strict ascending/unique order, `dataThrough === timestamps[23]`, `hours === 24`, `stepHours === 1`, stale minutes positive, spacing exactly 0.5, unique IDs, WGS84 bounds, pointCount equality, array length equality, finite-or-null values, source kind, method type/resolution, and string limitations.

- [ ] **Step 3: Run the new validator tests and verify RED**

Run: `npm run test:run -- src/lib/validateWeatherSnapshot.test.ts`

Expected: FAIL because `validateWeatherSnapshot` and weather types/fixture are not yet implemented.

- [ ] **Step 4: Implement strict fail-closed validation without changing territorial validation**

Use small internal helpers (`isRecord`, `requireString`, `requireTimestamp`, `requireFiniteNumber`, `requireNullableFiniteNumber`, `requireCoordinate`) local to `validateWeatherSnapshot.ts`. Return a new normalized object; do not return the unknown input by assertion.

Core length/range guard:

```ts
const VALUE_KEYS = [
  'temperatureC',
  'relativeHumidityPct',
  'windSpeedKmh',
  'windDirectionDeg',
  'windGustKmh',
  'precipitationMm',
] as const

function validateSeries(values: Record<string, unknown>, key: typeof VALUE_KEYS[number], frameCount: number) {
  const series = values[key]
  if (!Array.isArray(series) || series.length !== frameCount) {
    throw new Error(`${key} must contain ${frameCount} aligned values`)
  }
  return series.map((value) => {
    if (value === null) return null
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${key} values must be finite numbers or null`)
    }
    return value
  })
}
```

- [ ] **Step 5: Run validator tests and full TypeScript tests**

Run: `npm run test:run -- src/lib/validateWeatherSnapshot.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS with no contract/type errors.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/types/weather.ts src/test/weatherFixtures.ts src/lib/validateWeatherSnapshot.ts src/lib/validateWeatherSnapshot.test.ts
git commit -m "feat: add weather snapshot contract"
```

---

### Task 2: Add an independent weather snapshot loader

**Files:**
- Create: `src/lib/loadWeatherSnapshot.ts`
- Create: `src/lib/loadWeatherSnapshot.test.ts`

**Interfaces:**
- Consumes: `WeatherSnapshot`, `validateWeatherSnapshot` from Task 1.
- Produces: `loadWeatherSnapshot(fetcher?: typeof fetch, baseUrl?: string): Promise<WeatherSnapshot>`.

- [ ] **Step 1: Write failing loader tests**

```ts
it('loads /data/weather.json through the independent weather validator', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(weatherSnapshotFixture()), { status: 200 }))
  await expect(loadWeatherSnapshot(fetcher as typeof fetch, '/pulso/')).resolves.toEqual(weatherSnapshotFixture())
  expect(fetcher).toHaveBeenCalledWith('/pulso/data/weather.json', { cache: 'no-store' })
})

it('rejects HTTP errors instead of returning an empty weather snapshot', async () => {
  const fetcher = vi.fn(async () => new Response('down', { status: 503 }))
  await expect(loadWeatherSnapshot(fetcher as typeof fetch, '/')).rejects.toThrow('HTTP 503')
})
```

Add one semantically invalid JSON test and one malformed JSON rejection test.

- [ ] **Step 2: Run loader tests and verify RED**

Run: `npm run test:run -- src/lib/loadWeatherSnapshot.test.ts`

Expected: FAIL because loader does not exist.

- [ ] **Step 3: Implement the minimal independent loader**

```ts
export async function loadWeatherSnapshot(
  fetcher: typeof fetch = fetch,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<WeatherSnapshot> {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const response = await fetcher(`${normalizedBase}data/weather.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Failed to load weather snapshot: HTTP ${response.status}`)
  return validateWeatherSnapshot(await response.json())
}
```

Do not modify `loadTerritorialSnapshot.ts`.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:run -- src/lib/loadWeatherSnapshot.test.ts`

Expected: PASS.

```bash
git add src/lib/loadWeatherSnapshot.ts src/lib/loadWeatherSnapshot.test.ts
git commit -m "feat: load weather snapshot independently"
```

---

### Task 3: Generate the deterministic 0.5° Argentina weather grid

**Files:**
- Create: `scripts/lib/weather-grid.mjs`
- Create: `scripts/lib/weather-grid.test.mjs`
- Reuse unchanged: `scripts/lib/geo.mjs`

**Interfaces:**
- Consumes: `pointInFeatureCollection([lon, lat], featureCollection)`.
- Produces: `generateWeatherGrid(argentinaGeometry, spacingDegrees = 0.5)` returning ordered `{ id, latitude, longitude }[]`.

- [ ] **Step 1: Write RED tests against small Polygon/MultiPolygon fixtures**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateWeatherGrid } from './weather-grid.mjs'

test('generates stable 0.5 degree ids and excludes outside points', () => {
  const geometry = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[-65,-33],[-63,-33],[-63,-31],[-65,-31],[-65,-33]]],
      },
    }],
  }
  const first = generateWeatherGrid(geometry, 0.5)
  const second = generateWeatherGrid(geometry, 0.5)
  assert.deepEqual(first, second)
  assert.ok(first.every((point) => point.id === `wx-${point.latitude.toFixed(2)}-${point.longitude.toFixed(2)}`))
})
```

Add tests for MultiPolygon, hole exclusion, invalid spacing, and deterministic latitude/longitude ordering.

- [ ] **Step 2: Run the Node test and verify RED**

Run: `node --test scripts/lib/weather-grid.test.mjs`

Expected: FAIL because `weather-grid.mjs` does not exist.

- [ ] **Step 3: Implement bbox scan + existing point-in-polygon filter**

```js
export function generateWeatherGrid(argentinaGeometry, spacingDegrees = 0.5) {
  if (!Number.isFinite(spacingDegrees) || spacingDegrees <= 0) {
    throw new Error('weather grid spacing must be a positive finite number')
  }

  const candidates = []
  for (let latitude = -55.5; latitude <= -21.5; latitude += spacingDegrees) {
    for (let longitude = -73.5; longitude <= -53.5; longitude += spacingDegrees) {
      const lat = Number(latitude.toFixed(6))
      const lon = Number(longitude.toFixed(6))
      if (!pointInFeatureCollection([lon, lat], argentinaGeometry)) continue
      candidates.push({
        id: `wx-${lat.toFixed(2)}-${lon.toFixed(2)}`,
        latitude: lat,
        longitude: lon,
      })
    }
  }

  return candidates.sort((a, b) => a.latitude - b.latitude || a.longitude - b.longitude)
}
```

If the production geometry proves to extend beyond these current map bounds, use the existing map bounds from `TerritorialMap.tsx` exactly (`[-73.7,-55.3]` to `[-53.5,-21.7]`) snapped to 0.5° increments; do not invent broader geography.

- [ ] **Step 4: Run grid tests**

Run: `node --test scripts/lib/weather-grid.test.mjs`

Expected: PASS.

- [ ] **Step 5: Smoke-check the real geometry deterministically**

Run:

```bash
node -e "import('./scripts/lib/weather-grid.mjs').then(async ({generateWeatherGrid}) => { const fs=await import('node:fs/promises'); const g=JSON.parse(await fs.readFile('public/data/argentina-provinces.geojson','utf8')); const p=generateWeatherGrid(g); console.log(p.length, p[0], p.at(-1)); if (p.length < 500 || p.length > 3000) process.exit(1); })"
```

Expected: one deterministic point count in the approximate `10^3` order of magnitude and valid first/last points.

- [ ] **Step 6: Commit Task 3**

```bash
git add scripts/lib/weather-grid.mjs scripts/lib/weather-grid.test.mjs
git commit -m "feat: generate argentina weather grid"
```

---

### Task 4: Fetch and normalize Open-Meteo ECMWF batches

**Files:**
- Create: `scripts/fetch-open-meteo-weather.mjs`
- Create: `scripts/fetch-open-meteo-weather.test.mjs`

**Interfaces:**
- Consumes: grid points from Task 3.
- Produces:
  - `buildOpenMeteoUrl(points, checkedAt): URL`
  - `fetchOpenMeteoBatch(points, fetchImpl, checkedAt): Promise<NormalizedWeatherLocation[]>`
  - `fetchOpenMeteoWeather(points, fetchImpl, checkedAt, batchSize = 100): Promise<NormalizedWeatherLocation[]>`

- [ ] **Step 1: Write RED query/batching tests**

Assert the generated request uses:

```text
host: historical-forecast-api.open-meteo.com
path: /v1/forecast
models=ecmwf_ifs
hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation
timezone=UTC
wind_speed_unit=kmh
temperature_unit=celsius
precipitation_unit=mm
cell_selection=nearest
latitude=<comma-separated batch>
longitude=<comma-separated batch>
```

Use explicit `start_date`/`end_date` derived from `checkedAt` to request enough source hours to select the last 24 complete hourly frames. Request the UTC calendar day containing `checkedAt - 30h` through the UTC calendar day containing `checkedAt`; later selection, not the API date range, enforces exactly 24 frames.

Example assertion:

```js
assert.equal(url.searchParams.get('models'), 'ecmwf_ifs')
assert.equal(url.searchParams.get('timezone'), 'UTC')
assert.equal(url.searchParams.get('cell_selection'), 'nearest')
assert.match(url.searchParams.get('hourly'), /temperature_2m/)
```

- [ ] **Step 2: Add RED response tests**

Use a two-location fake API response and assert preservation of:

- query location ID/order;
- provider `latitude`/`longitude` as metadata;
- hourly `time` strings normalized to `...:00:00Z`;
- all six variable arrays;
- `null` values preserved.

Also test: non-2xx response rejects, non-array response for a multi-location batch rejects, missing location rejects, missing hourly variable rejects, and one failed batch causes the whole multi-batch fetch to reject.

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test scripts/fetch-open-meteo-weather.test.mjs`

Expected: FAIL because adapter does not exist.

- [ ] **Step 4: Implement URL and response normalization**

Use the provider model identifier `ecmwf_ifs`; do not use `best_match` or `ecmwf_ifs025` because the spec requires IFS HRES 9 km.

Normalized location shape:

```js
{
  id: point.id,
  queryCoordinate: { latitude: point.latitude, longitude: point.longitude },
  providerCoordinate: {
    latitude: response.latitude,
    longitude: response.longitude,
  },
  timestamps: response.hourly.time.map((time) => new Date(`${time}:00Z`).toISOString()),
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

Guard against API response order changes by pairing each response array element with the same index in the sent batch and validating the response count exactly equals batch length.

- [ ] **Step 5: Run adapter tests**

Run: `node --test scripts/fetch-open-meteo-weather.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add scripts/fetch-open-meteo-weather.mjs scripts/fetch-open-meteo-weather.test.mjs
git commit -m "feat: fetch ecmwf weather batches"
```

---

### Task 5: Build and publish a fail-closed weather snapshot

**Files:**
- Create: `scripts/refresh-weather-lib.mjs`
- Create: `scripts/refresh-weather-lib.test.mjs`
- Create: `scripts/refresh-weather.mjs`
- Create: `.github/workflows/refresh-weather.yml`
- Modify: `package.json`
- Create/Generate: `public/data/weather.json`

**Interfaces:**
- Consumes: `generateWeatherGrid`, `fetchOpenMeteoWeather`, existing `writeJsonAtomic`.
- Produces: `buildWeatherSnapshot(rawLocations, checkedAt)`, `refreshWeatherSnapshot(previous, geometry, fetchImpl, checkedAt)` returning `{ publish, snapshot }`.

- [ ] **Step 1: Write RED common-frame and publication tests**

```js
test('publishes exactly the newest 24 common hourly frames', async () => {
  const result = await refreshWeatherSnapshot(null, geometryFixture, fakeFetch, '2026-08-28T20:37:00Z')
  assert.equal(result.snapshot.timestamps.length, 24)
  assert.equal(result.snapshot.dataThrough, result.snapshot.timestamps.at(-1))
  assert.equal(result.snapshot.grid.spacingDegrees, 0.5)
  assert.equal(result.snapshot.grid.pointCount, result.snapshot.points.length)
})
```

Add tests that reject/preserve the previous snapshot when: a batch throws, one location is missing, one expected grid point is absent, fewer than 24 common frames exist, a variable array is shorter than the common timestamps, or final contract validation fails.

- [ ] **Step 2: Run refresh tests and verify RED**

Run: `node --test scripts/refresh-weather-lib.test.mjs`

Expected: FAIL because refresh library does not exist.

- [ ] **Step 3: Implement newest common-frame selection**

```js
export function selectCommonTimestamps(locations) {
  const counts = new Map()
  for (const location of locations) {
    for (const timestamp of new Set(location.timestamps)) {
      counts.set(timestamp, (counts.get(timestamp) ?? 0) + 1)
    }
  }
  const common = [...counts.entries()]
    .filter(([, count]) => count === locations.length)
    .map(([timestamp]) => timestamp)
    .sort()
  if (common.length < 24) throw new Error('weather source does not contain 24 common hourly frames')
  return common.slice(-24)
}
```

For each location, map each selected timestamp back to its source index and extract each variable at that index. Missing source index is fatal; a present `null` value is not fatal.

- [ ] **Step 4: Build the exact public candidate metadata**

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
    'La malla de Pulso es más gruesa que la resolución nominal del modelo y se consulta en coordenadas discretas de 0,5°.',
  ],
  points,
}
```

The Node refresh layer cannot import the TypeScript validator directly. Mirror only the publication-critical checks in `refresh-weather-lib.mjs` and make `src/lib/validateWeatherSnapshot.test.ts` load the generated `public/data/weather.json` as an additional contract fixture after the first live snapshot is generated.

- [ ] **Step 5: Implement CLI orchestration with atomic write**

`refresh-weather.mjs` must read the existing snapshot and Argentina geometry first, call the refresh library, and write only after full success using `writeJsonAtomic`. On any exception, set exit code 1 and leave the previous file unchanged.

- [ ] **Step 6: Add npm script and independent workflow**

Add to `package.json`:

```json
"refresh:weather": "node scripts/refresh-weather.mjs"
```

Create `.github/workflows/refresh-weather.yml` with:

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
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm install --no-audit --no-fund
      - run: npm run refresh:weather
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

Do not reuse `refresh-territorial` concurrency.

- [ ] **Step 7: Run all script tests before any live request**

Run:

```bash
node --test scripts/lib/weather-grid.test.mjs scripts/fetch-open-meteo-weather.test.mjs scripts/refresh-weather-lib.test.mjs
```

Expected: PASS with no network access.

- [ ] **Step 8: Generate the first real snapshot once**

Run: `npm run refresh:weather`

Expected: `public/data/weather.json` is created atomically, has a point count in the expected national order of magnitude, and contains exactly 24 timestamps.

Then run:

```bash
npm run test:run -- src/lib/validateWeatherSnapshot.test.ts
```

Expected: generated snapshot passes the frontend runtime contract validator.

- [ ] **Step 9: Commit Task 5**

```bash
git add scripts/refresh-weather-lib.mjs scripts/refresh-weather-lib.test.mjs scripts/refresh-weather.mjs .github/workflows/refresh-weather.yml package.json public/data/weather.json src/lib/validateWeatherSnapshot.test.ts
git commit -m "feat: publish hourly weather context"
```

---

### Task 6: Match hotspots to weather in space and time

**Files:**
- Create: `src/lib/weatherContext.ts`
- Create: `src/lib/weatherContext.test.ts`

**Interfaces:**
- Consumes: `ThermalHotspotEvent`, `WeatherSnapshot`, `WeatherPoint`.
- Produces: `HotspotWeatherContext`, `haversineKm`, `findWeatherContext(hotspot, snapshot, neighborCount = 6)`.

- [ ] **Step 1: Define the result shape in the test**

```ts
export interface HotspotWeatherContext {
  hotspotId: string
  frameIndex: number
  frameTimestamp: string
  timeDifferenceMinutes: number
  primary: WeatherNeighbor
  neighbors: WeatherNeighbor[]
}

export interface WeatherNeighbor {
  point: WeatherPoint
  distanceKm: number
}
```

- [ ] **Step 2: Write RED tests**

Cover:

- known Haversine distance within tolerance;
- nearest six ordered ascending;
- `neighborCount` capped at six even if caller passes more;
- nearest timestamp to hotspot `occurredAt`;
- ties choose the earlier timestamp deterministically;
- returned time difference is absolute minutes;
- no usable point/frame returns `null`;
- a point with some null variables can still be a neighbor, but the primary frame must have at least one of temperature/humidity/wind speed available.

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- src/lib/weatherContext.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 4: Implement pure matching**

```ts
const EARTH_RADIUS_KM = 6371.0088

export function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}
```

`findWeatherContext` must use `queryCoordinate`, not `providerCoordinate`, for the displayed spatial relationship because the spec defines Pulso grid coordinates as the reference geometry.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:run -- src/lib/weatherContext.test.ts`

Expected: PASS.

```bash
git add src/lib/weatherContext.ts src/lib/weatherContext.test.ts
git commit -m "feat: match hotspots with weather context"
```

---

### Task 7: Build weather GeoJSON for one active frame

**Files:**
- Create: `src/lib/weatherMapData.ts`
- Create: `src/lib/weatherMapData.test.ts`

**Interfaces:**
- Consumes: `WeatherSnapshot`, `WeatherVariable`, `HotspotWeatherContext`, optional selected `WeatherPoint`.
- Produces:
  - `weatherFrameToFeatureCollection(snapshot, frameIndex, variable)`
  - `weatherNeighborsToFeatureCollection(context, frameIndex)`
  - `weatherLinkToFeatureCollection(hotspot, context)`.

- [ ] **Step 1: Write RED feature-property tests**

```ts
const collection = weatherFrameToFeatureCollection(snapshot, 23, 'temperature')
expect(collection.features[0].properties).toMatchObject({
  id: 'wx--31.50--64.00',
  temperatureC: expect.any(Number),
  weatherValue: expect.any(Number),
  frameIndex: 23,
})
```

For wind, properties must include numeric `windSpeedKmh` and `windDirectionDeg`; features with `null` in the selected display variable must be omitted rather than rendered as zero.

- [ ] **Step 2: Run RED**

Run: `npm run test:run -- src/lib/weatherMapData.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement small pure GeoJSON transforms**

Use query coordinates for geometry. Neighbor properties include `rank`, `distanceKm`, and `isPrimary`. Link collection contains exactly one LineString from hotspot `[longitude, latitude]` to primary query coordinate when context exists; otherwise an empty FeatureCollection.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:run -- src/lib/weatherMapData.test.ts`

Expected: PASS.

```bash
git add src/lib/weatherMapData.ts src/lib/weatherMapData.test.ts
git commit -m "feat: prepare weather map data"
```

---

### Task 8: Render weather and hotspot-context details

**Files:**
- Create: `src/components/WeatherDetail.tsx`
- Create: `src/components/WeatherDetail.test.tsx`
- Create: `src/components/HotspotWeatherContext.tsx`
- Create: `src/components/HotspotWeatherContext.test.tsx`
- Modify: `src/components/TerritorialDetail.tsx`

**Interfaces:**
- Consumes: `WeatherSnapshot`, selected `WeatherPoint`, frame index, `HotspotWeatherContext`.
- Produces: semantic textual details only; no matching math in React components.

- [ ] **Step 1: Write RED `HotspotWeatherContext` UI test**

```tsx
render(<HotspotWeatherContext snapshot={snapshot} context={context} />)
expect(screen.getByText(/contexto meteorológico modelado/i)).toBeInTheDocument()
expect(screen.getByText(/19 km/i)).toBeInTheDocument()
expect(screen.getByText(/23 min/i)).toBeInTheDocument()
expect(screen.getByText(/no prueban su causa ni confirman por sí solas un incendio/i)).toBeInTheDocument()
expect(screen.getByRole('link', { name: /Open-Meteo/i })).toBeInTheDocument()
```

Also assert temperature/humidity/wind/gust/precipitation display `No disponible` for null, not zero.

- [ ] **Step 2: Write RED `WeatherDetail` test**

Assert active frame time, temperature, humidity, wind direction + speed, gust, precipitation, query coordinate, provider/dataset, `dataThrough`, and the explicit text `No es una estación de superficie`.

- [ ] **Step 3: Run RED tests**

Run: `npm run test:run -- src/components/HotspotWeatherContext.test.tsx src/components/WeatherDetail.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 4: Implement formatting in leaf components**

Use `Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })`. Wind cardinal label helper maps degrees to 16 compass sectors but retains numeric speed. Do not create risk labels.

Required caveat must appear verbatim:

```tsx
<p className="weather-context__caveat">
  Estas condiciones coexistían aproximadamente en espacio y tiempo con la detección. No prueban su causa ni confirman por sí solas un incendio.
</p>
```

- [ ] **Step 5: Keep `TerritorialDetail` narrow**

Add an optional React child/slot or optional `afterDetails` prop so `TerritorialSection` can append `HotspotWeatherContext` below thermal detail. Do not import `findWeatherContext` into `TerritorialDetail`.

- [ ] **Step 6: Run component tests and existing territorial detail tests**

Run: `npm run test:run -- src/components/HotspotWeatherContext.test.tsx src/components/WeatherDetail.test.tsx src/components/TerritorialSection.test.tsx`

Expected: PASS for new leaf tests; existing section tests remain green before section integration.

- [ ] **Step 7: Commit Task 8**

```bash
git add src/components/WeatherDetail.tsx src/components/WeatherDetail.test.tsx src/components/HotspotWeatherContext.tsx src/components/HotspotWeatherContext.test.tsx src/components/TerritorialDetail.tsx
git commit -m "feat: explain modeled hotspot weather context"
```

---

### Task 9: Extend the persistent MapLibre map with weather layers

**Files:**
- Modify: `src/components/TerritorialMap.tsx`
- Modify/Create: `src/components/TerritorialMap.test.tsx`

**Interfaces:**
- Consumes: `TerritorialViewMode`, `WeatherVariable`, `WeatherSnapshot | null`, frame index, hotspot context, separate selected hotspot/weather IDs.
- Produces callbacks: existing territorial `onSelect`; new `onSelectWeather(pointId: string)`.

- [ ] **Step 1: Write RED map lifecycle/visibility tests**

Mock `maplibre-gl` and assert:

- `new Map()` happens once across rerenders from hotspot → weather → hotspot;
- no `fitBounds`, `flyTo`, or new map construction occurs on view switch;
- weather full-grid layer is hidden in hotspot mode without selection;
- neighbor/link layers become visible only when hotspot context exists;
- weather full-grid is visible in weather mode;
- only the selected hotspot reference layer is visible in weather mode when a hotspot selection exists.

- [ ] **Step 2: Run RED map tests**

Run: `npm run test:run -- src/components/TerritorialMap.test.tsx`

Expected: FAIL until weather props/sources/layers exist.

- [ ] **Step 3: Add static sources to `createBlackMapStyle()`**

Add empty GeoJSON sources:

```text
weather-grid
weather-neighbors
weather-link
selected-hotspot-reference
```

Do not add a source containing 24 × points features. `syncSources` receives only the active frame feature collection.

- [ ] **Step 4: Add restrained weather layers**

Implement:

- `weather-temperature-points` circle layer using numeric `weatherValue` with a sequential non-risk ramp;
- `weather-humidity-points` circle layer using numeric `weatherValue` with a separate sequential non-risk ramp;
- `weather-wind-points` symbol layer rotating a simple arrow glyph by `windDirectionDeg`; speed remains detail text, not point size/risk;
- `weather-neighbor-points` subtle circles;
- `weather-primary-point` stronger but secondary to hotspot;
- `weather-context-link` thin low-opacity line;
- `selected-hotspot-reference` small hotspot-colored reference circle.

Do not interpolate a surface between grid points.

- [ ] **Step 5: Extend source/visibility synchronization without recreating map**

`syncVisibility(map, mode, weatherVariable, hasHotspotContext, hasSelectedHotspot)` must exclusively toggle layer visibility. Existing earthquake/hotspot cluster behavior stays unchanged.

- [ ] **Step 6: Add weather click handling**

In weather mode, click `weather-*-points`, read feature `id`, call `onSelectWeather(id)`. Preserve hotspot selection state in the parent; the map callback must not clear it.

- [ ] **Step 7: Run map + territorial map regression tests**

Run: `npm run test:run -- src/components/TerritorialMap.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit Task 9**

```bash
git add src/components/TerritorialMap.tsx src/components/TerritorialMap.test.tsx
git commit -m "feat: render weather context on territorial map"
```

---

### Task 10: Integrate weather state, controls, errors, freshness, and selection memory

**Files:**
- Modify: `src/components/TerritorialSection.tsx`
- Modify: `src/components/TerritorialSection.test.tsx`
- Modify: `src/components/TerritorialLegend.tsx`
- Modify its test file if present.

**Interfaces:**
- Consumes all previous frontend tasks.
- Produces complete `Sismos | Focos de calor | Meteorología` interaction.

- [ ] **Step 1: Update the map test mock before changing production section**

The mock must accept `TerritorialViewMode`, weather snapshot/frame props, `selectedHotspotId`, `selectedWeatherPointId`, `onSelect`, and `onSelectWeather`.

- [ ] **Step 2: Write RED integration tests for independent loading/failure**

Add `loadWeather?: () => Promise<WeatherSnapshot>` prop and tests:

```tsx
<TerritorialSection
  loadEarthquakes={async () => earthquakeSnapshot()}
  loadHotspots={async () => hotspotSnapshot()}
  loadWeather={async () => Promise.reject(new Error('weather unavailable'))}
  now={availableNow}
/>
```

Assert earthquakes and hotspots remain usable, weather mode says `Contexto meteorológico temporalmente no disponible`, and no `0 °C`/`0 km/h` false values appear.

- [ ] **Step 3: Write RED view/selection-memory tests**

Sequence:

1. switch to Focos;
2. select hotspot via mocked map;
3. assert thermal detail and modeled weather context;
4. switch to Meteorología;
5. select a weather point;
6. assert WeatherDetail;
7. switch back to Focos;
8. assert original hotspot detail restored.

Do not clear hotspot selection on view switch. Earthquake selection may remain independent or be cleared when entering earthquake mode, but hotspot and weather selections must not share one `selectedId`.

- [ ] **Step 4: Write RED variable-control/freshness tests**

Assert buttons `Temperatura`, `Viento`, `Humedad` exist only in weather mode, are keyboard buttons with `aria-pressed`, and weather stale at exactly `sourceCheckedAt + 180 min` shows `Datos desactualizados` plus last source check.

- [ ] **Step 5: Implement independent section state**

Use separate state:

```ts
const [mode, setMode] = useState<TerritorialViewMode>('earthquake')
const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
const [weatherError, setWeatherError] = useState(false)
const [weatherVariable, setWeatherVariable] = useState<WeatherVariable>('temperature')
const [selectedEarthquakeId, setSelectedEarthquakeId] = useState<string | null>(null)
const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null)
const [selectedWeatherPointId, setSelectedWeatherPointId] = useState<string | null>(null)
const activeWeatherFrameIndex = weather ? weather.timestamps.length - 1 : -1
```

Compute hotspot context with `useMemo(() => selectedHotspot && weather ? findWeatherContext(selectedHotspot, weather) : null, [...])`.

- [ ] **Step 6: Implement summary/detail switching**

Weather summary must show model/dataset, latest frame (`dataThrough`), source check, point count, and stale state. It must say `Contexto meteorológico modelado`, not `observaciones` or `estaciones`.

Hotspot detail appends `HotspotWeatherContext` only when weather context exists; on weather error it appends a compact `Contexto meteorológico temporalmente no disponible` state instead of hiding the hotspot detail.

- [ ] **Step 7: Extend legend for weather semantics**

Weather legend must explain current display variable and include `Modelo meteorológico · no estación de superficie`. Do not use danger/risk wording.

- [ ] **Step 8: Run section integration tests**

Run:

```bash
npm run test:run -- src/components/TerritorialSection.test.tsx src/components/TerritorialMap.test.tsx src/components/HotspotWeatherContext.test.tsx src/components/WeatherDetail.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 10**

```bash
git add src/components/TerritorialSection.tsx src/components/TerritorialSection.test.tsx src/components/TerritorialLegend.tsx src/components/TerritorialLegend.test.tsx
git commit -m "feat: add weather territorial view"
```

If the legend test file has a different existing name, add the exact existing file returned by repository inspection rather than creating a duplicate test file.

---

### Task 11: Apply bounded visual styling and attribution

**Files:**
- Modify: `src/styles.css`
- Modify: `README.md`
- Modify: UI tests from Tasks 8–10 only when they assert accessible labels, not presentation internals.

**Interfaces:**
- No new domain interfaces.

- [ ] **Step 1: Add weather controls using existing territorial visual tokens**

Reuse current Pulso black/bone/aged-amber hierarchy. Add only classes required by the new components/layers; do not restyle Evidence or national cards.

Required responsive behaviors:

```css
.territorial-weather-variables {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
}

.weather-context__caveat {
  max-width: 52ch;
}
```

Keep targets keyboard-visible with the repo's existing focus style. Do not encode danger through red/orange thresholds.

- [ ] **Step 2: Add visible source attribution in UI and README**

README section must state:

```text
Meteorología: Open-Meteo Historical Forecast · ECMWF IFS HRES 9 km · CC BY 4.0.
Los valores son contexto meteorológico modelado sobre una malla Pulso de 0,5°; no son estaciones ni mediciones exactas en cada foco.
```

Link to Open-Meteo Historical Forecast documentation and ECMWF attribution/source page using normal Markdown links in README.

- [ ] **Step 3: Run targeted UI tests and build**

Run:

```bash
npm run test:run -- src/components/TerritorialSection.test.tsx src/components/WeatherDetail.test.tsx src/components/HotspotWeatherContext.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit Task 11**

```bash
git add src/styles.css README.md
git commit -m "docs: explain modeled weather context"
```

---

### Task 12: Final regression gate, review, PR, merge, and exact deploy verification

**Files:**
- Potentially modify: `.github/workflows/ci.yml` only if Step 1 proves Node `.test.mjs` files are not already executed by Vitest/CI.
- No product feature scope additions.

**Interfaces:**
- This is a verification/integration task; no new public interfaces.

- [ ] **Step 1: Verify all Node script tests are covered by CI**

Run locally:

```bash
npm run test:run
```

Inspect output for `scripts/lib/weather-grid.test.mjs`, `scripts/fetch-open-meteo-weather.test.mjs`, and `scripts/refresh-weather-lib.test.mjs`.

If they are present, do not modify CI.

If Vitest does not discover them, modify `.github/workflows/ci.yml` to add before `npm run test:run`:

```yaml
      - name: Test Node data adapters
        run: node --test scripts/**/*.test.mjs
```

Then rerun the exact CI command locally.

- [ ] **Step 2: Run the complete local verification gate**

```bash
python3 scripts/cammesa_xlsx_test.py
npm run test:run
npm run build
git diff --check
```

Expected:

- CAMMESA extractor tests PASS;
- every Vitest/Node-discovered suite PASS;
- TypeScript/Vite build PASS;
- only the pre-existing chunk-size warning is acceptable;
- `git diff --check` prints nothing and exits 0.

- [ ] **Step 3: Verify the generated public snapshot explicitly**

Run:

```bash
node -e "const fs=require('fs'); const w=JSON.parse(fs.readFileSync('public/data/weather.json','utf8')); if(w.timestamps.length!==24) throw new Error('not 24 frames'); if(w.grid.pointCount!==w.points.length) throw new Error('point count mismatch'); if(w.dataThrough!==w.timestamps.at(-1)) throw new Error('dataThrough mismatch'); console.log(w.grid.pointCount, w.timestamps[0], w.dataThrough);"
```

Expected: valid point count and aligned 24-frame range.

- [ ] **Step 4: Perform code review against the spec before opening PR**

Check specifically:

- no modification of `TerritorialKind`;
- no browser Open-Meteo request;
- no false zeros;
- no risk/causal language;
- no map recreation/reset;
- no animation/forecast/GOES scope creep;
- weather failure leaves hotspots usable;
- attribution present;
- `weather.json` is a generated static snapshot, not hardcoded demo data.

- [ ] **Step 5: Push feature branch and open PR**

Use implementation branch:

```bash
git push -u origin feat/pulso-weather-context-v3-1
```

PR title:

```text
feat: add modeled weather context to thermal hotspots
```

PR body must summarize: separate contract, 0.5° grid, 24 UTC frames, ECMWF/Open-Meteo source, hotspot matching, independent fail-closed refresh, explicit non-causality, and full verification results.

- [ ] **Step 6: Require green CI and review before merge**

Do not merge on local tests alone. Record exact PR head SHA and verify GitHub CI passes on that SHA.

- [ ] **Step 7: Merge and verify exact GitHub Pages deployment**

After merge, record exact merge SHA. Verify:

1. `main` CI succeeds on that merge SHA;
2. GitHub Pages build succeeds;
3. deployed Pages build version equals the exact merge SHA;
4. public URL loads `weather.json` and the new Meteorología UI;
5. Focos still works if weather context is unavailable.

- [ ] **Step 8: Final completion commit only if CI coverage changed**

If `.github/workflows/ci.yml` changed in Step 1:

```bash
git add .github/workflows/ci.yml
git commit -m "ci: cover weather data adapters"
```

Otherwise no synthetic final commit is needed.

---

## Implementation Order and Review Checkpoints

Execute strictly in this order:

```text
1 Contract
2 Loader
3 Grid
4 Provider adapter
5 Snapshot publication
6 Spatial/temporal context
7 GeoJSON transforms
8 Detail UI
9 Map layers
10 Section integration
11 Styling/docs
12 Full verification + PR/deploy
```

Reviewer gates after Tasks 1, 5, 7, 10, and 12 are especially important because they close contract, ingestion, map-data, product-integration, and production boundaries respectively.

## Definition of Done

The feature is done only when a selected CONAE hotspot can show a traceable nearby modeled weather frame with visible spatial/temporal distance, the separate Meteorología view can render the latest national 0.5° grid for temperature/wind/humidity without resetting the map, weather refresh is independently fail-closed, all language avoids causal/confirmation overclaiming, the complete regression gate is green, and GitHub Pages is verified against the exact merged SHA.