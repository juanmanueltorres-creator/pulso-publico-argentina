# Pulso Público Argentina — V2 territorial design

**Date:** 2026-08-28  
**Status:** Approved design, pending implementation plan  
**Branch:** `feat/v2-territorial-design`

## 1. Goal

Evolve Pulso Público from a four-signal public-data monitor into a coherent national + territorial product without turning V2 into a patch on top of V1.

V2 keeps the existing scalar public-signal contract intact, gives the whole product a unified black-map editorial identity, and adds a new territorial subsystem based on official Argentine sources:

- earthquakes from INPRES;
- thermal hotspots from CONAE;
- one interactive dark map of Argentina;
- transparent provenance, freshness and limitations for every territorial dataset.

The product thesis becomes:

> **Qué está pasando. Dónde. Y cómo lo sabemos.**

The existing thesis remains a supporting principle:

> **Datos que se mueven. Fuentes que se pueden revisar.**

V2 must preserve the core V1 rule: a public-data failure must never be silently converted into zero, false currentness or invented precision.

## 2. Product information architecture

V2 is a full visual evolution of the same product at the same public URL. It is not a `/v2` side app and not a second product.

The page is organized into two primary sections:

### Pulso Nacional

The four existing V1 signals remain first-class content:

1. Energy — CAMMESA.
2. Science — OpenAlex.
3. Innovation — INPI.
4. Public digital infrastructure — GeoRef.

They continue to use `SignalEnvelope 1.0` and `public/data/signals.json`.

### Pulso Territorial

A new section introduces spatial events over a single map of Argentina:

- `Sismos` — last 7 days.
- `Focos de calor` — last 24 hours.

The conceptual flow remains consistent across both sections:

```text
qué pasó
  -> qué significa
  -> cómo lo sabemos
```

The map adds the missing spatial question:

```text
qué pasó
  -> dónde ocurrió
  -> qué significa
  -> cómo lo sabemos
```

## 3. Visual identity

V2 redesigns the complete page so Pulso Nacional and Pulso Territorial belong to one system.

The visual family is shared with GeoPlatform / Anti IA without copying either product literally:

- near-black main background;
- charcoal panels and map land masses;
- bone/off-white primary text;
- amber/gold editorial accent;
- very thin borders and low-noise UI chrome;
- restrained glow only where it communicates selection or signal emphasis;
- mono micro-labels for source/state/technical metadata;
- generous spacing and editorial hierarchy;
- no generic white dashboard styling;
- no pastel startup aesthetic;
- no decorative color that implies danger when the underlying variable does not.

The existing V1 green-led palette is no longer the primary identity. Existing number-entry animation can remain, but it must continue to run once per mount/value change, settle to the exact source value and respect `prefers-reduced-motion`.

### Hero

Primary headline remains `Pulso Público`.

Primary explanatory line:

> **Qué está pasando. Dónde. Y cómo lo sabemos.**

The original line `Datos que se mueven. Fuentes que se pueden revisar.` remains visible as a secondary principle rather than the main headline.

## 4. Page layout

Desktop flow:

```text
Hero
  ↓
Pulso Nacional
  ↓
4 redesigned signal cards
  ↓
Pulso Territorial
  ↓
[Sismos] [Focos de calor]
  ↓
black map of Argentina
  ↓
selected-event context
  ↓
sources / methodology / reusable data
```

Pulso Nacional uses the same card content model as V1 but adopts the V2 identity. The cards must not look like a legacy section sitting above a newer map.

Pulso Territorial uses one map instance. Switching between modes changes the event layer, count, legend and selected-event semantics while preserving the geographic viewport.

On desktop, a selected event may use a map/context split around 70/30 when space allows. On mobile, the Argentina map remains large and vertical, with the selected-event card rendered below the map rather than over it.

## 5. Architecture

V1 scalar signals and V2 territorial events are different domain primitives and must remain separate.

```text
CAMMESA ─────┐
OpenAlex ────┼──> SignalEnvelope 1.0 ──> public/data/signals.json
INPI ────────┤
GeoRef ──────┘

INPRES ─────────> EarthquakeEvent ─────> public/data/earthquakes.json
                                             ↓
                                         black map
                                             ↑
CONAE VIIRS ───> ThermalHotspotEvent ──> public/data/hotspots.json
```

The browser does not call INPRES or CONAE directly. Acquisition and normalization run outside the browser, and the static React app consumes only repository-published snapshots.

