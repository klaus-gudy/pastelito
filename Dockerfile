# syntax=docker/dockerfile:1

# Three images come out of this file:
#   migrate      applies the Prisma migrations, then exits
#   migrate-cli  helper stage: the Prisma CLI copied into runner
#   runner       the app itself (the default target)
# See docker-compose.yml for how they fit together.

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# All dependencies, dev ones included: the build and the Prisma CLI need them.
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, which writes to lib/generated/prisma.
RUN npm ci

FROM deps AS migrate
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# Just the Prisma CLI and the migrations, at the versions in the lockfile, so
# the app image can apply migrations itself (e.g. as a Railway pre-deploy
# command) without carrying every dev dependency.
FROM deps AS migrate-cli
WORKDIR /migrate
RUN node -e ' \
      const v = (p) => require(`/app/node_modules/${p}/package.json`).version; \
      const deps = { prisma: v("prisma"), dotenv: v("dotenv") }; \
      const allowScripts = { [`prisma@${deps.prisma}`]: true, \
        [`@prisma/engines@${v("@prisma/engines")}`]: true }; \
      require("fs").writeFileSync("package.json", \
        JSON.stringify({ private: true, dependencies: deps, allowScripts }));' \
 && npm install --omit=dev --no-audit --no-fund \
 && cp /app/prisma.config.ts ./ && cp -r /app/prisma ./

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Inlined into the build, so it must be known here, not only at runtime.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3090
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_STANDALONE=1
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3090 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Apply migrations with:
#   node migrate/node_modules/prisma/build/index.js migrate deploy --config migrate/prisma.config.ts
COPY --from=migrate-cli --chown=node:node /migrate ./migrate
USER node
EXPOSE 3090
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3090/api/health || exit 1
CMD ["node", "server.js"]
