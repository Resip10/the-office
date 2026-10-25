import * as D from '@radix-ui/react-dropdown-menu'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'

export const DropdownMenu = D.Root
export const DropdownMenuTrigger = D.Trigger

export function DropdownMenuContent({ className = '', sideOffset = 4, ...props }: ComponentPropsWithoutRef<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Content
        sideOffset={sideOffset}
        className={`z-50 min-w-[8rem] rounded-lg border border-line-strong bg-raised p-1 shadow-lg ${className}`}
        {...props}
      />
    </D.Portal>
  )
}

// forwardRef so an item can be a Tooltip trigger (e.g. a disabled item's reason).
export const DropdownMenuItem = forwardRef<ElementRef<typeof D.Item>, ComponentPropsWithoutRef<typeof D.Item>>(
  function DropdownMenuItem({ className = '', ...props }, ref) {
    return (
      <D.Item
        ref={ref}
        className={`focus-ring flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-text-2 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover data-[highlighted]:text-text ${className}`}
        {...props}
      />
    )
  },
)
