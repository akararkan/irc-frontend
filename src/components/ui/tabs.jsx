import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex h-10 max-w-full items-center justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/60 p-1 text-ink-3 scrollbar-none snap-x snap-mandatory',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex shrink-0 snap-start items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:text-ink data-[state=active]:bg-paper data-[state=active]:text-brand data-[state=active]:shadow-[var(--shadow-xs)]',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 focus-visible:outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
