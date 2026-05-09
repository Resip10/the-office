import { extractEnrichment } from '../watcher'

function assistantLine(model: string, usage: Record<string, number>): string {
  return JSON.stringify({ type: 'assistant', message: { model, usage } })
}

function resultLine(costUSD: number, turn_duration: number, isSidechain = false): string {
  return JSON.stringify({ type: 'result', costUSD, turn_duration, isSidechain })
}

describe('extractEnrichment', () => {
  it('returns null for empty lines', () => {
    expect(extractEnrichment([])).toBeNull()
  })

  it('returns null when no enrichment fields present', () => {
    expect(extractEnrichment(['{"type":"system","subtype":"init"}'])).toBeNull()
  })

  it('extracts model and usage from assistant line', () => {
    const data = extractEnrichment([
      assistantLine('claude-opus-4-7', {
        input_tokens: 42310,
        output_tokens: 8421,
        cache_read_input_tokens: 12000,
        cache_creation_input_tokens: 3200,
      }),
    ])
    expect(data).not.toBeNull()
    expect(data!.model).toBe('claude-opus-4-7')
    expect(data!.inputTokens).toBe(42310)
    expect(data!.outputTokens).toBe(8421)
    expect(data!.cacheReadTokens).toBe(12000)
    expect(data!.cacheWriteTokens).toBe(3200)
  })

  it('extracts costUSD and turnDurationMs from result line', () => {
    const data = extractEnrichment([resultLine(0.087, 2300)])
    expect(data).not.toBeNull()
    expect(data!.costUSD).toBe(0.087)
    expect(data!.turnDurationMs).toBe(2300)
  })

  it('extracts isSidechain from result line', () => {
    const data = extractEnrichment([resultLine(0, 0, true)])
    expect(data!.isSidechain).toBe(true)
  })

  it('uses last occurrence of model (latest turn wins)', () => {
    const data = extractEnrichment([
      assistantLine('claude-haiku-4-5', { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }),
      assistantLine('claude-opus-4-7', { input_tokens: 200, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }),
    ])
    expect(data!.model).toBe('claude-opus-4-7')
    expect(data!.inputTokens).toBe(200)
  })

  it('skips malformed lines without throwing', () => {
    const data = extractEnrichment(['not json', assistantLine('claude-sonnet-4-6', { input_tokens: 5, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 })])
    expect(data!.model).toBe('claude-sonnet-4-6')
  })
})
