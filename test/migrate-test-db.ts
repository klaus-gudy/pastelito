import { execFileSync } from "node:child_process"

// Brings the test database's schema up to date before the database tests run.
// Each test signs up its own user, and every ledger query is scoped to a user,
// so tests don't need an empty database and never see each other's rows.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? ""
  const name = new URL(url).pathname.slice(1)
  // A guard against pointing the tests at real data by mistake.
  if (!name.includes("test")) {
    throw new Error(
      `TEST_DATABASE_URL must name a database with "test" in it, got "${name}".`
    )
  }
  execFileSync("node_modules/.bin/prisma", ["migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: ["ignore", "ignore", "inherit"],
  })
}
