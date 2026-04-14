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
