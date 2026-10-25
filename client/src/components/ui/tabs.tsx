import * as T from '@radix-ui/react-tabs'
import type { ComponentPropsWithoutRef } from 'react'

export const Tabs = T.Root

export function TabsList({ className = '', ...props }: ComponentPropsWithoutRef<typeof T.List>) {
  return <T.List className={`flex items-center gap-1 border-b border-line ${className}`} {...props} />
}

export function TabsTrigger({ className = '', ...props }: ComponentPropsWithoutRef<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={`focus-ring rounded-md px-2.5 py-1 text-[12.5px] text-muted hover:text-text data-[state=active]:bg-selected data-[state=active]:text-text ${className}`}
      {...props}
    />
  )
}

export function TabsContent({ className = '', ...props }: ComponentPropsWithoutRef<typeof T.Content>) {
  return <T.Content className={`focus-ring ${className}`} {...props} />
}
