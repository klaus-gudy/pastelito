import nodemailer from "nodemailer"

const from = process.env.EMAIL_FROM || "Pastelito <no-reply@pastelito.local>"

// EMAIL_SERVER is an SMTP URL, e.g. smtp://user:pass@smtp.example.com:587
const transport = process.env.EMAIL_SERVER
  ? nodemailer.createTransport(process.env.EMAIL_SERVER)
  : null

export const appUrl = (
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3090"
).replace(/\/$/, "")

type Email = { to: string; subject: string; text: string; html: string }

export async function sendEmail(email: Email) {
  if (transport) {
    await transport.sendMail({ from, ...email })
    return
  }

  if (process.env.NODE_ENV === "production") {
    console.error(`[email] EMAIL_SERVER is not set; "${email.subject}" not sent.`)
    return
  }

  // Without SMTP in development, print the email so its links still work.
  console.info(
    `\n[email] EMAIL_SERVER is not set. Would send to ${email.to}:\n` +
      `Subject: ${email.subject}\n\n${email.text}\n`
  )
}
