# syntax=docker/dockerfile:1

# Three images come out of this file:
#   migrate  applies the Prisma migrations, then exits
#   runner   the app itself (the default target)
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
USER node
EXPOSE 3090
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3090/sign-in || exit 1
CMD ["node", "server.js"]
