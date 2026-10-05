import type { Metadata } from "next"
import { SearchX, Users } from "lucide-react"

import { AddCustomerDialog } from "@/components/customers/add-customer-dialog"
import {
  customerSortColumns,
  CustomersTable,
  type CustomerRow,
} from "@/components/customers/customers-table"
import { parseSort } from "@/components/sort-header"
import { TablePagination } from "@/components/table-pagination"
import { TableSearch } from "@/components/table-search"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { requireUser } from "@/lib/current-user"
import { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = { title: "Customers · Pastelito" }

const PAGE_SIZE = 10
const ZERO = new Prisma.Decimal(0)

/**
 * One page of customers ordered by how many completed sales they have.
 * Counts live on sales, so the ordering is worked out here; ties go by name.
 */
async function customersByPurchases(
  userId: string,
  where: Prisma.CustomerWhereInput,
  direction: "asc" | "desc",
  page: number
) {
  const all = await prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true },
  })
  const counts = await prisma.sale.groupBy({
    by: ["customerId"],
    where: {
      userId,
      status: "COMPLETED",
      customerId: { in: all.map((customer) => customer.id) },
    },
    _count: true,
  })
  const countOf = new Map(counts.map((row) => [row.customerId, row._count]))
  const sign = direction === "desc" ? -1 : 1
  // Sorting is stable, so equal counts keep their name order.
  const ids = [...all]
    .sort(
      (a, b) => sign * ((countOf.get(a.id) ?? 0) - (countOf.get(b.id) ?? 0))
    )
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .map((customer) => customer.id)

  const found = await prisma.customer.findMany({ where: { id: { in: ids } } })
  return ids.flatMap((id) => found.filter((customer) => customer.id === id))
}

export default async function CustomersPage({
  searchParams,
}: PageProps<"/customers">) {
  const user = await requireUser()
  const verified = Boolean(user.emailVerified)

  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : ""
  const requestedPage = Number(params.page)
  const sort = parseSort(params.sort, customerSortColumns)
  // Phone numbers are stored without spaces or dashes.
  const phoneQuery = q.replace(/[\s-]/g, "")

  const where: Prisma.CustomerWhereInput = {
    userId: user.id,
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(phoneQuery ? [{ phone: { contains: phoneQuery } }] : []),
      ],
    }),
  }

  const total = await prisma.customer.count({ where })
  if (!q && total === 0) {
    return (
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No customers yet</EmptyTitle>
          <EmptyDescription>
            Save the people you sell to, so you can see what they buy, who
            comes back and who still owes you.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <AddCustomerDialog verified={verified} />
        </EmptyContent>
      </Empty>
    )
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Number.isInteger(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1
  const customers = sort
    ? await customersByPurchases(user.id, where, sort.direction, page)
    : await prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      })

  // Completed sales for the customers on this page: what they bought, what
  // they still owe (total minus payments) and when they last bought.
  const sales = await prisma.sale.findMany({
    where: {
      userId: user.id,
      status: "COMPLETED",
      customerId: { in: customers.map((customer) => customer.id) },
    },
    select: {
      customerId: true,
      total: true,
      date: true,
      payments: { select: { amount: true } },
    },
  })

  const rows: CustomerRow[] = customers.map((customer) => {
    const own = sales.filter((sale) => sale.customerId === customer.id)
    const bought = own.reduce((sum, sale) => sum.add(sale.total), ZERO)
    const paid = own.reduce(
      (sum, sale) =>
        sale.payments.reduce((inner, p) => inner.add(p.amount), sum),
      ZERO
    )
    const lastPurchase = own.reduce<Date | null>(
      (latest, sale) => (!latest || sale.date > latest ? sale.date : latest),
      null
    )
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      purchases: own.length,
      owes: bought.sub(paid),
      lastPurchase,
    }
  })

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TableSearch
          defaultValue={q}
          placeholder="Search name, phone or email"
          label="Search customers"
        />
        <AddCustomerDialog verified={verified} />
      </div>

      {total === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>No matches</EmptyTitle>
            <EmptyDescription>
              No customers match &ldquo;{q}&rdquo;.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <CustomersTable
            customers={rows}
            sort={sort}
            q={q}
            verified={verified}
          />
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            params={{
              ...(q && { q }),
              ...(sort && { sort: `${sort.column}-${sort.direction}` }),
            }}
          />
        </>
      )}
    </div>
  )
}
