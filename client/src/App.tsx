import { useEffect } from 'react'
import { useAppState } from './hooks/useAppState'
import { applyTheme } from './lib/themes'
import { Popover } from './views/Popover'
import { Settings } from './views/Settings'
import { Window } from './views/Window'

const param = new URLSearchParams(window.location.search).get('view')
const view = param === 'window' || param === 'settings' ? param : 'popover'

export default function App() {
  const { settings } = useAppState()
  useEffect(() => applyTheme(document.documentElement, settings.theme), [settings.theme])

  if (view === 'settings') return <Settings />
  return view === 'window' ? <Window /> : <Popover />
}
