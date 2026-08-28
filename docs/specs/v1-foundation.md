# Pulso Público Argentina — V1 foundation spec

## Goal

Build a mobile-first static React app that renders public Argentine indicators from a stable JSON snapshot while preserving source, time, method and limitations.

## Product thesis

**Datos que se mueven. Fuentes que se pueden revisar.**

A counter must never look more precise or current than its source allows.

## V1 categories

1. Energy — CAMMESA.
2. Science — OpenAlex works with at least one Argentine institutional affiliation.
3. Innovation — INPI patent statistics.
4. Public digital infrastructure — Datos Argentina GeoRef API consumption.

## Data states

- `live`: observed now or near-real-time.
- `updated`: latest published/source-query value that does not claim real-time source ingestion.
- `estimated`: explicit derivation/calculation.
- `historical`: historical snapshot that does not claim currentness.

Availability is separate:

- `available`
- `stale`
- `unavailable`

## Architecture

```text
external sources
  -> source adapters
  -> normalized SignalEnvelope[]
  -> public/data/signals.json
  -> React/Vite static UI
```

The browser must not call source providers directly.

## SignalEnvelope 1.0

```ts
export type SignalCategory =
  | 'energy'
  | 'science'
  | 'innovation'
  | 'public-infrastructure'

export type SignalStatus = 'live' | 'updated' | 'estimated' | 'historical'
export type SignalAvailability = 'available' | 'stale' | 'unavailable'

export interface SignalEnvelope {
  schemaVersion: '1.0'
  id: string
  category: SignalCategory
  title: string
  value: number | null
  unit: string
  periodLabel: string
  status: SignalStatus
  availability: SignalAvailability
  observedAt: string | null
  publishedAt: string | null
  fetchedAt: string
  source: {
    name: string
    url: string
    kind: 'official' | 'open-index'
  }
  method: {
    type: 'api' | 'csv' | 'scrape' | 'calculation'
    note: string
  }
  limitations: string[]
}
```

`value` is nullable only when availability is `unavailable`. The UI renders `Sin dato` rather than `0`.

## Foundation slice

This first slice must provide:

- Vite + React + TypeScript.
- Contract types and runtime validation for the snapshot.
- A static snapshot with four declared signals; unresolved sources use `value: null` and `availability: unavailable`, never fabricated values.
- Mobile-first cards.
- `¿Cómo lo sabemos?` disclosure showing source, state, dates, method and limitations.
- Unit tests for snapshot validation and unavailable-value semantics.
- CI for tests and build.
- No backend, DB, auth, maps, AI runtime or GeoPlatform changes.

## Source slices

### GeoRef — implemented

Use `https://apis.datos.gob.ar/series/api/series` with id `apis_georef_005`, retrieving the most recent value.

**Verified behavior (2026-08-27):** the adapter and scheduled refresh work end-to-end against the official API. The first live refresh recovered `264037620` accumulated queries with observation date `2024-08-27`. Because the resource declares weekly frequency but the observation is old, Pulso Público preserves the official value and exposes it as `status: historical` and `availability: stale`.

Freshness rule for this signal: an observation older than 14 days is `historical + stale`. `fetchedAt` never upgrades an old `observedAt` to current.

### OpenAlex — implemented

Use the `/works` endpoint with:

```text
filter=institutions.country_code:AR,publication_year:<current-year>
per_page=1
```

The signal value is `meta.count`. The public copy must say that this is an OpenAlex-indexed count with at least one Argentine institutional affiliation, not a census of Argentine science.

**Verified behavior (2026-08-27):** the first end-to-end refresh returned `27994` works for 2026. The query succeeded without an API key. The signal is `updated + available`, not `live`, because OpenAlex ingestion and curation can lag or revise counts retroactively.

Because this count is evaluated when the API is queried and OpenAlex does not provide a separate observation timestamp for the aggregate, `observedAt` equals `fetchedAt` for this signal.

### INPI — next candidate

Inspect the stable CSV download behind the official patent statistics page before implementing HTML scraping.

### CAMMESA

Inspect the data path behind `Renovables Hoy`. If the live iframe does not expose a stable structured source, use the official monthly renewable dataset and label it `updated`.

## Automation

GeoRef and OpenAlex each refresh every 12 hours and can also be triggered manually. Their schedules are offset and both workflows share the `refresh-signals` concurrency group so they cannot write the public snapshot concurrently.

Each refresh workflow has `contents: write` only because it commits the generated public snapshot. Neither implemented source requires a credential.

## Out of scope for V1

Earthquakes and fires are high-value future territorial adapters but are intentionally deferred until the non-spatial pipeline is proven.
