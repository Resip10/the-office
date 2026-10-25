import * as T from '@radix-ui/react-tabs'
import type { ComponentPropsWithoutRef } from 'react'

export const Tabs = T.Root

export function TabsList({ className = '', ...props }: ComponentPropsWithoutRef<typeof T.List>) {
  return <T.List className={`flex items-end gap-0.5 border-b border-line ${className}`} {...props} />
}

export function TabsTrigger({ className = '', ...props }: ComponentPropsWithoutRef<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={`focus-ring -mb-px border-b-2 border-transparent px-3 py-2 text-[13px] text-muted hover:text-text data-[state=active]:border-text data-[state=active]:text-text ${className}`}
      {...props}
    />
  )
}

export function TabsContent({ className = '', ...props }: ComponentPropsWithoutRef<typeof T.Content>) {
  return <T.Content className={`focus-ring ${className}`} {...props} />
}
