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
- `updated`: latest published source value.
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

## Follow-up source slices

### GeoRef

Use `https://apis.datos.gob.ar/series/api/series` with id `apis_georef_005`, retrieving the most recent value.

### OpenAlex

Use works filtering by `institutions.country_code:AR` and current publication year. The copy must say that this is an OpenAlex-indexed count, not a census of Argentine science.

### INPI

Inspect the stable CSV download behind the official patent statistics page before implementing HTML scraping.

### CAMMESA

Inspect the data path behind `Renovables Hoy`. If the live iframe does not expose a stable structured source, use the official monthly renewable dataset and label it `updated`.

## Out of scope for V1

Earthquakes and fires are high-value future territorial adapters but are intentionally deferred until the non-spatial pipeline is proven.
