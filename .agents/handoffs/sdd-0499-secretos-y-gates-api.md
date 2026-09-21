# SDD-0499 — Secretos que viajan mal y gates que faltan en `app/api`

- **Owner**: Worker Claude (sesión `keen-swirles-62b904`)
- **Worktree**: `.claude/worktrees/keen-swirles-62b904`
- **Rama**: `claude/heuristic-benz-8851fb` (base `main` `d9adbabf`; `07831a5d` es ancestro)
- **SDD**: 0499 — `docs/specs/0499-endurecer-api-secretos-y-gates/spec.md`
- **Fecha**: 2026-09-21
- **Turno de máquina**: turno 5. `pnpm verify` completo **NO ejecutado** — falta el turno del Director.

## ESTADO DE CADA HUECO

Tres estados, sin término medio. **Lo que quedó abierto está dicho con todas las
letras**: un hueco a medio arreglar y sin etiquetar es peor que uno intacto,
porque el próximo lo lee como cerrado.

| # | Hueco | Estado | Prueba que lo afirma / qué expone |
|---|---|---|---|
| 1 | Secreto de Telegram en la query string | **CERRADO** (con una acción abierta de Sam, ver abajo) | `app/api/telegram/webhook/__tests__/secret-header.test.ts` — incluye el caso que manda el secreto bueno por query string y espera 403 |
| 2 | `shipments/[id]/events` mutaba estado sin gate | **CERRADO** | `.../events/__tests__/module-gate.test.ts` — `support` recibe 403 y ni `shipments` ni `shipment_events` se tocan |
| 3 | Push: 6 sitios re-asignaban o borraban la sub de otro | **CERRADO** (los 6) | `app/api/m/push/__tests__/ownership.test.ts`, `app/api/portal/push/__tests__/rebind.test.ts`, `app/api/studio/push/__tests__/rebind-possession.test.ts`, `lib/studio/notify/__tests__/push-rebind.test.ts` |
| 4 | `finalize` / `reauthorize` sin gate de módulo | **NO ERA UN HUECO** — arreglado igual, por uniformidad | La RPC `reauthorize_document_upload` (`0309_…sql:114-115`) filtra por `tenant_id` **y** `user_id = auth.uid()`: nadie alcanzaba reservas ajenas. Era inconsistencia de capas. |
| 5 | 21 comparaciones de secreto no constantes | **NO ERA UN HUECO** práctico — unificado igual | Sobre HTTP el jitter de red domina el canal de temporización. Lo que SÍ era sustancial —fail-closed— ya estaba bien en los 21 y se conserva. |
| 6 | `/api/contact` «deprecado pero montado» | **NO ERA UN HUECO — y la premisa era falsa** | El endpoint **está vivo**: lo llama `AcademiaLeadForm.tsx:45`, montado en `academia/page.tsx:221`. No se apagó. Sólo se corrigió el docblock. |
| D1 | `estimados/actions.ts:64-69` y `:97-100` — lee y muta `quotes` sin `tenant_id` | **ABIERTO Y CONFIRMADO** | Ver abajo. |
| D2 | `referral-invite.ts:80-87` y `:96-101` — dedupe y tope por markbox sin tenant | **ABIERTO Y CONFIRMADO** | Ver abajo. |
| D3 | `marca/access.ts:100-110` — `resolveBrandTenantId()` devuelve el primer tenant | **ABIERTO Y CONFIRMADO** | Ver abajo. |

### Lo abierto, con todas las letras

**D1, D2 y D3 siguen ahí. No los toqué.** Es una decisión del encargo, no un
descuido: Sam confirmó el 2026-09-21 que **hay un solo tenant en producción**, y
los tres sólo son explotables con un segundo. Lo que exponen **el día que se
abra uno**:

