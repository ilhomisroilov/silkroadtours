# syntax=docker/dockerfile:1.7
# Gulistan Travel — production image (works on amd64 and arm64, e.g. Oracle Cloud Ampere A1).
#   docker compose build && docker compose up -d

ARG NODE_IMAGE=node:22-bookworm-slim

# ── 1. dependencies ─────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── 2. build ────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SITE_URL=https://gulistantravel.uz
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ARG NEXT_PUBLIC_UZ_ALPHABET=new
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_UZ_ALPHABET=$NEXT_PUBLIC_UZ_ALPHABET
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsx scripts/build-seed-sql.ts && npx next build

# ── 3. database driver with its native binary for this platform ────────────
FROM ${NODE_IMAGE} AS dbdriver
WORKDIR /drv
COPY package.json ./
RUN node -e "const p=require('./package.json');require('fs').writeFileSync('package.json',JSON.stringify({name:'drv',private:true,dependencies:{'@libsql/client':p.dependencies['@libsql/client']}}))" \
 && npm install --omit=dev --no-audit --no-fund

# ── 4. runtime ──────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/silkroad.db
RUN groupadd --system app && useradd --system --gid app --home /app app \
 && mkdir -p /data && chown app:app /data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=dbdriver --chown=app:app /drv/node_modules ./node_modules
COPY --from=build --chown=app:app /app/drizzle/migrations ./drizzle/migrations
COPY --from=build --chown=app:app /app/drizzle/seed.sql /app/drizzle/seed-reset.sql ./drizzle/
COPY --chown=app:app scripts/db.mjs ./scripts/db.mjs
COPY --chown=app:app scripts/ai-eval.mjs ./scripts/ai-eval.mjs
COPY --chown=app:app docker/entrypoint.sh /entrypoint.sh
USER app
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]
