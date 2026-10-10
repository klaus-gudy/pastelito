import { describe, expect, it } from "vitest"

import { generateSku } from "@/lib/sku"

describe("generateSku", () => {
  it("joins the upper-cased name and the size", () => {
    expect(generateSku("Pastelito large", 100)).toBe("PASTELITO-LARGE-100ML")
  })

  it("drops accents and collapses symbols into single dashes", () => {
    expect(generateSku("  Crème  brûlée & co. ", 50)).toBe("CREME-BRULEE-CO-50ML")
  })

  it("falls back to PRODUCT when nothing usable is left", () => {
    expect(generateSku("***", 30)).toBe("PRODUCT-30ML")
  })
})
