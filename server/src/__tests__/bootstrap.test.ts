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
