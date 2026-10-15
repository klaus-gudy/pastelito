import { describe, expect, it } from "vitest"

import { generateOrderCode, normalizeOrderCode } from "@/lib/order-slug"

describe("generateOrderCode", () => {
  it("is three letters then three digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateOrderCode()).toMatch(/^[A-Z]{3}\d{3}$/)
    }
  })

  it("never uses I or O", () => {
    const codes = Array.from({ length: 500 }, generateOrderCode).join("")
    expect(codes).not.toMatch(/[IO]/)
  })
})

describe("normalizeOrderCode", () => {
  it("uppercases and trims", () => {
    expect(normalizeOrderCode(" mkh975 ")).toBe("MKH975")
  })
})