- **D1 — `app/portal/(app)/estimados/actions.ts`.** Un cliente del portal que
  comparta Shipping Mark con un cliente de otro tenant **lee y muta** el
  estimado ajeno (`quotes`), porque el markbox es `unique (tenant_id, markbox)`
  (`supabase/migrations/0006_clients.sql:23`), único por tenant y no global.
  **La RLS no lo corta**: `createAdminClient()` es `service_role` y la bypasea
  (`lib/db/admin.ts:2`). No hay segundo candado.
  Y además de la escritura, hay **fuga de PII por el canal de avisos**:
  `:113` llama `notifyCotizacionRequestToAdmin(admin, q.tenant_id, {markbox,
  clientName, …})`, que resuelve los admins **del tenant de la fila**
  (`lib/studio/cotizacion-request-notify.ts:48`) — o sea que les manda a los
  administradores del OTRO tenant un correo con el nombre y el markbox del
  llamador.
- **D2 — `lib/portal/referral-invite.ts`.** Oráculo de existencia («¿ya
  invitaron a este correo?») y cupo diario de invitaciones compartido entre dos
  referidores de tenants distintos que comparten markbox.
- **D3 — `lib/marca/access.ts`.** Los tres endpoints de `marca` firman URLs del
  bucket privado sobre el tenant más antiguo, no sobre el del que llama: un
  visitante validado contra un tenant recibiría assets del otro.

Ninguno de los tres tiene prueba: con un solo tenant no se puede escribir el
caso infeliz sin fabricar un segundo, y eso excede esta spec. **Quien lo retome
no necesita re-investigar** — la ubicación está medida hoy y el análisis de por
qué la RLS no ayuda está arriba.

**Acción abierta que NO es de un agente (hueco 1):** rotar
`TELEGRAM_WEBHOOK_SECRET`. El arreglo hace que el secreto deje de viajar en la
URL de ahora en adelante, pero **el valor vivo ya viajó** y hay que darlo por
comprometido. Es de Sam y va después del despliegue. En este handoff, en la
spec, en el runbook y en el diff se nombra la variable; **en ningún lado hay un
valor**.

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
| Migraciones | **NO APLICA** — esta tarea no toca SQL |
| Producción | **NO APLICA** — no se leyó ni escribió |

### `pnpm verify` completo — corrido sobre `1290ba4437fc0d188f85e8b6c163fac81acedcad`

**Exit 1.** 17 pasos declarados, **16 corrieron de verdad**.

| Paso | Veredicto |
|---|---|
| `harness` | **FALLÓ** (exit 1) — 196 de 197; ver el diagnóstico abajo |
| `lint` | PASÓ |
| `rsc-boundary` | PASÓ |
| `typecheck` | PASÓ |
| `edge-functions` | PASÓ — 4 funciones compilan |
| `test` | PASÓ |
| `docs:check` | PASÓ |
| `numbering` | PASÓ — sin números repetidos |
| `feature-constants` | PASÓ — 5 banderas coinciden |
| `components:check` | PASÓ |
| `governance:check` | PASÓ |
| `pending-migration-symbols` | PASÓ — 0 ROJO · 0 AMARILLO |
| `sql-tests` | PASÓ — **NO APLICA** a este diff (no toca migraciones) |
| `schema-rebuild` | PASÓ — **NO APLICA** a este diff |
| `e2e` | PASÓ **con aviso** — 168 pruebas pasaron y ninguna falló, pero el proceso salió ≠0; el propio verify lo atribuye al worker de WebKit que no cierra en Windows |
| `build` | PASÓ |
| `migrations-applied` | **SKIP · NO MEDIDO** — sin `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY` (worktree sin `.env.local`). El verify lo marca como «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR». **No es verde**, y desde acá no se afirma nada sobre qué migraciones están aplicadas en producción. |

**Una trampa en la que caí y conviene que quede escrita.** Lancé el verify como
`pnpm verify > log; echo "VERIFY_EXIT=$?" | tee -a log`, y la notificación de la
tarea informó **exit 0** — que era el del `tee`, no el del verify. El verify
salió **1**. Si me quedo con el código que me devolvió la herramienta, reporto un
verde que no existe. El veredicto sale de leer el log, no del exit de la tubería.

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

