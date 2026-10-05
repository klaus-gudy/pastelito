import type { Metadata } from "next"
import { SearchX, Users } from "lucide-react"

import { AddCustomerDialog } from "@/components/customers/add-customer-dialog"
import {
  CustomersTable,
  type CustomerRow,
} from "@/components/customers/customers-table"
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

export default async function CustomersPage({
  searchParams,
}: PageProps<"/customers">) {
  const user = await requireUser()
  const verified = Boolean(user.emailVerified)

  const params = await searchParams
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : ""
  const requestedPage = Number(params.page)
  // Phone numbers are stored without spaces or dashes.
  const phoneQuery = q.replace(/[\s-]/g, "")

  const where: Prisma.CustomerWhereInput = {
    userId: user.id,
    deletedAt: null,
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
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  // Completed sales for the customers on this page: what they still owe
  // (total minus payments).
  const sales = await prisma.sale.findMany({
    where: {
      userId: user.id,
      status: "COMPLETED",
      customerId: { in: customers.map((customer) => customer.id) },
    },
    select: {
      customerId: true,
      total: true,
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
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      owes: bought.sub(paid),
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
          <CustomersTable customers={rows} />
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            params={q ? { q } : undefined}
          />
        </>
      )}
    </div>
  )
}
