# Phase 4 — The Office View Design Spec
**Date:** 2026-05-14
**Status:** Approved
**Phase:** 4

---

## 1. Vision

A pixel-art floor-plan mode that sits alongside the existing list view. Agents become animated characters from The Office TV show, seated at a faithful recreation of the Dunder Mifflin Scranton branch. Toggle between list and office view at any time — same data, different lens.

**Core rules:**
- Every agent gets the next free desk (dynamic cast, no fixed agent→character pairing)
- The canonical Dunder Mifflin layout is always preserved; extra desks grow downward
- Zero changes to the server, reducer, or WebSocket — the office view is a pure state consumer

---

## 2. Architecture

```
App.tsx
  ├── header: [≡ List] [⌂ Office] toggle  (new, ~5 lines)
  ├── viewMode === 'list'   → existing layout (AgentTree + AgentDetail + EventStream)
  └── viewMode === 'office' → <OfficeView agents={state.agents} onSelect={...} />
                                └── <canvas> + requestAnimationFrame loop
                                    reads state via stateRef (no re-renders)
```

`OfficeView` mounts and unmounts on toggle. On mount it runs an immediate sync so agents already sitting appear at their desks without walking in — only newly arriving agents walk from the entrance.

Clicking a character dispatches the existing `SELECT_AGENT` action. The detail panel opens identically to list view.

**Keyboard shortcut:** `O` toggles between list and office view.

### Phase trajectory

- **Phase 4A (ship):** `OfficeView` renders agents via canvas sprites on an HTML/CSS floor layout (Approach A). Static rooms are `<div>` elements; characters are canvas-drawn on top.
- **Phase 4C (follow-up):** migrate the static floor elements into the canvas draw loop for zoom/pan support (Approach C). Sprite and animation code is identical — nothing is thrown away.

---

## 3. New Files

| File | Responsibility |
|---|---|
| `client/src/office/floorplan.ts` | Room + workspace definitions, `getWorkspace(n)` |
| `client/src/office/sprites/types.ts` | `Sprite`, `PixelRow` types |
| `client/src/office/sprites/michael.ts` | Michael Scott pixel frames |
| `client/src/office/sprites/dwight.ts` | Dwight Schrute pixel frames |
| `client/src/office/sprites/jim.ts` | Jim Halpert pixel frames |
| `client/src/office/sprites/pam.ts` | Pam Beesly pixel frames |
| `client/src/office/sprites/angela.ts` | Angela Martin pixel frames |
| `client/src/office/sprites/kevin.ts` | Kevin Malone pixel frames |
| `client/src/office/sprites/oscar.ts` | Oscar Martinez pixel frames |
| `client/src/office/sprites/meredith.ts` | Meredith Palmer pixel frames |
| `client/src/office/sprites/creed.ts` | Creed Bratton pixel frames |
| `client/src/office/sprites/stanley.ts` | Stanley Hudson pixel frames |
| `client/src/office/sprites/phyllis.ts` | Phyllis Vance pixel frames |
| `client/src/office/sprites/kelly.ts` | Kelly Kapoor pixel frames |
| `client/src/office/sprites/ryan.ts` | Ryan Howard pixel frames |
| `client/src/office/sprites/toby.ts` | Toby Flenderson pixel frames |
| `client/src/office/sprites/index.ts` | `CAST` array + `drawSprite()` utility |
| `client/src/components/OfficeView.tsx` | Canvas component + animation loop |

**Modified files:**
- `client/src/App.tsx` — add `viewMode` state + toggle button

**Unchanged:** server, reducer, WebSocket, AgentTree, AgentDetail, EventStream.

---

## 4. Floor Plan Data Model

```typescript
// client/src/office/floorplan.ts

type PixelColor = string   // hex e.g. '#2d2d44'
type TilePattern = 'carpet' | 'wood' | 'plain'

interface Room {
  id: RoomId
  label: string
  x: number; y: number; w: number; h: number  // bounds in game-pixels
  floorTile: TilePattern
}

type RoomId = 'michaels-office' | 'conference-room' | 'break-room'
            | 'reception' | 'bullpen' | 'annex' | 'extension'

interface Workspace {
  id: string           // 'michael-desk', 'jim-desk', 'ext-0', etc.
  label: string        // desk nameplate shown on floor
  x: number           // center x in game-pixels
  y: number           // desk top y in game-pixels
  room: RoomId
}
```

