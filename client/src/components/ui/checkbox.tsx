import * as C from '@radix-ui/react-checkbox'
import type { ComponentPropsWithoutRef } from 'react'
import { CheckIcon } from './icons'

export function Checkbox({ className = '', ...props }: ComponentPropsWithoutRef<typeof C.Root>) {
  return (
    <C.Root
      className={`focus-ring inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line-strong bg-control text-on-accent data-[state=checked]:border-accent data-[state=checked]:bg-accent ${className}`}
      {...props}
    >
      <C.Indicator><CheckIcon width={12} height={12} /></C.Indicator>
    </C.Root>
  )
}
