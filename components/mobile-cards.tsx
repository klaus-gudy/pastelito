import type * as React from "react"
import { cn } from "cn"

/**
 * Below the md breakpoint a table gives way to a stack of cards, one per row.
 * Pair it with the table wrapped in `hidden md:block`.
 */
export function MobileCards({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return <ul className={cn("grid gap-3 md:hidden", className)} {...props} />
}

export function MobileCard({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("grid gap-3 rounded-lg border p-4 text-sm", className)}
      {...props}
    />
  )
}

/** The row's name on the left, its headline figure or status on the right. */
export function MobileCardHeader({
  title,
  description,
  aside,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid min-w-0 gap-0.5">
        <div className="font-medium">{title}</div>
        {description && (
          <div className="text-muted-foreground">{description}</div>
        )}
      </div>
      {aside && <div className="shrink-0 text-right">{aside}</div>}
    </div>
  )
}

export function MobileCardFields({
  className,
  ...props
}: React.ComponentProps<"dl">) {
  return (
    <dl
      className={cn("grid grid-cols-2 gap-x-4 gap-y-2", className)}
      {...props}
    />
  )
}

export function MobileCardField({
  label,
  className,
  children,
}: {
  label: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid min-w-0 gap-0.5", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

export function MobileCardActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap justify-end gap-2 border-t pt-3",
        className
      )}
      {...props}
    />
  )
}
