import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FilterBar } from '../components/FilterBar'

const FILTERS = { query: '', range: '7d' as const, project: null, runningOnly: false }

describe('FilterBar', () => {
  it('focuses the search box again whenever the window regains focus (popover reopened)', () => {
    render(<><FilterBar filters={FILTERS} onChange={vi.fn()} projects={[]} /><button>elsewhere</button></>)
    const search = screen.getByRole('searchbox')
    screen.getByRole('button', { name: 'elsewhere' }).focus()
    expect(search).not.toHaveFocus()
    window.dispatchEvent(new Event('focus'))
    expect(search).toHaveFocus()
  })
})
