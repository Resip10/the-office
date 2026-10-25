import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import type { DetailTab } from './types'

export interface TabSpec {
  value: DetailTab
  label: string
  count?: number
  content: ReactNode
}

interface Props {
  tabs: TabSpec[]
  value: DetailTab
  onValueChange: (t: DetailTab) => void
  aside?: ReactNode
}

// Tab bar with muted counts; the selected panel fills the rest of the pane and scrolls inside itself.
export function DetailTabs({ tabs, value, onValueChange, aside }: Props) {
  return (
    <Tabs value={value} onValueChange={v => onValueChange(v as DetailTab)} className="flex-1 min-h-[240px] flex flex-col">
      <div className="flex shrink-0 items-end border-b border-line">
      <TabsList aria-label="Session details tabs" className="!border-b-0">
        {tabs.map(t => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
            {t.count !== undefined && <> <span className="ml-1 font-mono text-[12px] tabular-nums text-faint">{t.count}</span></>}
          </TabsTrigger>
        ))}
      </TabsList>
      {aside && <div className="ml-auto self-center flex items-center">{aside}</div>}
      </div>
      {tabs.map(t => (
        <TabsContent key={t.value} value={t.value} className="flex-1 min-h-0 overflow-y-auto pt-3">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
