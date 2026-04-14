import { parseJSONLSession } from '../bootstrap'

describe('parseJSONLSession', () => {
  it('parses real Claude Code format with top-level sessionId and cwd', () => {
    const lines = [
      JSON.stringify({ type: 'permission-mode', permissionMode: 'default', sessionId: 'abc-123' }),
      JSON.stringify({ type: 'user', sessionId: 'abc-123', cwd: 'C:\\projects\\my-project', timestamp: '2026-01-01T00:00:00.000Z' }),
    ]
    const result = parseJSONLSession('C:/Users/user/.claude/projects/C--projects-my-project/abc-123.jsonl', lines)
    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe('abc-123')
    expect(result!.projectPath).toBe('C:/projects/my-project')
    expect(result!.status).toBe('idle')
  })

  it('derives agentName from encoded project folder for main sessions', () => {
    const lines = [
      JSON.stringify({ type: 'user', sessionId: 'abc-123', cwd: '/home/user/the-office', timestamp: '2026-01-01T00:00:00.000Z' }),
    ]
    const result = parseJSONLSession('/home/user/.claude/projects/C--projects-the-office/abc-123.jsonl', lines)
    expect(result!.agentName).toBe('the-office')
  })

  it('derives agentName for subagent files', () => {
    const lines = [
      JSON.stringify({ type: 'user', sessionId: 'sub-456', cwd: '/p', timestamp: '2026-01-01T00:00:00.000Z' }),
    ]
    const result = parseJSONLSession('/home/.claude/projects/C--projects-foo/abc-123/subagents/agent-aside_question-0a8aa506aa23401b.jsonl', lines)
    expect(result!.agentName).toBe('agent-aside_question')
  })

  it('returns null when no session_id is found', () => {
    const lines = [JSON.stringify({ type: 'file-history-snapshot', snapshot: {} })]
    const result = parseJSONLSession('/path/unknown.jsonl', lines)
    expect(result).toBeNull()
  })

  it('marks session as done when summary type is found', () => {
    const lines = [
      JSON.stringify({ type: 'user', sessionId: 'done-sess', cwd: '/proj', timestamp: '2026-01-01T00:00:00.000Z' }),
      JSON.stringify({ type: 'summary', summary: 'Session ended' }),
    ]
    const result = parseJSONLSession('/sessions/done-sess.jsonl', lines)
    expect(result!.status).toBe('done')
  })

  it('skips malformed lines without throwing', () => {
    const lines = [
      'NOT VALID JSON {{{',
      JSON.stringify({ type: 'user', sessionId: 'resilient', cwd: '/r', timestamp: '2026-01-01T00:00:00.000Z' }),
    ]
    const result = parseJSONLSession('/sessions/resilient.jsonl', lines)
    expect(result!.sessionId).toBe('resilient')
  })

  it('falls back to legacy system/init format', () => {
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init', data: { session_id: 'flat-id', cwd: '/flat' } }),
    ]
    const result = parseJSONLSession('/sessions/main-flat.jsonl', lines)
    expect(result!.sessionId).toBe('flat-id')
  })
})