`SignalEnvelope 1.0` remains backward compatible and unchanged. Coordinates, magnitude, FRP or sensor fields must not be added as optional fields to the scalar contract.

## 6. Territorial contracts

V2 introduces a separate discriminated territorial model.

```ts
export type TerritorialKind = 'earthquake' | 'thermal-hotspot'

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

export type HotspotConfidence = 'low' | 'nominal' | 'high' | 'unknown'

export interface ThermalHotspotEvent extends BaseTerritorialEvent {
  kind: 'thermal-hotspot'
  confidence: HotspotConfidence
  frpMw: number | null
  sensor: string | null
  satellite: string | null
}
```

Each source publishes an independent snapshot envelope:

```ts
export interface TerritorialSnapshot<TEvent> {
  schemaVersion: '1.0'
  kind: TerritorialKind
  generatedAt: string
  window: {
    hours: number
  }
  freshness: {
    staleAfterMinutes: number
  }
  source: {
    name: string
    url: string
    kind: 'official'
  }
  method: {
    type: 'scrape' | 'wfs'
    note: string
  }
  limitations: string[]
  events: TEvent[]
}
```

Initial windows:

- earthquakes: `168` hours;
- thermal hotspots: `24` hours.

Initial territorial freshness policy: a successful snapshot becomes stale after 180 minutes without replacement. This is intentionally longer than the hourly refresh cadence to tolerate a small number of missed runs without falsely claiming currentness.

A fresh snapshot with `events: []` means the source query succeeded and produced zero qualifying events. A failed source fetch or parser failure must never write `events: []` over the previous good snapshot.

## 7. Stable event identity

Source row order must never be used as event identity.

For earthquakes, use an official event identifier if INPRES exposes a stable one in the acquired record. If no stable source identifier is available, derive the event id deterministically from normalized source fields:

```text
occurredAt + latitude + longitude + depthKm + magnitude
```

For thermal hotspots, use an official feature identifier when stable across refreshes. If the WFS feature id is not suitable, derive the id from the normalized observation fields needed to distinguish one satellite detection from another, including timestamp, coordinates, sensor/satellite and other stable source fields available in the feature.

IDs are implementation details for deduplication and React selection; they must not be presented as scientific identifiers unless they originate from the source.

## 8. Earthquake source — INPRES

Primary source: official INPRES recent-earthquake publication.

Source boundary for V2: the official INPRES recent-events table/page. No undocumented third-party earthquake feed may replace INPRES for the primary V2 dataset.

Acquisition path:

```text
INPRES official publication
  -> source adapter
  -> parse and normalize
  -> validate coordinates/time/magnitude/depth
  -> retain events inside Argentina
  -> retain last 7 days
  -> earthquakes.json
```

The adapter must fail closed if the expected source structure changes in a way that makes fields ambiguous. It must not guess column meaning.

Fields used when published by INPRES:

- occurrence date/time;
- latitude;
- longitude;
- magnitude;
- depth;
- place/province text;
- macroseismic intensity text.

Magnitude is a direct event property. Depth is secondary context. Neither magnitude nor depth alone may be translated into a damage or danger label.

### Geographic scope

Pulso Público V2 represents events whose epicentres fall within Argentina. Because a recent-events source may also list nearby events in Chile or other neighbouring territory, the normalized coordinates are checked against the same Argentina boundary used by the map rather than relying only on a rectangular bounding box.

This means an event outside the national polygon can be operationally relevant to Argentina but still be excluded from the V2 `Argentina` count. That limitation is documented.

## 9. Thermal-hotspot source — CONAE

Primary source: CONAE public OGC geoservices, VIIRS last-24-hours thermal-hotspot layer `GeoServiciosCONAE:FocosDeCalorVIIRS` as advertised by the official CONAE geoservices catalog.

Acquisition path:

```text
CONAE WFS / VIIRS 24 h
  -> source adapter
  -> structured feature parse
  -> coarse Argentina bbox filter where useful
  -> exact point-in-polygon Argentina filter
  -> normalize source attributes
  -> hotspots.json
```

The adapter must verify that the expected layer is present in the WFS service capabilities before relying on it. A source/schema mismatch fails closed and does not overwrite the previous good snapshot.

### Semantics

A thermal hotspot is a satellite-detected thermal anomaly. It is not automatically a confirmed wildfire.

UI and metadata must use language such as:

- `foco de calor`;
- `anomalía térmica`;
- `detección`.

They must not relabel detections as:

- `incendios activos`;
- `incendios confirmados`;
- `probabilidad de incendio`.

