"use server"

import { revalidatePath } from "next/cache"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { withDbErrors } from "@/lib/db-errors"
import { formatCount } from "@/lib/format"
import { LedgerError, undoStockAdjustment } from "@/lib/ledger"

// Stock shows on products, and decides which preorders can go out.
function revalidateStock() {
  revalidatePath("/products")
  revalidatePath("/preorders")
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
