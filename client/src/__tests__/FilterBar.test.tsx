import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen, within } from '@testing-library/react'
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

  it('time range is a segmented group with the active segment pressed', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={FILTERS} onChange={onChange} projects={[]} />)
    const group = screen.getByRole('group', { name: 'Time range' })
    expect(within(group).getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(within(group).getByRole('button', { name: '30d' }))
    expect(onChange).toHaveBeenCalledWith({ ...FILTERS, range: '30d' })
  })

  it('project select lists all projects and each project, and choosing one filters', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const long = '/work/' + 'x'.repeat(60)
    render(<FilterBar filters={FILTERS} onChange={onChange} projects={['/work/alpha', long]} />)
    await user.click(screen.getByRole('combobox', { name: 'Project' }))
    expect(screen.getByRole('option', { name: 'All projects' })).toBeInTheDocument()
    const option = screen.getByRole('option', { name: 'x'.repeat(60) })
    const text = option.querySelector('.truncate')
    expect(text).toHaveClass('block', 'truncate')
    expect(option.className).toContain('[&>span:last-child]:min-w-0')
    expect(text?.closest('[role="listbox"]')?.className).toMatch(/max-w-/)
    await user.click(screen.getByRole('option', { name: 'alpha' }))
    expect(onChange).toHaveBeenCalledWith({ ...FILTERS, project: '/work/alpha' })
  })
})
