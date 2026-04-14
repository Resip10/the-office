# the-office Phase 1 (Observer) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time observer dashboard that shows all Claude Code agents across every project on your machine — live event stream, agent tree with parent/child hierarchy, agent detail panel, JSONL bootstrap on connect, and mock mode for development.

**Architecture:** Node.js Express server receives Claude Code HTTP hooks, stamps events with an ID + timestamp, maintains a ring buffer of 500 events, and broadcasts via WebSocket. React frontend (useReducer) maintains an agent state map derived from hook events. On WebSocket connect, server scans `~/.claude/projects/**/sessions/*.jsonl` (last 4 hours) and sends bootstrapped agent snapshots alongside the ring buffer.

**Tech Stack:** Node.js 20+, TypeScript 5, Express 4, ws 8, fast-glob 3, React 18, Vite 5, Tailwind CSS v3, Vitest (client), Jest + ts-jest (server), npm workspaces, concurrently

---

## File Map

```
the-office/
├── package.json                              # root: workspaces, dev script
├── .gitignore
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.cjs
│   └── src/
│       ├── types.ts                          # HookEvent, AgentSnapshot, WSMessage
│       ├── relay.ts                          # ring buffer + broadcast
│       ├── bootstrap.ts                      # JSONL scanner + parseJSONLSession
│       ├── index.ts                          # Express app + WebSocket server
│       └── __tests__/
│           ├── relay.test.ts
│           └── bootstrap.test.ts
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts                        # includes Vitest config
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── index.css
        ├── test-setup.ts                     # @testing-library/jest-dom import
        ├── types.ts                          # AgentState, DashboardState, Action, etc.
        ├── reducer.ts                        # dashboardReducer + initialState
        ├── App.tsx                           # 3-panel layout, useReducer, useRelay
        ├── hooks/
        │   └── useRelay.ts                   # WebSocket + reconnect + mock switch
        ├── mock/
        │   └── generator.ts                  # scripted scenario, 2 projects, 5 agents
        ├── components/
        │   ├── ConnectionBadge.tsx
        │   ├── AgentTree.tsx
        │   ├── ProjectGroup.tsx
        │   ├── AgentNode.tsx
        │   ├── AgentDetail.tsx
        │   ├── ToolHistory.tsx
        │   ├── EventStream.tsx
        │   └── EventRow.tsx
        └── __tests__/
            └── reducer.test.ts
```

---

## Task 1: Scaffold monorepo root

**Files:**
- Create: `package.json`

- [x] **Step 1: Create root package.json**

```json
{
  "name": "the-office",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently -n server,client -c cyan,magenta \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w server && npm run build -w client"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [x] **Step 2: Install root dependencies**

```bash
cd /path/to/the-office
npm install
```

Expected: `node_modules/concurrently` exists at root.

- [x] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add monorepo root with npm workspaces"
```

---

## Task 2: Scaffold server package

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/jest.config.cjs`, `server/src/index.ts` (stub)

- [x] **Step 1: Create `server/package.json`**

```json
{
  "name": "the-office-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "fast-glob": "^3.3.2",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.5",
    "@types/ws": "^8.5.10",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

- [x] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [x] **Step 3: Create `server/jest.config.cjs`**

```javascript
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
}
```

- [x] **Step 4: Create `server/src/index.ts` stub**

```typescript
console.log('the-office server starting...')
```

- [x] **Step 5: Install server dependencies**

```bash
npm install -w server
```

Expected: `server/node_modules` exists.

- [x] **Step 6: Verify server compiles**

```bash
cd server && npx tsx src/index.ts
```

Expected output: `the-office server starting...`

- [x] **Step 7: Commit**

```bash
git add server/
git commit -m "chore: scaffold server package"
```

---

## Task 3: Scaffold client package

**Files:**
- Create: `client/package.json`, `client/vite.config.ts`, `client/tailwind.config.js`, `client/postcss.config.js`, `client/index.html`, `client/src/main.tsx`, `client/src/index.css`

- [x] **Step 1: Create `client/package.json`**

```json
{
  "name": "the-office-client",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.2.0",
    "@testing-library/react": "^14.1.2",
    "@types/react": "^18.2.48",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "jsdom": "^24.0.0",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.12",
    "vitest": "^1.2.0"
  }
}
```

- [x] **Step 2: Create `client/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
```

- [x] **Step 3: Create `client/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0d1117',
        surface: '#161b22',
        border: '#30363d',
        'text-primary': '#f0f6fc',
        'text-muted': '#8b949e',
        'status-idle': '#3fb950',
        'status-working': '#d29922',
        'status-starting': '#58a6ff',
        'status-waiting': '#bc8cff',
        'status-done': '#6e7681',
        'status-error': '#f85149',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

- [x] **Step 4: Create `client/postcss.config.js`**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [x] **Step 5: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>the-office</title>
  </head>
  <body class="bg-canvas text-text-primary font-mono">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [x] **Step 6: Create `client/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
}
```

- [x] **Step 7: Create `client/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [x] **Step 8: Create `client/src/main.tsx` stub**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="flex items-center justify-center h-full text-text-muted">
      the-office loading...
    </div>
  </React.StrictMode>
)
```

- [x] **Step 9: Install client dependencies**

```bash
npm install -w client
```

- [x] **Step 10: Verify client dev server starts**

```bash
npm run dev -w client
```

Expected: Vite starts on `http://localhost:5173`. Open browser — shows "the-office loading..." on dark background.

- [x] **Step 11: Commit**

```bash
git add client/
git commit -m "chore: scaffold client package with Vite + React + Tailwind"
```

---

## Task 4: Define TypeScript types

**Files:**
- Create: `server/src/types.ts`, `client/src/types.ts`, `client/src/tsconfig.json`

- [x] **Step 1: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src"]
}
```

- [x] **Step 2: Create `server/src/types.ts`**

```typescript
export interface HookEvent {
  session_id: string
  hook_event_name: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_output?: Record<string, unknown>
  transcript_path?: string
  parent_session_id?: string
  cwd?: string
  _timestamp: number
  _id: string
}

export interface AgentSnapshot {
  sessionId: string
  agentName: string
  projectPath: string
  status: 'idle' | 'done'
  startedAt: number
  parentSessionId: string | null
}

export interface InitPayload {
  type: 'init'
  agents: AgentSnapshot[]
  recentEvents: HookEvent[]
}

export interface EventPayload {
  type: 'event'
  event: HookEvent
}

export type WSMessage = InitPayload | EventPayload
```

- [x] **Step 3: Create `client/src/types.ts`**

```typescript
export type AgentStatus = 'starting' | 'idle' | 'working' | 'waiting' | 'done' | 'error'

export interface ToolCall {
  id: string
  toolName: string
  input: unknown
  startedAt: number
  completedAt: number | null
  status: 'running' | 'success' | 'failure'
}

export interface AgentState {
  sessionId: string
  agentName: string
  status: AgentStatus
  parentSessionId: string | null
  currentTool: string | null
  currentToolInput: unknown | null
  toolHistory: ToolCall[]
  startedAt: number
  lastActivityAt: number
  projectPath: string
}

export interface AgentSnapshot {
  sessionId: string
  agentName: string
  projectPath: string
  status: 'idle' | 'done'
  startedAt: number
  parentSessionId: string | null
}

export interface HookEvent {
  session_id: string
  hook_event_name: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_output?: Record<string, unknown>
  transcript_path?: string
  parent_session_id?: string
  cwd?: string
  _timestamp: number
  _id: string
}

export interface DashboardState {
  agents: Map<string, AgentState>
  events: HookEvent[]
  selectedAgentId: string | null
  connected: boolean
}

