import type { EditableExpense } from "@/components/expenses/expense-dialog"
import { ExpenseRowActions } from "@/components/expenses/expense-row-actions"
import {
  MobileCard,
  MobileCardActions,
  MobileCardHeader,
  MobileCards,
} from "@/components/mobile-cards"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { dayOf, formatDate } from "@/lib/dates"
import type { Expense } from "@/lib/generated/prisma/client"
import { formatMoney } from "@/lib/format"
import { expenseCategoryLabel, paymentMethodLabels } from "@/lib/labels"

export function ExpensesTable({
  expenses,
  verified,
  today,
}: {
  expenses: Expense[]
  verified: boolean
  today: string
}) {
  const actions = (expense: Expense) => {
    const editable: EditableExpense = {
      id: expense.id,
      category: expense.category,
      // Amounts are whole shillings; the form wants plain digits.
      amount: expense.amount.toFixed(0),
      method: expense.method,
      date: dayOf(expense.date),
      description: expense.description ?? "",
    }
    return (
      <ExpenseRowActions
        expense={editable}
        verified={verified}
        today={today}
        what={`${expenseCategoryLabel(expense.category).toLowerCase()} expense of ${formatMoney(expense.amount)}`}
      />
    )
  }

  return (
    <>
      <div className="hidden rounded-lg border @4xl/main:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid by</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="pl-4">{formatDate(expense.date)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {expenseCategoryLabel(expense.category)}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatMoney(expense.amount)}
                </TableCell>
                <TableCell>{paymentMethodLabels[expense.method]}</TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {expense.description ?? "—"}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">{actions(expense)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <MobileCards>
        {expenses.map((expense) => (
          <MobileCard key={expense.id}>
            <MobileCardHeader
              title={expenseCategoryLabel(expense.category)}
              description={`${formatDate(expense.date)} · ${paymentMethodLabels[expense.method]}`}
              aside={
                <span className="font-medium tabular-nums">
                  {formatMoney(expense.amount)}
                </span>
              }
            />
            {expense.description && (
              <p className="truncate text-muted-foreground">
                {expense.description}
              </p>
            )}
            <MobileCardActions>{actions(expense)}</MobileCardActions>
          </MobileCard>
        ))}
      </MobileCards>
    </>
  )
}
