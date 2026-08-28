# Pulso Público Argentina — V2 territorial design

**Date:** 2026-08-28  
**Status:** Approved design, pending implementation plan  
**Branch:** `feat/v2-territorial-design`

## 1. Goal

Evolve Pulso Público from a four-signal public-data monitor into one coherent national + territorial product without turning V2 into a patch on top of V1.

V2 keeps the existing scalar public-signal contract intact, gives the whole product a unified black-map editorial identity, and adds a territorial subsystem based on official Argentine sources:

- earthquakes from INPRES;
- thermal hotspots from CONAE;
- one interactive dark map of Argentina;
- explicit provenance, freshness and limitations for each territorial dataset.

Primary product line:

> **Qué está pasando. Dónde. Y cómo lo sabemos.**

Supporting principle retained from V1:

> **Datos que se mueven. Fuentes que se pueden revisar.**

A source failure must never be silently converted into zero, false currentness or invented precision.

## 2. Product structure

V2 replaces the visual experience at the existing Pulso Público URL. It is not a `/v2` side app and not a second product.

The page has two primary sections.

### Pulso Nacional

The four existing V1 signals remain first-class content:

1. Energy — CAMMESA.
2. Science — OpenAlex.
3. Innovation — INPI.
4. Public digital infrastructure — GeoRef.

They continue to use `SignalEnvelope 1.0` and `public/data/signals.json` unchanged.

### Pulso Territorial

A new section adds spatial events over one map of Argentina:

- `Sismos` — last 7 days;
- `Focos de calor` — last 24 hours.

The editorial flow is:

```text
qué pasó
  -> dónde ocurrió
  -> qué significa
  -> cómo lo sabemos
```

## 3. Visual identity

V2 redesigns the complete page so Pulso Nacional and Pulso Territorial clearly belong to one system.

The visual family is related to GeoPlatform / Anti IA without copying either product literally:

- near-black main background;
- charcoal panels and map land masses;
- bone/off-white primary text;
- amber/gold editorial accent;
- thin borders and restrained UI chrome;
- subtle glow only for selection/emphasis;
- mono micro-labels for source/state/technical metadata;
- generous spacing and editorial hierarchy;
- no generic white dashboard aesthetic;
- no decorative red that implies danger when the data does not.

The current V1 green-led palette stops being the dominant identity.

The existing number-entry animation may remain, but it must continue to run once per mount/value change, settle to the exact source value and respect `prefers-reduced-motion`.

### Hero

Primary title: `Pulso Público`.

Primary explanatory line:

> **Qué está pasando. Dónde. Y cómo lo sabemos.**

`Datos que se mueven. Fuentes que se pueden revisar.` remains visible as a secondary principle.

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

Pulso Nacional keeps the information model of the existing cards but adopts the new identity. The four V1 cards must not read as legacy UI sitting above a separate V2 product.

Pulso Territorial uses one map instance. Switching mode changes the event layer, count, legend and selected-event semantics while preserving the current geographic viewport.

On desktop, a selected event may use a map/context split around 70/30 when space allows. On mobile, the Argentina map remains large and vertical and the selected-event card renders below the map rather than over it.

## 5. Architecture

Scalar signals and territorial events are separate domain primitives.

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

The browser never calls INPRES or CONAE directly. Acquisition and normalization run in scripts/workflows; the static React app consumes repository-published snapshots.

`SignalEnvelope 1.0` remains backward compatible and unchanged. Coordinates, magnitude, FRP and sensor fields are not added as optional scalar-signal fields.

## 6. Territorial contracts

V2 introduces a discriminated territorial model.

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
  sourceCheckedAt: string
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

Initial stale threshold: `240` minutes from `sourceCheckedAt`.

`sourceCheckedAt` means the last successful source fetch/parse/filter check represented by the published snapshot. `generatedAt` means when that snapshot file was generated for publication. Event occurrence time remains independent from both.

