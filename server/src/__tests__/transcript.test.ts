import { extractSnapshot } from '../transcript'

describe('extractSnapshot', () => {
  it('extracts first user text and last assistant text', () => {
    const lines = [
      JSON.stringify({ type: 'user', message: { content: 'Fix the bug in reducer.ts' } }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'I will look at the file.' }] } }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Done. The bug was on line 42.' }] } }),
    ]
    const result = extractSnapshot(lines)
    expect(result.firstPrompt).toBe('Fix the bug in reducer.ts')
    expect(result.latestAssistant).toBe('Done. The bug was on line 42.')
    expect(result.messageCount).toBe(3)
  })

  it('skips pure tool_result user messages for firstPrompt', () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'tool_result', content: 'output', tool_use_id: 'tu-1' }] },
      }),
      JSON.stringify({ type: 'user', message: { content: 'Actually do this instead' } }),
    ]
    const result = extractSnapshot(lines)
    expect(result.firstPrompt).toBe('Actually do this instead')
  })

  it('skips tool_result user messages in messageCount', () => {
    const lines = [
      JSON.stringify({ type: 'user', message: { content: 'Hello' } }),
      JSON.stringify({
        type: 'user',
        message: { content: [{ type: 'tool_result', content: 'output', tool_use_id: 'tu-1' }] },
      }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }] } }),
    ]
    const result = extractSnapshot(lines)
    expect(result.messageCount).toBe(2)
  })

  it('extracts text from content block arrays for assistant', () => {
    const lines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Let me check that.' },
            { type: 'tool_use', name: 'Read', input: { file_path: 'foo.ts' } },
          ],
        },
      }),
    ]
    const result = extractSnapshot(lines)
    expect(result.latestAssistant).toBe('Let me check that.')
  })

  it('returns nulls for empty transcript', () => {
    const result = extractSnapshot([])
    expect(result).toEqual({ firstPrompt: null, latestAssistant: null, messageCount: 0 })
  })

  it('ignores system, summary, result lines in messageCount', () => {
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init', sessionId: 'x' }),
      JSON.stringify({ type: 'user', message: { content: 'Go' } }),
      JSON.stringify({ type: 'summary', summary: 'done' }),
    ]
    expect(extractSnapshot(lines).messageCount).toBe(1)
  })

  it('skips malformed lines without throwing', () => {
    const lines = ['not json', '{}', JSON.stringify({ type: 'user', message: { content: 'OK' } })]
    expect(() => extractSnapshot(lines)).not.toThrow()
    expect(extractSnapshot(lines).firstPrompt).toBe('OK')
  })
})
