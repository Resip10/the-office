import { inferEvents } from '../jsonl-status'

const SESSION = 'sess-abc'

function toolUseAssistantLine(toolName: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: toolName, id: 'toolu_01' }] },
  })
}

function toolResultUserLine(): string {
  return JSON.stringify({
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: 'ok' }] },
  })
}

function turnDurationLine(): string {
  return JSON.stringify({ type: 'result', turn_duration: 2300 })
}

describe('inferEvents', () => {
  it('returns empty array for lines with no tool signals', () => {
    const events = inferEvents(SESSION, ['{"type":"system","subtype":"init"}'])
    expect(events).toHaveLength(0)
  })

  it('emits PreToolUse when last signal is a tool_use block', () => {
    const events = inferEvents(SESSION, [toolUseAssistantLine('Read')])
    expect(events).toHaveLength(1)
    expect(events[0].hook_event_name).toBe('PreToolUse')
    expect(events[0].tool_name).toBe('Read')
    expect(events[0].session_id).toBe(SESSION)
  })

  it('emits PostToolUse when last signal is a tool_result block', () => {
    const events = inferEvents(SESSION, [
      toolUseAssistantLine('Read'),
      toolResultUserLine(),
    ])
    expect(events).toHaveLength(1)
    expect(events[0].hook_event_name).toBe('PostToolUse')
  })

  it('emits PostToolUse (idle) when turn_duration is present', () => {
    const events = inferEvents(SESSION, [turnDurationLine()])
    expect(events).toHaveLength(1)
    expect(events[0].hook_event_name).toBe('PostToolUse')
  })

  it('net result of tool_use + tool_result is PostToolUse', () => {
    const events = inferEvents(SESSION, [
      toolUseAssistantLine('Write'),
      toolResultUserLine(),
      toolUseAssistantLine('Read'),
      toolResultUserLine(),
    ])
    expect(events).toHaveLength(1)
    expect(events[0].hook_event_name).toBe('PostToolUse')
  })

  it('emits PreToolUse if last tool signal is a tool_use with no following result', () => {
    const events = inferEvents(SESSION, [
      toolResultUserLine(),       // previous completed tool
      toolUseAssistantLine('Bash'),  // new tool starting
    ])
    expect(events).toHaveLength(1)
    expect(events[0].hook_event_name).toBe('PreToolUse')
    expect(events[0].tool_name).toBe('Bash')
  })

  it('returns empty for malformed lines', () => {
    const events = inferEvents(SESSION, ['not json', '{broken'])
    expect(events).toHaveLength(0)
  })
})