A fresh snapshot with `events: []` means the source check succeeded and produced zero qualifying events. A network/source/parser failure never writes an empty array over the previous good snapshot.

## 7. Stable event identity

Source row order is never used as event identity.

For earthquakes, use an official stable event id if INPRES exposes one in the acquired record. Otherwise derive a deterministic id from normalized source fields:

```text
occurredAt + latitude + longitude + depthKm + magnitude
```

For hotspots, use a stable WFS feature id when suitable. Otherwise derive an id from the normalized observation fields required to distinguish one satellite detection from another, including timestamp, coordinates and sensor/satellite fields available in the source feature.

Derived ids are implementation identifiers for deduplication/selection, not scientific identifiers.

## 8. Earthquake source — INPRES

Primary source: official INPRES recent-earthquake publication.

V2 uses the official recent-events table/page as its source boundary. No third-party earthquake feed replaces INPRES as the primary dataset.

```text
INPRES official publication
  -> adapter
  -> parse and normalize
  -> validate time/coordinates/magnitude/depth
  -> exact Argentina spatial filter
  -> last-7-days filter
  -> earthquakes.json
```

The adapter fails closed if source structure changes make field meaning ambiguous. It must not guess column meaning.

Fields are preserved when published by INPRES:

- occurrence date/time;
- latitude;
- longitude;
- magnitude;
- depth;
- place/province text;
- macroseismic intensity text.

Magnitude is a direct event property. Depth is context. Neither magnitude nor depth alone is converted into a damage/danger label.

### Geographic scope

Pulso V2 counts earthquakes whose epicentres fall within Argentina. Nearby Chilean or other foreign events can be relevant to Argentine users but are excluded from the `Argentina` count when the epicentre falls outside the national polygon.

That limitation is visible in methodology.

## 9. Thermal-hotspot source — CONAE

Primary source: CONAE public OGC geoservices, VIIRS last-24-hours thermal-hotspot layer `GeoServiciosCONAE:FocosDeCalorVIIRS` as advertised by the official CONAE geoservices catalog.

```text
CONAE WFS / VIIRS 24 h
  -> adapter
  -> structured feature parse
  -> coarse Argentina bbox where useful
  -> exact Argentina point-in-polygon filter
  -> normalize source attributes
  -> hotspots.json
```

The adapter verifies the expected layer against WFS capabilities before relying on it. A schema/layer mismatch fails closed and preserves the previous good snapshot.

### Semantics

A thermal hotspot is a satellite-detected thermal anomaly. It is not automatically a confirmed wildfire.

Allowed product language includes:

- `foco de calor`;
- `anomalía térmica`;
- `detección`.

V2 does not relabel detections as:

- `incendios activos`;
- `incendios confirmados`;
- `probabilidad de incendio`.

CONAE confidence expresses confidence in the thermal-anomaly detection, not probability that a wildfire exists on the ground.

### Confidence and FRP

Initial V2 marker emphasis is driven by source confidence when available:

- low/unknown: subdued;
- nominal: normal;
- high: stronger contrast.

FRP is preserved and shown as a physical source property in event detail when available. **Initial V2 does not use FRP to assign danger, risk, marker size or marker color.** A future release may add a source-defensible FRP encoding only after its methodology is explicitly validated for the selected VIIRS feed.

Persistence and repeated-detection analysis are not required for initial V2.

## 10. Spatial boundary

Both territorial adapters use the same checked-in simplified Argentina/provinces GeoJSON derived from an official IGN administrative-boundary source.

The geometry serves three purposes:

1. render the black map without a commercial/runtime basemap;
2. perform exact point-in-polygon filtering after any coarse bbox query;
3. keep source scope and visual scope consistent.

The repository documents geometry source and attribution. Simplification may reduce vertex count for browser performance but must preserve the national outline adequately for event inclusion at the working scale.

A rectangular Argentina bbox is never the final country filter because it includes neighbouring territory.

## 11. Black map

