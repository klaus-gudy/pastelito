import Link from "next/link"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

export type SortDirection = "asc" | "desc"

/** "purchases-desc" -> { column: "purchases", direction: "desc" }. */
export function parseSort<C extends string>(
  value: unknown,
  columns: readonly C[]
): { column: C; direction: SortDirection } | null {
  if (typeof value !== "string") return null
  const [column, direction] = value.split("-")
  if (!columns.includes(column as C)) return null
  if (direction !== "asc" && direction !== "desc") return null
  return { column: column as C, direction }
}

/**
 * Column heading that sorts the table through the URL (?sort=column-dir).
 * Clicking cycles highest first, lowest first, then back to the default
 * order, and always returns to page 1.
 */
export function SortHeader({
  path,
  label,
  column,
  sort,
  params = {},
}: {
  /** The page being sorted, e.g. "/customers". */
  path: string
  label: string
  column: string
  sort: { column: string; direction: SortDirection } | null
  /** Other query params to keep, e.g. { q: "amina" }. */
  params?: Record<string, string>
}) {
  const active = sort?.column === column ? sort.direction : null
  const next = active === null ? "desc" : active === "desc" ? "asc" : null
  const search = new URLSearchParams(params)
  if (next) search.set("sort", `${column}-${next}`)
  const Icon =
    active === "desc" ? ArrowDown : active === "asc" ? ArrowUp : ArrowUpDown

  return (
    <Link
      href={search.size ? `${path}?${search}` : path}
      scroll={false}
      className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
      aria-label={
        next === "desc"
          ? `Sort by ${label.toLowerCase()}, highest first`
          : next === "asc"
            ? `Sort by ${label.toLowerCase()}, lowest first`
            : `Stop sorting by ${label.toLowerCase()}`
      }
    >
      {label}
      <Icon
        className={active ? "size-3.5" : "size-3.5 text-muted-foreground/60"}
      />
    </Link>
  )
}