CONAE confidence describes confidence in the thermal-anomaly detection, not probability that a wildfire exists on the ground.

### Confidence and FRP

V2 initial emphasis is driven primarily by the source confidence class when present.

FRP is preserved and displayed as a physical source property when available. V2 does not invent a universal FRP risk threshold and does not reuse a threshold documented for another sensor/product unless the methodology is explicitly validated for the selected VIIRS feed.

Persistence and spatial grouping are useful future derived features, but they are not required for the initial V2 release.

## 10. Spatial boundary

Both territorial adapters use a checked-in simplified Argentina/provinces GeoJSON derived from an official IGN administrative-boundary source.

The geometry is used for:

1. rendering the black map without a commercial/runtime basemap;
2. exact point-in-polygon filtering after any coarse bounding-box query;
3. keeping source scope and visual scope consistent.

The repository must document the geometry source and attribution. Simplification may reduce vertex count for browser performance but must not materially alter the national outline for event inclusion at the working scale.

A rectangular Argentina bbox is never accepted as the final country filter because it includes parts of neighbouring countries.

## 11. Black-map implementation

Recommended map engine: MapLibre GL JS with local GeoJSON sources and a minimal custom style. V2 does not require a commercial map provider or runtime tile service.

The map should read as an interactive cartographic plate rather than a generic street map:

- black/charcoal background;
- Argentina land polygon slightly separated from the background;
- subtle provincial boundaries;
- no roads, POIs or dense city labels;
- minimal controls;
- event layers as the visual focus.

The map initially fits the complete Argentine territory, including Tierra del Fuego.

Default territorial mode: `Sismos`.

Switching `Sismos` / `Focos de calor` preserves the current viewport. The map instance is not destroyed and recreated merely to change mode.

## 12. Earthquake map encoding

All qualifying earthquakes in the seven-day snapshot are shown.

Primary visual encoding:

- marker radius represents magnitude using a bounded visual scale;
- higher magnitude produces a larger marker, but size is capped to avoid obscuring large map areas;
- neutral bone/amber tones are used rather than automatic danger red;
- the largest events can receive a restrained halo for prominence;
- selection increases contrast and lowers surrounding-event emphasis slightly.

No V2 label says that a larger marker means greater expected damage.

Selected-event detail includes, when available:

- magnitude;
- depth;
- occurrence date/time;
- place/province;
- intensity text;
- human explanation of what magnitude/depth mean;
- `¿Cómo lo sabemos?` source/provenance disclosure.

## 13. Thermal-hotspot map encoding

All qualifying last-24-hours detections remain available to the map. Low-confidence points are not silently deleted merely to make the map look cleaner.

Visual hierarchy:

- low/unknown confidence: very subdued;
- nominal confidence: normal visibility;
- high confidence: stronger contrast;
- FRP may influence detail copy and can influence marker emphasis only after an explicit, source-defensible mapping is implemented;
- no marker style means `confirmed fire`.

At national zoom, hotspots use MapLibre source clustering so dense areas do not become unreadable.

A cluster means `grouped detections`, not one large fire. Cluster counts represent detections in the cluster.

Selected detection detail includes, when available:

- confidence;
- FRP in MW;
- sensor;
- satellite;
- occurrence/acquisition time;
- explanation that the record is a thermal anomaly rather than a confirmed fire;
- `¿Cómo lo sabemos?` source/provenance disclosure.

## 14. Counters and derived summaries

Territorial headline counts are derived from the events currently loaded from the matching snapshot rather than stored as an unrelated second source of truth.

Examples:

```text
earthquakes.events.length
  -> "23 sismos registrados · últimos 7 días"

earthquakes.events.filter(event => event.magnitude >= 4).length
  -> "3 de magnitud 4 o superior"

hotspots.events.length
  -> "184 focos de calor detectados · últimas 24 h"

hotspots.events.filter(event => event.confidence === 'high').length
  -> "27 con confianza alta"
```

The initial V2 UI should prefer `con confianza alta` over vague wording such as `más peligrosos` or a synthetic risk score.

No hidden `riskScore` is introduced in V2.

## 15. Interaction model

The map has one active mode at a time:

```text
[Sismos] [Focos de calor]
```

Mode change updates:

- active layer;
- headline count;
- secondary summary;
- legend;
- explanatory copy;
- selected-event schema.

Viewport remains stable between modes.

A first click/tap selects an event. Selection does not trigger an aggressive automatic zoom. Users can zoom/pan separately.

Desktop may show the selected event in a side panel. Mobile shows the detail panel below the map.

