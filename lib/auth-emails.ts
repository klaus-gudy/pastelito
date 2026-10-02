import { appUrl, sendEmail } from "@/lib/email"
import { issueToken } from "@/lib/tokens"

/** Returns false if an email was sent too recently to send another. */
export async function sendVerificationEmail(email: string) {
  const token = await issueToken("verify-email", email)
  if (!token) return false

  const link = `${appUrl}/verify-email?token=${token}`
  await sendEmail({
    to: email,
    subject: "Verify your Pastelito email",
    text: `Confirm this is your email address by opening the link below. It expires in 24 hours.\n\n${link}\n\nIf you didn't create a Pastelito account, you can ignore this email.`,
    html: `<p>Confirm this is your email address. The link expires in 24 hours.</p><p><a href="${link}">Verify my email</a></p><p>If you didn't create a Pastelito account, you can ignore this email.</p>`,
  })
  return true
}

/** Returns false if an email was sent too recently to send another. */
export async function sendPasswordResetEmail(email: string) {
  const token = await issueToken("reset-password", email)
  if (!token) return false

  const link = `${appUrl}/reset-password?token=${token}`
  await sendEmail({
    to: email,
    subject: "Reset your Pastelito password",
    text: `Choose a new password by opening the link below. It expires in 1 hour.\n\n${link}\n\nIf you didn't ask to reset your password, you can ignore this email.`,
    html: `<p>Choose a new password. The link expires in 1 hour.</p><p><a href="${link}">Reset my password</a></p><p>If you didn't ask to reset your password, you can ignore this email.</p>`,
  })
  return true
}
