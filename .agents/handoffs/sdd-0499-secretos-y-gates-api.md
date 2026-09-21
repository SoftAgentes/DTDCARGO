# SDD-0499 — Secretos que viajan mal y gates que faltan en `app/api`

- **Owner**: Worker Claude (sesión `keen-swirles-62b904`)
- **Worktree**: `.claude/worktrees/keen-swirles-62b904`
- **Rama**: `claude/heuristic-benz-8851fb` (base `main` `d9adbabf`; `07831a5d` es ancestro)
- **SDD**: 0499 — `docs/specs/0499-endurecer-api-secretos-y-gates/spec.md`
- **Fecha**: 2026-09-21
- **Turno de máquina**: turno 5. `pnpm verify` completo **NO ejecutado** — falta el turno del Director.

## OBJETIVO ORIGINAL

Seis hallazgos de dos auditorías de solo lectura sobre `main` `07831a5d` (los 99
métodos HTTP de `app/api/**` y las 65 superficies del Portal), más tres que sólo
se documentan porque dependen de un segundo tenant que hoy no existe.

## COMPLETADO

| # | Hallazgo | Qué se hizo |
|---|---|---|
| 1 | Secreto del webhook de Telegram en el query string | Pasa a `X-Telegram-Bot-Api-Secret-Token` con comparación en tiempo constante. El query param deja de aceptarse. Runbook actualizado. |
| 2 | `shipments/[id]/events` mutaba estado sin gate de módulo | `moduleEditDenial(supabase, "tracking")` antes de leer el envío. |
| 3 | Cinco rutas de push re-asignaban la sub de otro | Borrados acotados al dueño + gate de posesión para el rebind. |
| 4 | `finalize` y `reauthorize` sin gate de módulo | `moduleEditDenial(client, "expenses")`, por uniformidad. |
| 5 | 21 comparaciones de secreto con `===` | Un solo `lib/http/secret-compare.ts`. |
| 6 | `/api/contact` «deprecado» | **Tiene un llamador vivo. NO se apagó.** Se corrigió el docblock. |
| 7 | Tres huecos que necesitan segundo tenant | Documentados en la spec, no arreglados. |

### La premisa falsa que desbloqueó el #1 — verificada

El docblock decía «Telegram no soporta headers custom». Leí
**core.telegram.org/bots/api#setwebhook en vivo el 2026-09-21**: el parámetro
`secret_token` existe y la API documenta que «the request will contain a header
"X-Telegram-Bot-Api-Secret-Token" with the secret token as content». Charset
limitado a `A-Z a-z 0-9 _ -`, 1-256 caracteres — anotado en el runbook porque
descarta `openssl rand -base64`.

### El #6 salió al revés de lo esperado

`/api/contact` **está vivo**: lo llama
`app/academia/_components/AcademiaLeadForm.tsx:45` y ese form se monta en
`app/academia/page.tsx:221`. Según el encargo («si encuentras un llamador, no lo
toques y dilo»), no se apagó ni se puso tras bandera. Sólo se corrigió el
docblock, que afirmaba lo contrario y es lo que haría que el siguiente lo borre.

Esta trampa ya estaba anotada en `docs/engineering/project-rules.md:145`, en
rojo y fechada el 2026-08-19, con este mismo endpoint.

### Decisiones que pedían justificación

- **El rebind del Studio se CONSERVA** (`studio/push/subscribe/route.ts:75`). El
  puesto compartido entre turnos de almacén es real; quitarlo dejaría al segundo
  turno sin activar su push. Se le agrega la comprobación que faltaba: el que
  reclama el endpoint presenta el `keys.auth` de esa suscripción. El mismo
  navegador lo presenta siempre; quien sólo conoce el endpoint, no. Mismo
  criterio para el portal y para los dos de `m/`.
- **Un sitio más del que pedía el encargo**: `app/api/m/push/subscribe/route.ts:46`
  tenía el mismo `upsert(onConflict:"endpoint")` sin dueño. Está en mi área
  (`app/api/**`) y dejarlo habría hecho incoherente el arreglo: el rebind
  forjable seguía abierto en el hermano de al lado.
