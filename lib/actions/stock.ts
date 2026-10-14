"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { withDbErrors } from "@/lib/db-errors"
import { formatCount } from "@/lib/format"
import { adjustStock, LedgerError, undoStockAdjustment } from "@/lib/ledger"
import { prisma } from "@/lib/prisma"
import { stockAdjustmentSchema } from "@/lib/validations/stock-adjustment"

export type StockAdjustmentFormState =
  | {
      errors?: Partial<Record<string, string[]>>
      values?: Record<string, string>
      success?: boolean
      message?: string
    }
  | undefined

const fields = ["productId", "direction", "quantity", "reason", "note"] as const

const units = (count: number) =>
  `${formatCount(count)} ${count === 1 ? "unit" : "units"}`

// Stock shows on products, and decides which preorders can go out.
function revalidateStock() {
  revalidatePath("/products")
  revalidatePath("/preorders")
}

export async function recordStockAdjustment(
  _state: StockAdjustmentFormState,
  formData: FormData
): Promise<StockAdjustmentFormState> {
  return withDbErrors<StockAdjustmentFormState>(async () => {
    const user = await requireUser()
    const values = Object.fromEntries(
      fields.map((field) => [field, String(formData.get(field) ?? "")])
    )

    const parsed = stockAdjustmentSchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }
    if (!user.verified) return { message: VERIFY_TO_SAVE, values }

    const { productId, direction, quantity, reason, note } = parsed.data
    try {
      await adjustStock(user.id, {
        productId,
        quantity: direction === "out" ? -quantity : quantity,
        reason,
        note,
      })
    } catch (error) {
      if (error instanceof LedgerError) {
        return { errors: { quantity: [error.message] }, values }
      }
      throw error
    }

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { name: true, sizeMl: true, quantityOnHand: true },
    })
    revalidateStock()
    return {
      success: true,
      message: `${units(quantity)} ${direction === "out" ? "taken out of" : "added to"} ${product.name} ${product.sizeMl} ml. ${formatCount(product.quantityOnHand)} in stock now.`,
    }
  })
}

export type UndoStockAdjustmentResult = { success?: boolean; message: string }

export async function deleteStockAdjustment(
  id: string
): Promise<UndoStockAdjustmentResult> {
  return withDbErrors<UndoStockAdjustmentResult>(async () => {
    const user = await requireUser()
    if (!user.verified) return { message: VERIFY_TO_SAVE }

    let movement
    try {
      movement = await undoStockAdjustment(user.id, id)
    } catch (error) {
      if (error instanceof LedgerError) return { message: error.message }
      throw error
    }

    revalidateStock()
    return {
      success: true,
      message: `Adjustment undone. ${movement.product.name} ${movement.product.sizeMl} ml is back to ${formatCount(movement.product.quantityOnHand - movement.quantity)} in stock.`,
    }
  })
}