Recommended engine: MapLibre GL JS with local GeoJSON sources and a minimal custom style. V2 does not require a commercial map provider or runtime tile service.

The map reads as an interactive cartographic plate rather than a generic street map:

- black/charcoal background;
- Argentina land polygon slightly separated from background;
- subtle provincial boundaries;
- no roads, POIs or dense city labels;
- minimal controls;
- event layers are the visual focus.

Initial viewport fits Argentina including Tierra del Fuego.

Default territorial mode: `Sismos`.

Switching `Sismos` / `Focos de calor` preserves viewport and reuses the same map instance.

## 12. Earthquake encoding

All qualifying seven-day earthquakes are shown.

Primary encoding:

- bounded marker radius = magnitude;
- larger magnitude -> larger marker, capped to avoid covering large areas;
- neutral bone/amber tones rather than danger red;
- restrained halo may emphasize the largest events;
- selection raises contrast and slightly lowers surrounding-event emphasis.

No label equates a larger marker with expected damage.

Selected earthquake detail includes, when available:

- magnitude;
- depth;
- occurrence date/time;
- place/province;
- intensity text;
- plain-language explanation;
- `¿Cómo lo sabemos?` provenance.

## 13. Thermal-hotspot encoding

All qualifying last-24-hours detections remain available to the map. Low-confidence detections are not silently deleted merely to simplify the picture.

At national zoom, hotspot points use MapLibre source clustering so dense areas remain readable.

A cluster means `grouped detections`, not one large fire. Cluster counts are counts of detections.

Selected hotspot detail includes, when available:

- confidence;
- FRP in MW;
- sensor;
- satellite;
- acquisition/occurrence time;
- explicit thermal-anomaly caveat;
- `¿Cómo lo sabemos?` provenance.

No marker style means `confirmed fire`.

## 14. Counters and derived summaries

Territorial headline counts are derived from the exact events loaded from the matching snapshot. No unrelated count endpoint is maintained as a second source of truth.

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

Initial V2 prefers `con confianza alta` over vague wording such as `más peligrosos` or `señales más graves`.

No hidden `riskScore` exists in V2.

## 15. Interaction model

The map has one active mode:

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

Viewport remains stable across mode changes.

A first click/tap selects an event without aggressive automatic zoom. Zoom and pan remain separate user actions.

Desktop may render selected-event context beside the map. Mobile renders it below the map.

Layer changes use restrained opacity transitions around 200–300 ms and respect reduced-motion preferences.

## 16. Legend and explanatory copy

Mode-specific legend:

Sismos:

> `Tamaño = magnitud`

Focos:

> `Más marcado = mayor confianza de detección`

A `Cómo leer este mapa` disclosure explains encodings/limitations in plain Spanish.

Thermal-hotspot copy always includes an equivalent of:

> Una detección térmica no implica un incendio confirmado.

## 17. Freshness and failure semantics

Territorial snapshots are independently loadable and independently fallible.

Rules:

1. A successful source check may publish a zero-event snapshot.
2. A network/source/parser/validation failure never overwrites the previous good snapshot.
3. The failing workflow is visibly failed.
4. The UI derives `stale` from `sourceCheckedAt`, not from the newest event time.
5. A snapshot is stale after its declared `staleAfterMinutes`.
6. A missing/unreadable snapshot is `unavailable` for that territorial mode.
7. One source failing does not hide Pulso Nacional or the other territorial mode.
8. A recent source check never changes an old event's `occurredAt`.

A stale last-good dataset may remain visible, but the UI labels it stale and shows the last represented successful source check.

## 18. Automation and freshness heartbeat

INPRES and CONAE source checks run independently once per hour.

Recommended offsets:

- INPRES: minute 07;
- CONAE: minute 37.

The workflows share a territorial write concurrency group to avoid simultaneous Git pushes to `main`.

Each source check:

