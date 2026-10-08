# Imagen de DTD Cargo para el servidor propio (SDD-0505 · Fase 0).
#
# Tres etapas sobre la misma base para que el runner no arrastre ni pnpm ni
# los node_modules completos (~1,6 GB): `next build` con `output: "standalone"`
# traza lo que de verdad importa el servidor y lo deja en `.next/standalone`.
#
#   deps   → instala dependencias desde el lockfile (capa cacheable).
#   build  → compila con DTD_STANDALONE=1; recibe las NEXT_PUBLIC_* por build arg.
#   runner → node:24 slim, usuario `node`, solo el bundle standalone + estáticos.
#
# Las etiquetas van fijas (nunca `latest`): la misma imagen construida dos veces
# tiene que dar el mismo Node. Para subir de versión se cambia NODE_IMAGE acá y
# en `.github/workflows/build-image.yml` no hace falta tocar nada.
#
# Uso local:
#   docker build -t dtdcargo:local \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://supabase.dtdcargo.com \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon> .
#   (el resto de NEXT_PUBLIC_* es opcional: ver ARG más abajo)
ARG NODE_IMAGE=node:24.21.0-bookworm-slim

# ─── deps ───────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# pnpm fijado a la misma versión que CI (`quality.yml`): el lockfile se resolvió
# con pnpm 11 y otra major podría reinterpretarlo. Corepack viene con Node 24;
# `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` evita el prompt interactivo de descarga.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

# Solo los manifiestos: si no cambian, esta capa (la más lenta) se reutiliza.
# `pnpm-workspace.yaml` trae `allowBuilds` y los `overrides`; `.npmrc`, los
# flags de instalación. Sin ellos pnpm instalaría otra cosa que en local.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ─── build ──────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Las NEXT_PUBLIC_* se inlinean en el bundle del navegador durante `next build`:
# cambiarlas exige reconstruir la imagen, no reiniciarla (riesgo declarado en la
# spec). Mismos nombres que `.env.example` y que `build-image.yml`. Todo lo que
# entra por acá queda legible dentro de la imagen: nunca un secreto.
ARG NEXT_PUBLIC_BUG_REPLAY_ENABLED
ARG NEXT_PUBLIC_BUILD_SHA
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_HAILUWAY_API
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_WHATSAPP_NUMBER
ENV NEXT_PUBLIC_BUG_REPLAY_ENABLED=${NEXT_PUBLIC_BUG_REPLAY_ENABLED} \
    NEXT_PUBLIC_BUILD_SHA=${NEXT_PUBLIC_BUILD_SHA} \
    NEXT_PUBLIC_CONTACT_EMAIL=${NEXT_PUBLIC_CONTACT_EMAIL} \
    NEXT_PUBLIC_GA_ID=${NEXT_PUBLIC_GA_ID} \
    NEXT_PUBLIC_HAILUWAY_API=${NEXT_PUBLIC_HAILUWAY_API} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=${NEXT_PUBLIC_TELEGRAM_BOT_USERNAME} \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY} \
    NEXT_PUBLIC_WHATSAPP_NUMBER=${NEXT_PUBLIC_WHATSAPP_NUMBER}

# DTD_STANDALONE=1 es lo único que activa `output: "standalone"` en
# `next.config.ts`; Vercel y el gate local no lo definen y conservan su salida.
# El heap explícito es el mismo que usa CI: el build de este repo agota los
# ~2 GiB implícitos de Node (exit 134) en máquinas con poca RAM.
ENV DTD_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=4096

# `next build` a secas, sin el `postbuild` de package.json: ese paso hornea el
# Norte (`scripts/norte.mjs`) leyendo docs/design y docs/specs, material
# interno que no viaja en la imagen (ver .dockerignore). Lo único que pierde el
# contenedor es el snapshot `/norte.html` de la pestaña Norte de /studio/debug.
RUN pnpm exec next build

# ─── runner ─────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# El bundle standalone ya trae `server.js` y un `node_modules` trazado (incluye
# `sharp` para next/image y lo que declara `outputFileTracingIncludes`:
# public/brand, private/marca/herramientas, docs/marketing/*.md). `public/` y
# `.next/static` NO los incluye el tracer: se copian aparte. `--chown=node`
# porque el proceso corre sin root y Next escribe su caché en `.next/cache`.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# `/robots.txt` (app/robots.ts) responde sin sesión, sin tocar Supabase y sin
# renderizar la home: un 200 ahí dice "Next arrancó y sirve" sin costar un
# render por sonda. No se usa `/api/debug/health`: exige `DEBUG_HEALTH_SECRET` y
# responde 503/401 a propósito sin él (spec 0505 § Seguimiento). `start-period`
# de 40 s porque el arranque compila rutas dinámicas.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
