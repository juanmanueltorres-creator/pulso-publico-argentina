# Pulso Público Argentina V1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest production-shaped static app that renders four public-indicator cards from a validated JSON snapshot without fabricating unresolved values.

**Architecture:** Vite/React reads only `public/data/signals.json`. Runtime validation protects the UI contract. Source-specific network adapters are separate follow-up slices; this foundation ships explicit unavailable states for sources not yet integrated.

**Tech Stack:** Node 20+, React 19, TypeScript 5, Vite 7, Vitest 3, Testing Library.

**Spec:** `docs/specs/v1-foundation.md`

## Global Constraints

- No backend, database, auth, maps or AI runtime.
- Browser does not call provider APIs directly.
- `0` is never used to represent a failed/unavailable source.
- Source, time, method and limitations remain visible from every card.
- Keep the JSON contract independent of React so GeoPlatform can consume it later.
- No production code before its failing test.

---

### Task 1: Bootstrap and contract validator

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/types/signal.ts`
- Create: `src/lib/validateSnapshot.ts`
- Test: `src/lib/validateSnapshot.test.ts`

**Interfaces:**
- Consumes: JSON-compatible unknown input.
- Produces: `validateSnapshot(input: unknown): SignalSnapshot` or throws `Error`.

- [ ] **Step 1: Write failing validator tests**

```ts
import { describe, expect, it } from 'vitest'
import { validateSnapshot } from './validateSnapshot'

it('accepts an unavailable signal with a null value', () => {
  const snapshot = validateSnapshot({
    schemaVersion: '1.0',
    generatedAt: '2026-08-27T00:00:00Z',
    signals: [{
      schemaVersion: '1.0', id: 'energy', category: 'energy', title: 'Energía renovable',
      value: null, unit: 'MW', periodLabel: 'Fuente pendiente', status: 'updated',
      availability: 'unavailable', observedAt: null, publishedAt: null,
      fetchedAt: '2026-08-27T00:00:00Z',
      source: { name: 'CAMMESA', url: 'https://cammesaweb.cammesa.com/inicio-renovables/', kind: 'official' },
      method: { type: 'api', note: 'Pendiente de confirmar endpoint estructurado.' },
      limitations: ['No se publica un valor hasta verificar la fuente.']
    }]
  })
  expect(snapshot.signals[0].value).toBeNull()
})

it('rejects available signals with null values', () => {
  expect(() => validateSnapshot({
    schemaVersion: '1.0', generatedAt: '2026-08-27T00:00:00Z',
    signals: [{
      schemaVersion: '1.0', id: 'x', category: 'science', title: 'X', value: null,
      unit: 'works', periodLabel: '2026', status: 'updated', availability: 'available',
      observedAt: null, publishedAt: null, fetchedAt: '2026-08-27T00:00:00Z',
      source: { name: 'OpenAlex', url: 'https://openalex.org', kind: 'open-index' },
      method: { type: 'api', note: 'API' }, limitations: []
    }]
  })).toThrow(/value/i)
})
```

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- src/lib/validateSnapshot.test.ts`
Expected: FAIL because validator does not exist.

- [ ] **Step 3: Implement minimal types and validator**

Implement the exact `SignalEnvelope` contract from the spec plus a small manual validator. Avoid a schema dependency in V1.

- [ ] **Step 4: Run validator tests and confirm GREEN**

Run: `npm test -- src/lib/validateSnapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig*.json vite.config.ts index.html src/types/signal.ts src/lib/validateSnapshot.ts src/lib/validateSnapshot.test.ts
git commit -m "feat: add signal snapshot contract"
```

---

### Task 2: Snapshot loader and explicit unavailable states

**Files:**
- Create: `public/data/signals.json`
- Create: `src/lib/loadSignals.ts`
- Test: `src/lib/loadSignals.test.ts`

**Interfaces:**
- Consumes: `/data/signals.json`.
- Produces: `loadSignals(fetcher?: typeof fetch): Promise<SignalSnapshot>`.

- [ ] **Step 1: Write failing loader test**

```ts
it('loads and validates the public snapshot', async () => {
  const fetcher = async () => new Response(JSON.stringify(validSnapshot), { status: 200 })
  const result = await loadSignals(fetcher as typeof fetch)
  expect(result.schemaVersion).toBe('1.0')
})
```

- [ ] **Step 2: Run test and confirm RED**

Run: `npm test -- src/lib/loadSignals.test.ts`
Expected: FAIL because loader does not exist.

- [ ] **Step 3: Implement minimal loader and four declared signals**

The initial snapshot contains CAMMESA, OpenAlex, INPI and GeoRef entries. Until each live source adapter is implemented, use `availability: "unavailable"` with `value: null`; include the exact official source URL and a limitation explaining that no numeric value is published yet.

- [ ] **Step 4: Run loader tests and confirm GREEN**

Run: `npm test -- src/lib/loadSignals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/data/signals.json src/lib/loadSignals.ts src/lib/loadSignals.test.ts
git commit -m "feat: add public signal snapshot"
```

---

### Task 3: Mobile-first cards and provenance disclosure

**Files:**
- Create: `src/components/SignalCard.tsx`
- Create: `src/components/SignalCard.test.tsx`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Create: `src/main.tsx`
- Create: `src/styles.css`

**Interfaces:**
- Consumes: `SignalEnvelope`.
- Produces: accessible card with status/source and expandable provenance.

- [ ] **Step 1: Write failing card tests**

```tsx
it('renders Sin dato instead of zero for unavailable signals', () => {
  render(<SignalCard signal={unavailableSignal} />)
  expect(screen.getByText('Sin dato')).toBeInTheDocument()
  expect(screen.queryByText(/^0$/)).not.toBeInTheDocument()
})

it('reveals provenance and limitations', async () => {
  render(<SignalCard signal={unavailableSignal} />)
  await userEvent.click(screen.getByRole('button', { name: /cómo lo sabemos/i }))
  expect(screen.getByText('CAMMESA')).toBeInTheDocument()
  expect(screen.getByText(/No se publica un valor/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- src/components/SignalCard.test.tsx`
Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement minimal mobile UI**

Use semantic HTML, `<button aria-expanded>`, `<dl>` for provenance, responsive CSS grid and system fonts. No design-system dependency.

- [ ] **Step 4: Run component/app tests and confirm GREEN**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components src/App.tsx src/App.test.tsx src/main.tsx src/styles.css
git commit -m "feat: add mobile public pulse cards"
```

---

### Task 4: CI and public documentation

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: reproducible install/test/build gate on push and PR.

- [ ] **Step 1: Add CI configuration**

Use Node 20, `npm ci`, `npm test -- --run`, `npm run build`. Workflow permissions: `contents: read`.

- [ ] **Step 2: Document architecture and truthfulness rules**

README must explain the four states, why unavailable is not zero, V1 source list and future GeoPlatform integration through `signals.json`.

- [ ] **Step 3: Run full local verification**

Run:

```bash
npm ci
npm test -- --run
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: verify V1 foundation"
```

---

## Self-review

- Spec coverage: contract, four source declarations, unavailable semantics, mobile cards, provenance, CI and no-backend rule are all covered.
- Placeholder scan: unresolved provider integrations are deliberately represented as unavailable data, not implementation placeholders inside this foundation slice.
- Type consistency: `SignalEnvelope`, `SignalSnapshot`, `validateSnapshot`, `loadSignals` and `SignalCard` use the same field names as the spec.
