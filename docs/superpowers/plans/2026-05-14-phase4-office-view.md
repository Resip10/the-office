# Phase 4 — The Office View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable pixel-art Dunder Mifflin floor-plan view where agents appear as animated Office characters sitting at desks.

**Architecture:** A self-contained `OfficeView` React component reads existing `DashboardState` via a ref (no reducer changes), renders an HTML/CSS floor layout (Phase 4A) with a canvas overlay for animated character sprites, driven by `requestAnimationFrame`. A toggle button in the App header switches between list and office view.

**Tech Stack:** React 18, TypeScript, HTML5 Canvas, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `client/src/office/sprites/types.ts` | Create | `Sprite`, `PixelRow`, `CharacterColors` types |
| `client/src/office/sprites/draw.ts` | Create | `drawSprite()` utility |
| `client/src/office/sprites/build.ts` | Create | `buildSprite()` — auto-generates animation frames from idle0 |
| `client/src/office/sprites/michael.ts` | Create | Michael Scott — fully handcrafted frames |
| `client/src/office/sprites/dwight.ts` | Create | Dwight Schrute — idle0 + buildSprite |
| `client/src/office/sprites/jim.ts` | Create | Jim Halpert — idle0 + buildSprite |
| `client/src/office/sprites/pam.ts` | Create | Pam Beesly — idle0 + buildSprite |
| `client/src/office/sprites/angela.ts` | Create | Angela Martin — idle0 + buildSprite |
| `client/src/office/sprites/kevin.ts` | Create | Kevin Malone — idle0 + buildSprite |
| `client/src/office/sprites/oscar.ts` | Create | Oscar Martinez — idle0 + buildSprite |
| `client/src/office/sprites/meredith.ts` | Create | Meredith Palmer — idle0 + buildSprite |
| `client/src/office/sprites/creed.ts` | Create | Creed Bratton — idle0 + buildSprite |
| `client/src/office/sprites/stanley.ts` | Create | Stanley Hudson — idle0 + buildSprite |
| `client/src/office/sprites/phyllis.ts` | Create | Phyllis Vance — idle0 + buildSprite |
| `client/src/office/sprites/kelly.ts` | Create | Kelly Kapoor — idle0 + buildSprite |
| `client/src/office/sprites/ryan.ts` | Create | Ryan Howard — idle0 + buildSprite |
| `client/src/office/sprites/toby.ts` | Create | Toby Flenderson — idle0 + buildSprite |
| `client/src/office/sprites/index.ts` | Create | `CAST` array (14 sprites), exports |
| `client/src/office/floorplan.ts` | Create | Room + workspace definitions, `getWorkspace(n)` |
| `client/src/components/OfficeView.tsx` | Create | Canvas component + HTML/CSS floor + animation loop |
| `client/src/App.tsx` | Modify | `viewMode` state + toggle button + `O` shortcut |

---

### Task 1: Sprite types

**Files:**
- Create: `client/src/office/sprites/types.ts`
- Create: `client/src/office/sprites/types.test.ts`

- [ ] **Step 1: Create `client/src/office/sprites/types.ts`**

```typescript
export type PixelRow = (string | null)[]

export interface Sprite {
  width: number
  height: number
  frames: {
    idle:    [PixelRow[], PixelRow[]]
    working: [PixelRow[], PixelRow[]]
    walking: [PixelRow[], PixelRow[], PixelRow[], PixelRow[]]
    waiting: [PixelRow[]]
    done:    [PixelRow[]]
  }
}

export interface CharacterColors {
  skin: string
  shirt: string
  trouser: string
  shoe: string
  tie?: string
}
```

- [ ] **Step 2: Create `client/src/office/sprites/types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import type { Sprite, PixelRow } from './types'

describe('Sprite type', () => {
  it('accepts a valid sprite', () => {
    const row: PixelRow = ['#ff0000', null]
    const sprite: Sprite = {
      width: 2, height: 1,
      frames: {
        idle:    [[row], [row]],
        working: [[row], [row]],
        walking: [[row], [row], [row], [row]],
        waiting: [[row]],
        done:    [[row]],
      },
    }
    expect(sprite.frames.idle).toHaveLength(2)
    expect(sprite.frames.walking).toHaveLength(4)
  })
})
```

- [ ] **Step 3: Run**

```
npm test -w client -- --run
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/office/sprites/types.ts client/src/office/sprites/types.test.ts
git commit -m "feat(office): add Sprite type definitions"
```

---

### Task 2: Floorplan data model

**Files:**
- Create: `client/src/office/floorplan.ts`
- Create: `client/src/office/floorplan.test.ts`

- [ ] **Step 1: Write failing tests — `client/src/office/floorplan.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { getWorkspace, CANONICAL_WORKSPACES } from './floorplan'

describe('getWorkspace', () => {
  it('returns michael-desk for index 0', () => {
    expect(getWorkspace(0).id).toBe('michael-desk')
    expect(getWorkspace(0).room).toBe('michaels-office')
  })

  it('returns pam-desk for index 1', () => {
    expect(getWorkspace(1).id).toBe('pam-desk')
  })

  it('returns toby-desk for index 13', () => {
    expect(getWorkspace(13).id).toBe('toby-desk')
  })

  it('returns ext-0 for index 14', () => {
    const ws = getWorkspace(14)
    expect(ws.id).toBe('ext-0')
    expect(ws.room).toBe('extension')
  })

  it('ext columns cycle 0–3', () => {
    const x0 = getWorkspace(14).x
    const x1 = getWorkspace(15).x
    const x4 = getWorkspace(18).x
    expect(x1).toBeGreaterThan(x0)
    expect(x4).toBe(x0)
  })

  it('ext rows increment every 4', () => {
    expect(getWorkspace(18).y).toBeGreaterThan(getWorkspace(14).y)
  })

  it('canonical list has 14 entries', () => {
    expect(CANONICAL_WORKSPACES).toHaveLength(14)
  })
})
```

- [ ] **Step 2: Run — expect FAIL (module not found)**

```
npm test -w client -- --run
```

- [ ] **Step 3: Create `client/src/office/floorplan.ts`**