- **El contrato anti-deriva NO se extiende.**
  `lib/http/__tests__/studio-api-auth-guard.test.ts` exige guard de SESIÓN por
  método. Exigir además gate de MÓDULO encendería **11 de las 18** rutas de
  `app/api/studio` con método mutante, y varias no lo llevan por diseño. Es una
  spec aparte; el inventario está abajo. Las tres rutas que toqué siguen
  cumpliendo el contrato vigente (corrido en verde).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm typecheck` | **PASÓ** (exit 0) |
| `pnpm lint app/api lib/http lib/studio/notify` | **PASÓ** (exit 0) |
| `git diff --check` | **PASÓ** (exit 0) |
| `pnpm docs:check` | **PASÓ** tras `pnpm docs:index` (485 specs) |
| `pnpm sdd:check` | **PASÓ** — sin números repetidos |
| Vitest focal (28 archivos, 502 pruebas) | **PASÓ** (exit 0) |
| Mutantes (16 sobre líneas del diff propio) | **Los 16 mueren**, cada uno en su prueba, resto en verde |
| `pnpm verify` completo | **NO EJECUTADO** — falta el turno de máquina |
| Migraciones | **NO APLICA** — esta tarea no toca SQL |
| Producción | **NO APLICA** — no se leyó ni escribió |

Focal corrido: `lib/http`, `app/api/telegram`, `app/api/m/push`,
`app/api/portal/push`, `app/api/studio/push`, `app/api/studio/attachments`,
`app/api/studio/shipments`, `lib/studio/notify`, `app/api/cron`,
`app/api/contact`, `app/api/studio/__tests__`.

### Sobre los mutantes, con honestidad

Dos necesitaron dos vueltas y vale registrar por qué:

- `11-studio-sin-posesion` **sobrevivió** a la primera pasada. No era un mutante
  malo: **faltaba la prueba**. El contrato de frontera que ya existía corre con
  el endpoint LIBRE, así que quitar el gate no le cambiaba nada. Se añadió
  `app/api/studio/push/__tests__/rebind-possession.test.ts` y ahora muere.
- El primer mutante de `secret-compare` **era equivalente**: reescribía
  `!expected` en dos ramas con el mismo resultado observable. El fallo fue de mi
  elección de mutante, no de la prueba. Se sustituyó por dos reales —quitar el
  `if (!secret)` de `matchesBearerSecret`, que abre un fail-open de verdad (con
  la variable sin definir, un header `"Bearer "` autenticaría), y comparar sólo
  la longitud— y los dos mueren.

### Contratos preexistentes ajustados (sin debilitarlos)

- `app/api/studio/push/__tests__/subscribe-boundary.test.ts`: su doble ahora
  devuelve «endpoint libre» para las tablas de subs (la ruta hace una lectura
  más). La aserción posicional del resubscribe pasa a fijar la **secuencia
  completa** de escrituras y a localizar el insert/upsert por operación — es más
  fuerte que el índice que tenía, no menos.
- `app/api/studio/push/__tests__/subscribe-identity.test.ts`: su doble suma
  `select`/`maybeSingle` y hace la cadena thenable. Aserciones intactas.

## COMMITS

```
35723d83 feat(studio): SDD-0499 — un solo comparador de secretos, en tiempo constante
c0df1825 fix(studio): SDD-0499 — el secreto del webhook de Telegram deja de viajar en la URL
f7009aa5 fix(studio): SDD-0499 — un support ya no mueve el estado de un envío
45369d0e fix(studio): SDD-0499 — finalize y reauthorize pasan por el gate de expenses
bb646c6e fix(studio): SDD-0499 — conocer un endpoint de push ya no apaga las notificaciones de otro
32a29c03 docs(studio): SDD-0499 — /api/contact NO está deprecado: lo llama la Academia
a8365ede docs(SDD-0499): spec de los secretos que viajan mal y los gates que faltan
```

## PENDIENTES DE ESTA TAREA

1. **`pnpm verify` completo.** Necesita el turno del Director. Si el paso `test`
   sale rojo, hay que distinguir una aserción que falla de un worker de vitest
   que no arranca por RAM, y mandarle el veredicto literal.
2. **Rotar `TELEGRAM_WEBHOOK_SECRET` — es de Sam, no de un agente, y va DESPUÉS
   del despliegue.** El valor vivo hay que darlo por comprometido: viajó en
   URLs. Procedimiento y orden en
   `docs/runbooks/setup-telegram-bot.md#rotación-sdd-0499`.
3. **Ventana ciega en el despliegue de Telegram**: entre el deploy y el
   `setWebhook` nuevo, el endpoint responde 403 a todo update. No se pierden —
   Telegram reintenta las entregas fallidas — pero conviene encadenar los pasos.
4. **Estado SDD**: queda `in-progress`. Pasa a `done` cuando cierre verify y la
   PR se integre.

## FUERA DE ALCANCE DETECTADO

### A · 11 de 18 rutas mutantes de `app/api/studio` sin gate de módulo

