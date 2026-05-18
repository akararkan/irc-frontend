import * as React from 'react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { cva } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

function SheetOverlay({ className, ...props }) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in',
        className,
      )}
      {...props}
    />
  )
}

// The cubic-bezier here is the Apple "ease" curve — decelerates as the
// drawer settles, which reads as "physical" rather than mechanical.
// Open is slightly longer than close so the entrance feels deliberate
// while the dismissal stays snappy.
const sheetVariants = cva(
  'fixed z-50 gap-4 bg-background p-6 shadow-2xl transition ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:duration-[250ms] data-[state=open]:duration-[400ms] data-[state=closed]:animate-out data-[state=open]:animate-in',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-80 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        right:
          'inset-y-0 right-0 h-full w-80 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
      },
    },
    defaultVariants: { side: 'right' },
  },
)

function SheetContent({ side = 'right', className, children, showClose = true, ...props }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {showClose ? (
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-md text-muted-foreground transition-colors hover:text-foreground">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
}

function SheetFooter({ className, ...props }) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }) {
  return (
    <SheetPrimitive.Title
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }) {
  return (
    <SheetPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