```typescript
export type TilePattern = 'carpet' | 'wood' | 'plain'

export type RoomId =
  | 'michaels-office' | 'conference-room' | 'break-room'
  | 'reception' | 'bullpen' | 'annex' | 'extension'

export interface Room {
  id: RoomId
  label: string
  x: number; y: number; w: number; h: number
  floorTile: TilePattern
}

export interface Workspace {
  id: string
  label: string
  x: number
  y: number
  room: RoomId
}

export const ROOMS: Room[] = [
  { id: 'michaels-office', label: "Michael's Office", x: 0,   y: 0,   w: 72,  h: 52,  floorTile: 'wood'   },
  { id: 'conference-room',  label: 'Conference Room',  x: 76,  y: 0,   w: 80,  h: 52,  floorTile: 'carpet' },
  { id: 'break-room',       label: 'Break Room',       x: 160, y: 0,   w: 60,  h: 52,  floorTile: 'plain'  },
  { id: 'reception',        label: 'Reception',        x: 0,   y: 56,  w: 72,  h: 28,  floorTile: 'carpet' },
  { id: 'bullpen',          label: 'The Bullpen',      x: 0,   y: 88,  w: 220, h: 92,  floorTile: 'carpet' },
  { id: 'annex',            label: 'Annex',            x: 0,   y: 184, w: 220, h: 52,  floorTile: 'plain'  },
  { id: 'extension',        label: '',                 x: 0,   y: 240, w: 220, h: 0,   floorTile: 'plain'  },
]

export const CANONICAL_WORKSPACES: Workspace[] = [
  { id: 'michael-desk',  label: 'Michael',  x: 36,  y: 26,  room: 'michaels-office' },
  { id: 'pam-desk',      label: 'Pam',      x: 36,  y: 64,  room: 'reception'       },
  { id: 'jim-desk',      label: 'Jim',      x: 28,  y: 104, room: 'bullpen'         },
  { id: 'dwight-desk',   label: 'Dwight',   x: 74,  y: 104, room: 'bullpen'         },
  { id: 'angela-desk',   label: 'Angela',   x: 120, y: 104, room: 'bullpen'         },
  { id: 'kevin-desk',    label: 'Kevin',    x: 166, y: 104, room: 'bullpen'         },
  { id: 'oscar-desk',    label: 'Oscar',    x: 28,  y: 148, room: 'bullpen'         },
  { id: 'meredith-desk', label: 'Meredith', x: 74,  y: 148, room: 'bullpen'         },
  { id: 'creed-desk',    label: 'Creed',    x: 120, y: 148, room: 'bullpen'         },
  { id: 'stanley-desk',  label: 'Stanley',  x: 166, y: 148, room: 'bullpen'         },
  { id: 'phyllis-desk',  label: 'Phyllis',  x: 96,  y: 166, room: 'bullpen'         },
  { id: 'kelly-desk',    label: 'Kelly',    x: 40,  y: 204, room: 'annex'           },
  { id: 'ryan-desk',     label: 'Ryan',     x: 110, y: 204, room: 'annex'           },
  { id: 'toby-desk',     label: 'Toby',     x: 180, y: 204, room: 'annex'           },
]

const EXT_X = 30
const EXT_Y = 250
const EXT_DX = 55
const EXT_DY = 48

function getExtensionWorkspace(i: number): Workspace {
  return {
    id: `ext-${i}`,
    label: `+${i + 1}`,
    x: EXT_X + (i % 4) * EXT_DX,
    y: EXT_Y + Math.floor(i / 4) * EXT_DY,
    room: 'extension',
  }
}

export function getWorkspace(index: number): Workspace {
  return index < CANONICAL_WORKSPACES.length
    ? CANONICAL_WORKSPACES[index]
    : getExtensionWorkspace(index - CANONICAL_WORKSPACES.length)
}
```

- [ ] **Step 4: Run — expect all 7 tests PASS**

```
npm test -w client -- --run
```

- [ ] **Step 5: Commit**

```bash
git add client/src/office/floorplan.ts client/src/office/floorplan.test.ts
git commit -m "feat(office): add floorplan rooms, workspaces, and getWorkspace()"
```

---

### Task 3: drawSprite utility

**Files:**
- Create: `client/src/office/sprites/draw.ts`
- Create: `client/src/office/sprites/draw.test.ts`

- [ ] **Step 1: Write failing tests — `client/src/office/sprites/draw.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { drawSprite } from './draw'
import type { PixelRow } from './types'

function mockCtx() {
  return { fillStyle: '', globalAlpha: 1, fillRect: vi.fn() } as unknown as CanvasRenderingContext2D
}

describe('drawSprite', () => {
  it('calls fillRect once per non-null pixel', () => {
    const ctx = mockCtx()
    const frame: PixelRow[] = [['#f00', null, '#0f0'], [null, '#00f', null]]
    drawSprite(ctx, frame, 0, 0, 1)
    expect(ctx.fillRect).toHaveBeenCalledTimes(3)
  })

  it('skips null pixels entirely', () => {
    const ctx = mockCtx()
    drawSprite(ctx, [[null, null]], 0, 0, 1)
    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  it('scales pixel position and size by scale factor', () => {
    const ctx = mockCtx()
    drawSprite(ctx, [['#f00']], 5, 10, 4)
    expect(ctx.fillRect).toHaveBeenCalledWith(5 * 4, 10 * 4, 4, 4)
  })

  it('sets fillStyle before each fillRect call', () => {
    const ctx = mockCtx()
    const seen: string[] = []
    ctx.fillRect = vi.fn().mockImplementation(() => seen.push((ctx as any).fillStyle))
    drawSprite(ctx, [['#aaa', '#bbb']], 0, 0, 1)
    expect(seen).toEqual(['#aaa', '#bbb'])
  })

  it('restores globalAlpha after draw', () => {
    const ctx = mockCtx()
    ctx.globalAlpha = 1
    drawSprite(ctx, [['#f00']], 0, 0, 1, 0.4)
    expect(ctx.globalAlpha).toBe(1)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```
npm test -w client -- --run
```

- [ ] **Step 3: Create `client/src/office/sprites/draw.ts`**

```typescript
import type { PixelRow } from './types'

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  frame: PixelRow[],
  x: number,
  y: number,
  scale: number,
  alpha = 1,
): void {
  const prev = ctx.globalAlpha
  ctx.globalAlpha = alpha
  for (let row = 0; row < frame.length; row++) {
    for (let col = 0; col < frame[row].length; col++) {
      const color = frame[row][col]
      if (color === null) continue
      ctx.fillStyle = color
      ctx.fillRect((x + col) * scale, (y + row) * scale, scale, scale)
    }
  }
  ctx.globalAlpha = prev
}
```

- [ ] **Step 4: Run — expect all 5 PASS**

```
npm test -w client -- --run
```

- [ ] **Step 5: Commit**

```bash
git add client/src/office/sprites/draw.ts client/src/office/sprites/draw.test.ts
git commit -m "feat(office): add drawSprite utility"
```

---

### Task 4: buildSprite helper

`buildSprite` generates all animation frames from a single `idle0` base frame, so each character file only needs to define their visual identity once.

**Files:**
- Create: `client/src/office/sprites/build.ts`
- Create: `client/src/office/sprites/build.test.ts`

- [ ] **Step 1: Write failing tests — `client/src/office/sprites/build.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { buildSprite } from './build'
import type { PixelRow } from './types'

const row: PixelRow = Array(16).fill(null)
const bodyRow: PixelRow = Array(16).fill('#3a3a3a')
const legRow: PixelRow = Array(16).fill('#1a1a1a')

// 22-row idle0: rows 0-7 head, 8-16 body, 17-21 legs
const idle0: PixelRow[] = [
  ...Array(8).fill(row),    // head
  ...Array(9).fill(bodyRow), // body
  ...Array(5).fill(legRow),  // legs
]