1. fetches with bounded timeout/retry behavior;
2. parses and validates source-specific fields;
3. applies temporal filtering;
4. applies Argentina point-in-polygon filtering;
5. normalizes and deterministically sorts events;
6. compares the semantic event payload with the published snapshot;
7. publishes immediately when event content materially changes.

To reconcile trustworthy freshness with commit noise, each snapshot also has a **freshness heartbeat**:

- source checks still run hourly;
- unchanged event content does not create an hourly commit;
- if the source remains healthy and the published `sourceCheckedAt` reaches 180 minutes old, the next successful check publishes a heartbeat-only snapshot update;
- stale threshold is 240 minutes.

Therefore a healthy unchanged source remains demonstrably fresh without producing 24 no-op commits per source per day, while a source that stops succeeding becomes stale after at most four hours from the last represented successful check.

Heartbeat-only publication updates `sourceCheckedAt`/`generatedAt` but does not alter event identity or occurrence timestamps.

The existing Pages deployment watches `public/**`, so territorial snapshot commits are expected to trigger production redeploy. Final implementation verification must confirm this on the actual final commit rather than assuming configuration is sufficient.

## 19. Accessibility

V2 retains V1 accessibility and extends it to the map:

- keyboard-visible focus;
- reduced-motion support;
- selected-event information exists outside the graphical marker alone;
- color is not the only encoding for magnitude/confidence;
- mode controls expose programmatic active state;
- map canvas/container has an accessible label/description;
- headline counts and source state are readable without clicking points;
- technical detail values are text, not only visual symbols.

The map enhances the data; it is not the sole route to critical event information.

## 20. Implementation strategy

Use vertical end-to-end slices.

### Slice 1 — Identity and territorial foundation

- redesign the full V1 page into the V2 visual system;
- introduce `Pulso Nacional` / `Pulso Territorial` hierarchy;
- preserve all four scalar signals and behavior;
- add MapLibre and local Argentina/province geometry;
- add territorial contracts, runtime validators and loaders;
- build the black-map shell with deterministic fixtures;
- verify responsive/mobile layout and accessibility basics.

This slice remains on the feature branch and is not deployed as a partial V2 production release.

### Slice 2 — Earthquakes end to end

```text
INPRES
  -> adapter
  -> validation
  -> spatial/time filtering
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
  -> spatial/time filtering
  -> hotspots.json
  -> loader
  -> clustering/confidence encoding
  -> selection/detail/provenance
```

### Slice 4 — Integration and hardening

- mode switching with preserved viewport;
- independent loading/error/stale states;
- legends and `Cómo leer este mapa` copy;
- mobile selected-event behavior;
- reduced motion;
- full-page visual consistency;
- refresh heartbeat/deploy verification;
- regression coverage for V1 scalar signals.

## 21. Testing strategy

Implementation follows test-driven development for new behavior.

### Contract tests

- valid earthquake snapshot accepted;
- valid hotspot snapshot accepted;
- malformed coordinates rejected;
- malformed timestamps rejected;
- event-specific required fields enforced;
- `sourceCheckedAt` and freshness metadata validated;
- `SignalEnvelope 1.0` remains backward compatible.

### INPRES adapter tests

Use checked-in representative source fixtures, not live network calls, for unit tests.

Test:

- field extraction;
- timestamp normalization;
- magnitude/depth parsing;
- stable ids;
- seven-day filtering;
- foreign event exclusion by polygon;
- malformed source structure fails closed;
- source failure cannot produce a synthetic zero-event snapshot.

### CONAE adapter tests

Use representative WFS/feature fixtures.

Test:

- expected layer/schema handling;
- coordinates/time normalization;
- confidence mapping;
- nullable FRP;
- sensor/satellite preservation;
- 24-hour filtering;
- Argentina point-in-polygon filtering;
- a Chile/Uruguay/Paraguay point inside the coarse bbox is excluded;
- malformed WFS/schema fails closed.

### Freshness tests