Medido con un barrido de `app/api/studio/**/route.ts` que exportan
`POST|PATCH|PUT|DELETE` y no llaman a
`moduleEditDenial|moduleEditGate|tenantAdminGate|requirePlatformAdmin`:

```
app/api/studio/agents/run/route.ts
app/api/studio/audit/export/route.ts
app/api/studio/bugs/route.ts
app/api/studio/bugs/[id]/messages/route.ts
app/api/studio/bugs/[id]/replay/route.ts
app/api/studio/bugs/[id]/route.ts
app/api/studio/bugs/[id]/state/route.ts
app/api/studio/bugs/[id]/take/route.ts
app/api/studio/push/subscribe/route.ts
app/api/studio/searates/probe/route.ts
app/api/studio/shipments/route.ts
```

**No es una lista de defectos**: varias no llevan gate por diseño (`push` es
autoservicio del propio usuario, `audit/export` autoriza en la base, `bugs` está
abierto a todo el staff a propósito). Es el inventario que necesitaría una spec
que quiera extender el contrato anti-deriva. `shipments/route.ts` (el POST de
creación) es el que más se parece al que arreglé acá y merece mirada.

### B · Los tres que esperan un segundo tenant

Están completos en la spec, sección «Deuda con fecha de vencimiento». Resumen
con ubicación verificada hoy:

- `app/portal/(app)/estimados/actions.ts:64-69` (lee) y `:97-100` (muta) —
  `quotes` con admin filtrando por `quote_code` y `client_markbox`, sin
  `tenant_id`. El markbox es `unique (tenant_id, markbox)`
  (`supabase/migrations/0006_clients.sql:23`), único por tenant y no global.
- `lib/portal/referral-invite.ts:80-87` y `:96-101` — dedupe y tope diario por
  markbox sin tenant.
- `lib/marca/access.ts:100-110` — `resolveBrandTenantId()` devuelve siempre el
  primer tenant por `created_at`.

**Respuesta a la pregunta del Director sobre si la RLS corta igual: no corta.**
`createAdminClient()` es `service_role` y bypasea RLS — `lib/db/admin.ts:2` lo
dice literalmente. No hay segundo candado en esa ruta; lo único que la salva hoy
es que no existe el segundo tenant.

**Y la parte que no toca la base**: `estimados/actions.ts:113` llama
`notifyCotizacionRequestToAdmin(admin, q.tenant_id, { markbox: client.markbox,
clientName: client.name, … })`, que resuelve los admins **del tenant de la fila**
(`lib/studio/cotizacion-request-notify.ts:48`). Con dos tenants, avanzar el
estimado ajeno además le manda a los administradores del OTRO tenant un correo
con el nombre y el markbox del llamador: fuga de PII por el canal de avisos, no
sólo escritura cruzada. Eso sube la gravedad del día que se abra el segundo
tenant y conviene que quede dicho.

### C · Las líneas del parte del Director se corrieron

`app/portal/(app)/estimados/actions.ts:63,96` (lo que me pasó) está a una línea:
medido hoy son `:64-69` y `:97-100`. El defecto sigue ahí; la cita es la que
venció. Las otras tres (`telegram:44`, `shipments/events`,
`portal/push/subscribe:66`) coincidían exactamente.

La cita de la RPC que venía en el encargo también estaba corrida:
`0309_document_reserve_finalize_rpcs.sql:108-121` → los filtros están en
`:114-115` (la función empieza en `:101`). Corregido en spec, docblock y prueba.

## HANDOFF AL DIRECTOR

- Rama publicada y PR abierta. **No fusioné nada**; la integración es tuya.
- Falta `pnpm verify` completo: **pido turno de máquina**.
- Cuando integres y despliegue: avísale a Sam que rote
  `TELEGRAM_WEBHOOK_SECRET`. Es el único paso de esta spec que no puede hacer un
  agente, y sin él el bot deja de enlazar cuentas (403 a todo update hasta que
  se corra el `setWebhook` nuevo).
- No crucé la frontera con la sesión de `app/studio/**`: mi diff no toca ningún
  archivo bajo `app/studio/`.

## IMPACTO DOCUMENTAL

- **Canónicos actualizados**: `docs/runbooks/setup-telegram-bot.md` (§2 charset,
  §3 `secret_token`, §Rotación), `docs/specs/README.md` (índice regenerado con
  `pnpm docs:index`).
- **Nuevo**: `docs/specs/0499-endurecer-api-secretos-y-gates/spec.md`.
- **Graphify / Archify**: pendiente. No se corrió `knowledge:status` ni
  `knowledge:visual` — son pasos del cierre que conviene encadenar con el turno
  de verify para no competir por la máquina. **No declaro esa capa cubierta.**
