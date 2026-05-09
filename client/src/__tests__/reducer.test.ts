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
    hasHooks: false,
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
      const state = dashboardReducer(initialState, { type: 'INIT', agents: [snapshot()], recentEvents: [], hooksInstalled: false })
      expect(state.agents.has('sess-001')).toBe(true)
      expect(state.agents.get('sess-001')?.agentName).toBe('main')
    })

    it('replays recentEvents on top of seeded agents', () => {
      const state = dashboardReducer(initialState, {
        type: 'INIT',
        agents: [snapshot()],
        recentEvents: [event({ hook_event_name: 'PreToolUse', tool_name: 'Read', _id: 'e2', _timestamp: 2000 })],
        hooksInstalled: false,
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

  describe('SESSION_DISCOVERED', () => {
    it('adds a new agent with hasHooks: false', () => {
      const state = dashboardReducer(initialState, {
        type: 'SESSION_DISCOVERED',
        agent: snapshot({ sessionId: 'new-001', agentName: 'discovered', hasHooks: false }),
      })
      const agent = state.agents.get('new-001')
      expect(agent).toBeDefined()
      expect(agent!.hasHooks).toBe(false)
      expect(agent!.agentName).toBe('discovered')
    })

    it('is idempotent — does not overwrite existing agent', () => {
      const withAgent = dashboardReducer(initialState, {
        type: 'EVENT',
        event: event({ hook_event_name: 'SessionStart', session_id: 'sess-001' }),
      })
      const state = dashboardReducer(withAgent, {
        type: 'SESSION_DISCOVERED',
        agent: snapshot({ sessionId: 'sess-001', agentName: 'overwrite-attempt', hasHooks: false }),
      })
      expect(state.agents.get('sess-001')?.agentName).not.toBe('overwrite-attempt')
    })
  })

  describe('ENRICH', () => {
    it('merges enrichment data into the agent', () => {
      const withAgent = dashboardReducer(initialState, {
        type: 'EVENT',
        event: event({ hook_event_name: 'SessionStart' }),
      })
      const enrichment = {
        model: 'claude-opus-4-7',
        inputTokens: 42000,
        outputTokens: 8000,
        cacheReadTokens: 1000,
        cacheWriteTokens: 500,
        costUSD: 0.05,
        turnDurationMs: 2000,
        isSidechain: false,
      }
      const state = dashboardReducer(withAgent, {
        type: 'ENRICH',
        sessionId: 'sess-001',
        data: enrichment,
      })
      expect(state.agents.get('sess-001')?.enrichment).toEqual(enrichment)
    })

    it('is a no-op for unknown sessionId', () => {
      const state = dashboardReducer(initialState, {
        type: 'ENRICH',
        sessionId: 'unknown',
        data: { model: 'x', inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUSD: 0, turnDurationMs: 0, isSidechain: false },
      })
      expect(state).toBe(initialState)
    })
  })

  describe('waitingSince', () => {
    it('sets waitingSince when Notification received', () => {
      const before = Date.now()
      const state = dashboardReducer(initialState, {
        type: 'EVENT',
        event: event({ hook_event_name: 'Notification', _timestamp: Date.now() }),
      })
      expect(state.agents.get('sess-001')?.waitingSince).toBeGreaterThanOrEqual(before)
    })

    it('clears waitingSince on PreToolUse', () => {
      const withWaiting = dashboardReducer(initialState, {
        type: 'EVENT',
        event: event({ hook_event_name: 'Notification', _timestamp: 1000 }),
      })
      const state = dashboardReducer(withWaiting, {
        type: 'EVENT',
        event: event({ hook_event_name: 'PreToolUse', tool_name: 'Read', _timestamp: 2000 }),
      })
      expect(state.agents.get('sess-001')?.waitingSince).toBeNull()
    })
  })

  describe('hasHooks', () => {
    it('sets hasHooks: true on first real hook event for a new agent', () => {
      const state = dashboardReducer(initialState, {
        type: 'EVENT',
        event: event({ hook_event_name: 'SessionStart' }),
      })
      expect(state.agents.get('sess-001')?.hasHooks).toBe(true)
    })

    it('SESSION_DISCOVERED agent starts with hasHooks: false', () => {
      const state = dashboardReducer(initialState, {
        type: 'SESSION_DISCOVERED',
        agent: snapshot({ hasHooks: false }),
      })
      expect(state.agents.get('sess-001')?.hasHooks).toBe(false)
    })
  })

  describe('INIT hooksInstalled', () => {
    it('stores hooksInstalled from init payload', () => {
      const state = dashboardReducer(initialState, {
        type: 'INIT',
        agents: [],
        recentEvents: [],
        hooksInstalled: true,
      })
      expect(state.hooksInstalled).toBe(true)
    })
  })

  describe('transcriptPath capture', () => {
    it('stores transcript_path from SessionStart', () => {
      const e: HookEvent = {
        session_id: 'sess-1',
        hook_event_name: 'SessionStart',
        transcript_path: '/home/user/.claude/projects/foo/sess-1.jsonl',
        cwd: '/home/user/foo',
        _timestamp: 1000,
        _id: 'e1',
      }
      const s1 = dashboardReducer(initialState, { type: 'EVENT', event: e })
      expect(s1.agents.get('sess-1')?.transcriptPath).toBe(
        '/home/user/.claude/projects/foo/sess-1.jsonl'
      )
    })

    it('does not overwrite transcriptPath once set', () => {
      const e1: HookEvent = {
        session_id: 'sess-1',
        hook_event_name: 'SessionStart',
        transcript_path: '/path/first.jsonl',
        _timestamp: 1000,
        _id: 'e1',
      }
      const e2: HookEvent = {
        session_id: 'sess-1',
        hook_event_name: 'PreToolUse',
        transcript_path: '/path/second.jsonl',
        tool_name: 'Read',
        _timestamp: 2000,
        _id: 'e2',
      }
      const s1 = dashboardReducer(initialState, { type: 'EVENT', event: e1 })
      const s2 = dashboardReducer(s1, { type: 'EVENT', event: e2 })
      expect(s2.agents.get('sess-1')?.transcriptPath).toBe('/path/first.jsonl')
    })

    it('stores agent_transcript_path for subagents', () => {
      const e: HookEvent = {
        session_id: 'sess-1',
        hook_event_name: 'SubagentStart',
        agent_id: 'agent-abc',
        agent_transcript_path: '/home/.claude/projects/foo/sess-1/subagents/agent-abc.jsonl',
        cwd: '/home/user/foo',
        _timestamp: 1000,
        _id: 'e1',
      }
      const s1 = dashboardReducer(initialState, { type: 'EVENT', event: e })
      expect(s1.agents.get('agent-abc')?.transcriptPath).toBe(
        '/home/.claude/projects/foo/sess-1/subagents/agent-abc.jsonl'
      )
    })
  })
})
