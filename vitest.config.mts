import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Two kinds of tests:
//   unit  *.test.ts     pure functions, no database
//   db    *.db.test.ts  the ledger against a real Postgres database, run only
//                       when TEST_DATABASE_URL points at a disposable one
const testDatabaseUrl = process.env.TEST_DATABASE_URL

if (!testDatabaseUrl) {
  console.warn(
    "TEST_DATABASE_URL is not set: skipping database tests (*.db.test.ts)."
  )
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["lib/**/*.test.ts"],
          exclude: ["lib/**/*.db.test.ts"],
        },
      },
      ...(testDatabaseUrl
        ? [
            {
              extends: true,
              test: {
                name: "db",
                include: ["lib/**/*.db.test.ts"],
                env: { DATABASE_URL: testDatabaseUrl },
                globalSetup: ["test/migrate-test-db.ts"],
                // Serializable transactions from parallel files would abort
                // each other more often than the ledger's retries allow for.
                fileParallelism: false,
                testTimeout: 20_000,
              },
            },
          ]
        : []),
    ],
  },
})