### Canonical workspace assignment order (14 desks)

| # | Workspace ID | Room |
|---|---|---|
| 1 | michael-desk | michaels-office |
| 2 | pam-desk | reception |
| 3 | jim-desk | bullpen |
| 4 | dwight-desk | bullpen |
| 5 | angela-desk | bullpen |
| 6 | kevin-desk | bullpen |
| 7 | oscar-desk | bullpen |
| 8 | meredith-desk | bullpen |
| 9 | creed-desk | bullpen |
| 10 | stanley-desk | bullpen |
| 11 | phyllis-desk | bullpen |
| 12 | kelly-desk | annex |
| 13 | ryan-desk | annex |
| 14 | toby-desk | annex |

### Extension workspaces (agent 15+)

```typescript
function getExtensionWorkspace(index: number): Workspace {
  // index 0 = 15th agent, index 1 = 16th, etc.
  const col = index % 4
  const row = Math.floor(index / 4)
  return {
    id: `ext-${index}`,
    label: `+${index + 1}`,
    x: EXTENSION_ORIGIN_X + col * DESK_STRIDE_X,
    y: EXTENSION_ORIGIN_Y + row * DESK_STRIDE_Y,
    room: 'extension',
  }
}

export function getWorkspace(index: number): Workspace {
  return index < CANONICAL_WORKSPACES.length
    ? CANONICAL_WORKSPACES[index]
    : getExtensionWorkspace(index - CANONICAL_WORKSPACES.length)
}
```

Extension zone: faint dashed border, dimmer floor tile, grows downward in rows of 4. Canvas height grows to fit; container uses `overflow-y: auto` for very large agent counts.

---

## 5. Sprite System

### Types

```typescript
// client/src/office/sprites/types.ts

type PixelRow = (string | null)[]   // null = transparent

interface Sprite {
  width: number    // 16 (game-pixels)
  height: number   // 22 (game-pixels)
  frames: {
    idle:    [PixelRow[], PixelRow[]]                          // 2-frame bob
    working: [PixelRow[], PixelRow[]]                          // 2-frame typing
    walking: [PixelRow[], PixelRow[], PixelRow[], PixelRow[]]  // 4-frame walk cycle
    waiting: [PixelRow[]]                                      // 1-frame, drifts slowly
    done:    [PixelRow[]]                                      // 1-frame, opacity fades
  }
}
```

All sprites are **16×22 game-pixels**, rendered at **3× CSS scale** (48×66 CSS pixels on screen). The scale constant lives in `OfficeView.tsx` and can be adjusted globally.

### Cast

```typescript
// client/src/office/sprites/index.ts
export const CAST: Sprite[] = [
  michael, dwight, jim, pam, angela, kevin, oscar,
  meredith, creed, stanley, phyllis, kelly, ryan, toby
]
```

Agent N gets `CAST[N % CAST.length]`. When agents exceed 14, the cast cycles — two Michaels, two Dwights, etc. The sprite is assigned once on first appearance and is stable for the session lifetime.

### Rendering utility

```typescript
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  framePixels: PixelRow[],
  x: number, y: number,
  scale: number,
  alpha?: number
): void
```

All callers go through this — no raw pixel array access outside `sprites/`.

### Distinctive pixel features per character

| Character | Key pixel markers |
|---|---|
| Michael | styled dark hair, navy suit, red tie |
| Dwight | bowl-cut brown hair, wire glasses, mustard yellow shirt |
| Jim | shaggy brown hair, blue-grey shirt, brown tie |
| Pam | red hair bun, pink/cream blouse |
| Angela | severe blonde updo, dark conservative blouse |
| Kevin | round head, green shirt |
| Oscar | short dark hair, light blue dress shirt |
| Meredith | messy red hair, flannel shirt |
| Creed | grey hair, flannel |
| Stanley | grey temples, moustache, patterned shirt |
| Phyllis | grey-brown bob, pink blouse |
| Kelly | long dark hair, bright pink top |
| Ryan | dark hair, hoodie / casual |
| Toby | mousy brown hair, sad expression, muted shirt |

---

## 6. Animation Loop

### Internal state (ref, not React state)

```typescript
interface SpriteState {
  sessionId: string
  workspaceIndex: number
  x: number; y: number      // current position (game-px, float)
  tx: number; ty: number    // walk target
  walking: boolean
  frame: number             // increments each tick
  opacity: number           // 1.0 → fades to 0 on 'done'
}
```

