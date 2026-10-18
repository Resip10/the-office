import { Popover } from './views/Popover'
import { Window } from './views/Window'

const view = new URLSearchParams(window.location.search).get('view') === 'window' ? 'window' : 'popover'

export default function App() {
  return view === 'window' ? <Window /> : <Popover />
}
