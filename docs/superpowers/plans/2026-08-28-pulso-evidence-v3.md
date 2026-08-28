# Pulso Evidencia V3 Implementation Plan

> **Required execution skill:** use `superpowers:executing-plans` to implement this plan task-by-task. Every behavior change follows `superpowers:test-driven-development`; final completion requires `superpowers:verification-before-completion`.

**Goal:** Add a third independent public contract and UI section, `Pulso Evidencia`, starting with a single traceable external AgroENSO reference for maize + El Niño + Villaguay, Entre Ríos, without changing the public contracts of Pulso Nacional or Pulso Territorial.

**Architecture:** `EvidenceSnapshot 1.0` is a separate static contract loaded independently from `/data/evidence.json`. A fail-closed runtime validator protects the UI. `EvidenceSection` owns its loading/error state so failure remains isolated from the national and territorial sections. `EvidenceCard` renders the approved `claim / result / provenance / limitations / missingContext` grammar. The first geometry is a checked-in, explicitly simplified Villaguay polygon derived from IGN/CONAE departmental cartography, while official department identity is keyed by GeoRef/INDEC code `30113`.

**Tech stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, static JSON/GeoJSON, GitHub Actions, GitHub Pages.

---

## Task 1 — Lock the public evidence contract with RED tests

**Files:**
- Create: `src/types/evidence.ts`
- Create: `src/lib/validateEvidenceSnapshot.test.ts`
- Create later in GREEN: `src/lib/validateEvidenceSnapshot.ts`

**Contract:**

```ts
export interface EvidenceInput {
  role: string
  sourceName: string
  sourceUrl: string
}

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

export interface EvidenceSnapshot {
  schemaVersion: '1.0'
  generatedAt: string
  evidences: TerritorialEvidence[]
}
```

**Validator signature:**

```ts
export function validateEvidenceSnapshot(input: unknown): EvidenceSnapshot
```

**RED tests:**
- accepts one valid Villaguay-shaped evidence object;
- rejects wrong `schemaVersion`;
- rejects invalid `generatedAt`;
- rejects duplicate or empty evidence IDs;
- rejects missing/empty `territory.adminCode` and `geometryRef`;
- rejects non-finite numeric results;
- rejects invalid `statisticalSignificance`;
- rejects unsupported `claim.type`, `countryCode`, `adminLevel`, `freshness`, or `resultKind`;
- rejects missing/non-array `limitations` or `missingContext`;
- rejects empty provenance URLs and malformed input sources.

**GREEN implementation:** small explicit type guards, no schema library added. Follow the existing validator style in `validateSnapshot.ts` and `validateTerritorialSnapshot.ts`.

**Commit:** `test: define EvidenceSnapshot contract` for RED, then `feat: validate EvidenceSnapshot contract` for GREEN.

---

## Task 2 — Add the independent loader

**Files:**
- Create: `src/lib/loadEvidence.test.ts`
- Create later in GREEN: `src/lib/loadEvidence.ts`

**Signature:**

```ts
export async function loadEvidence(
  fetchImpl: typeof fetch = fetch,
): Promise<EvidenceSnapshot>
```

**RED tests:**
- requests `${import.meta.env.BASE_URL}data/evidence.json`;
- returns a validated snapshot;
- rejects non-OK HTTP response;
- rejects malformed JSON;
- rejects semantically invalid snapshot.

**GREEN implementation:** mirror existing loader patterns, with validation before returning.

**Commit:** `test: define evidence loader behavior`, then `feat: load public evidence snapshot`.

---

## Task 3 — Publish the Villaguay evidence and traceable geometry

**Files:**
- Create: `public/data/evidence.json`
- Create: `public/data/evidence/territories/villaguay.geojson`
- Create: `public/data/evidence/territories/villaguay.source.json`
- Create: `src/lib/evidenceDataContract.test.ts`

**Evidence identity:**
- `id`: `agroenso-maize-nino-villaguay`
- `claim.type`: `historical-association`
- territory: Villaguay, Entre Ríos, Argentina
- `adminCode`: `30113`
- `geometryRef`: `/data/evidence/territories/villaguay.geojson`
- subject: Maíz / El Niño
- `provenance.resultKind`: `external-reference`
- `provenance.analysisName`: `AgroENSO`
- authors: Juan Pablo Monzon, Fernando Aramburu-Merlos, Jorge Luis Mercau
- inputs: MAGyP agricultural estimates, NOAA ONI, IGN territorial geometry
- numeric external reference: `24` percent only because the institutional publication explicitly reports a +24% peak for Villaguay; the copy must use approximation language and never attribute the calculation to Pulso.
- `statisticalSignificance`: keep `null` unless the selected public source explicitly verifies significance for Villaguay individually; do not infer it from broader prose.