export type Action =
  | { type: 'INIT'; agents: AgentSnapshot[]; recentEvents: HookEvent[] }
  | { type: 'EVENT'; event: HookEvent }
  | { type: 'SELECT_AGENT'; sessionId: string | null }
  | { type: 'CONNECTED'; connected: boolean }
  | { type: 'CLEAR' }
```

- [x] **Step 4: Verify both packages compile**

```bash
cd server && npx tsc --noEmit
cd ../client && npx tsc --noEmit
```

Expected: no errors.

- [x] **Step 5: Commit**

```bash
git add server/src/types.ts client/src/types.ts client/tsconfig.json
git commit -m "feat: define TypeScript types for server and client"
```

---

## Task 5: Implement relay ring buffer (TDD)

**Files:**
- Create: `server/src/relay.ts`, `server/src/__tests__/relay.test.ts`

- [x] **Step 1: Create `server/src/__tests__/relay.test.ts`**

```typescript
import { Relay } from '../relay'
import type { HookEvent } from '../types'

function makeEvent(id: string): HookEvent {
  return {
    session_id: 'test-session',
    hook_event_name: 'PreToolUse',
    tool_name: 'Read',
    _timestamp: Date.now(),
    _id: id,
  }
}

describe('Relay', () => {
  it('stores pushed events and returns them via getRecent', () => {
    const relay = new Relay()
    relay.push(makeEvent('1'))
    relay.push(makeEvent('2'))
    expect(relay.getRecent()).toHaveLength(2)
    expect(relay.getRecent()[0]._id).toBe('1')
  })

  it('caps the buffer at 500 events, dropping the oldest', () => {
    const relay = new Relay()
    for (let i = 0; i < 501; i++) relay.push(makeEvent(String(i)))
    expect(relay.getRecent()).toHaveLength(500)
    expect(relay.getRecent()[0]._id).toBe('1') // '0' was dropped
  })

  it('broadcasts pushed event to connected clients', () => {
    const relay = new Relay()
    const received: string[] = []
    const fakeWs = {
      readyState: 1, // WebSocket.OPEN
      send: (data: string) => received.push(data),
      on: (_evt: string, _cb: () => void) => {},
    } as never
    relay.addClient(fakeWs)
    relay.push(makeEvent('abc'))
    expect(received).toHaveLength(1)
    const msg = JSON.parse(received[0])
    expect(msg.type).toBe('event')
    expect(msg.event._id).toBe('abc')
  })

  it('does not broadcast to closed clients', () => {
    const relay = new Relay()
    const received: string[] = []
    const closedWs = {
      readyState: 3, // WebSocket.CLOSED
      send: (data: string) => received.push(data),
      on: (_evt: string, _cb: () => void) => {},
    } as never
    relay.addClient(closedWs)
    relay.push(makeEvent('xyz'))
    expect(received).toHaveLength(0)
  })
})
```

- [x] **Step 2: Run test — verify it fails**

```bash
cd server && npm test
```

Expected: FAIL — `Cannot find module '../relay'`

- [x] **Step 3: Create `server/src/relay.ts`**

```typescript
import type { WebSocket } from 'ws'
import type { HookEvent } from './types'

const BUFFER_SIZE = 500

export class Relay {
  private buffer: HookEvent[] = []
  private clients: Set<WebSocket> = new Set()

  push(event: HookEvent): void {
    this.buffer.push(event)
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.shift()
    }
    this.broadcast({ type: 'event', event })
  }

  getRecent(): HookEvent[] {
    return [...this.buffer]
  }

  addClient(ws: WebSocket): void {
    this.clients.add(ws)
    ws.on('close', () => this.clients.delete(ws))
  }

  private broadcast(msg: unknown): void {
    const data = JSON.stringify(msg)
    for (const client of this.clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(data)
      }
    }
  }
}
```

- [x] **Step 4: Run tests — verify they pass**

```bash
cd server && npm test
```

Expected: PASS — 4 tests pass.

- [x] **Step 5: Commit**

```bash
git add server/src/relay.ts server/src/__tests__/relay.test.ts
git commit -m "feat: implement relay ring buffer with tests"
```

---

## Task 6: Implement Express + WebSocket server

**Files:**
- Modify: `server/src/index.ts`

- [x] **Step 1: Replace `server/src/index.ts` stub with full implementation**

```typescript
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { Relay } from './relay'
import { bootstrap } from './bootstrap'
import type { HookEvent } from './types'

const PORT = 7777

const app = express()
const relay = new Relay()

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/events', (req, res) => {
  const raw = req.body as Record<string, unknown>
  const event: HookEvent = {
    ...(raw as Omit<HookEvent, '_timestamp' | '_id'>),
    _timestamp: Date.now(),
    _id: crypto.randomUUID(),
  }
  relay.push(event)
  res.sendStatus(200)
})

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', async (ws) => {
  const agents = await bootstrap()
  ws.send(JSON.stringify({
    type: 'init',
    agents,
    recentEvents: relay.getRecent(),
  }))
  relay.addClient(ws)
})

server.listen(PORT, () => {
  console.log(`the-office server running on http://localhost:${PORT}`)
})
```

Note: `bootstrap` is imported here. Create a stub now so the server starts. Task 8 replaces this stub with the real implementation.

- [x] **Step 2: Create `server/src/bootstrap.ts` stub** (will be replaced in Task 8)

```typescript
import type { AgentSnapshot } from './types'

export async function bootstrap(): Promise<AgentSnapshot[]> {
  return []
}
```

- [x] **Step 3: Start the server and verify it responds**

```bash
cd server && npm run dev
```

In a second terminal:
```bash
curl http://localhost:7777/health
```

Expected: `{"ok":true}`

- [x] **Step 4: Verify event endpoint accepts hook events**

```bash
curl -X POST http://localhost:7777/api/events \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test-123","hook_event_name":"PreToolUse","tool_name":"Read"}'
```

Expected: HTTP 200, no body.

- [x] **Step 5: Commit**

```bash
git add server/src/index.ts server/src/bootstrap.ts
git commit -m "feat: implement Express server with WebSocket relay"
```

---

## Task 7: Implement reducer (TDD)

**Files:**
- Create: `client/src/reducer.ts`, `client/src/__tests__/reducer.test.ts`

- [ ] **Step 1: Create `client/src/__tests__/reducer.test.ts`**

```typescript
import { dashboardReducer, initialState } from '../reducer'
import type { HookEvent, AgentSnapshot } from '../types'

function event(overrides: Partial<HookEvent> = {}): HookEvent {
  return {
    session_id: 'sess-001',
    hook_event_name: 'SessionStart',
    _timestamp: 1000,
    _id: 'evt-1',
    ...overrides,
  }
}

function snapshot(overrides: Partial<AgentSnapshot> = {}): AgentSnapshot {
  return {
    sessionId: 'sess-001',
    agentName: 'main',
    projectPath: '/home/user/project',
    status: 'idle',
    startedAt: 1000,
    parentSessionId: null,
    ...overrides,
  }
}