This map is mutated directly each frame — never triggers React re-renders.

### Loop steps (each `requestAnimationFrame`)

Steps 1–2 and 5–7 apply in both Phase 4A and 4C. Steps 3–4 apply only in Phase 4C (in 4A, rooms and floor are HTML/CSS `<div>` elements rendered beneath the canvas).

1. **Sync** — diff `SpriteState` map against `stateRef.current.agents`
   - New agent → assign next free workspace, place at entrance coords, set walk target to desk
   - Agent removed from state → begin fade (`opacity -= 0.03/frame`, delete at `opacity ≤ 0`)
2. **Move** — walking agents step toward `(tx, ty)` at 1.5 game-px/frame; on arrival set `walking = false`
3. **Draw floor** *(4C only)* — tiled patterns per room via `ctx.createPattern()` (created once, reused)
4. **Draw rooms** *(4C only)* — walls, doorways, room labels
5. **Draw desks** — all workspaces; empty desks shown with faint dashed outline
6. **Draw agents** — sprite frame selected by status + tick counter (see table below)
7. **Draw name tags** — `sessionId.slice(0, 8)` in 7px monospace above each character's head

### Status → animation

| Agent status | Frames | Tick cadence |
|---|---|---|
| `starting` | `idle[0]` only | — |
| `idle` | `idle[0↔1]` | every 20 ticks |
| `working` | `working[0↔1]` | every 8 ticks |
| `waiting` | `waiting[0]`, ±1 game-px horizontal drift | every 40 ticks |
| `done` | `done[0]`, opacity fades to 0.25 | — |
| `error` | `idle[0]`, red 30%-alpha overlay | — |

### Click hit-testing

```typescript
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  const gx = (e.clientX - rect.left) / SCALE
  const gy = (e.clientY - rect.top) / SCALE
  const hit = findAgentAt(gx, gy, spriteStates)
  if (hit) dispatch({ type: 'SELECT_AGENT', sessionId: hit.sessionId })
})
```

`findAgentAt` checks a 16×22 bounding box centered on each agent's current `(x, y)`.

---

## 7. Floor Textures

Textures are small tiled patterns defined as `PixelRow[][]` in `floorplan.ts`:

| Room | Tile | Description |
|---|---|---|
| michaels-office | `wood` | horizontal brown planks, 4×2 tile |
| conference-room | `carpet` | 4×4 checkerboard, two greys |
| break-room | `plain` | solid dark grey |
| reception | `carpet` | same as conference room |
| bullpen | `carpet` | 4×4 checkerboard, slightly lighter |
| annex | `plain` | slightly dimmer than break room |
| extension | `plain` | dimmest, clearly "extra" |

Patterns are drawn with `ctx.createPattern(offscreenCanvas, 'repeat')` on first render and cached. Adding a new tile type is one new pixel array in `floorplan.ts`.

---

## 8. Toggle Mechanism

```typescript
// App.tsx addition
const [viewMode, setViewMode] = useState<'list' | 'office'>('list')
```

Header control (replaces nothing — sits next to connection badge):

```
[≡ List]  [⌂ Office]     ● connected    [Clear All]
```

Active segment is highlighted. Keyboard shortcut `O` (when no input focused) toggles the mode.

---

## 9. Out of Scope (Phase 4)

- Zoom / pan (Phase 4C follow-up)
- Agent speech bubbles
- Room-specific interactions (e.g. clicking the conference room to see active agents there)
- Characters walking between rooms during status changes
- Sound effects
- Any server-side changes

---

## 10. Success Criteria

- [ ] `O` key and header toggle switch between list and office view
- [ ] Each agent maps to the next free workspace in canonical order
- [ ] All 14 canonical Dunder Mifflin workspaces are recognizable on the floor plan
- [ ] Agent 15+ gets an extension desk below the annex
- [ ] Clicking a character opens the existing agent detail panel
- [ ] Status color dot visible above each character's head
- [ ] Working agents show typing animation; idle agents bob; done agents fade
- [ ] New agents walk from the entrance to their assigned desk
- [ ] All 14 characters are visually distinguishable from each other
- [ ] Floor textures differ between Michael's office, bullpen, and annex
- [ ] Mock mode (`?mock=true`) works in office view — agents appear and animate
- [ ] No changes to server, reducer, or existing client components
- [ ] All existing tests still pass
