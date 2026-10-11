import { describe, expect, it } from "vitest"

import { emailVerificationRequired, isVerified } from "./email-verification"

const unverified = { emailVerified: null }
const verified = { emailVerified: new Date("2026-10-01") }

describe("emailVerificationRequired", () => {
  it("is on unless switched off", () => {
    expect(emailVerificationRequired({})).toBe(true)
    expect(emailVerificationRequired({ EMAIL_VERIFICATION: "on" })).toBe(true)
    expect(emailVerificationRequired({ EMAIL_VERIFICATION: "" })).toBe(true)
  })

  it("accepts off in any case and with spaces", () => {
    expect(emailVerificationRequired({ EMAIL_VERIFICATION: "off" })).toBe(false)
    expect(emailVerificationRequired({ EMAIL_VERIFICATION: " OFF " })).toBe(false)
  })
})

describe("isVerified", () => {
  it("follows the stored flag while verification is on", () => {
    expect(isVerified(unverified, {})).toBe(false)
    expect(isVerified(verified, {})).toBe(true)
  })

  it("lets everyone through while verification is off", () => {
    const off = { EMAIL_VERIFICATION: "off" }
    expect(isVerified(unverified, off)).toBe(true)
    expect(isVerified(verified, off)).toBe(true)
  })
})