describe('buildSprite', () => {
  it('returns a sprite with correct dimensions', () => {
    const s = buildSprite(idle0, { skin: '#c8a882', shirt: '#1a3a6a', trouser: '#2a2a3a', shoe: '#1a1a1a' })
    expect(s.width).toBe(16)
    expect(s.height).toBe(22)
  })

  it('idle has 2 frames', () => {
    const s = buildSprite(idle0, { skin: '#c8a882', shirt: '#1a3a6a', trouser: '#2a2a3a', shoe: '#1a1a1a' })
    expect(s.frames.idle).toHaveLength(2)
  })

  it('idle[0] is the provided idle0', () => {
    const s = buildSprite(idle0, { skin: '#c8a882', shirt: '#1a3a6a', trouser: '#2a2a3a', shoe: '#1a1a1a' })
    expect(s.frames.idle[0]).toBe(idle0)
  })

  it('walking has 4 frames', () => {
    const s = buildSprite(idle0, { skin: '#c8a882', shirt: '#1a3a6a', trouser: '#2a2a3a', shoe: '#1a1a1a' })
    expect(s.frames.walking).toHaveLength(4)
  })

  it('each frame has 22 rows', () => {
    const s = buildSprite(idle0, { skin: '#c8a882', shirt: '#1a3a6a', trouser: '#2a2a3a', shoe: '#1a1a1a' })
    for (const frame of [...s.frames.idle, ...s.frames.working, ...s.frames.walking, ...s.frames.waiting, ...s.frames.done]) {
      expect(frame).toHaveLength(22)
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```
npm test -w client -- --run
```

- [ ] **Step 3: Create `client/src/office/sprites/build.ts`**

```typescript
import type { PixelRow, Sprite, CharacterColors } from './types'

function blank(width: number): PixelRow {
  return Array(width).fill(null)
}

// idle1: sprite 1px higher (bob effect — last row becomes blank)
function bobFrame(idle0: PixelRow[]): PixelRow[] {
  return [...idle0.slice(1), blank(idle0[0].length)]
}

// working: arms extend 1px outward in rows 9-11
function workingFrame(idle0: PixelRow[], colors: CharacterColors, tick: 0 | 1): PixelRow[] {
  const frame = idle0.map(r => [...r])
  const offset = tick === 0 ? 0 : 1
  for (let r = 9; r <= 11; r++) {
    // Left arm: column 2 - offset
    const leftCol = Math.max(0, 2 - offset)
    // Right arm: column 13 + offset
    const rightCol = Math.min(15, 13 + offset)
    frame[r][leftCol] = colors.skin
    frame[r][rightCol] = colors.skin
  }
  return frame
}

// walk: alternate leg columns in rows 17-21
function walkFrame(idle0: PixelRow[], colors: CharacterColors, phase: 0 | 1): PixelRow[] {
  const W = idle0[0].length
  const frame = idle0.slice(0, 17).map(r => [...r])
  const P = colors.trouser
  const SH = colors.shoe
  if (phase === 0) {
    // left leg forward, right leg back
    frame.push(
      [...Array(4).fill(null), P, P, null, null, null, null, P, null, null, null, null, null],
      [...Array(4).fill(null), null, P, null, null, null, null, null, null, null, null, null, null],
      [...Array(5).fill(null), P, null, null, null, null, null, null, null, null, null, null],
      [...Array(5).fill(null), P, null, null, null, null, null, null, null, null, null, null],
      [...Array(5).fill(null), SH, null, null, null, null, null, null, null, null, null, null],
    )
  } else {
    // right leg forward, left leg back
    frame.push(
      [...Array(4).fill(null), P, null, null, null, null, null, P, P, null, null, null, null],
      [...Array(4).fill(null), null, null, null, null, null, null, null, P, null, null, null, null],
      [...Array(10).fill(null), P, null, null, null, null, null],
      [...Array(10).fill(null), P, null, null, null, null, null],
      [...Array(10).fill(null), SH, null, null, null, null, null],
    )
  }
  return frame
}

export function buildSprite(idle0: PixelRow[], colors: CharacterColors): Sprite {
  return {
    width: idle0[0].length,
    height: idle0.length,
    frames: {
      idle:    [idle0, bobFrame(idle0)],
      working: [workingFrame(idle0, colors, 0), workingFrame(idle0, colors, 1)],
      walking: [walkFrame(idle0, colors, 0), walkFrame(idle0, colors, 1), idle0, walkFrame(idle0, colors, 0)],
      waiting: [idle0],
      done:    [idle0],
    },
  }
}
```

- [ ] **Step 4: Run — expect all 5 PASS**

```
npm test -w client -- --run
```

- [ ] **Step 5: Commit**

```bash
git add client/src/office/sprites/build.ts client/src/office/sprites/build.test.ts
git commit -m "feat(office): add buildSprite frame generator"
```

---

### Task 5: Michael Scott sprite

Michael: dark styled hair, navy suit, red tie. Fully handcrafted — reference quality for all animation frames.

**Files:**
- Create: `client/src/office/sprites/michael.ts`

- [ ] **Step 1: Create `client/src/office/sprites/michael.ts`**

```typescript
import type { Sprite, PixelRow } from './types'

const _ = null
const H = '#c8a882'  // skin
const h = '#e0b898'  // skin highlight
const K = '#8b6914'  // dark hair
const S = '#1a3a6a'  // navy suit
const T = '#c23a3a'  // red tie
const W = '#d9e0e8'  // white shirt
const P = '#2a2a3a'  // dark trousers
const E = '#222222'  // eyes
const SH = '#1a1a1a' // shoes

const idle0: PixelRow[] = [
  [_,_,_,_,_,_,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,_,K,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,_,_,_,H,E,_,H,_,E,H,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,H,_,_,_,_],
  [_,_,_,_,_,_,H,h,H,h,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,S,W,T,T,T,T,W,S,S,_,_,_],
  [_,_,_,S,H,W,T,T,T,T,W,H,S,_,_,_],
  [_,_,_,S,H,S,T,T,T,T,S,H,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

// idle1: head 1px higher
const idle1: PixelRow[] = [
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,_,_,_,H,E,_,H,_,E,H,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,H,_,_,_,_],
  [_,_,_,_,_,_,H,h,H,h,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,S,W,T,T,T,T,W,S,S,_,_,_],
  [_,_,_,S,H,W,T,T,T,T,W,H,S,_,_,_],
  [_,_,_,S,H,S,T,T,T,T,S,H,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

// working: arms extended, typing
const working0: PixelRow[] = [
  ...idle0.slice(0, 9),
  [_,_,S,S,S,W,T,T,T,T,W,S,S,S,_,_],
  [_,S,H,S,S,W,T,T,T,T,W,S,S,H,S,_],
  [_,S,H,S,S,S,T,T,T,T,S,S,S,H,S,_],
  ...idle0.slice(12),
]
const working1: PixelRow[] = [
  ...idle0.slice(0, 9),
  [_,_,S,S,S,W,T,T,T,T,W,S,S,S,_,_],
  [_,H,S,S,S,W,T,T,T,T,W,S,S,S,H,_],
  [_,H,S,S,S,S,T,T,T,T,S,S,S,S,H,_],
  ...idle0.slice(12),
]

// walk0: left leg forward
const walk0: PixelRow[] = [
  ...idle0.slice(0, 17),
  [_,_,_,_,P,P,_,_,_,_,P,_,_,_,_,_],
  [_,_,_,_,_,P,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,P,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,P,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,SH,_,_,_,_,_,_,_,_,_,_],
]
// walk1: right leg forward
const walk1: PixelRow[] = [
  ...idle0.slice(0, 17),
  [_,_,_,_,P,_,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,SH,_,_,_,_],
]

export const michael: Sprite = {
  width: 16, height: 22,
  frames: {
    idle:    [idle0, idle1],
    working: [working0, working1],
    walking: [walk0, walk1, idle0, walk0],
    waiting: [idle0],
    done:    [idle0],
  },
}
```

- [ ] **Step 2: Run — TypeScript validates the export**

```
npm test -w client -- --run
```

Expected: PASS (no TS errors, existing tests pass)

- [ ] **Step 3: Commit**

```bash
git add client/src/office/sprites/michael.ts
git commit -m "feat(office): add Michael Scott sprite"
```

---

### Task 6: Dwight, Jim, Pam sprites

**Files:**
- Create: `client/src/office/sprites/dwight.ts`
- Create: `client/src/office/sprites/jim.ts`
- Create: `client/src/office/sprites/pam.ts`

- [ ] **Step 1: Create `client/src/office/sprites/dwight.ts`**

Dwight: bowl-cut brown hair, wire-frame glasses, mustard yellow shirt.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#c8a060'  // skin (slightly more olive)
const K = '#7a5820'  // brown bowl-cut hair
const G = '#aaaaaa'  // wire glasses frames
const S = '#8a8a1e'  // mustard yellow shirt
const B = '#3a3a1a'  // dark belt
const P = '#2a2a2a'  // dark trousers
const E = '#222222'  // eyes
const SH = '#1a1a1a' // shoes

const idle0: PixelRow[] = [
  [_,_,K,K,K,K,K,K,K,K,K,K,K,_,_,_],
  [_,K,K,H,H,H,H,H,H,H,H,H,K,K,_,_],
  [_,K,H,H,H,H,H,H,H,H,H,H,H,K,_,_],
  [_,_,G,G,H,H,H,H,H,H,G,G,_,_,_,_],
  [_,_,G,E,H,H,H,H,H,H,E,G,_,_,_,_],
  [_,_,G,G,H,H,H,H,H,H,G,G,_,_,_,_],
  [_,_,_,H,H,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,S,H,S,S,S,S,S,S,H,S,S,_,_,_],
  [_,_,S,H,S,S,S,S,S,S,H,S,S,_,_,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,B,B,B,B,B,B,B,B,B,B,B,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,_,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,_,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,_,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,P,_,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,P,_,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,SH,_,_,_,_,_],
]

export const dwight = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 2: Create `client/src/office/sprites/jim.ts`**

Jim: shaggy brown hair, blue-grey shirt, brown tie, relaxed posture.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#c8a882'  // skin
const K = '#4a3010'  // dark brown shaggy hair
const S = '#9090c0'  // blue-grey shirt
const T = '#7a3a10'  // brown tie
const P = '#2a2a3a'  // dark trousers
const E = '#222222'  // eyes
const SH = '#1a1a1a' // shoes

const idle0: PixelRow[] = [
  [_,_,_,_,K,K,K,K,K,_,_,_,_,_,_,_],
  [_,_,_,K,K,H,H,H,H,H,K,_,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,K,K,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,_,_,H,E,_,H,_,E,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,_,_,_,_,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,S,S,T,T,T,T,S,S,S,_,_,_],
  [_,_,_,S,H,S,T,T,T,T,S,H,S,_,_,_],
  [_,_,_,S,H,S,T,T,T,T,S,H,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const jim = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 3: Create `client/src/office/sprites/pam.ts`**

Pam: auburn hair in a bun, pink/cream blouse.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#d4a882'  // skin (slightly lighter)
const K = '#8a3820'  // auburn hair
const B = '#5a2810'  // hair bun dark
const S = '#e8a0b8'  // pink blouse
const P = '#2a2a4a'  // dark trousers
const E = '#222222'  // eyes
const SH = '#1a1a1a' // shoes

const idle0: PixelRow[] = [
  [_,_,_,_,_,K,K,K,K,B,B,_,_,_,_,_],  // bun at top-right
  [_,_,_,_,K,H,H,H,H,H,K,B,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,_,H,E,_,H,_,E,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,K,K,H,H,H,K,K,_,_,_,_,_],  // hair framing neck
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,S,H,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,S,H,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const pam = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 4: Run — expect PASS**

```
npm test -w client -- --run
```

- [ ] **Step 5: Commit**

```bash
git add client/src/office/sprites/dwight.ts client/src/office/sprites/jim.ts client/src/office/sprites/pam.ts
git commit -m "feat(office): add Dwight, Jim, Pam sprites"
```

---

### Task 7: Angela, Kevin, Oscar, Meredith sprites

**Files:**
- Create: `client/src/office/sprites/angela.ts`
- Create: `client/src/office/sprites/kevin.ts`
- Create: `client/src/office/sprites/oscar.ts`
- Create: `client/src/office/sprites/meredith.ts`

- [ ] **Step 1: Create `client/src/office/sprites/angela.ts`**

Angela: tight blonde updo, dark navy blouse, severe/neat look.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#d0a880'  // skin
const K = '#d4c060'  // blonde hair
const U = '#b8a840'  // updo dark shade
const S = '#1a1a3a'  // very dark navy blouse
const P = '#1a1a2a'  // dark trousers
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,_,_,_,U,U,U,U,U,_,_,_,_,_,_],  // tight updo
  [_,_,_,_,K,K,K,K,K,K,K,_,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,K,_,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,K,_,_,_,_,_],
  [_,_,_,_,_,H,E,H,H,E,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,_,_,_,_,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,H,S,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,H,S,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const angela = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 2: Create `client/src/office/sprites/kevin.ts`**

Kevin: wider/rounder head, short dark hair, green shirt.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#c09070'  // skin (darker)
const K = '#1a1a1a'  // dark hair
const S = '#3a6a3a'  // green shirt
const P = '#2a2a2a'
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,_,_,K,K,K,K,K,K,K,_,_,_,_,_],  // wider head silhouette
  [_,_,_,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,_,K,H,E,_,H,_,E,H,K,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],  // wider body
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,H,S,S,S,S,S,S,S,H,S,S,_,_],
  [_,_,S,H,S,S,S,S,S,S,S,H,S,S,_,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const kevin = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 3: Create `client/src/office/sprites/oscar.ts`**

Oscar: neat short dark hair, light blue dress shirt.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#b89070'  // skin
const K = '#1a1a10'  // very dark hair
const S = '#6080c0'  // light blue shirt
const P = '#1a2a3a'
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,_,_,_,K,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,K,_,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,_,H,E,_,H,_,E,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,_,_,_,_,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,S,H,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,S,H,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const oscar = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 4: Create `client/src/office/sprites/meredith.ts`**

Meredith: messy red hair, flannel plaid shirt.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#c09070'
const K = '#c03820'  // messy red hair
const k = '#8a2810'  // hair dark
const S = '#7a3a2a'  // flannel red-brown
const F = '#5a2a1a'  // flannel stripe
const P = '#2a2a1a'
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,K,K,k,K,K,K,k,K,K,_,_,_,_,_],  // messy hair top
  [_,K,K,H,H,H,H,H,H,H,H,K,k,_,_,_],
  [_,k,H,H,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,K,H,H,H,H,H,H,H,H,H,H,k,_,_,_],
  [_,_,K,H,E,_,H,H,_,E,H,K,_,_,_,_],
  [_,_,_,H,H,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,K,K,H,H,H,H,H,K,K,_,_,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,F,S,F,S,F,S,F,S,F,S,F,_,_,_],  // plaid stripes
  [_,_,S,H,S,S,S,S,S,S,S,H,S,_,_,_],
  [_,_,F,H,F,S,F,S,F,S,F,H,F,_,_,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,S,F,S,F,S,F,S,F,S,F,S,F,S,_,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const meredith = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 5: Run — expect PASS**

```
npm test -w client -- --run
```

- [ ] **Step 6: Commit**

```bash
git add client/src/office/sprites/angela.ts client/src/office/sprites/kevin.ts client/src/office/sprites/oscar.ts client/src/office/sprites/meredith.ts
git commit -m "feat(office): add Angela, Kevin, Oscar, Meredith sprites"
```

---

### Task 8: Creed, Stanley, Phyllis, Kelly, Ryan, Toby sprites

**Files:**
- Create: `client/src/office/sprites/creed.ts`
- Create: `client/src/office/sprites/stanley.ts`
- Create: `client/src/office/sprites/phyllis.ts`
- Create: `client/src/office/sprites/kelly.ts`
- Create: `client/src/office/sprites/ryan.ts`
- Create: `client/src/office/sprites/toby.ts`

- [ ] **Step 1: Create `client/src/office/sprites/creed.ts`**

Creed: grey-white hair, flannel shirt, older.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#b88060'
const K = '#909090'  // grey hair
const k = '#c0c0c0'  // grey highlight
const S = '#5a4a3a'  // dark flannel
const F = '#3a2a1a'
const P = '#2a1a1a'
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,_,k,K,K,K,K,K,K,k,_,_,_,_,_],
  [_,_,k,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,_,H,E,_,H,H,_,E,H,_,_,_,_,_],
  [_,_,_,H,H,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,_,_,_,_,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,F,S,F,S,F,S,F,S,F,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,H,S,S,_,_,_],
  [_,_,_,F,H,F,S,F,S,F,H,F,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,F,S,F,S,F,S,F,S,F,S,F,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const creed = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 2: Create `client/src/office/sprites/stanley.ts`**

Stanley: grey temples, dark center hair, moustache, patterned loud shirt.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#a07050'  // darker skin
const K = '#1a1a1a'  // dark center hair
const G = '#808080'  // grey temples
const M = '#4a3020'  // moustache
const S = '#8a5a2a'  // loud patterned shirt (orange-brown)
const F = '#6a3a10'  // shirt pattern stripe
const P = '#1a1a1a'
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,G,G,K,K,K,K,K,K,G,G,_,_,_,_],  // grey temples
  [_,_,G,H,H,H,H,H,H,H,H,G,_,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,_,H,E,_,H,H,_,E,H,_,_,_,_,_],
  [_,_,_,H,H,M,M,M,M,H,H,_,_,_,_,_],  // moustache
  [_,_,_,_,H,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,_,_,_,_,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,F,S,F,S,F,S,F,S,F,S,F,S,_,_],
  [_,_,S,H,S,S,S,S,S,S,S,H,S,S,_,_],
  [_,_,F,H,F,S,F,S,F,S,F,H,F,S,_,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_],
  [_,S,F,S,F,S,F,S,F,S,F,S,F,S,F,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const stanley = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 3: Create `client/src/office/sprites/phyllis.ts`**

Phyllis: grey-brown bob, pink floral blouse, heavier build.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#c8a070'
const K = '#7a6a5a'  // grey-brown bob
const S = '#e880a0'  // pink blouse
const P = '#2a1a2a'
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,_,K,K,K,K,K,K,K,K,K,_,_,_,_],  // bob top
  [_,_,K,K,H,H,H,H,H,H,H,K,K,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,H,K,_,_,_],
  [_,_,_,K,H,E,_,H,_,E,H,K,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,K,_,_,_,_,_],  // bob at sides
  [_,_,_,K,K,H,H,H,K,K,_,_,_,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],  // wider body
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,H,S,S,S,S,S,S,S,H,S,S,_,_],
  [_,_,S,H,S,S,S,S,S,S,S,H,S,S,_,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_],
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const phyllis = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 4: Create `client/src/office/sprites/kelly.ts`**

Kelly: long straight dark hair down past shoulders, bright pink top.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#b88060'
const K = '#1a1010'  // very dark brown-black hair
const S = '#e830a0'  // hot pink top
const P = '#1a1a2a'
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,_,K,K,K,K,K,K,K,_,_,_,_,_,_],
  [_,_,K,K,H,H,H,H,H,H,K,K,_,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,K,H,E,_,H,H,_,E,H,K,_,_,_,_],
  [_,_,K,H,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,K,K,H,H,H,H,H,H,K,K,_,_,_,_],
  [_,_,K,K,K,H,H,H,K,K,K,_,_,_,_,_],  // hair hanging long
  [_,K,K,S,S,S,S,S,S,S,S,S,S,K,K,_],  // hair falls past shoulders
  [_,K,K,S,S,S,S,S,S,S,S,S,S,K,K,_],
  [_,K,K,S,H,S,S,S,S,S,H,S,S,K,K,_],
  [_,K,_,S,H,S,S,S,S,S,H,S,S,_,K,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const kelly = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 5: Create `client/src/office/sprites/ryan.ts`**

Ryan: dark hair, casual hoodie, younger look.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#c8a070'
const K = '#2a1a10'  // dark brown hair
const S = '#4a4a6a'  // grey-blue hoodie
const P = '#1a1a2a'
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,_,_,_,K,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,K,_,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,_,_,H,E,_,H,_,E,H,_,_,_,_],
  [_,_,_,_,_,H,H,H,H,H,H,H,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],  // hoodie
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,S,H,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,S,H,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const ryan = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 6: Create `client/src/office/sprites/toby.ts`**

Toby: mousy brown hair, muted grey-blue shirt, slight slump.

```typescript
import type { PixelRow } from './types'
import { buildSprite } from './build'

const _ = null
const H = '#c0a070'
const K = '#5a4a3a'  // mousy brown hair
const S = '#5a6a7a'  // muted grey-blue shirt
const P = '#2a2a2a'
const E = '#222222'
const SH = '#111111'

const idle0: PixelRow[] = [
  [_,_,_,_,_,K,K,K,K,K,_,_,_,_,_,_],
  [_,_,_,_,K,H,H,H,H,H,K,_,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,K,H,H,H,H,H,H,H,K,_,_,_,_],
  [_,_,_,_,H,E,_,H,_,E,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,_,_,_,_,_],  // slightly downcast expression
  [_,_,_,_,_,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,_,_,H,H,H,_,_,_,_,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,S,H,S,_,_,_],
  [_,_,_,S,H,S,S,S,S,S,S,H,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,P,P,P,P,P,P,P,P,P,P,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,P,_,_,_,_,_,_,P,_,_,_,_],
  [_,_,_,_,SH,_,_,_,_,_,_,SH,_,_,_,_],
]

export const toby = buildSprite(idle0, { skin: H, shirt: S, trouser: P, shoe: SH })
```

- [ ] **Step 7: Run — expect PASS**

```
npm test -w client -- --run
```

- [ ] **Step 8: Commit**

```bash
git add client/src/office/sprites/creed.ts client/src/office/sprites/stanley.ts client/src/office/sprites/phyllis.ts client/src/office/sprites/kelly.ts client/src/office/sprites/ryan.ts client/src/office/sprites/toby.ts
git commit -m "feat(office): add remaining 6 character sprites"
```

---

### Task 9: sprites/index.ts — CAST array

**Files:**
- Create: `client/src/office/sprites/index.ts`
- Create: `client/src/office/sprites/index.test.ts`

- [ ] **Step 1: Write failing test — `client/src/office/sprites/index.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { CAST, getSpriteForAgent } from './index'

describe('CAST', () => {
  it('has exactly 14 sprites', () => {
    expect(CAST).toHaveLength(14)
  })

  it('getSpriteForAgent cycles through cast', () => {
    expect(getSpriteForAgent(0)).toBe(CAST[0])
    expect(getSpriteForAgent(13)).toBe(CAST[13])
    expect(getSpriteForAgent(14)).toBe(CAST[0])  // cycles
    expect(getSpriteForAgent(15)).toBe(CAST[1])
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```
npm test -w client -- --run
```

- [ ] **Step 3: Create `client/src/office/sprites/index.ts`**

```typescript
export { drawSprite } from './draw'
export { buildSprite } from './build'
export type { Sprite, PixelRow, CharacterColors } from './types'

import { michael } from './michael'
import { dwight } from './dwight'
import { jim } from './jim'
import { pam } from './pam'
import { angela } from './angela'
import { kevin } from './kevin'
import { oscar } from './oscar'
import { meredith } from './meredith'
import { creed } from './creed'
import { stanley } from './stanley'
import { phyllis } from './phyllis'
import { kelly } from './kelly'
import { ryan } from './ryan'
import { toby } from './toby'
import type { Sprite } from './types'

export const CAST: Sprite[] = [
  michael, dwight, jim, pam, angela, kevin, oscar,
  meredith, creed, stanley, phyllis, kelly, ryan, toby,
]

export function getSpriteForAgent(agentIndex: number): Sprite {
  return CAST[agentIndex % CAST.length]
}
```

- [ ] **Step 4: Run — expect all tests PASS**

```
npm test -w client -- --run
```

- [ ] **Step 5: Commit**

```bash
git add client/src/office/sprites/index.ts client/src/office/sprites/index.test.ts
git commit -m "feat(office): add CAST array and getSpriteForAgent()"
```

---

### Task 10: OfficeView — component shell + HTML/CSS floor

**Files:**
- Create: `client/src/components/OfficeView.tsx`

- [ ] **Step 1: Create `client/src/components/OfficeView.tsx`** (shell — no animation yet)

```tsx
import { useEffect, useRef, useState } from 'react'
import type { AgentState, DashboardState } from '../types'
import { ROOMS, CANONICAL_WORKSPACES, getWorkspace } from '../office/floorplan'
import type { Room } from '../office/floorplan'

const SCALE = 3  // game-pixels → CSS pixels

interface Props {
  state: DashboardState
  onSelectAgent: (sessionId: string | null) => void
}

// Tile pattern colors per room
const TILE_COLORS: Record<string, [string, string]> = {
  'michaels-office': ['#2d2010', '#251a0c'],  // wood: two plank shades
  'conference-room': ['#22253a', '#1e2236'],  // carpet: checkerboard
  'break-room':      ['#1a1a1a', '#1a1a1a'],  // plain
  'reception':       ['#22253a', '#1e2236'],  // carpet
  'bullpen':         ['#22253a', '#20223a'],  // carpet slightly lighter
  'annex':           ['#181818', '#181818'],  // plain dimmer
  'extension':       ['#141414', '#141414'],  // dimmest
}

function RoomBox({ room }: { room: Room }) {
  const [a, b] = TILE_COLORS[room.id] ?? ['#1a1a1a', '#1a1a1a']
  return (
    <div
      style={{
        position: 'absolute',
        left: room.x * SCALE,
        top: room.y * SCALE,
        width: room.w * SCALE,
        height: room.h * SCALE,
        border: '2px solid #30363d',
        boxSizing: 'border-box',
        backgroundImage: `repeating-conic-gradient(${a} 0% 25%, ${b} 0% 50%)`,
        backgroundSize: `${SCALE * 4}px ${SCALE * 4}px`,
      }}
    >
      {room.label && (
        <span style={{
          position: 'absolute', top: 2, left: 4,
          fontSize: 8, color: '#4a5568', letterSpacing: 1,
          fontFamily: 'monospace', textTransform: 'uppercase',
          userSelect: 'none',
        }}>
          {room.label}
        </span>
      )}
    </div>
  )
}

function DeskMark({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <>
      {/* desk surface */}
      <div style={{
        position: 'absolute',
        left: (x - 11) * SCALE,
        top: y * SCALE,
        width: 22 * SCALE,
        height: 5 * SCALE,
        background: '#5c4a1e',
        borderTop: `${SCALE}px solid #8a6f2e`,
      }} />
      {/* monitor */}
      <div style={{
        position: 'absolute',
        left: (x - 7) * SCALE,
        top: (y - 6) * SCALE,
        width: 14 * SCALE,
        height: 6 * SCALE,
        background: '#1e3a5f',
        borderTop: `${SCALE}px solid #3d7ab8`,
      }} />
      {/* label */}
      <div style={{
        position: 'absolute',
        left: (x - 11) * SCALE,
        top: (y + 6) * SCALE,
        width: 22 * SCALE,
        textAlign: 'center',
        fontSize: 7,
        color: '#4a5568',
        fontFamily: 'monospace',
        userSelect: 'none',
      }}>
        {label}
      </div>
    </>
  )
}

export function OfficeView({ state, onSelectAgent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Total canvas height grows with agent count
  const agentCount = state.agents.size
  const extensionRows = Math.max(0, Math.ceil((agentCount - CANONICAL_WORKSPACES.length) / 4))
  const canvasH = 240 + extensionRows * 48 + 20  // base + extension + padding
  const canvasW = 220

  return (
    <div style={{ position: 'relative', width: canvasW * SCALE, minHeight: canvasH * SCALE, margin: '0 auto', overflowY: 'auto' }}>
      {/* HTML/CSS floor layer */}
      {ROOMS.map(r => <RoomBox key={r.id} room={r} />)}

      {/* Desks */}
      {CANONICAL_WORKSPACES.map(ws => (
        <DeskMark key={ws.id} x={ws.x} y={ws.y} label={ws.label} />
      ))}

      {/* Extension desks */}
      {Array.from({ length: Math.max(0, agentCount - CANONICAL_WORKSPACES.length) }, (_, i) => {
        const ws = getWorkspace(CANONICAL_WORKSPACES.length + i)
        return <DeskMark key={ws.id} x={ws.x} y={ws.y} label={ws.label} />
      })}

      {/* Canvas overlay — characters drawn here */}
      <canvas
        ref={canvasRef}
        width={canvasW * SCALE}
        height={canvasH * SCALE}
        style={{ position: 'absolute', top: 0, left: 0, cursor: 'pointer', imageRendering: 'pixelated' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const gx = (e.clientX - rect.left) / SCALE
          const gy = (e.clientY - rect.top) / SCALE
          // click handling added in Task 11
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run — expect PASS (no TS errors)**

```
npm test -w client -- --run
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/OfficeView.tsx
git commit -m "feat(office): add OfficeView shell with HTML/CSS floor layout"
```

---

### Task 11: OfficeView — animation loop

Add the `requestAnimationFrame` loop, `SpriteState`, sync, move, and draw to `OfficeView.tsx`.

**Files:**
- Modify: `client/src/components/OfficeView.tsx`

- [ ] **Step 1: Add SpriteState type and animation logic**

Replace the entire file with this complete version:

```tsx
import { useEffect, useRef } from 'react'
import type { DashboardState } from '../types'
import { ROOMS, CANONICAL_WORKSPACES, getWorkspace } from '../office/floorplan'
import type { Room } from '../office/floorplan'
import { drawSprite, getSpriteForAgent } from '../office/sprites/index'
import type { PixelRow } from '../office/sprites/index'

const SCALE = 3
const WALK_SPEED = 1.5  // game-px per frame
const ENTRANCE_X = 220  // agents enter from right edge
const ENTRANCE_Y = 2

interface SpriteState {
  sessionId: string
  agentIndex: number
  x: number; y: number
  tx: number; ty: number
  walking: boolean
  frame: number
  opacity: number
}

const STATUS_DOT_COLOR: Record<string, string> = {
  starting: '#58a6ff',
  idle:     '#3fb950',
  working:  '#d29922',
  waiting:  '#bc8cff',
  done:     '#6e7681',
  error:    '#f85149',
}

// Tile pattern colors per room
const TILE_COLORS: Record<string, [string, string]> = {
  'michaels-office': ['#2d2010', '#251a0c'],
  'conference-room': ['#22253a', '#1e2236'],
  'break-room':      ['#1a1a1a', '#1a1a1a'],
  'reception':       ['#22253a', '#1e2236'],
  'bullpen':         ['#22253a', '#20223a'],
  'annex':           ['#181818', '#181818'],
  'extension':       ['#141414', '#141414'],
}

function RoomBox({ room }: { room: Room }) {
  const [a, b] = TILE_COLORS[room.id] ?? ['#1a1a1a', '#1a1a1a']
  return (
    <div style={{
      position: 'absolute',
      left: room.x * SCALE, top: room.y * SCALE,
      width: room.w * SCALE, height: room.h * SCALE,
      border: '2px solid #30363d', boxSizing: 'border-box',
      backgroundImage: `repeating-conic-gradient(${a} 0% 25%, ${b} 0% 50%)`,
      backgroundSize: `${SCALE * 4}px ${SCALE * 4}px`,
    }}>
      {room.label && (
        <span style={{
          position: 'absolute', top: 2, left: 4,
          fontSize: 8, color: '#4a5568', letterSpacing: 1,
          fontFamily: 'monospace', textTransform: 'uppercase', userSelect: 'none',
        }}>
          {room.label}
        </span>
      )}
    </div>
  )
}

function DeskMark({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <>
      <div style={{
        position: 'absolute',
        left: (x - 11) * SCALE, top: y * SCALE,
        width: 22 * SCALE, height: 5 * SCALE,
        background: '#5c4a1e', borderTop: `${SCALE}px solid #8a6f2e`,
      }} />
      <div style={{
        position: 'absolute',
        left: (x - 7) * SCALE, top: (y - 6) * SCALE,
        width: 14 * SCALE, height: 6 * SCALE,
        background: '#1e3a5f', borderTop: `${SCALE}px solid #3d7ab8`,
      }} />
      <div style={{
        position: 'absolute',
        left: (x - 11) * SCALE, top: (y + 6) * SCALE,
        width: 22 * SCALE, textAlign: 'center',
        fontSize: 7, color: '#4a5568', fontFamily: 'monospace', userSelect: 'none',
      }}>
        {label}
      </div>
    </>
  )
}

interface Props {
  state: DashboardState
  onSelectAgent: (sessionId: string | null) => void
}

export function OfficeView({ state, onSelectAgent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const spriteStatesRef = useRef<Map<string, SpriteState>>(new Map())
  const agentOrderRef = useRef<string[]>([])  // tracks insertion order for index assignment

  const agentCount = state.agents.size
  const extensionRows = Math.max(0, Math.ceil((agentCount - CANONICAL_WORKSPACES.length) / 4))
  const canvasH = 240 + extensionRows * 48 + 20
  const canvasW = 220

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let rafId: number

    function getAgentIndex(sessionId: string): number {
      if (!agentOrderRef.current.includes(sessionId)) {
        agentOrderRef.current.push(sessionId)
      }
      return agentOrderRef.current.indexOf(sessionId)
    }

    function sync() {
      const agents = stateRef.current.agents
      const sprites = spriteStatesRef.current

      // Add new agents
      agents.forEach((agent, sessionId) => {
        if (!sprites.has(sessionId)) {
          const idx = getAgentIndex(sessionId)
          const ws = getWorkspace(idx)
          sprites.set(sessionId, {
            sessionId, agentIndex: idx,
            x: ENTRANCE_X, y: ENTRANCE_Y,
            tx: ws.x - 8, ty: ws.y - 14,  // stand in front of desk
            walking: true, frame: 0, opacity: 1,
          })
        }
      })

      // Begin fade for removed agents
      sprites.forEach((ss, sessionId) => {
        if (!agents.has(sessionId) && ss.opacity > 0) {
          ss.tx = ss.x
          ss.ty = ss.y
          ss.walking = false
        }
      })
    }

    function move() {
      spriteStatesRef.current.forEach((ss, sessionId) => {
        ss.frame++
        if (!stateRef.current.agents.has(sessionId)) {
          ss.opacity = Math.max(0, ss.opacity - 0.02)
          return
        }
        if (ss.walking) {
          const dx = ss.tx - ss.x
          const dy = ss.ty - ss.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < WALK_SPEED) {
            ss.x = ss.tx; ss.y = ss.ty; ss.walking = false
          } else {
            ss.x += (dx / dist) * WALK_SPEED
            ss.y += (dy / dist) * WALK_SPEED
          }
        }
      })
      // Remove fully faded
      spriteStatesRef.current.forEach((ss, sessionId) => {
        if (ss.opacity <= 0) spriteStatesRef.current.delete(sessionId)
      })
    }

    function getFramePixels(ss: SpriteState): PixelRow[] {
      const agent = stateRef.current.agents.get(ss.sessionId)
      const sprite = getSpriteForAgent(ss.agentIndex)
      const status = agent?.status ?? 'done'
      const tick = Math.floor(ss.frame / 12)

      if (ss.walking) return sprite.frames.walking[tick % 4]
      switch (status) {
        case 'working': return sprite.frames.working[tick % 2]
        case 'waiting': return sprite.frames.waiting[0]
        case 'done':    return sprite.frames.done[0]
        default:        return sprite.frames.idle[tick % 2]
      }
    }

    function drawNameTag(ctx: CanvasRenderingContext2D, ss: SpriteState) {
      const agent = stateRef.current.agents.get(ss.sessionId)
      if (!agent) return
      const label = ss.sessionId.slice(0, 8)
      ctx.globalAlpha = ss.opacity
      ctx.fillStyle = '#6e7681'
      ctx.font = `${SCALE * 2}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(label, ss.x * SCALE, (ss.y - 18) * SCALE)
      ctx.globalAlpha = 1
    }

    function drawStatusDot(ctx: CanvasRenderingContext2D, ss: SpriteState) {
      const agent = stateRef.current.agents.get(ss.sessionId)
      const color = STATUS_DOT_COLOR[agent?.status ?? 'done'] ?? '#6e7681'
      ctx.globalAlpha = ss.opacity
      ctx.fillStyle = color
      const r = SCALE * 2
      ctx.beginPath()
      ctx.arc((ss.x + 8) * SCALE, (ss.y - 2) * SCALE, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    function drawFrame() {
      sync()
      move()

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      spriteStatesRef.current.forEach(ss => {
        const pixels = getFramePixels(ss)
        // error: red tint overlay
        const agent = stateRef.current.agents.get(ss.sessionId)
        if (agent?.status === 'error') {
          drawSprite(ctx, pixels, ss.x, ss.y, SCALE, ss.opacity * 0.7)
          ctx.fillStyle = 'rgba(248, 81, 73, 0.3)'
          ctx.fillRect((ss.x) * SCALE, (ss.y) * SCALE, 16 * SCALE, 22 * SCALE)
        } else {
          drawSprite(ctx, pixels, ss.x, ss.y, SCALE, ss.opacity)
        }
        drawStatusDot(ctx, ss)
        drawNameTag(ctx, ss)
      })

      rafId = requestAnimationFrame(drawFrame)
    }

    // On mount: seat already-known agents without walking in
    stateRef.current.agents.forEach((_, sessionId) => {
      const idx = getAgentIndex(sessionId)
      const ws = getWorkspace(idx)
      spriteStatesRef.current.set(sessionId, {
        sessionId, agentIndex: idx,
        x: ws.x - 8, y: ws.y - 14,
        tx: ws.x - 8, ty: ws.y - 14,
        walking: false, frame: 0, opacity: 1,
      })
    })

    rafId = requestAnimationFrame(drawFrame)
    return () => cancelAnimationFrame(rafId)
  }, [])  // run once on mount; stateRef keeps it fresh

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const gx = (e.clientX - rect.left) / SCALE
    const gy = (e.clientY - rect.top) / SCALE
    let hit: string | null = null
    spriteStatesRef.current.forEach(ss => {
      if (gx >= ss.x && gx <= ss.x + 16 && gy >= ss.y && gy <= ss.y + 22) {
        hit = ss.sessionId
      }
    })
    onSelectAgent(hit)
  }

  return (
    <div style={{ position: 'relative', width: canvasW * SCALE, minHeight: canvasH * SCALE, margin: '0 auto' }}>
      {ROOMS.map(r => <RoomBox key={r.id} room={r} />)}
      {CANONICAL_WORKSPACES.map(ws => <DeskMark key={ws.id} x={ws.x} y={ws.y} label={ws.label} />)}
      {Array.from({ length: Math.max(0, agentCount - CANONICAL_WORKSPACES.length) }, (_, i) => {
        const ws = getWorkspace(CANONICAL_WORKSPACES.length + i)
        return <DeskMark key={ws.id} x={ws.x} y={ws.y} label={ws.label} />
      })}
      <canvas
        ref={canvasRef}
        width={canvasW * SCALE}
        height={canvasH * SCALE}
        style={{ position: 'absolute', top: 0, left: 0, cursor: 'pointer', imageRendering: 'pixelated' }}
        onClick={handleClick}
      />
    </div>
  )
}
```

- [ ] **Step 2: Run — expect PASS**

```
npm test -w client -- --run
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/OfficeView.tsx
git commit -m "feat(office): add animation loop, sprite rendering, and click hit-testing"
```

---

### Task 12: App.tsx — toggle and keyboard shortcut

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Open `client/src/App.tsx` and locate the header JSX**

Find the header area where `ConnectionBadge` and the `Clear All` button are rendered.

- [ ] **Step 2: Add `viewMode` state and keyboard listener**

Add these two items near the top of the `App` component body (after existing `useState` calls):

```tsx
const [viewMode, setViewMode] = useState<'list' | 'office'>('list')

useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.key === 'o' || e.key === 'O') {
      if (document.activeElement?.tagName === 'INPUT') return
      setViewMode(v => v === 'list' ? 'office' : 'list')
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [])
```

- [ ] **Step 3: Add toggle button to header**

In the header JSX, add the toggle before `ConnectionBadge`:

```tsx
<div style={{ display: 'flex', gap: 4 }}>
  <button
    onClick={() => setViewMode('list')}
    style={{
      padding: '3px 10px', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer',
      background: viewMode === 'list' ? '#1f6feb' : '#21262d',
      color: viewMode === 'list' ? '#fff' : '#8b949e',
      border: '1px solid #30363d', borderRadius: '4px 0 0 4px',
    }}
  >
    ≡ List
  </button>
  <button
    onClick={() => setViewMode('office')}
    style={{
      padding: '3px 10px', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer',
      background: viewMode === 'office' ? '#1f6feb' : '#21262d',
      color: viewMode === 'office' ? '#fff' : '#8b949e',
      border: '1px solid #30363d', borderLeft: 'none', borderRadius: '0 4px 4px 0',
    }}
  >
    ⌂ Office
  </button>
</div>
```

- [ ] **Step 4: Wrap main content in the viewMode condition**

Find the main layout JSX (the part with `AgentTree`, `AgentDetail`, `EventStream`). Wrap it like this:

```tsx
{viewMode === 'list' ? (
  /* existing list layout — AgentTree, AgentDetail, EventStream — unchanged */
  <existing layout here>
) : (
  <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
    <OfficeView
      state={state}
      onSelectAgent={(id) => dispatch({ type: 'SELECT_AGENT', sessionId: id })}
    />
  </div>
)}
```

Add the import at the top of `App.tsx`:

```tsx
import { OfficeView } from './components/OfficeView'
```

- [ ] **Step 5: Run all tests**

```
npm test -w client -- --run
npm test -w server -- --run
```

Expected: all PASS

- [ ] **Step 6: Start dev server and manually verify**

```
npm run dev
```

Open `http://localhost:5173?mock=true`. Verify:
- `≡ List` and `⌂ Office` buttons appear in the header
- Pressing `O` toggles the view
- Office view shows the Dunder Mifflin floor plan
- Mock agents appear as animated characters sitting at desks
- Characters animate (bob, typing)
- Clicking a character opens the detail panel

- [ ] **Step 7: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(office): add list/office toggle and O keyboard shortcut"
```

---

### Task 13: Integration verification

- [ ] **Step 1: Run full test suite**

```
npm test -w client -- --run
npm test -w server -- --run
```

Expected: all existing tests PASS, no regressions

- [ ] **Step 2: Verify mock mode — office view**

Open `http://localhost:5173?mock=true`, switch to Office view. Confirm:
- [ ] Michael appears at desk 1 (top-left room)
- [ ] Dwight appears at desk 4 (bullpen)
- [ ] All characters are visually distinct (different hair/clothing)
- [ ] Working agents show fast typing animation
- [ ] Idle agents show slow bob
- [ ] Status dot color matches agent status
- [ ] Clicking a character selects them and opens the detail panel
- [ ] `O` key toggles back to list view without data loss

- [ ] **Step 3: Verify extension desks**

Temporarily add to `mock/generator.ts`: spawn 15+ agents. Verify extension row appears below annex with faint styling.

Revert after verification.

- [ ] **Step 4: Final commit if clean**

```bash
git add -A
git commit -m "feat(office): Phase 4A complete — pixel-art Dunder Mifflin office view"
```