Transitions between layers are restrained opacity transitions around 200–300 ms and must respect reduced-motion preferences.

## 16. Legend and explanatory copy

The legend remains compact and mode-specific.

Sismos:

> `Tamaño = magnitud`

Focos:

> `Más marcado = mayor confianza de detección`

A `Cómo leer este mapa` disclosure explains encodings and limitations in plain Spanish.

The thermal-hotspot legend must include a concise caveat equivalent to:

> Una detección térmica no implica un incendio confirmado.

## 17. Freshness, failure and unavailable states

Territorial snapshots are independently loadable and independently fallible.

Rules:

1. A successful source refresh writes a new normalized snapshot even when there are zero qualifying events.
2. A source/network/parser failure does not overwrite the last good snapshot.
3. The workflow fails visibly when acquisition/validation fails.
4. The UI derives `stale` when the last good snapshot exceeds its declared `staleAfterMinutes`.
5. A missing/unreadable snapshot is `unavailable` for that territorial mode.
6. Failure of one territorial source must not prevent Pulso Nacional or the other territorial mode from rendering.
7. `fetched/generated now` never makes an old event appear newly observed; event occurrence time remains distinct from snapshot generation time.

The UI may continue to display a stale last-good dataset, but it must label that state and show the last successful update time.

## 18. Automation

INPRES and CONAE refresh independently once per hour.

Recommended schedule offsets:

- INPRES: minute 07 of each hour;
- CONAE: minute 37 of each hour.

The workflows share a territorial write concurrency group so two GitHub Actions jobs do not race to commit different generated files to `main` at the same moment.

Each refresh:

1. fetches source data with bounded timeout/retry behavior;
2. parses and validates source-specific fields;
3. applies the temporal window;
4. applies Argentina point-in-polygon filtering;
5. normalizes and deterministically sorts events;
6. compares the generated semantic snapshot with the existing snapshot;
7. commits only when normalized data materially changed.

Operational timestamp churn alone must not create a commit every hour when no material event data changed. When event data does change, the committed successful snapshot receives the corresponding new generation/fetch metadata.

The existing Pages deployment watches `public/**`, so territorial snapshot commits are expected to trigger a production redeploy. Final implementation verification must confirm this behavior on the actual final commit rather than assuming it from configuration.

## 19. Accessibility

V2 retains the existing accessibility principles and extends them to the map:

- keyboard-visible focus;
- reduced-motion support;
- selected-event information available outside the graphical marker alone;
- color is not the only encoding for magnitude/confidence;
- buttons/toggles have programmatic active state;
- map canvas has an accessible label/description;
- counts and source state remain readable without interacting with individual points;
- technical values in detail panels remain available as text.

The map is an enhancement to the data, not the only way to access critical event information.

## 20. Implementation strategy

Use vertical end-to-end slices rather than building all acquisition first or all UI first.

### Slice 1 — Identity and territorial foundation

- redesign the whole V1 page into the V2 visual system;
- introduce `Pulso Nacional` and `Pulso Territorial` hierarchy;
- preserve the four existing scalar signals and their behavior;
- add MapLibre and local Argentina/province geometry;
- add territorial TypeScript contracts, runtime validators and loaders;
- build the black-map shell with deterministic fixtures;
- verify responsive/mobile layout and accessibility basics.

This slice remains on the feature branch and is not deployed as a partial V2 production release.

### Slice 2 — Earthquakes end to end

```text
INPRES
  -> adapter
  -> validation
  -> country/time filtering
  -> earthquakes.json
  -> loader
  -> map markers
  -> selection/detail/provenance
```

### Slice 3 — Thermal hotspots end to end

```text
CONAE WFS
  -> adapter
  -> validation
  -> Argentina point-in-polygon filter
  -> hotspots.json
  -> loader
  -> clustering/confidence encoding
  -> selection/detail/provenance
```

### Slice 4 — Integration and hardening

- mode switching while preserving viewport;
- independent loading/error/stale states;
- legends and `Cómo leer este mapa` copy;
- mobile selected-event behavior;
- reduced motion;
- full-page visual consistency;
- workflow/deploy verification;
- regression coverage for V1 scalar signals.

## 21. Testing strategy

Implementation follows test-driven development for new behavior.

### Contract tests

- valid earthquake snapshot accepted;
- valid hotspot snapshot accepted;
- malformed coordinates rejected;
- malformed timestamps rejected;
- event-specific required fields enforced;
- `SignalEnvelope 1.0` remains backward compatible.