**Geometry provenance:**
- official identity and code are based on GeoRef/INDEC `30113`;
- polygon coordinates are a coarse topology-preserving simplification using boundary-arc endpoints from the public `mgaitan/departamentos_argentina` departmental geometry whose README attributes the geography to IGN information distributed by CONAE;
- source metadata must disclose the mirror, upstream attribution, simplification method, CRS `EPSG:4326`, and that it is suitable for territorial reference rather than cadastral precision.

**RED data contract test:** read the checked-in JSON/GeoJSON and assert:
- evidence snapshot validates;
- one evidence only;
- `adminCode === '30113'`;
- external result is not marked as reproduced;
- geometry is a non-empty Polygon/MultiPolygon and coordinates are finite;
- geometry source metadata documents simplification and upstream provenance.

**Commit:** `test: define Villaguay evidence fixture`, then `data: add Villaguay evidence reference`.

---

## Task 4 — Render one evidence clearly

**Files:**
- Create: `src/components/EvidenceCard.test.tsx`
- Create later in GREEN: `src/components/EvidenceCard.tsx`
- Modify: `src/styles.css`

**Component API:**

```ts
interface EvidenceCardProps {
  evidence: TerritorialEvidence
}

export function EvidenceCard({ evidence }: EvidenceCardProps)
```

**RED UI tests:**
- renders Villaguay + Entre Ríos, Maíz + El Niño;
- renders `Referencia externa`;
- renders `Qué sabemos`, `Qué significa`, `Qué falta`, `Cómo lo sabemos`;
- renders the +24% reference only as an external reported result;
- explicitly renders `Asociación histórica` and `no es un pronóstico de rendimiento`;
- renders AgroENSO, authors, inputs, temporal coverage, method and limitations;
- no `riesgo`, no synthetic `score`, no copy that says Pulso calculated the external result;
- `result.value = null` renders `Sin dato` rather than `0`.

**GREEN UI:** one responsive card using the existing black/bone/amber identity. No map, selector, chart, risk color, or prediction widget in V3.0.

**Commit:** `test: define evidence card semantics`, then `feat: render territorial evidence card`.

---

## Task 5 — Add an isolated Pulso Evidencia section

**Files:**
- Create: `src/components/EvidenceSection.test.tsx`
- Create later in GREEN: `src/components/EvidenceSection.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Component API:**

```ts
type EvidenceLoader = () => Promise<EvidenceSnapshot>

interface EvidenceSectionProps {
  loadSnapshot?: EvidenceLoader
}

export function EvidenceSection({ loadSnapshot = loadEvidence }: EvidenceSectionProps)
```

**Section copy:**
- eyebrow: `RELACIÓN + TERRITORIO + EVIDENCIA`
- title: `Pulso Evidencia`
- description: `Qué relaciones conocemos, dónde aplican y cómo fueron construidas.`

**RED tests:**
- loading state does not affect other sections;
- valid snapshot renders the one evidence;
- loader failure renders an evidence-specific error and does not fabricate an empty truth state;
- App contains Nacional, Territorial and Evidencia in that order;
- App national snapshot failure still leaves `EvidenceSection` mounted;
- evidence failure is owned by `EvidenceSection`, not App-wide state.

**GREEN implementation:** `EvidenceSection` owns its own `useEffect`, state and error handling, exactly to preserve failure isolation.

**Commit:** `test: define Pulso Evidencia integration`, then `feat: add Pulso Evidencia section`.

---

## Task 6 — Documentation and full verification

**Files:**
- Modify: `README.md`
- Verify: `docs/superpowers/specs/2026-08-28-pulso-evidence-territorial-design.md`

**Documentation changes:**
- document third public family and `/data/evidence.json`;
- document `/data/evidence/territories/villaguay.geojson`;
- state external reference vs reproduction distinction;
- state historical association ≠ yield forecast;
- state V3.1 will be the first candidate for a reproducible MAGyP + NOAA ONI pipeline.

**Fresh verification commands via CI:**
```text
python3 scripts/cammesa_xlsx_test.py
npm run test:run
npm run build
```

**Verification gates:**
1. all Vitest files/tests green;
2. TypeScript + Vite build green;
3. existing V1/V2 tests remain green;
4. diff review confirms no existing public contract changed incompatibly;
5. PR targets `main` from `feat/pulso-evidence-v3`;
6. merge uses exact reviewed head SHA;
7. GitHub Pages deployment succeeds for exact merged SHA;
8. public `/data/evidence.json` and Villaguay geometry path are reachable after deploy;
9. final browser-side visual confirmation remains a separate human gate.

**Final commit before PR if docs changed:** `docs: document Pulso Evidencia V3`.
