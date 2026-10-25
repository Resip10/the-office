import * as S from '@radix-ui/react-select'
import type { ComponentPropsWithoutRef } from 'react'
import { CheckIcon, ChevronDownIcon } from './icons'

export const Select = S.Root
export const SelectValue = S.Value

export function SelectTrigger({ className = '', children, ...props }: ComponentPropsWithoutRef<typeof S.Trigger>) {
  return (
    <S.Trigger
      className={`focus-ring inline-flex h-7 items-center justify-between gap-2 rounded-md border border-line bg-control px-2 text-[12.5px] text-text hover:border-line-strong ${className}`}
      {...props}
    >
      {children}
      <S.Icon className="text-muted"><ChevronDownIcon /></S.Icon>
    </S.Trigger>
  )
}

export function SelectContent({ className = '', children, ...props }: ComponentPropsWithoutRef<typeof S.Content>) {
  return (
    <S.Portal>
      <S.Content
        position="popper"
        sideOffset={4}
        className={`z-50 min-w-[var(--radix-select-trigger-width)] rounded-lg border border-line-strong bg-raised p-1 shadow-lg ${className}`}
        {...props}
      >
        <S.Viewport>{children}</S.Viewport>
      </S.Content>
    </S.Portal>
  )
}

export function SelectItem({ className = '', children, ...props }: ComponentPropsWithoutRef<typeof S.Item>) {
  return (
    <S.Item
      className={`relative flex cursor-default select-none items-center rounded-md py-1.5 pl-6 pr-2 text-[12.5px] text-text-2 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover data-[highlighted]:text-text ${className}`}
      {...props}
    >
      <S.ItemIndicator className="absolute left-1.5 inline-flex"><CheckIcon /></S.ItemIndicator>
      <S.ItemText>{children}</S.ItemText>
    </S.Item>
  )
}