### INPRES adapter tests

Use checked-in representative source fixtures rather than live network calls in unit tests.

Test:

- field extraction;
- timestamp normalization;
- numeric magnitude/depth parsing;
- stable ids;
- seven-day filtering;
- foreign event exclusion;
- malformed source structure fails closed;
- source failure never produces a synthetic zero-event snapshot.

### CONAE adapter tests

Use representative WFS/feature fixtures.

Test:

- expected layer/schema handling;
- coordinates/time normalization;
- confidence mapping;
- nullable FRP;
- sensor/satellite preservation;
- 24-hour filtering;
- point-in-polygon Argentina filtering;
- a Chile/Uruguay/Paraguay point inside the coarse Argentina bbox is excluded;
- malformed WFS/schema fails closed.

### UI tests

Test:

- Pulso Nacional still renders all four scalar signals;
- Sismos is the default territorial mode;
- mode toggle changes count/legend/content;
- viewport state is preserved across mode changes at the component contract level;
- selecting an earthquake shows magnitude/depth/provenance;
- selecting a hotspot shows confidence/FRP/sensor caveat;
- hotspot copy does not call a detection a confirmed fire;
- stale/unavailable one-source states do not hide working sections;
- reduced-motion behavior remains respected.

### Verification

Before claiming V2 complete:

- all unit/component tests pass on final HEAD;
- TypeScript passes;
- production build passes;
- `git diff --check` equivalent validation passes where available;
- scheduled adapter scripts are exercised against the real current sources;
- generated snapshots pass runtime validation;
- production Pages deploy succeeds for the exact final HEAD;
- deployed site and public JSON files are checked after deploy;
- desktop and mobile visual validation confirms V1/V2 identity coherence.

## 22. Definition of done

V2 is complete only when all of the following are true:

### Product

- one public Pulso Público URL shows the V2 experience;
- the whole site shares the black/bone/amber identity;
- Pulso Nacional retains all four real V1 signals;
- Pulso Territorial contains one functional Argentina black map;
- `Sismos` and `Focos de calor` are both backed by real official-source snapshots;
- desktop and mobile interactions are usable.

### Semantics

- magnitude is not presented as predicted damage;
- depth is contextual, not a standalone danger rating;
- thermal hotspots are not presented as confirmed fires;
- CONAE confidence is not presented as wildfire probability;
- no opaque risk score exists;
- source-derived and Pulso-derived values are distinguishable.

### Data

- `signals.json` remains compatible with V1;
- `earthquakes.json` and `hotspots.json` are public reusable snapshots;
- event counts correspond to the events loaded for the active mode;
- source failure never becomes zero;
- stale data is visibly stale;
- foreign points are not included merely because they fall inside an Argentina bbox.

### Operations

- INPRES and CONAE refresh independently;
- writes are serialized safely;
- workflows do not create meaningless commits when event content is unchanged;
- a failure in one source does not take down the rest of the product;
- Pages redeploys when territorial public data changes.

### QA

- adapters, validators, spatial filters, loaders and critical map interactions are tested;
- final CI/build/deploy checks are green on the exact final HEAD;
- final visual review confirms that Pulso Nacional does not look like a V1 patch above a separate V2 map.

## 23. Explicitly out of scope for V2

The following are intentionally deferred:

- wildfire probability or damage prediction;
- synthetic fire-risk score;
- persistence scoring;
- temporal hotspot tracking across multiple acquisitions;
- custom spatial clustering semantics beyond map display clustering;
- GOES 10-minute layer;
- NASA FIRMS cross-source validation;
- weather/wind overlays;
- vegetation/fuel layers;
- heatmaps;
- animated temporal playback;
- satellite imagery;
- complex filters by province/date/magnitude/confidence;
- user accounts, backend or database;
- AI runtime;
- direct GeoPlatform integration.

These are V2.x/V3 candidates only after the V2 territorial acquisition/map contract is proven.

## 24. Design rationale

V2 deliberately protects three boundaries:

1. **Scalar signal vs spatial event** — do not overload `SignalEnvelope`.
2. **Detection vs conclusion** — a thermal anomaly is evidence, not a confirmed wildfire.
3. **Product evolution vs feature patch** — V2 redesigns the full Pulso experience so national and territorial signals read as one product.

The target outcome is not a dashboard with more counters. It is a public, reusable territorial publication where a person can move from a national number to an event on the map and still answer:

> **Qué pasó. Dónde. Qué significa. Cómo lo sabemos.**
