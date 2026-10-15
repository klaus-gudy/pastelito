import { describe, expect, it } from "vitest"

import { slugCandidates, slugify } from "@/lib/order-slug"

describe("slugify", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugify("Pastelito Perfumes")).toBe("pastelito-perfumes")
  })

  it("drops accents and apostrophes", () => {
    expect(slugify("Graça's Shop")).toBe("gracas-shop")
  })

  it("trims stray dashes and long names", () => {
    expect(slugify("  --Hello!!  ")).toBe("hello")
    expect(slugify("a".repeat(40))).toHaveLength(24)
    expect(slugify("abcdefghijklmnopqrstuvw xyz")).toBe("abcdefghijklmnopqrstuvw")
  })

  it("is empty when nothing usable is left", () => {
    expect(slugify("★★★")).toBe("")
  })
})

describe("slugCandidates", () => {
  it("numbers repeats of the name", () => {
    expect(slugCandidates("Graca", 3)).toEqual(["graca", "graca-2", "graca-3"])
  })

  it("falls back to shop without a name", () => {
    expect(slugCandidates(null, 2)).toEqual(["shop", "shop-2"])
  })
})
