import Link from "next/link"

export type BarListRow = {
  key: string
  label: string
  /** Sets the bar's length relative to the largest row. */
  value: number
  /** The value as shown, e.g. "TZS 40,000". */
  display: string
  /** Smaller text after the label, e.g. revenue next to units sold. */
  detail?: string
  href?: string
}

/**
 * A ranked list where each row carries a slim bar sized against the largest
 * row. Names and values are written out, so nothing is cut off and no
 * tooltip is needed to read a value.
 */
export function BarList({
  rows,
  color,
}: {
  rows: BarListRow[]
  /** A CSS colour for the bars, e.g. "var(--chart-1)". */
  color: string
}) {
  const max = Math.max(...rows.map((row) => row.value), 1)

  return (
    <ul className="grid gap-4">
      {rows.map((row) => {
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-4 text-sm">
              <span className="min-w-0 font-medium break-words">
                {row.label}
                {row.detail && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {row.detail}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">{row.display}</span>
            </span>
            <span className="block h-2 rounded-full bg-muted">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max((row.value / max) * 100, 2)}%`,
                  backgroundColor: color,
                }}
              />
            </span>
          </>
        )
        return (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                className="grid gap-1.5 rounded-md outline-none hover:[&_.font-medium]:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {content}
              </Link>
            ) : (
              <div className="grid gap-1.5">{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