- material event change publishes immediately;
- unchanged healthy source does not create hourly timestamp-only writes;
- heartbeat publishes when represented `sourceCheckedAt` reaches 180 minutes;
- UI becomes stale after 240 minutes;
- failure preserves last-good data.

### UI tests

- Pulso Nacional renders all four scalar signals;
- Sismos is default territorial mode;
- mode toggle changes count/legend/content;
- viewport state is preserved across mode changes at component-contract level;
- earthquake selection exposes magnitude/depth/provenance;
- hotspot selection exposes confidence/FRP/sensor and caveat;
- hotspot copy never calls a detection a confirmed fire;
- one-source stale/unavailable state does not hide working sections;
- reduced-motion behavior remains respected.

### Final verification

Before claiming V2 complete:

- all tests pass on final HEAD;
- TypeScript passes;
- production build passes;
- diff/whitespace validation passes where available;
- adapters are exercised against the real current INPRES/CONAE sources;
- generated snapshots pass runtime validation;
- production Pages deploy succeeds for exact final HEAD;
- deployed UI and public JSON files are checked after deploy;
- desktop/mobile visual validation confirms Pulso Nacional and Pulso Territorial share one identity.

## 22. Definition of done

V2 is complete only when all conditions below are true.

### Product

- one public Pulso Público URL shows the V2 experience;
- the full site shares the black/bone/amber identity;
- Pulso Nacional retains all four real V1 signals;
- Pulso Territorial contains one functional Argentina black map;
- `Sismos` and `Focos de calor` are backed by real official-source snapshots;
- desktop and mobile interactions are usable.

### Semantics

- magnitude is not presented as predicted damage;
- depth is context, not a standalone danger rating;
- thermal hotspots are not presented as confirmed fires;
- CONAE confidence is not presented as wildfire probability;
- FRP is not converted into an unvalidated danger scale;
- no opaque risk score exists;
- source-derived and Pulso-derived values are distinguishable.

### Data

- `signals.json` remains V1 compatible;
- `earthquakes.json` and `hotspots.json` are public reusable snapshots;
- counts correspond to loaded events in the active mode;
- source failure never becomes zero;
- stale data is visibly stale;
- foreign points are not included merely because they fall inside an Argentina bbox.

### Operations

- INPRES and CONAE checks run independently;
- repository writes are serialized safely;
- material data changes publish promptly;
- healthy unchanged sources publish bounded freshness heartbeats rather than hourly no-op commits;
- a failure in one source does not take down the rest of the product;
- Pages redeploys when territorial public data changes.

### QA

- adapters, validators, spatial filters, freshness logic, loaders and critical map interactions are tested;
- final CI/build/deploy checks are green on exact final HEAD;
- final visual review confirms Pulso Nacional does not look like a V1 patch above a separate V2 map.

## 23. Explicitly out of scope for V2

Deferred to V2.x/V3:

- wildfire probability or damage prediction;
- synthetic fire-risk score;
- hotspot persistence scoring/tracking;
- custom spatial event semantics beyond display clustering;
- GOES 10-minute layer;
- NASA FIRMS cross-source validation;
- weather/wind overlays;
- vegetation/fuel layers;
- heatmaps;
- animated temporal playback;
- satellite imagery;
- complex province/date/magnitude/confidence filters;
- user accounts, backend or database;
- AI runtime;
- direct GeoPlatform integration.

## 24. Design rationale

V2 protects three boundaries:

1. **Scalar signal vs spatial event** — do not overload `SignalEnvelope`.
2. **Detection vs conclusion** — a thermal anomaly is evidence, not a confirmed wildfire.
3. **Product evolution vs feature patch** — redesign the whole Pulso experience so national and territorial signals read as one product.

The target is not simply a dashboard with more counters. It is a public, reusable territorial publication where a person can move from a national indicator to an event on the map and still answer:

> **Qué pasó. Dónde. Qué significa. Cómo lo sabemos.**
