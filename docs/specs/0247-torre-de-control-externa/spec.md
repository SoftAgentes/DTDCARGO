---
sdd: "0247"
title: "Torre de control externa: un vigía que no vive adentro de lo que vigila"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-08-03
updated: 2026-08-03
supersedes: null
superseded_by: null
related: ["0238"]
confidencialidad: interno
---

# SDD-0247 · Torre de control externa

## El problema

**Ningún cron de Vercel puede avisar que Vercel dejó de disparar sus crons, y
ningún vigía que viva dentro del deploy puede avisar que ese deploy se cayó.**

Tres incidentes que ya costaron, todos con el mismo patrón — el sistema estaba
roto y nadie se enteró hasta que alguien lo miró de casualidad:

1. **2026-08-02 · SDD-0238.** El `ignoreCommand` de `vercel.json` canceló el
   build porque el último commit del push era doc-only. El sistema navegable de
   `/marca` se quedó en `main` sin publicar, en silencio. El código del repo
   estaba perfecto.
2. **Migraciones 0317–0324.** Llegaron a `main` y al código desplegado, pero no
   a la base. Reventaron ocho Server Actions con `PGRST202`. El gate
   `migrations-applied` mide el *checkout*, no `origin/main`, así que en un árbol
   atrasado da verde por omisión.
3. **Avisos al cliente que no salen.** Un "tu carga llegó a Valencia" que no se
   entrega rompe justo el eslabón de la recompra del día 30/45.

## Lo que NO es

Esto **no** es un motor de flujo ni una cola. El ERP ya tiene el suyo
(`lib/studio/workflow/`, SDD-0091) y cinco colas con su drain. La torre no
decide, no calcula y no guarda estado de negocio: **mira desde afuera y avisa.**

## Alcance de esta fase

### Fase 1 — lo que entra acá

**Cambio en el ERP (1 archivo de lógica + 1 ruta):**

`checkAllIntegrations()` acepta `{ skipMetered }`, y `GET /api/debug/health`
acepta `?cheap=1`. Con el flag, las integraciones que cobran por ping
—`anthropic`, `openrouter`, `searates`— vuelven `skipped` con el motivo en
`detail`, sin consultarse.

**Por qué es obligatorio y no un lujo:** el chequeo completo pinga SeaRates en
cada llamada. Un vigía que sondea cada 15 minutos son ~96 llamadas al día contra
una cuota de **100 al MES**, y esa cuota la comparte con el cotizador FCL de
`/tarifas`. Sin el modo barato, prender la torre mata el cotizador el primer día
y el síntoma aparece días después, lejísimos de la causa.

`detail` es lo que separa "no la consulté a propósito" de "no está configurada"
(que sale con `detail: null`). El vigía necesita esa diferencia para no reportar
una integración sana como ausente.

**Retrocompatible:** sin argumentos, el comportamiento es idéntico. El único otro
consumidor, `app/studio/(app)/debug/page.tsx:73`, llama sin argumentos y no cambia.

**Workflow en n8n** (`VQuL0JqUo5OOs6YM`, cada 15 min):

- **(a) Salud del ERP** — `GET /api/debug/health?cheap=1`. Reporta integraciones
  en `error`. Si el health responde **sin** modo barato, eso mismo es un problema
  y lo dice.
- **(b) ¿`main` está publicado?** — toma el `commitShaShort` del health, pide
  `GET /repos/…/compare/{sha}...main` a GitHub y aplica el predicado del
  `ignoreCommand` sobre **todo el rango sin desplegar**, no sobre el último commit.

### Fase 2 — lo que queda afuera, y por qué

- **`GET /api/cron/estado-colas`** — tres números por cola: vivas, abandonadas, y
  antigüedad de la más vieja **viva**. No se hace acá porque `outbox_push_events`
  **no tiene columna de status**: un push que agota sus 5 intentos queda con
  `sent_at` en null para siempre, así que una regla tipo "la más vieja supera 5
  min" se dispararía cada 30 minutos, para siempre. Hay que resolver la
  representación antes de vigilarla.
- **`POST /api/cron/migrations-check`** — va **después** del fix de raíz: que
  `localMigrations()` en `scripts/check-migrations-applied.mjs:99-105` lea
  `git ls-tree origin/main` en vez de hacer `readdirSync` del checkout. n8n queda
  como reloj y transporte, y **nunca** reimplementa `findMissing`: sería una
  segunda copia de la regla, fuera del gate, sin test, dependiendo de `cutoff` y
  `pendingBelowCutoff` que se editan a mano. Ese es el mismo modo de falla que
  costó la 0228.

## Decisiones

### La alerta es por transición, jamás por estado repetido

A 15 minutos de cadencia, alertar por valor absoluto son 96 mensajes al día. Un
vigía ruidoso se ignora — y un vigía ignorado es peor que ninguno, porque da la
sensación de que algo está cubierto. El workflow guarda una firma del estado en
`$getWorkflowStaticData` y sólo habla cuando cambia. Re-avisa cada 6 horas
mientras siga roto, para que un problema real no se olvide.

### `CANCELED` no es un error

Que un push doc-only cancele el build **es el comportamiento correcto y deseado**
del `ignoreCommand`. Alertar por eso sería entrenar a ignorar la alerta. Lo que
se detecta es distinto: código que quedó en `main` sin publicar.

Sutileza del predicado: `:(exclude,glob)*.md` lleva `:(glob)`, que hace que `*`
**no cruce `/`**. Excluye sólo los `.md` de la raíz, no los de subcarpetas. Un
`.md` dentro de `app/` sí dispara deploy.

### Los secretos y sus alcances

- **`DEBUG_HEALTH_SECRET` en n8n Cloud** — que sea uno **dedicado y rotable**,
  distinto del que usa el Studio con `fetchRemoteHealth`.
- **GitHub: fine-grained token de sólo lectura** (`Contents: Read`) sobre
  `hailuwaycom-sketch/DTDCARGO`, que es privado. **Nunca un token de Vercel:** es
  de cuenta, lee env vars del proyecto y puede disparar deploys.
- **Telegram: bot PROPIO del vigía.** Si alguien le pone un Telegram Trigger al
  bot de producción, n8n hace `setWebhook` sobre él y se lleva por delante
  `app/api/telegram/webhook`, que es por donde el ERP linkea los `chat_id` con
  `/start`.

## Qué se verificó

- `pnpm typecheck` limpio.
- `pnpm lint` limpio.
- Suite completa: **386 archivos, 4.635 tests**, todos verdes.
- `lib/studio/__tests__/integration-health.test.ts` — 5 casos, anclados en la
  **llamada** (stub de `fetch`, se mira a qué host se pegó) y no en el nombre.
  Incluye la prueba de fondo: sin `skipMetered` las tres medidas **sí** se
  consultan, para que un skip que apagara todo no pasara igual.
- **Mutación comprobada:** al quitar `skipMetered ? saltada() : checkSeaRates()`,
  fallan 2 de los 5 con el mensaje exacto. El test muerde.
- Workflow validado en la instancia con `n8n_validate_workflow`: 6 nodos,
  5 conexiones, 0 errores.

## Pendiente

- Las tres credenciales en n8n; el workflow queda **inactivo** hasta entonces.
- Fase 2 (colas y migraciones), con sus prerrequisitos de arriba.
- ⚠️ Hay **dos archivos `0247`** en `supabase/migrations/`: el paso `numbering`
  de `verify.mjs` va a fallar en el próximo merge. Es previo e independiente de
  esta spec.