## PR / BRANCH

- Rama **publicada**: `claude/heuristic-benz-8851fb` → `origin`.
- PR **draft**: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/186 (base `main`).
- Draft a propósito: `pnpm verify` completo quedó sin correr.
- **No fusioné nada.** La integración es del Director.

## PENDIENTES DE ESTA TAREA

1. **`pnpm verify` completo — NO EJECUTADO.** Pedí el turno; el Director cerró
   el día con tres sesiones más terminando a la vez e indicó **no correrlo**
   («gates estáticos y focales»). Queda para quien retome, con el mismo cuidado
   de siempre: si el paso `test` sale rojo, distinguir una aserción que falla de
   un worker de vitest que no arranca por RAM antes de tocar nada.
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

### C · El fallo de `harness`: una carrera latente en la prueba, no en mi diff

`scripts/tests/verify-watchdog.node.mjs:248` — «un árbol que calla se corta
entero por inactividad, y sólo ese árbol». Falla en `:283` con
`AssertionError [ERR_ASSERTION]: nivel 2 (PID 38332) sigue vivo`, `true !== false`.

**Es una aserción que falla, no un fork que no arranca por RAM.** La distinción
está hecha antes de diagnosticar, que es el orden que pide el runbook.

**No es de esta rama, con evidencia y no por descarte:**

1. Mi diff toca 48 archivos y **cero** bajo `scripts/`:
   `git diff --stat d9adbabf..HEAD -- scripts/` sale vacío. Por carpeta raíz:
   39 `app`, 5 `lib`, 3 `docs`, 1 `.agents`.
2. Aislada **pasa 3 de 3**: `node --test --test-reporter=tap` sobre ese archivo
   da `# pass 14 · # fail 0` y exit 0 las tres veces. (El reporter TAP es
   deliberado: con el `spec` por defecto el corredor informa mal.)
3. **La causa está en el harness y es específica.**
   `scripts/verify-watchdog.mjs:130` ya distingue los procesos «aún en cierre
   del sistema, ya no corren» — o sea que la implementación **sabe** que en
   Windows un proceso terminado sigue abierto un rato. Pero `isProcessAlive`
   (`scripts/verify-watchdog.mjs:219-231`) devuelve `true` para ésos:
   `process.kill(pid, 0)` no tira mientras el handle vive, y el chequeo de
   zombie que lo salvaría lee `/proc/<pid>/stat`, que es **sólo Linux** — en
   Windows ese `readFileSync` tira siempre y cae al `return true`.
   La aserción por PID de `:283` no da la gracia que la aserción de `:290` del
   **mismo test** sí da en su regex
   (`sobrevivientes: 0(; \d+ aún en cierre del sistema, ya no corren)?`).

O sea: bajo la carga de la corrida completa el cierre tarda más, la ventana se
ensancha y el nivel más profundo todavía lee como vivo. Por eso falla en el
verify entero y pasa aislada.

**No lo arreglo**: es `scripts/`, harness, fuera de mi alcance y probablemente
de otro dueño. Queda acá con la evidencia para que el Director decida si va a
una tarea aparte.

### D · La condición que activaría el contrato extendido sobre mis rutas

Hoy `app/api/**` **no entra** en el alcance del contrato de candados de
SDD-0500: su escáner arranca en `app/studio/(app)` y recorre sólo desde ahí
(medido por el Director). Así que mis tres rutas nuevas no las mide nadie.

Eso no es una propiedad permanente, es una condición: **el día que alguien
escriba la spec del inventario del punto A** —extender el contrato a
`app/api/studio`— mis tres rutas pasan a estar medidas por un contrato que esta
tarea nunca corrió. Queda anotado como la condición que lo activa, no como
riesgo vivo.

### E · Las líneas del parte del Director se corrieron

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