describe('dashboardReducer', () => {
  describe('CONNECTED', () => {
    it('sets connected flag', () => {
      const state = dashboardReducer(initialState, { type: 'CONNECTED', connected: true })
      expect(state.connected).toBe(true)
    })
  })

  describe('EVENT: SessionStart', () => {
    it('creates an idle agent', () => {
      const state = dashboardReducer(initialState, { type: 'EVENT', event: event({ hook_event_name: 'SessionStart' }) })
      expect(state.agents.get('sess-001')?.status).toBe('idle')
    })

    it('appends event to events array', () => {
      const state = dashboardReducer(initialState, { type: 'EVENT', event: event() })
      expect(state.events).toHaveLength(1)
    })
  })

  describe('EVENT: SubagentStart', () => {
    it('creates a starting agent with parentSessionId', () => {
      const state = dashboardReducer(initialState, {
        type: 'EVENT',
        event: event({ hook_event_name: 'SubagentStart', session_id: 'child-001', parent_session_id: 'sess-001' }),
      })
      const agent = state.agents.get('child-001')
      expect(agent?.status).toBe('starting')
      expect(agent?.parentSessionId).toBe('sess-001')
    })
  })

  describe('EVENT: PreToolUse', () => {
    it('sets status to working with currentTool and adds a running ToolCall', () => {
      let state = dashboardReducer(initialState, { type: 'EVENT', event: event({ hook_event_name: 'SessionStart' }) })
      state = dashboardReducer(state, {
        type: 'EVENT',
        event: event({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'src/app.ts' }, _id: 'evt-2', _timestamp: 2000 }),
      })
      const agent = state.agents.get('sess-001')!
      expect(agent.status).toBe('working')
      expect(agent.currentTool).toBe('Read')
      expect(agent.toolHistory).toHaveLength(1)
      expect(agent.toolHistory[0].status).toBe('running')
    })
  })

  describe('EVENT: PostToolUse', () => {
    it('sets status to idle, clears currentTool, completes ToolCall as success', () => {
      let state = dashboardReducer(initialState, { type: 'EVENT', event: event({ hook_event_name: 'SessionStart' }) })
      state = dashboardReducer(state, { type: 'EVENT', event: event({ hook_event_name: 'PreToolUse', tool_name: 'Read', _id: 'e2', _timestamp: 2000 }) })
      state = dashboardReducer(state, { type: 'EVENT', event: event({ hook_event_name: 'PostToolUse', tool_name: 'Read', _id: 'e3', _timestamp: 3000 }) })
      const agent = state.agents.get('sess-001')!
      expect(agent.status).toBe('idle')
      expect(agent.currentTool).toBeNull()
      expect(agent.toolHistory[0].status).toBe('success')
      expect(agent.toolHistory[0].completedAt).toBe(3000)
    })
  })

  describe('EVENT: PostToolUseFailure', () => {
    it('sets status to error and marks ToolCall as failure', () => {
      let state = dashboardReducer(initialState, { type: 'EVENT', event: event({ hook_event_name: 'SessionStart' }) })
      state = dashboardReducer(state, { type: 'EVENT', event: event({ hook_event_name: 'PreToolUse', tool_name: 'Bash', _id: 'e2', _timestamp: 2000 }) })
      state = dashboardReducer(state, { type: 'EVENT', event: event({ hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', _id: 'e3', _timestamp: 3000 }) })
      const agent = state.agents.get('sess-001')!
      expect(agent.status).toBe('error')
      expect(agent.toolHistory[0].status).toBe('failure')
    })
  })

  describe('EVENT: SessionEnd / SubagentStop', () => {
    it('sets status to done', () => {
      let state = dashboardReducer(initialState, { type: 'EVENT', event: event({ hook_event_name: 'SessionStart' }) })
      state = dashboardReducer(state, { type: 'EVENT', event: event({ hook_event_name: 'SessionEnd', _id: 'e2', _timestamp: 2000 }) })
      expect(state.agents.get('sess-001')?.status).toBe('done')
    })
  })

  describe('EVENT: Notification', () => {
    it('sets status to waiting', () => {
      let state = dashboardReducer(initialState, { type: 'EVENT', event: event({ hook_event_name: 'SessionStart' }) })
      state = dashboardReducer(state, { type: 'EVENT', event: event({ hook_event_name: 'Notification', _id: 'e2', _timestamp: 2000 }) })
      expect(state.agents.get('sess-001')?.status).toBe('waiting')
    })
  })

  describe('INIT', () => {
    it('seeds agents from snapshots', () => {
      const state = dashboardReducer(initialState, { type: 'INIT', agents: [snapshot()], recentEvents: [] })
      expect(state.agents.has('sess-001')).toBe(true)
      expect(state.agents.get('sess-001')?.agentName).toBe('main')
    })

    it('replays recentEvents on top of seeded agents', () => {
      const state = dashboardReducer(initialState, {
        type: 'INIT',
        agents: [snapshot()],
        recentEvents: [event({ hook_event_name: 'PreToolUse', tool_name: 'Read', _id: 'e2', _timestamp: 2000 })],
      })
      expect(state.agents.get('sess-001')?.status).toBe('working')
    })
  })

  describe('CLEAR', () => {
    it('resets agents and events, preserves connected', () => {
      let state = dashboardReducer(initialState, { type: 'CONNECTED', connected: true })
      state = dashboardReducer(state, { type: 'EVENT', event: event({ hook_event_name: 'SessionStart' }) })
      state = dashboardReducer(state, { type: 'CLEAR' })
      expect(state.agents.size).toBe(0)
      expect(state.events).toHaveLength(0)
      expect(state.connected).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd client && npm test
```

Expected: FAIL — `Cannot find module '../reducer'`

- [ ] **Step 3: Create `client/src/reducer.ts`**

```typescript
import type { DashboardState, Action, AgentState, AgentSnapshot, HookEvent, ToolCall } from './types'

export const initialState: DashboardState = {
  agents: new Map(),
  events: [],
  selectedAgentId: null,
  connected: false,
}

const MAX_EVENTS = 5000
const MAX_TOOL_HISTORY = 50

function snapshotToAgent(snap: AgentSnapshot): AgentState {
  return {
    sessionId: snap.sessionId,
    agentName: snap.agentName,
    status: snap.status === 'done' ? 'done' : 'idle',
    parentSessionId: snap.parentSessionId,
    currentTool: null,
    currentToolInput: null,
    toolHistory: [],
    startedAt: snap.startedAt,
    lastActivityAt: snap.startedAt,
    projectPath: snap.projectPath,
  }
}

function deriveProjectPath(event: HookEvent): string {
  if (event.cwd) return event.cwd
  if (!event.transcript_path) return ''
  // transcript_path: ~/.claude/projects/<encoded>/sessions/<file>.jsonl
  // Extract the part between the last 'projects/' and '/sessions/'
  const normalized = event.transcript_path.replace(/\\/g, '/')
  const projectsIdx = normalized.lastIndexOf('/projects/')
  const sessionsIdx = normalized.indexOf('/sessions/', projectsIdx)
  if (projectsIdx === -1 || sessionsIdx === -1) return event.transcript_path
  return normalized.slice(projectsIdx + '/projects/'.length, sessionsIdx)
}

function defaultAgent(event: HookEvent): AgentState {
  return {
    sessionId: event.session_id,
    agentName: event.session_id.slice(0, 8),
    status: 'idle',
    parentSessionId: event.parent_session_id ?? null,
    currentTool: null,
    currentToolInput: null,
    toolHistory: [],
    startedAt: event._timestamp,
    lastActivityAt: event._timestamp,
    projectPath: deriveProjectPath(event),
  }
}

function applyEvent(agents: Map<string, AgentState>, event: HookEvent): Map<string, AgentState> {
  const next = new Map(agents)
  const id = event.session_id
  const ts = event._timestamp
  const existing = next.get(id) ?? defaultAgent(event)

  switch (event.hook_event_name) {
    case 'SessionStart':
      next.set(id, {
        ...existing,
        status: 'idle',
        projectPath: deriveProjectPath(event) || existing.projectPath,
        lastActivityAt: ts,
      })
      break

    case 'SubagentStart':
      next.set(id, {
        ...existing,
        status: 'starting',
        parentSessionId: event.parent_session_id ?? existing.parentSessionId,
        projectPath: deriveProjectPath(event) || existing.projectPath,
        lastActivityAt: ts,
      })
      break

    case 'PreToolUse': {
      const toolCall: ToolCall = {
        id: `${id}-${ts}`,
        toolName: event.tool_name ?? 'unknown',
        input: event.tool_input ?? null,
        startedAt: ts,
        completedAt: null,
        status: 'running',
      }
      next.set(id, {
        ...existing,
        status: 'working',
        currentTool: event.tool_name ?? null,
        currentToolInput: event.tool_input ?? null,
        toolHistory: [...existing.toolHistory, toolCall].slice(-MAX_TOOL_HISTORY),
        lastActivityAt: ts,
      })
      break
    }

    case 'PostToolUse': {
      const history = existing.toolHistory.map(t =>
        t.status === 'running' ? { ...t, status: 'success' as const, completedAt: ts } : t
      )
      next.set(id, {
        ...existing,
        status: 'idle',
        currentTool: null,
        currentToolInput: null,
        toolHistory: history,
        lastActivityAt: ts,
      })
      break
    }

    case 'PostToolUseFailure': {
      const history = existing.toolHistory.map(t =>
        t.status === 'running' ? { ...t, status: 'failure' as const, completedAt: ts } : t
      )
      next.set(id, {
        ...existing,
        status: 'error',
        currentTool: null,
        currentToolInput: null,
        toolHistory: history,
        lastActivityAt: ts,
      })
      break
    }

    case 'Notification':
      next.set(id, { ...existing, status: 'waiting', lastActivityAt: ts })
      break

    case 'SubagentStop':
    case 'SessionEnd':
      next.set(id, { ...existing, status: 'done', lastActivityAt: ts })
      break

    case 'Stop':
      next.set(id, { ...existing, status: 'idle', lastActivityAt: ts })
      break
  }

  return next
}

export function dashboardReducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'INIT': {
      let agents = new Map<string, AgentState>()
      for (const snap of action.agents) {
        agents.set(snap.sessionId, snapshotToAgent(snap))
      }
      for (const ev of action.recentEvents) {
        agents = applyEvent(agents, ev)
      }
      const events = action.recentEvents.slice(-MAX_EVENTS)
      return { ...state, agents, events }
    }

    case 'EVENT': {
      const agents = applyEvent(state.agents, action.event)
      const events = [...state.events, action.event].slice(-MAX_EVENTS)
      return { ...state, agents, events }
    }

    case 'SELECT_AGENT':
      return { ...state, selectedAgentId: action.sessionId }

    case 'CONNECTED':
      return { ...state, connected: action.connected }

    case 'CLEAR':
      return { ...initialState, connected: state.connected }

    default:
      return state
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd client && npm test
```

Expected: PASS — all reducer tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/reducer.ts client/src/__tests__/reducer.test.ts
git commit -m "feat: implement dashboardReducer with full test coverage"
```

---

## Task 8: Implement bootstrap (TDD)

**Files:**
- Modify: `server/src/bootstrap.ts`
- Create: `server/src/__tests__/bootstrap.test.ts`

- [ ] **Step 1: Create `server/src/__tests__/bootstrap.test.ts`**

```typescript
import { parseJSONLSession } from '../bootstrap'

describe('parseJSONLSession', () => {
  it('parses a valid session with data.session_id and data.cwd', () => {
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init', data: { session_id: 'abc-123', cwd: '/home/user/project' } }),
      JSON.stringify({ type: 'assistant', message: {} }),
    ]
    const result = parseJSONLSession('/path/sessions/main-abc-123.jsonl', lines)
    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe('abc-123')
    expect(result!.projectPath).toBe('/home/user/project')
    expect(result!.status).toBe('idle')
  })

  it('derives agentName from filename prefix', () => {
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init', data: { session_id: 'xyz', cwd: '/p' } }),
    ]
    const result = parseJSONLSession('/sessions/code-reviewer-xyz.jsonl', lines)
    expect(result!.agentName).toBe('code-reviewer')
  })

  it('returns null when no session_id is found', () => {
    const lines = [JSON.stringify({ type: 'assistant', message: {} })]
    const result = parseJSONLSession('/path/sessions/unknown.jsonl', lines)
    expect(result).toBeNull()
  })

  it('marks session as done when result type is found', () => {
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init', data: { session_id: 'done-sess', cwd: '/proj' } }),
      JSON.stringify({ type: 'result', subtype: 'success' }),
    ]
    const result = parseJSONLSession('/sessions/main-done.jsonl', lines)
    expect(result!.status).toBe('done')
  })

  it('skips malformed lines without throwing', () => {
    const lines = [
      'NOT VALID JSON {{{',
      JSON.stringify({ type: 'system', subtype: 'init', data: { session_id: 'resilient', cwd: '/r' } }),
    ]
    const result = parseJSONLSession('/sessions/main-resilient.jsonl', lines)
    expect(result!.sessionId).toBe('resilient')
  })

  it('falls back to top-level session_id if data wrapper absent', () => {
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 'flat-id', cwd: '/flat' }),
    ]
    const result = parseJSONLSession('/sessions/main-flat.jsonl', lines)
    expect(result!.sessionId).toBe('flat-id')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd server && npm test
```

Expected: FAIL — `parseJSONLSession` is not exported.

- [ ] **Step 3: Replace `server/src/bootstrap.ts` stub with full implementation**

```typescript
import { readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import fg from 'fast-glob'
import type { AgentSnapshot } from './types'

const FOUR_HOURS = 4 * 60 * 60 * 1000

export async function bootstrap(): Promise<AgentSnapshot[]> {
  const claudeDir = join(homedir(), '.claude', 'projects')

  let files: string[]
  try {
    files = await fg('**/sessions/*.jsonl', { cwd: claudeDir, absolute: true })
  } catch {
    return []
  }

  const cutoff = Date.now() - FOUR_HOURS
  const snapshots: AgentSnapshot[] = []

  for (const file of files) {
    try {
      const info = await stat(file)
      if (info.mtimeMs < cutoff) continue
      const content = await readFile(file, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)
      const snapshot = parseJSONLSession(file, lines)
      if (snapshot) snapshots.push(snapshot)
    } catch {
      // unreadable or locked file — skip silently
    }
  }

  return snapshots
}

export function parseJSONLSession(filePath: string, lines: string[]): AgentSnapshot | null {
  let sessionId: string | null = null
  let projectPath = ''
  let startedAt = Date.now()
  let isDone = false
  let parentSessionId: string | null = null

  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>

      if (obj.type === 'system' && obj.subtype === 'init') {
        const data = (typeof obj.data === 'object' && obj.data !== null ? obj.data : obj) as Record<string, unknown>
        sessionId = (data.session_id as string | undefined) ?? null
        projectPath = (data.cwd as string | undefined) ?? ''
        if (typeof obj.timestamp === 'number') startedAt = obj.timestamp
      }

      if (typeof obj.parent_session_id === 'string') {
        parentSessionId = obj.parent_session_id
      }

      if (obj.type === 'result') {
        isDone = true
      }
    } catch {
      // malformed line — skip
    }
  }

  if (!sessionId) return null

  // Derive agent name from filename: "code-reviewer-abc123.jsonl" → "code-reviewer"
  const filename = (filePath.split(/[\\/]/).pop() ?? '').replace(/\.jsonl$/, '')
  const agentName = filename.replace(/-[a-f0-9]{8,}.*$/, '').replace(/-[0-9a-f-]{36}$/, '') || sessionId.slice(0, 8)

  return {
    sessionId,
    agentName,
    projectPath,
    status: isDone ? 'done' : 'idle',
    startedAt,
    parentSessionId,
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd server && npm test
```

Expected: PASS — all relay + bootstrap tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/bootstrap.ts server/src/__tests__/bootstrap.test.ts
git commit -m "feat: implement JSONL bootstrap with parseJSONLSession tests"
```

---

## Task 9: Implement mock generator

**Files:**
- Create: `client/src/mock/generator.ts`

- [ ] **Step 1: Create `client/src/mock/generator.ts`**

```typescript
import type { Dispatch } from 'react'
import type { Action, HookEvent, AgentSnapshot } from '../types'

const P1 = '/home/user/my-project'
const P2 = '/home/user/other-project'

const S_MAIN = 'mock-main-0001'
const S_REVIEWER = 'mock-reviewer-0002'
const S_EXPLORER = 'mock-explorer-0003'
const S_OTHER = 'mock-other-main-0004'
const S_WRITER = 'mock-writer-0005'

let _seq = 0
function makeEvent(session_id: string, hook_event_name: string, extras: Partial<HookEvent> = {}): HookEvent {
  return {
    session_id,
    hook_event_name,
    _timestamp: Date.now(),
    _id: `mock-${++_seq}`,
    ...extras,
  }
}

const INITIAL_SNAPSHOTS: AgentSnapshot[] = [
  { sessionId: S_MAIN, agentName: 'main', projectPath: P1, status: 'idle', startedAt: Date.now() - 30000, parentSessionId: null },
]

type EventFactory = () => HookEvent

const SCENARIO: EventFactory[] = [
  () => makeEvent(S_REVIEWER, 'SubagentStart', { transcript_path: `${P1}/.sessions/r.jsonl`, parent_session_id: S_MAIN }),
  () => makeEvent(S_REVIEWER, 'PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'src/app.tsx' } }),
  () => makeEvent(S_OTHER, 'SessionStart', { cwd: P2, transcript_path: `${P2}/.sessions/m.jsonl` }),
  () => makeEvent(S_REVIEWER, 'PostToolUse', { tool_name: 'Read' }),
  () => makeEvent(S_OTHER, 'PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' } }),
  () => makeEvent(S_REVIEWER, 'PreToolUse', { tool_name: 'Grep', tool_input: { pattern: 'useState', path: 'src/' } }),
  () => makeEvent(S_EXPLORER, 'SubagentStart', { transcript_path: `${P1}/.sessions/e.jsonl`, parent_session_id: S_MAIN }),
  () => makeEvent(S_OTHER, 'PostToolUse', { tool_name: 'Bash' }),
  () => makeEvent(S_REVIEWER, 'PostToolUse', { tool_name: 'Grep' }),
  () => makeEvent(S_EXPLORER, 'PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'src/index.ts' } }),
  () => makeEvent(S_MAIN, 'Notification'),
  () => makeEvent(S_EXPLORER, 'PostToolUse', { tool_name: 'Read' }),
  () => makeEvent(S_WRITER, 'SubagentStart', { transcript_path: `${P2}/.sessions/w.jsonl`, parent_session_id: S_OTHER }),
  () => makeEvent(S_EXPLORER, 'SubagentStop'),
  () => makeEvent(S_REVIEWER, 'PreToolUse', { tool_name: 'Write', tool_input: { file_path: 'src/output.ts' } }),
  () => makeEvent(S_WRITER, 'PreToolUse', { tool_name: 'Read', tool_input: { file_path: 'docs/spec.md' } }),
  () => makeEvent(S_REVIEWER, 'PostToolUse', { tool_name: 'Write' }),
  () => makeEvent(S_WRITER, 'PostToolUse', { tool_name: 'Read' }),
  () => makeEvent(S_REVIEWER, 'SubagentStop'),
  () => makeEvent(S_WRITER, 'SubagentStop'),
  () => makeEvent(S_OTHER, 'Stop'),
  () => makeEvent(S_MAIN, 'Stop'),
]

const DELAYS = [600, 800, 400, 500, 700, 600, 500, 400, 300, 700, 900, 400, 500, 600, 700, 500, 400, 600, 800, 700, 500, 600]

export function startMockGenerator(dispatch: Dispatch<Action>): () => void {
  const timers: ReturnType<typeof setTimeout>[] = []

  dispatch({ type: 'INIT', agents: INITIAL_SNAPSHOTS, recentEvents: [] })
  dispatch({ type: 'CONNECTED', connected: true })
  dispatch({ type: 'EVENT', event: makeEvent(S_MAIN, 'SessionStart', { cwd: P1, transcript_path: `${P1}/.sessions/main.jsonl` }) })

  function scheduleRound(baseDelay: number): void {
    let cumulative = baseDelay
    SCENARIO.forEach((factory, i) => {
      cumulative += DELAYS[i % DELAYS.length]
      const t = setTimeout(() => {
        dispatch({ type: 'EVENT', event: factory() })
        if (i === SCENARIO.length - 1) {
          scheduleRound(cumulative + 2000)
        }
      }, cumulative)
      timers.push(t)
    })
  }

  scheduleRound(300)
  return () => timers.forEach(clearTimeout)
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/mock/generator.ts
git commit -m "feat: implement mock event generator for two-project scenario"
```

---

## Task 10: Build App.tsx layout shell

**Files:**
- Create: `client/src/App.tsx`
- Modify: `client/src/main.tsx`

- [ ] **Step 1: Create `client/src/App.tsx`**

```tsx
import { useReducer } from 'react'
import { dashboardReducer, initialState } from './reducer'
import type { DashboardState } from './types'

// Placeholder panels — replaced in later tasks
function AgentTreePanel({ state }: { state: DashboardState }) {
  const count = state.agents.size
  return (
    <div className="flex flex-col h-full border-r border-border p-3 overflow-y-auto">
      <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Agents ({count})</div>
      {count === 0 ? (
        <div className="text-text-muted text-xs mt-4">No agents yet. Start a Claude Code session or use ?mock=true</div>
      ) : (
        Array.from(state.agents.values()).map(a => (
          <div key={a.sessionId} className="text-xs py-1 text-text-primary">
            {a.agentName} — {a.status}
          </div>
        ))
      )}
    </div>
  )
}

function DetailPanel({ state }: { state: DashboardState }) {
  const agent = state.selectedAgentId ? state.agents.get(state.selectedAgentId) : null
  return (
    <div className="flex flex-col h-full p-3 overflow-y-auto">
      {agent ? (
        <div className="text-xs text-text-primary">{agent.agentName} — {agent.status}</div>
      ) : (
        <div className="text-text-muted text-xs mt-4">Select an agent</div>
      )}
    </div>
  )
}

function EventStreamPanel({ state }: { state: DashboardState }) {
  return (
    <div className="h-32 border-t border-border p-2 overflow-y-auto">
      {state.events.slice(-20).reverse().map(ev => (
        <div key={ev._id} className="text-xs text-text-muted font-mono py-0.5">
          {new Date(ev._timestamp).toLocaleTimeString()} {ev.session_id.slice(0, 8)} {ev.hook_event_name} {ev.tool_name ?? ''}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState)

  // useRelay will be wired in Task 11
  // For now, dispatch is unused — mock mode will come next

  return (
    <div className="flex flex-col h-full bg-canvas text-text-primary font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface shrink-0">
        <span className="font-semibold tracking-wide">the-office</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            {state.connected ? (
              <span className="text-status-idle">● connected</span>
            ) : (
              <span className="text-status-error">● disconnected</span>
            )}
          </span>
          <button
            onClick={() => dispatch({ type: 'CLEAR' })}
            className="text-xs text-text-muted hover:text-text-primary border border-border px-2 py-0.5 rounded"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Main panels */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 shrink-0 overflow-y-auto">
          <AgentTreePanel state={state} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <DetailPanel state={state} />
        </div>
      </div>

      {/* Event stream */}
      <EventStreamPanel state={state} />
    </div>
  )
}
```

- [ ] **Step 2: Update `client/src/main.tsx` to render App**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Start client and verify the layout renders**

```bash
npm run dev -w client
```

Open `http://localhost:5173` — verify dark 3-panel layout, "No agents yet" message, header with "the-office" and "● disconnected".

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx client/src/main.tsx
git commit -m "feat: add App layout shell with 3-panel dark terminal UI"
```

---

## Task 11: Wire up useRelay (mock mode + live mode)

**Files:**
- Create: `client/src/hooks/useRelay.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create `client/src/hooks/useRelay.ts`**

```typescript
import { useEffect } from 'react'
import type { Dispatch } from 'react'
import type { Action } from '../types'

const WS_URL = 'ws://localhost:7777/ws'
const RECONNECT_DELAY = 3000

export function useRelay(dispatch: Dispatch<Action>): void {
  useEffect(() => {
    const isMock = new URLSearchParams(window.location.search).has('mock')

    if (isMock) {
      let cleanup: (() => void) | undefined
      import('../mock/generator').then(({ startMockGenerator }) => {
        cleanup = startMockGenerator(dispatch)
      })
      return () => cleanup?.()
    }

    // Live WebSocket mode
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    function connect() {
      if (destroyed) return
      ws = new WebSocket(WS_URL)

      ws.onopen = () => dispatch({ type: 'CONNECTED', connected: true })

      ws.onclose = () => {
        dispatch({ type: 'CONNECTED', connected: false })
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY)
        }
      }

      ws.onerror = () => ws?.close()

      ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data as string) as { type: string; agents?: unknown; recentEvents?: unknown; event?: unknown }
          if (payload.type === 'init') {
            dispatch({ type: 'INIT', agents: payload.agents as never, recentEvents: payload.recentEvents as never })
          } else if (payload.type === 'event') {
            dispatch({ type: 'EVENT', event: payload.event as never })
          }
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()

    return () => {
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [dispatch])
}
```

- [ ] **Step 2: Wire useRelay into `client/src/App.tsx`**

Add the import at the top:
```typescript
import { useRelay } from './hooks/useRelay'
```

Add the hook call directly after `useReducer`:
```typescript
const [state, dispatch] = useReducer(dashboardReducer, initialState)
useRelay(dispatch)
```

Remove the comment `// useRelay will be wired in Task 11`.

- [ ] **Step 3: Verify mock mode works**

Start the client dev server:
```bash
npm run dev -w client
```

Open `http://localhost:5173?mock=true` — verify:
- Status shows "● connected"
- Agents appear in the left panel over the first few seconds
- Events appear in the event stream at the bottom
- Status values change (idle, working, done, etc.)

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useRelay.ts client/src/App.tsx
git commit -m "feat: wire useRelay hook with mock mode and live WebSocket"
```

---

## Task 12: Build AgentTree, ProjectGroup, AgentNode

**Files:**
- Create: `client/src/components/AgentTree.tsx`, `client/src/components/ProjectGroup.tsx`, `client/src/components/AgentNode.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create `client/src/components/AgentNode.tsx`**

```tsx
import type { AgentState, AgentStatus } from '../types'

const STATUS_DOT: Record<AgentStatus, string> = {
  starting: '◐',
  working:  '●',
  idle:     '●',
  waiting:  '●',
  done:     '○',
  error:    '✕',
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  starting: 'text-status-starting',
  working:  'text-status-working',
  idle:     'text-status-idle',
  waiting:  'text-status-waiting',
  done:     'text-status-done',
  error:    'text-status-error',
}

interface Props {
  agent: AgentState
  depth: number
  selected: boolean
  onClick: () => void
}

export function AgentNode({ agent, depth, selected, onClick }: Props) {
  const indent = depth * 12

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-1.5 px-2 py-1 text-xs rounded hover:bg-surface transition-colors ${
        selected ? 'bg-surface border-l-2 border-status-idle' : ''
      }`}
      style={{ paddingLeft: `${8 + indent}px` }}
    >
      <span className={`shrink-0 mt-0.5 ${STATUS_COLOR[agent.status]}`}>
        {STATUS_DOT[agent.status]}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-text-primary truncate">{agent.agentName}</span>
        {agent.currentTool && (
          <span className="text-text-muted truncate">→{agent.currentTool}</span>
        )}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Create `client/src/components/ProjectGroup.tsx`**

```tsx
import { useState } from 'react'
import type { AgentState } from '../types'
import { AgentNode } from './AgentNode'

interface Props {
  projectPath: string
  agents: AgentState[]    // already sorted: root first, then children by parentSessionId
  selectedId: string | null
  onSelect: (id: string) => void
}

function getDisplayName(projectPath: string): string {
  if (!projectPath) return '(unknown project)'
  return projectPath.replace(/\\/g, '/').split('/').pop() ?? projectPath
}

function getDepth(agent: AgentState, allAgents: AgentState[]): number {
  if (!agent.parentSessionId) return 0
  const parent = allAgents.find(a => a.sessionId === agent.parentSessionId)
  if (!parent) return 1
  return 1 + getDepth(parent, allAgents)
}

export function ProjectGroup({ projectPath, agents, selectedId, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-1 px-2 py-1 text-xs text-status-starting hover:text-text-primary transition-colors"
      >
        <span>{collapsed ? '▸' : '▾'}</span>
        <span className="truncate">{getDisplayName(projectPath)}/</span>
        <span className="text-text-muted ml-auto shrink-0">{agents.length}</span>
      </button>
      {!collapsed && agents.map(agent => (
        <AgentNode
          key={agent.sessionId}
          agent={agent}
          depth={getDepth(agent, agents)}
          selected={agent.sessionId === selectedId}
          onClick={() => onSelect(agent.sessionId)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `client/src/components/AgentTree.tsx`**

```tsx
import type { AgentState } from '../types'
import { ProjectGroup } from './ProjectGroup'

interface Props {
  agents: Map<string, AgentState>
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function AgentTree({ agents, selectedId, onSelect }: Props) {
  // Group agents by projectPath
  const groups = new Map<string, AgentState[]>()
  for (const agent of agents.values()) {
    const key = agent.projectPath || '(unknown)'
    const group = groups.get(key) ?? []
    group.push(agent)
    groups.set(key, group)
  }

  if (groups.size === 0) {
    return (
      <div className="p-3 text-xs text-text-muted">
        No agents yet.{' '}
        <span className="text-text-muted/60">Add hooks or open ?mock=true</span>
      </div>
    )
  }

  return (
    <div className="p-2">
      {Array.from(groups.entries()).map(([path, groupAgents]) => (
        <ProjectGroup
          key={path}
          projectPath={path}
          agents={groupAgents}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Replace placeholder AgentTreePanel in `client/src/App.tsx`**

Remove the inline `AgentTreePanel` function and replace with an import:
```typescript
import { AgentTree } from './components/AgentTree'
```

Replace the `<AgentTreePanel state={state} />` call:
```tsx
<AgentTree
  agents={state.agents}
  selectedId={state.selectedAgentId}
  onSelect={(id) => dispatch({ type: 'SELECT_AGENT', sessionId: id })}
/>
```

- [ ] **Step 5: Verify in mock mode**

Open `http://localhost:5173?mock=true` — verify:
- Agents appear grouped under "my-project/" and "other-project/" headers
- Child agents are indented under parent
- Status dots animate as events come in
- Clicking an agent highlights it

- [ ] **Step 6: Commit**

```bash
git add client/src/components/AgentTree.tsx client/src/components/ProjectGroup.tsx client/src/components/AgentNode.tsx client/src/App.tsx
git commit -m "feat: implement AgentTree with project grouping and status dots"
```

---

## Task 13: Build AgentDetail and ToolHistory

**Files:**
- Create: `client/src/components/ToolHistory.tsx`, `client/src/components/AgentDetail.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create `client/src/components/ToolHistory.tsx`**

```tsx
import type { ToolCall } from '../types'

const ICON: Record<ToolCall['status'], string> = {
  running: '●',
  success: '✓',
  failure: '✕',
}

const ICON_COLOR: Record<ToolCall['status'], string> = {
  running: 'text-status-working',
  success: 'text-status-idle',
  failure: 'text-status-error',
}

function formatDuration(startedAt: number, completedAt: number | null): string {
  if (!completedAt) return '...'
  const ms = completedAt - startedAt
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

interface Props {
  toolHistory: ToolCall[]
}

export function ToolHistory({ toolHistory }: Props) {
  if (toolHistory.length === 0) {
    return <div className="text-xs text-text-muted italic">No tool calls yet</div>
  }

  return (
    <div className="space-y-0.5">
      {[...toolHistory].reverse().map(call => (
        <div key={call.id} className="flex items-baseline gap-2 text-xs py-0.5">
          <span className={`shrink-0 ${ICON_COLOR[call.status]}`}>{ICON[call.status]}</span>
          <span className="text-text-primary truncate flex-1">{call.toolName}</span>
          {call.input && typeof call.input === 'object' && (
            <span className="text-text-muted truncate max-w-32">
              {Object.values(call.input as Record<string, unknown>)[0] as string ?? ''}
            </span>
          )}
          <span className="text-text-muted shrink-0">{formatDuration(call.startedAt, call.completedAt)}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `client/src/components/AgentDetail.tsx`**

```tsx
import type { AgentState } from '../types'
import { ToolHistory } from './ToolHistory'

function formatDuration(startedAt: number): string {
  const s = Math.floor((Date.now() - startedAt) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

interface Props {
  agent: AgentState | null
}

export function AgentDetail({ agent }: Props) {
  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        Select an agent to see details
      </div>
    )
  }

  return (
    <div className="p-4 text-xs space-y-4">
      {/* Header */}
      <div>
        <div className="text-text-primary text-sm font-semibold">{agent.agentName}</div>
        <div className="text-text-muted mt-0.5">{agent.projectPath || '—'}</div>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap gap-4">
        <div>
          <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Status</div>
          <div className="text-text-primary">{agent.status}</div>
        </div>
        {agent.currentTool && (
          <div>
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Tool</div>
            <div className="text-status-working">{agent.currentTool}</div>
          </div>
        )}
        {agent.parentSessionId && (
          <div>
            <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Parent</div>
            <div className="text-text-primary">{agent.parentSessionId.slice(0, 12)}</div>
          </div>
        )}
        <div>
          <div className="text-text-muted uppercase tracking-wider text-[10px] mb-0.5">Duration</div>
          <div className="text-text-primary">{formatDuration(agent.startedAt)}</div>
        </div>
      </div>

      {/* Current tool input */}
      {agent.currentToolInput && (
        <div>
          <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1">Tool Input</div>
          <pre className="text-text-muted bg-surface rounded p-2 overflow-x-auto text-[10px] whitespace-pre-wrap break-all">
            {JSON.stringify(agent.currentToolInput, null, 2)}
          </pre>
        </div>
      )}

      {/* Tool history */}
      <div>
        <div className="text-text-muted uppercase tracking-wider text-[10px] mb-1">
          Tool History ({agent.toolHistory.length})
        </div>
        <ToolHistory toolHistory={agent.toolHistory} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace placeholder DetailPanel in `client/src/App.tsx`**

Add import:
```typescript
import { AgentDetail } from './components/AgentDetail'
```

Replace `<DetailPanel state={state} />` and the `DetailPanel` function:
```tsx
<AgentDetail agent={state.selectedAgentId ? (state.agents.get(state.selectedAgentId) ?? null) : null} />
```

Remove the `DetailPanel` inline function entirely.

- [ ] **Step 4: Verify in mock mode**

Open `http://localhost:5173?mock=true` — click an agent. Verify:
- Detail panel shows agent name, project, status, duration
- Tool history populates with running/success/failure calls
- Tool input JSON shows for working agents
- Duration counts up

- [ ] **Step 5: Commit**

```bash
git add client/src/components/AgentDetail.tsx client/src/components/ToolHistory.tsx client/src/App.tsx
git commit -m "feat: implement AgentDetail panel with ToolHistory"
```

---

## Task 14: Build EventStream and EventRow

**Files:**
- Create: `client/src/components/EventRow.tsx`, `client/src/components/EventStream.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create `client/src/components/EventRow.tsx`**

```tsx
import type { HookEvent } from '../types'

interface Props {
  event: HookEvent
}

function projectLabel(event: HookEvent): string {
  if (event.cwd) return event.cwd.replace(/\\/g, '/').split('/').pop() ?? ''
  if (event.transcript_path) {
    const norm = event.transcript_path.replace(/\\/g, '/')
    const parts = norm.split('/')
    const sessIdx = parts.indexOf('sessions')
    if (sessIdx > 0) return parts[sessIdx - 1] ?? ''
  }
  return event.session_id.slice(0, 8)
}

export function EventRow({ event }: Props) {
  return (
    <div className="flex items-baseline gap-3 py-0.5 text-[11px] font-mono hover:bg-surface px-2 rounded">
      <span className="text-text-muted shrink-0 tabular-nums">
        {new Date(event._timestamp).toLocaleTimeString()}
      </span>
      <span className="text-status-starting shrink-0 truncate max-w-24" title={event.session_id}>
        {projectLabel(event)}
      </span>
      <span className="text-text-muted shrink-0">{event.hook_event_name}</span>
      {event.tool_name && (
        <span className="text-text-primary shrink-0">{event.tool_name}</span>
      )}
      {event.tool_input && typeof event.tool_input === 'object' && (
        <span className="text-text-muted truncate">
          {String(Object.values(event.tool_input)[0] ?? '')}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `client/src/components/EventStream.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import type { HookEvent } from '../types'
import { EventRow } from './EventRow'

interface Props {
  events: HookEvent[]
}

export function EventStream({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  // Auto-scroll when not paused
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events, paused])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20
    setPaused(!atBottom)
  }

  const visible = events.slice(-200)

  return (
    <div className="border-t border-border shrink-0 flex flex-col" style={{ height: '8rem' }}>
      <div className="flex items-center justify-between px-2 py-0.5 border-b border-border bg-surface">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Event Stream</span>
        {paused && (
          <button
            onClick={() => {
              setPaused(false)
              bottomRef.current?.scrollIntoView()
            }}
            className="text-[10px] text-status-working hover:text-text-primary"
          >
            ↓ resume
          </button>
        )}
        <span className="text-[10px] text-text-muted">{events.length} events</span>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-1"
      >
        {visible.map(ev => <EventRow key={ev._id} event={ev} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace placeholder EventStreamPanel in `client/src/App.tsx`**

Add import:
```typescript
import { EventStream } from './components/EventStream'
```

Replace `<EventStreamPanel state={state} />` and the `EventStreamPanel` function:
```tsx
<EventStream events={state.events} />
```

Remove the `EventStreamPanel` inline function entirely.

- [ ] **Step 4: Verify in mock mode**

Open `http://localhost:5173?mock=true` — verify:
- Event stream fills with rows as events arrive
- Rows show: timestamp, project name, event type, tool name
- Stream auto-scrolls
- Scrolling up pauses auto-scroll with a "↓ resume" button
- Clicking "↓ resume" jumps back to bottom

- [ ] **Step 5: Commit**

```bash
git add client/src/components/EventStream.tsx client/src/components/EventRow.tsx client/src/App.tsx
git commit -m "feat: implement EventStream with auto-scroll and pause on scroll-up"
```

---

## Task 15: Polish — ConnectionBadge, header cleanup, empty states

**Files:**
- Create: `client/src/components/ConnectionBadge.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create `client/src/components/ConnectionBadge.tsx`**

```tsx
interface Props {
  connected: boolean
}

export function ConnectionBadge({ connected }: Props) {
  return (
    <span className={`text-xs flex items-center gap-1.5 ${connected ? 'text-status-idle' : 'text-status-error'}`}>
      <span className="text-[10px]">{connected ? '●' : '●'}</span>
      {connected ? 'connected' : 'disconnected'}
    </span>
  )
}
```

- [ ] **Step 2: Update header in `client/src/App.tsx` to use ConnectionBadge**

Add import:
```typescript
import { ConnectionBadge } from './components/ConnectionBadge'
```

Replace the inline connection status span:
```tsx
<ConnectionBadge connected={state.connected} />
```

- [ ] **Step 3: Add auto-refresh duration display to AgentNode**

Edit `client/src/components/AgentNode.tsx`. Add a live duration counter for active agents. Import `useEffect` and `useState`:

```tsx
import { useEffect, useState } from 'react'

// Inside AgentNode component, after existing declarations:
const [, setTick] = useState(0)
useEffect(() => {
  if (agent.status === 'done' || agent.status === 'error') return
  const id = setInterval(() => setTick(t => t + 1), 1000)
  return () => clearInterval(id)
}, [agent.status])

function elapsed(): string {
  const s = Math.floor((Date.now() - agent.startedAt) / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m`
}
```

Add the elapsed time next to status in the button JSX:
```tsx
<span className="text-text-muted ml-auto shrink-0">
  {agent.status !== 'done' && agent.status !== 'error' ? elapsed() : ''}
</span>
```

- [ ] **Step 4: Verify full mock mode experience**

Open `http://localhost:5173?mock=true` — final checklist:
- [ ] Header shows "the-office", ConnectionBadge in green, "Clear All" button
- [ ] Agent tree shows two project groups with correct agent hierarchy
- [ ] Status dots animate correctly through the full cycle
- [ ] Elapsed time shows next to agent names
- [ ] Clicking an agent populates the detail panel
- [ ] Tool history shows running/success/failure with timing
- [ ] Event stream auto-scrolls and pauses on scroll-up
- [ ] "Clear All" clears agents and events, "● disconnected" remains
- [ ] Refresh page re-runs mock scenario from scratch

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ConnectionBadge.tsx client/src/components/AgentNode.tsx client/src/App.tsx
git commit -m "feat: add ConnectionBadge, elapsed timer, polish empty states"
```

---

## Task 16: End-to-end live smoke test + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run both server and client together**

```bash
npm run dev
```

Expected: concurrently starts both. Server on `http://localhost:7777`, client on `http://localhost:5173`.

- [ ] **Step 2: Send a test hook event and verify it appears**

In a second terminal:
```bash
curl -X POST http://localhost:7777/api/events \
  -H "Content-Type: application/json" \
  -d '{"session_id":"live-test-001","hook_event_name":"SessionStart","cwd":"/home/user/live-test"}'
```

Open `http://localhost:5173` — verify: "live-test" project group appears with one idle agent. Send a PreToolUse:

```bash
curl -X POST http://localhost:7777/api/events \
  -H "Content-Type: application/json" \
  -d '{"session_id":"live-test-001","hook_event_name":"PreToolUse","tool_name":"Read","tool_input":{"file_path":"src/app.ts"}}'
```

Verify: agent status changes to working, event stream shows the event.

- [ ] **Step 3: Create `README.md`**

```markdown
# the-office

**htop for AI agents.** Real-time dashboard for observing Claude Code agents across all your projects.

![Status: Phase 1 — Observer](https://img.shields.io/badge/status-Phase%201%20Observer-blue)

---

## What it does

- **Live agent tree** — see every Claude Code agent on your machine, grouped by project, with parent/child hierarchy
- **Agent detail** — click any agent to see its current tool, tool history with timing, and duration
- **Event stream** — live feed of every hook event as it fires
- **JSONL bootstrap** — dashboard populates immediately on open, even for sessions that started before the dashboard
- **Mock mode** — develop and demo without Claude Code running (`?mock=true`)

## Setup

### 1. Install dependencies

```bash
git clone <repo>
cd the-office
npm install
```

### 2. Configure Claude Code hooks (one-time)

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart":  [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "SessionEnd":    [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "SubagentStart": [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "SubagentStop":  [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "PreToolUse":    [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "PostToolUse":   [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "Stop":          [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}],
    "Notification":  [{"hooks": [{"type": "http", "url": "http://localhost:7777/api/events", "timeout": 5}]}]
  }
}
```

If the server isn't running, hooks fail silently — Claude Code is unaffected.

### 3. Start the dashboard

```bash
npm run dev
```

Open `http://localhost:5173`.

## Mock mode

No Claude Code required:

```
http://localhost:5173?mock=true
```

Simulates two projects, five agents, ~25 events looping every ~20 seconds.

## Architecture

```
Claude Code hooks
      │ HTTP POST :7777/api/events
      ▼
  Express server (server/)
      │ stamp _id + _timestamp → ring buffer (500) → broadcast
      ▼
  React frontend (client/)
      │ useReducer: HookEvent → AgentState transitions
      ▼
  AgentTree / AgentDetail / EventStream
```

On WebSocket connect, server scans `~/.claude/projects/**/sessions/*.jsonl` (last 4h) and sends bootstrapped agent state alongside the ring buffer. Page refresh always gives fresh data.

## Development

```bash
npm run dev          # start both server and client
npm test -w server   # server tests (Jest)
npm test -w client   # client tests (Vitest)
```

## Roadmap

- **Phase 2:** Kill agents, view full conversations, spawn agents from dashboard
- **Phase 3:** Deployed client (Vercel) + local server, then desktop app (Tauri/Electron)
```

- [ ] **Step 4: Commit README**

```bash
git add README.md
git commit -m "docs: add README with setup, architecture, mock mode, roadmap"
```

- [ ] **Step 5: Final verification checklist**

Run through the Phase 1 success criteria:
- [ ] `npm run dev` starts both server and client with one command
- [ ] `?mock=true` works — agents appear, animate, event stream fills
- [ ] Real hook event via curl appears in live dashboard within ~100ms
- [ ] Agent tree groups by project, indents children
- [ ] Status dots update as events arrive
- [ ] Clicking agent shows full detail panel
- [ ] Event stream auto-scrolls, pauses on scroll-up
- [ ] "Clear All" resets state
- [ ] Server `/health` returns 200 when server is down, client shows "● disconnected"
- [ ] Bootstrap: stop server, start an agent via Claude Code, open dashboard → agent appears
