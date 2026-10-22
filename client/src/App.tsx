import { useEffect, useState } from 'react'
import { useAppState } from './hooks/useAppState'
import { applyTheme, effectiveTheme } from './lib/themes'
import { Popover } from './views/Popover'
import { Settings } from './views/Settings'
import { Window } from './views/Window'

const param = new URLSearchParams(window.location.search).get('view')
const view = param === 'window' || param === 'settings' ? param : 'popover'
// The popover window is transparent; index.css keeps its page background clear so the rounded corners show.
document.documentElement.dataset.view = view

const DARK_QUERY = '(prefers-color-scheme: dark)'

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia?.(DARK_QUERY).matches ?? true)
  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY)
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

export default function App() {
  const { settings } = useAppState()
  const systemDark = useSystemDark()
  const theme = effectiveTheme(settings, systemDark)
  useEffect(() => applyTheme(document.documentElement, theme), [theme])

  if (view === 'settings') return <Settings />
  return view === 'window' ? <Window /> : <Popover />
}
