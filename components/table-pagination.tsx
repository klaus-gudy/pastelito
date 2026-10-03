import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { formatCount } from "@/lib/format"

type Props = {
  page: number
  pageSize: number
  total: number
  /** Other query params to keep, e.g. { q: "oud" }. */
  params?: Record<string, string>
}

/** Page numbers to show: first, last, and the current page's neighbours. */
function pageList(page: number, pageCount: number) {
  const pages = new Set([1, pageCount, page - 1, page, page + 1])
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b)
  return sorted.flatMap((p, i) =>
    i > 0 && p - sorted[i - 1] > 1 ? (["gap", p] as const) : [p]
  )
}

export function TablePagination({ page, pageSize, total, params = {} }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const href = (target: number) => {
    const search = new URLSearchParams(params)
    if (target > 1) search.set("page", String(target))
    const query = search.toString()
    return query ? `?${query}` : "?"
  }
  const disabled = "pointer-events-none opacity-50"

  return (
    <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
      <p>
        Showing {formatCount(from)}–{formatCount(to)} of {formatCount(total)}
      </p>
      {pageCount > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={href(page - 1)}
                aria-disabled={page === 1}
                className={page === 1 ? disabled : undefined}
              />
            </PaginationItem>
            {pageList(page, pageCount).map((item, i) =>
              item === "gap" ? (
                <PaginationItem key={`gap-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink href={href(item)} isActive={item === page}>
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                href={href(page + 1)}
                aria-disabled={page === pageCount}
                className={page === pageCount ? disabled : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
