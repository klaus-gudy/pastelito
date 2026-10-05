"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser, VERIFY_TO_SAVE } from "@/lib/current-user"
import { withDbErrors } from "@/lib/db-errors"
import { targetKeys } from "@/lib/health"
import { prisma } from "@/lib/prisma"
import { healthTargetsSchema } from "@/lib/validations/health"

export type HealthTargetsFormState =
  | {
      errors?: Partial<Record<string, string[]>>
      values?: Record<string, string>
      success?: boolean
      message?: string
    }
  | undefined

/** Saves the business's own health targets; a blank field restores the default. */
export async function updateHealthTargets(
  _state: HealthTargetsFormState,
  formData: FormData
): Promise<HealthTargetsFormState> {
  return withDbErrors<HealthTargetsFormState>(async () => {
    const user = await requireUser()
    const values = Object.fromEntries(
      targetKeys.map((key) => [key, String(formData.get(key) ?? "")])
    )

    const parsed = healthTargetsSchema.safeParse(values)
    if (!parsed.success) {
      return { errors: z.flattenError(parsed.error).fieldErrors, values }
    }
    if (!user.emailVerified) return { message: VERIFY_TO_SAVE, values }

    await prisma.healthTargets.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...parsed.data },
      update: parsed.data,
    })
    revalidatePath("/health")
    return { success: true, message: "Targets saved." }
  })
}
