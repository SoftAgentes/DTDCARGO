# Handoff · SDD-0505 — Dockerizar DTD Cargo para el servidor propio en Contabo (Fase 0)

- **Owner:** Claude Worker (sesión `claude-76245a75`), por encargo directo de Sam el 2026-10-08.
- **Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\dockerizar-dtd-cargo-contabo`
- **Rama:** `codex/dockerizar-dtd-cargo-contabo` (desde `origin/main` = `c3d37a8e`), reserva `codex/sdd-reserve-0505-dockerizar-dtd-cargo-contabo` (`1f9ea0d9`, local, sin push).
- **Claim:** `node scripts/harness-worktree.mjs claim --owner claude-76245a75` adquirido el 2026-10-08.
- **Objetivo:** Fase 0 del plan de transferencia a Contabo: imagen Docker de la app, compose de Supabase self-hosted, cierre de acoplamientos a Vercel y Supabase Cloud, plantilla multi-proyecto, CI de imagen, runbooks de servidor y backup. Sin tocar producción.
- **SDD:** `docs/specs/0505-dockerizar-dtd-cargo-contabo/spec.md` (aceptación y allowlist ahí; § Seguimiento con la evidencia fechada).
- **Permisos:** Sam aprobó el plan completo (ventana de planificación, 2026-10-08), incluida la PR al final. No autoriza aplicar la migración 0472 a producción, ni exportar producción, ni cambiar DNS, ni pausar Vercel/Cloud.
- **Dependencias:** Docker Desktop para `check-schema-rebuild`/`sql-tests`/build local; turno del Director para `pnpm verify` completo (una corrida pesada a la vez).
- **Construcción en paralelo:** varias áreas (infra, código, migración, CI, docs) escriben en este mismo worktree sobre archivos asignados sin solapamiento. Este handoff lo mantiene el área docs; cada casilla de «Estado» se marca **solo** cuando el archivo existe en el worktree y su prueba focalizada reporta PASÓ con conteo, y se anota quién lo midió.

## Estado consolidado (Worker, 2026-10-08, después de que la construcción en paralelo se cortara por errores de red y se retomara a mano)

- [x] **Infra:** `Dockerfile`, `.dockerignore`, `infra/dtd-cargo/` (compose, Supabase self-hosted, overlay S3, cron, plantillas de Auth, `.env.example`, README), `infra/templates/proyecto/`, `infra/ops/` (Traefik, Uptime Kuma, backup). Evidencia abajo.
- [x] **Código:** `lib/runtime/*`, `deployActions`, `env-status`, `sender`, `unsubscribe-request`, `request-ip`, `next.config.ts`, con sus pruebas. Evidencia abajo.
- [x] **Migración 0472 + pruebas SQL/PGlite**, con la espera declarada en `pendingBelowCutoff` (MIGRATE-FIRST). Evidencia abajo.
- [x] **CI build-image** (`.github/workflows/build-image.yml`). No se ejecutó en GitHub: corre en push a `main` o con `workflow_dispatch`.
- [x] **Docs:** runbooks, `setup-portal-auth`, `.env.example`, índices.
- [ ] **Validación:** todo lo focalizado PASÓ (tabla de abajo). **NO EJECUTADO:** `pnpm verify` completo (pide turno del Director: una corrida pesada a la vez). **FALLÓ, pendiente de decisión:** rebuild sobre `supabase/postgres:17.6.1.136` (aceptación 2b).
- [ ] **Commits + PR:** commits selectivos hechos (`f82554b1`, `1ec7c377`, `ef955fc2`, `5dfe4a3b` + el de la migración y este handoff). PR: draft, porque falta `verify` completo y la decisión 2b.

## Evidencia consolidada · Worker (2026-10-08, sobre el árbol completo antes de los commits)

| Comprobación | Comando | Resultado literal |
|---|---|---|
| Lint | `corepack pnpm lint` | PASÓ · exit 0 · 0 errores, 15 warnings, todos en archivos que esta tarea no toca |
| Tipos | `NODE_OPTIONS=--max-old-space-size=4096 corepack pnpm typecheck` | PASÓ · exit 0 |
| Frontera RSC | `node scripts/check-rsc-boundary.mjs` | PASÓ · exit 0 |
| Índice de docs | `corepack pnpm docs:check` | PASÓ · exit 0 |
| Numeración | `corepack pnpm sdd:check` | PASÓ · exit 0 · sin números repetidos |
| Símbolos pendientes | `node scripts/check-pending-migration-symbols.mjs` | PASÓ · 0 ROJO · 0 AMARILLO (la 0472 no crea símbolos y la app no llama a esas funciones) |
| Espacios | `git diff --check` | PASÓ · exit 0 |
| Pruebas focalizadas | `vitest run lib/runtime lib/http lib/studio/newsletter lib/studio/attachments "app/studio/(app)/_actions" scripts/__tests__/build-crontab.test.ts scripts/__tests__/infra-env-example.test.ts lib/studio/__tests__/kommo-functions-base-url.migration.test.ts --pool=forks` | PASÓ · 22 archivos · 222 pruebas |
| 0472 en PGlite | `vitest run lib/studio/__tests__/kommo-functions-base-url.migration.test.ts --pool=forks --maxWorkers=1` | PASÓ · 12/12 (control rojo, mutantes y comparación línea a línea con 0084/0136) |
| Crontab | `node scripts/build-crontab.mjs --check` | PASÓ · exit 0 |
| Compose DTD | `docker compose -f infra/dtd-cargo/compose.yml -f …compose.supabase.yml -f …compose.supabase.s3.yml --env-file <copia de .env.example> config` | PASÓ · exit 0 · 11 servicios + Studio por profile · ningún `ports:` ni `container_name` · red de la base `internal: true` · límites de memoria ≈9,5 GB |
| Compose plantilla | `docker compose -f infra/templates/proyecto/compose.yml --env-file <.env.example con valores de prueba> config` | PASÓ · 9 servicios (Supabase recortado + web + cron) · sin puertos · red interna. Con el `.env.example` vacío FALLA a propósito: exige `CRON_SECRET` |
| Compose ops | `docker compose config` en `infra/ops/traefik` e `infra/ops/uptime-kuma` | PASÓ · exit 0 |
| Scripts | `bash -n` de `infra/ops/backup/*.sh`, `infra/templates/proyecto/backup.sh`, `infra/dtd-cargo/cron/entrypoint.sh` | PASÓ |
| Imagen | `docker build -t dtdcargo:0505-test --build-arg NEXT_PUBLIC_SUPABASE_URL=https://api.example.test …` | PASÓ · 138 s (deps en caché; `next build` completo: 162 páginas) · 518 MB descomprimida (127 MB de contenido) · usuario `node` |
| Arranque de la imagen | `docker run … dtdcargo:0505-test` + `curl` | PASÓ · `/robots.txt` 200 a los ~2 s · `/` 200 · `/tarifas` 200 · `/entrar` 200 · `/studio` 307 → `/studio/login` · CSP, `X-Frame-Options: DENY` y HSTS presentes · healthcheck `healthy` |
| CSP con origen propio | encabezado de la imagen construida con `NEXT_PUBLIC_SUPABASE_URL=https://api.example.test` | PASÓ · `img-src`/`media-src` con `https://api.example.test`; `connect-src` con `https://` y `wss://api.example.test`; `*.supabase.co` se conserva |
| Rebuild sobre `postgres:17` | `node scripts/check-schema-rebuild.mjs` | PASÓ · 30 s · 450 migraciones aplicadas desde cero + 18 sólo-ledger = 468 (0472 incluida) |
| Contratos SQL | `node scripts/run-sql-tests.mjs` | PASÓ · 86 s · 225 contratos, `0472_kommo_functions_base_url.test.sql` incluido · rollback total |
| Rebuild sobre `supabase/postgres:17.6.1.136` | `SQL_TEST_PG_IMAGE=supabase/postgres:17.6.1.136 node scripts/check-schema-rebuild.mjs` | FALLÓ · repetido por el Worker, 6 s · se cae en `_supabase-platform-stubs.sql:43` (`permission denied for schema auth`) **antes de la primera migración**: los stubs de `postgres:17` crean `auth.users`, que en la imagen ya es de `supabase_admin`. Con los stubs reducidos (no cableados) el corte está en el guardarraíl de la 0268 (DELETE de `anon`/`authenticated` por default privileges de la imagen). La atribución anterior a «0038, 0268, 0410 y 0453» era incorrecta |
| `pnpm verify` completo | — | NO EJECUTADO · requiere turno del Director |

**Recomendación del Worker para 2b:** cablear los stubs reducidos (`_supabase-platform-stubs.supabase.sql`) en el script cuando la imagen es `supabase/postgres` y resolver el guardarraíl de la 0268 con una migración aditiva que haga explícitos los `revoke` que hoy solo viven en el ledger (0279/0286-0288); así la base reconstruida desde migraciones queda igual de cerrada que producción. Mientras tanto, la base del servidor se llena **solo** desde el dump de producción, y `servidor-contabo.md` §2.2 exige comprobar que `anon`/`authenticated` no tengan DELETE en `public.tenants` después del restore.

## Evidencia · área docs (2026-10-08, pasada de corrección)

| Comprobación | Comando | Resultado literal |
|---|---|---|
| Índice de specs regenerado | `corepack pnpm docs:index` | PASÓ · «índice regenerado en docs\specs\README.md — 490 specs, 15 huecos» · diff: fila `0505 … in-progress · interno`, conteo 489→490, `0504` añadido a huecos |
| Índice sincronizado | `corepack pnpm docs:check` | PASÓ · exit 0 · «docs:check — índice sincronizado con 490 specs» (antes de la pasada: FALLÓ exit 1, «índice desactualizado») |
| Numeración SDD/migraciones | `corepack pnpm sdd:check` | PASÓ · exit 0 · «490 specs · 468 migraciones» · «numbering: sin números repetidos» (los 11 ⏸ son choques históricos ya aplicados, no se renumeran) |
| Voseo en lo nuevo | `grep -nE '\b(vos|tenés|andá|revisá|poné|hacé|mirá|copiá|completá|dejá|pegá|…)\b'` sobre los dos runbooks nuevos, la sección Self-hosted y el bloque nuevo de `.env.example` | PASÓ · 0 coincidencias |
| «VDS» en los runbooks nuevos | `grep -n VDS docs/runbooks/servidor-contabo.md docs/runbooks/backup-restore-servidor.md` | PASÓ · 1 coincidencia, la frase que dice «No es un VDS» (servidor-contabo.md:33) |
| Secretos o valores reales | `grep -rn 'sbp_\|eyJhbGci'` sobre los cinco archivos tocados | PASÓ · 0 coincidencias fuera de la frase de la aceptación 6 que nombra el patrón |
| Espacios colgantes | `git diff --check` (árbol completo) y `grep -nE '[[:space:]]+$'` sobre los archivos nuevos del área | PASÓ · exit 0 · 0 coincidencias |
| Pruebas Vitest del área | — | NO APLICA · el área docs no tiene pruebas Vitest; `scripts/build-docs-index.mjs --check` es su gate |
| `pnpm verify` completo | — | NO EJECUTADO · requiere turno del Director (una corrida pesada a la vez) |

Archivos de esta pasada (área docs):

- Nuevos: `docs/runbooks/servidor-contabo.md` (Fases 1-4: reinstalación con llave, benchmark del día 1 con umbrales numéricos, reputación de la IP `217.216.54.70`, hardening, Tailscale, Dokploy/Traefik/Cloudflare, snapshots como conveniencia, `REQUEST_IP_HEADER` con la prueba `curl -H`, estructura `/srv`, staging con copia de producción, corte y rollback limpio/sucio, retiro), `docs/runbooks/backup-restore-servidor.md` (dump diario + `age` + `rclone` fuera de Contabo, latido en Uptime Kuma, restore mensual obligatorio en staging con conteos y RTO, secretos irreemplazables, copia semanal de Storage a otro proveedor, snapshot ≠ backup, pgBackRest pendiente con decisión antes del corte).
- Modificados: `docs/runbooks/setup-portal-auth.md` (sección «Self-hosted (SDD-0505)» con la tabla dashboard → compose → `GOTRUE_*`, qué necesita el camino `token_hash` y qué el plan B PKCE, prueba de humo en otro navegador), `.env.example` raíz (bloque «Runtime fuera de Vercel (SDD-0505)» con `APP_ENV`, `APP_URL`, `REQUEST_IP_HEADER` y la nota de que `DTD_STANDALONE=1` es solo de build), `docs/specs/0505-dockerizar-dtd-cargo-contabo/spec.md` (HEALTHCHECK fijado a `GET /robots.txt`; criterio de aceptación 2 reescrito con la evidencia medida y las dos opciones de cierre para el Director; § Seguimiento nuevo), `docs/specs/README.md` (regenerado, no editado a mano), este handoff.

## Evidencia reportada por el revisor de infra (`infra-dtd`), fase de verificación del 2026-10-08

Literales tal como los entregó el revisor; **el área docs no los reprodujo** (Docker y corridas pesadas piden turno) y los registra para que la spec y este handoff no afirmen más de lo medido:

| Comprobación | Resultado |
|---|---|
| `docker compose -f infra/dtd-cargo/compose.yml -f infra/dtd-cargo/compose.supabase.yml config` | NO EJECUTADO · archivos de compose ausentes en el worktree |
| `SQL_TEST_PG_IMAGE=supabase/postgres:17.6.1.136 node scripts/check-schema-rebuild.mjs` | FALLÓ · «permission denied for schema auth» · 10,8 s · bloquean 0038, 0268, 0410 y 0453 (la imagen trae `auth` con dueño/ACL propios) |
| `node scripts/check-schema-rebuild.mjs` (sobre `postgres:17`) | PASÓ · 449 migraciones + 18 solo-ledger (= 467) · 41 s |
| `node scripts/run-sql-tests.mjs` (sobre `postgres:17`) | PASÓ · 224/224 · ~3 min · todavía sin la 0472 |
| Imagen `dtdcargo:local` | NO DISPONIBLE · sin `Dockerfile` |

Consecuencia registrada en la spec (aceptación 2 y § Seguimiento): la variante sobre `supabase/postgres:17.6.1.136` queda **pendiente de decisión del Director** entre correr el rebuild «en modo Supabase» (roles y hooks que la imagen ya declara) o una migración de ACL explícita con su prueba. El área docs no inventó esa decisión: la spec deja las dos opciones y prohíbe afirmar (b) como PASÓ hasta que exista.

## Hallazgos de la fase de corrección (área docs) y su cierre

1. **Runbooks ausentes, sección Self-hosted, variables en `.env.example`, handoff stub** (alta) → cerrado con los archivos de arriba.
2. **`docs/specs/README.md` desactualizado** (media) → `docs:index` corrido; `docs:check` exit 0.
3. **Handoff sin evidencia y criterio 2 falso** (media) → evidencia literal registrada (propia y la reportada), criterio 2 reescrito; la decisión del Director sigue pendiente y así queda escrito.
4. **El orquestador afirmó «todos los constructores terminaron» con resumen vacío** (baja) → no se corrige con un archivo. Regla para la siguiente fase, anotada en la cabecera de este handoff: antes de abrir la fase de validación, el orquestador adjunta la salida literal de `git -C <worktree> status --short --untracked-files=all` y el JSON de cada constructor; una casilla se marca solo con ruta + comando + PASÓ/FALLÓ con conteo.
5. **No abrir PR ni pasar a validación con dos módulos sueltos** (alta) → vigente: al 21:08 UTC faltan compose (tres archivos), `.env.example` de infra, `README.md` de infra, plantilla y ops, y ninguna área salvo docs ha dejado evidencia de PASÓ en este handoff. La PR no se abre hasta que cada área entregue su JSON con PASÓ y el orquestador adjunte el `git status` literal.
6. **Runbooks con VPS, snapshots y `REQUEST_IP_HEADER` bien dichos** (alta) → cerrado; ver grep de «VDS» y §1.7/§1.8 de `servidor-contabo.md`.
7. **Self-hosted en `setup-portal-auth.md`** (media) → cerrado; la tabla cubre los dos caminos y los valores medidos (3600 s, 60 s).
8. **`.env.example` sin las tres variables** (media) → cerrado.
9. **HEALTHCHECK contra un `/api/health` que no existe** (baja) → cerrado en la spec: `GET /robots.txt`, timeout 5 s, start-period 40 s; `app/api/debug/health` descartado con sus códigos (503/401).

## FUERA DE ALCANCE DETECTADO

- ~~Archivos fuera de la allowlist~~ (cerrado por el Worker): `.gitattributes`, `eslint.config.mjs` y `tsconfig.json` ya figuran en la allowlist de la spec con su motivo (excluir el router Deno copiado del upstream y conservar la copia verbatim).
- ~~Espera de la 0472 sin verificar~~ (cerrado por el Worker): la entrada en `pendingBelowCutoff` sigue la forma de 0422/0423 y la prueba PGlite da 12/12.
- **Fase 2 · grants después del restore:** la imagen de Supabase da DELETE a `anon`/`authenticated` en `public` por default privileges. El dump de producción trae los grants reales, pero hay que comprobarlo tras el restore (`servidor-contabo.md` §2.2); una reconstrucción desde migraciones sobre esta imagen quedaría abierta.
- **`origin/main` avanzó** desde la base de esta rama (`c3d37a8e` → incluye SDD-0504, `68b2a864`). Antes de integrar hay que traer `main` a esta rama y repetir lo afectado.
- `docs/investigacion/contabo-vps-produccion-ago-2026.md` lleva el banner «⛔ CERRADA — NO SE IMPLEMENTA» (decisión del 2026-08-23) que la decisión de Sam del 2026-10-08 (spec § Objetivo) deja superada. `docs/architecture/migracion-vps-2026-07.md` desaconseja Contabo para la base. Ninguno se tocó: el runbook nuevo los cita como fuente de los umbrales y deja la decisión como está. El Director decide si se les anota la fecha de la nueva decisión.
- `docs/runbooks/aplicar-migraciones-prod.md` asume el conector MCP de Supabase Cloud (`apply_migration`, ledger por md5). Para el servidor propio hace falta una versión con `psql` y alta manual del ledger; `servidor-contabo.md` §4 la pone como condición de la Fase 4. No es de esta spec.
- Voseo preexistente en `docs/runbooks/setup-portal-auth.md` (pasos 1-5, troubleshooting, plantillas: «Dejá», «conectá», «pegá», «pedile») y en `.env.example:4` («Copiá… completá»). Solo lo nuevo va en tuteo; reescribir lo viejo es otra tarea.
- `setup-portal-auth.md` § «Cómo funciona» cita `app/portal/(auth)/login/actions.ts` con `shouldCreateUser: true`; hoy el plan B vive en `app/entrar/actions.ts:44-50` con `shouldCreateUser: false`. Desactualizado; no se tocó.
- Dos supuestos del runbook del servidor que se validan en la Fase 1, no en el repo: que Dokploy exponga su Traefik como `dokploy-traefik` y acepte `docker network connect dtd_edge`, y el tag vigente de `traefik/whoami` para la prueba del header (el runbook pide comprobarlo en el registro).
- `app/api/cron/searates-refresh` existe y no está en `vercel.json` (sin agendar en Vercel); en el crontab del servidor sí va semanal.
- PGlite 0.5.8 embebe PG 18.3 mientras producción y el harness Docker están en 17: las pruebas de CI corren en una major distinta de producción.
