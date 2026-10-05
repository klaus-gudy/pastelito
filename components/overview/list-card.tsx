import Link from "next/link"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type ListRow = {
  key: string
  label: string
  /** Smaller text under the label. */
  detail?: string
  value: string
  href?: string
}

/** A short ranked list, e.g. the top five customers who owe you. */
export function ListCard({
  title,
  description,
  rows,
  empty,
}: {
  title: string
  description: string
  rows: ListRow[]
  /** Shown when there are no rows. */
  empty: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((row) => {
              const label = (
                <span className="grid">
                  <span className="font-medium break-words">{row.label}</span>
                  {row.detail && (
                    <span className="text-xs text-muted-foreground">
                      {row.detail}
                    </span>
                  )}
                </span>
              )
              return (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="min-w-0 underline-offset-4 hover:underline"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span className="min-w-0">{label}</span>
                  )}
                  <span className="shrink-0 tabular-nums">{row.value}</span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
