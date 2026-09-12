# L04 — Referidos del Portal por principal (RPC 0404)

Fecha: 2026-09-11; ronda 2 el 2026-09-12. Task ID: `c-l04-portal-referidos`.
Owner / sesión escritora: ronda 1 `c-l04-worker-20260911-claude` (terminada y liberada); ronda 2 `pr78-update-worker-20260912-claude`, por adopción explícita del Director sobre el mismo worktree y la misma rama. Estado: lista-para-revision en PR borrador.
**Ya no aplica el bloqueo migrate-first:** `0404_portal_referidos_por_principal` fue aplicada a producción el 2026-09-12 con OK nominal de Sam (ledger `20260912022404`), así que la rama dejó de declararla como espera y puede integrarse en el orden normal.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l04-portal-referidos`.
Rama: `codex/c-l04-portal-referidos`. Base de la ronda 2: `origin/main` `664bb4b22a314eb58161abd6518df653090db78f` tras dos merges (el primero sobre `6c282b44fba04c550afcf6bb6511dfb0fd26770a`); base de la ronda 1: `3c6107012f754953323202a7386b3e7811593814`.
Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, PR #21; unidad SDD-0339 en `8f388305`.

## OBJETIVO ORIGINAL

Preparar L04 del bloque C como PR draft contra main, integrable sólo después de aplicar 0404 en producción: importar la migración 0404, su contrato y la spec 0339; adoptar focalmente la RPC en las versiones vigentes de `lib/portal/portal-referral-queries.ts` y `app/portal/(app)/referidos/page.tsx`; añadir el test del origen y declarar `0404_portal_referidos_por_principal` pendiente de aplicar.

## COMPLETADO

- Migración y contrato 0404 importados idénticos por blob. La spec 0339 es idéntica salvo una nota de importación fechada bajo el título (forma de 0363) que declara MIGRATE-FIRST; al retirarla coincide byte a byte con `df943352` (2698 B). El `status: done` es histórico del origen y no significa aplicación real.
- **Premisa corregida con evidencia:** `git log 2a2e81bf..origin/main` sobre `portal-referral-queries.ts`, `referidos/page.tsx` y `referrals.test.ts` sale vacío; los blobs de main (`f58828cb`, `05225398`, `c46d2d5d`) son los de la base común. Crédito aplicado (0237, SDD-0137), acreditación automática (0197) y montos configurables (0250, SDD-0159) son anteriores a esa base y el origen ya los contempla. La diferencia 6666→4434 B es el recorte de SDD-0339, no crecimiento de main. Por eso el corte focal sobre main coincide exactamente con el origen: **0 líneas adaptadas**, queries = `83be7d13` y página = `bad86749`.
- Lo que main tiene y se conserva: estados `acreditado`/`aplicado` y `reward_usd` llegan de la RPC (0404:50-51) y la regla de créditos es la misma (queries:93-108 = main:157-172); montos configurables con fallback 80/60 (0404:42-43 = `referral-settings-types.ts:29-32` y `types.ts:115-121`); gate de verificación, hero, "Cómo funciona", nivel, lista y copy intactos. Los triggers de acreditación y aplicación de crédito no se tocan.
- `lib/portal/__tests__/referrals.test.ts` (main; allowlist de la spec 0339:48 y manifiesto `c-analisis-bloque-c-producto.md:193`) se adapta al snapshot de la RPC porque la firma cambió y `tsconfig` tipa los tests. Mapa de sus 8 casos abajo: ninguno se pierde.
- Test del origen `portal-referral-query.test.ts` importado sin cambios (`0933d06a`). Test nuevo `app/portal/(app)/referidos/__tests__/page.test.tsx`: RPC presente → renderiza el snapshot sin service_role ni lecturas de tablas; RPC ausente (PGRST202) → la página devuelve null, sin service_role ni tablas.
- Baseline: sólo la espera `0404_portal_referidos_por_principal` (bloque C L04 / SDD-0339; MIGRATE-FIRST; OK nominal de Sam y runbook; name exacto). Sin esa clave el JSON es idéntico a la base; cutoff 238 y esperas 0409/0418/0419/0430 intactas.
- Declaración `l04-portal-referral-program-pending-rpc` conforme al `$doc`, patrón L16: callSite `lib/portal/portal-referral-queries.ts:67`; evidencias `:68`, `:74` y `app/portal/(app)/referidos/page.tsx:43`. Antes de declarar: 1 ROJO; después: 0 ROJO · 1 AMARILLO. No se silenció el check.
- Índice regenerado con `corepack pnpm docs:index` (416 specs).

### Identidad de blobs

| Archivo | Blob / bytes | Frente al origen |
|---|---|---|
| `supabase/migrations/0404_portal_referidos_por_principal.sql` | `cb6e6309` / 2952 | Idéntico |
| `supabase/tests/0404_portal_referidos_por_principal.test.sql` | `b5db04a6` / 7596 | Idéntico |
| `docs/specs/0339-referidos-portal-por-principal/spec.md` | `3c94387e` / 3457 | Sin la nota: `df943352` / 2698 |
| `lib/portal/portal-referral-queries.ts` | `83be7d13` / 4434 | Idéntico (main = base común) |
| `app/portal/(app)/referidos/page.tsx` | `bad86749` / 16216 | Idéntico (main = base común) |
| `lib/portal/__tests__/portal-referral-query.test.ts` | `0933d06a` / 2395 | Idéntico |

### Diff focal por archivo

`lib/portal/portal-referral-queries.ts` (`f58828cb` → `83be7d13`):

| Líneas nuevas | Cambio | Justificación en spec 0339 |
|---|---|---|
| 6-12 | Comentario: RPC definer desde `auth.uid()` | Decisiones 1-2 |
| 14-20 | Retira `invoiceUsdAmount`, `getReferralSettings`, `InvoiceCurrency/InvoiceStatus` | Normalización y montos pasan a la RPC (decisión 3; 0404:27-43) |
| 51-57 | Tipo `ReferralProgramRpcRow` | Snapshot mínimo (decisión 4) |
| 64-68 | `getMyReferralProgram(db)` sin markbox ni `now`; `db.rpc(...)` sin argumentos; `if (error) return null` | Decisiones 1 y 6; ERR-01 |
| 70-79 | Parseo; `!row \|\| !markbox → null`; montos acotados a ≥0 | Decisión 6 |
| 81-91 | Mapeo de filas: los mismos 6 campos que main:125 | Decisión 4 |
| 93-108 | Créditos: misma regla, renombra variables y usa el monto del snapshot | Decisión 5 |
| 110-119 | Retorno con Shipping Mark y montos del snapshot | Decisión 5 |

Se eliminan de main `BILLABLE_STATUSES`, `trailingStart`, `billedUsdForClient` (main:58-106) y el `Promise.all` con admin (main:120-142).

`app/portal/(app)/referidos/page.tsx` (`05225398` → `bad86749`): se retiran los imports `createAdminClient` y `getPortalClient` (main:3-4), cambian 2 líneas de comentario (main:25-26 → 23-24), y main:44-50 pasa a 42-43 (`getMyReferralProgram(supabase)` + `if (!program) return null`).

**Resumen JSX para /ui-check** (lo corre el Director): 0 líneas de marcado, clase, estilo, copy o componente cambian; el árbol que retorna la página es idéntico. Único efecto visible: con programa null el área de contenido queda vacía.

### Comportamiento ante fallo

Main hoy (base `3c610701`):

- Facturas: error o sin datos → `return 0` (queries main:88) → nivel Bronze y "Te faltan $X" (TierCard main:273). Engañoso.
- Referidos: error → `data ?? []` (main:145) → "Todavía no has referido a nadie" (page main:357). Engañoso.
- Tenant ambiguo o con error → `getReferralSettings(admin, undefined)` (main:142) → defaults $80/$60 (`referral-settings-queries.ts:44`). Monto posiblemente incorrecto.
- Lee con service_role (page main:3, 48) por Shipping Mark sin tenant (queries main:85, 127). Como `clients` es único por `(tenant_id, markbox)` (0006:23), podría mezclar facturas o referidos de otro tenant con el mismo Shipping Mark.
- Sin principal → `return null` (page main:44-45). Sin `SUPABASE_SERVICE_ROLE_KEY`, `createAdminClient` lanza (`lib/db/admin.ts:21-29`) → `error.tsx`.

Código adoptado:

- RPC ausente (PGRST202, 0404 sin aplicar) o cualquier error → `return null` (queries:68). postgrest-js 2.106.1 convierte errores HTTP y de red en `{ error }` sin lanzar (`dist/index.cjs:293`), así que ese es el camino común.
- Snapshot vacío o sin Shipping Mark → null (queries:74).
- Página: `if (!program) return null` (page:43) → área de contenido vacía dentro del shell; el layout ya exigió principal (`layout.tsx:38-40`). No muestra código, montos, nivel ni lista.
- Nunca produce créditos o referidos falsos, fallback a service_role, lecturas por Shipping Mark ni datos de otro cliente (lo fijan el test de página y el contrato 0404).
- Valoración: frente a main no empeora integridad ni aislamiento (los mejora). Sí empeora disponibilidad si el código llega a producción sin la función: la página queda vacía. **Ese es el motivo del MIGRATE-FIRST.**

### Paridad de cálculo RPC ↔ main

1. Tenant: la RPC filtra tenant en facturas y referidos (0404:35, 59); main no lo hacía (main:85, 127). Corrección.
2. Shipping Mark: la RPC compara `upper(btrim())` también sobre las copias guardadas (0404:36, 60); main usaba igualdad exacta con el valor normalizado (main:118, 85, 127). Es más inclusiva dentro del mismo tenant.
3. Importes negativos: main sumaba sólo `usd > 0` por factura (main:103); la RPC suma todos (0404:28-33) y TS acota el total a ≥0 (queries:76). `0077:37` no impide `total_amount < 0` y no se encontró código que los cree; no se consultaron datos. Podría bajar el nivel si existieran.
4. Sin tope de 1000 facturas (main:87): la RPC agrega todas las de la ventana.
5. Ventana de 12 meses equivalente en UTC; sólo difiere el 29 de febrero.
6. Monedas: mismas reglas USD/USDT/VES/CNY (0404:28-33 = `types.ts:280-298`; enum 0077:13).

### Mapa de `referrals.test.ts`

| Caso de main | Dónde queda |
|---|---|
| shareCode `REF-` y mayúsculas | TS, mismo nombre (Shipping Mark `" dtd-1004 "`) |
| Nivel por facturación 60000 → silver/gold/toNext | TS, igual |
| Sin facturación → Bronze | TS, igual |
| Excluye borrador y fuera de ventana | Contrato 0404 `$own_program` (test.sql:88-93, 141); TS verifica que usa `billed_usd` de la RPC sin leer invoices |
| VES por fx_rate y omite CNY | Contrato 0404 (test.sql:89-90, 141); TS verifica la normalización numérica ≥0 |
| Créditos ganados y en camino | TS, igual |
| Fallback $80/$60 | Contrato 0404 `$other_tenant` (test.sql:159-162); TS verifica que expone los montos del snapshot |
| Montos configurados (en camino 200) | TS, igual |

### revisar-datos-ve (focal, esta superficie)

Resumen: CORRECTO 7 · ENCONTRADO 0 · NO VERIFICABLE 5.

| Origen.campo | Qué es | Finalidad | Quién lo ve | Líneas |
|---|---|---|---|---|
| `clients.markbox` | Shipping Mark propio | Código REF y cruce | El propio cliente | 0404:15, 26; queries:73, 111 |
| `invoices.{currency,total_amount,fx_rate,status,issued_at,created_at}` | Facturación propia | Nivel del programa | Sólo el agregado `billed_usd`, al propio cliente | 0404:27-41; TierCard page:266 |
| `referral_settings.{referrer,referred}_reward_usd` | Montos del tenant (no personal) | Bono anunciado | Clientes del tenant | 0404:42-43 |
| `referrals.referred_name` / `referred_company` | Nombre y empresa del referido: **titular no usuario** | Seguimiento por quien lo invitó | Sólo el referidor | 0404:48-49; page:360, 363 |
| `referrals.status` / `reward_usd` / `created_at` / `id` | Estado, crédito del referidor, fecha, clave | Créditos y orden | Sólo el referidor | 0404:47, 50-52; page:363, 382 |

Excluidos de la respuesta: `referred_email`, `referred_phone`, `notes`, `lead_id`, `referred_client_id`, `referrer_client_id`, columnas `applied_*` (0237), `accredited_at` (0238), `tenant_id` y `client_id`.

- CORRECTO: identidad y tenant se derivan en la base desde `auth.uid()`, sin parámetros (0404:7, 14-24); `client_users` es único por `auth_user_id` (0080:30), así que `limit 1` es determinista.
- CORRECTO: minimización a 6 campos por referido, sin contacto, notas, lead ni ids internos (0404:47-52; test.sql:148-151). Las facturas no salen de la base: sólo el agregado (0404:27-41). Main materializaba hasta 1000 filas en el servidor (main:82-87).
- CORRECTO: aislamiento entre tenants (0404:35, 59; test.sql:155-168).
- CORRECTO: vínculo revocado o cliente eliminado → sin programa (0404:20-22; test.sql:170-186).
- CORRECTO: `EXECUTE` sólo para `authenticated`, revocado a public/anon/service_role, SECURITY DEFINER con `search_path` vacío (0404:11-12, 75-78; test.sql:113-130).
- CORRECTO: la página deja de construir service_role (page main:3, 48 retirados; lo fija page.test.tsx).
- CORRECTO: no se añaden logs; el error de la RPC no se registra con datos (queries:68).
- NO VERIFICABLE: aviso y base de licitud frente al referido (punto 12, titulares no usuarios); vive en el flujo de invitación, fuera de este diff.
- NO VERIFICABLE: retención de `referrals`. Se usa borrado lógico `deleted_at` (0404:61) y no se ve política de conservación en el diff.
- NO VERIFICABLE: posible colisión de Shipping Mark por mayúsculas o espacios dentro de un tenant (0404:15, 36, 60, frente al único sensible a mayúsculas 0006:23). Requiere datos reales y no se leyó producción. Main tenía una variante más amplia, entre tenants.
- NO VERIFICABLE: ACL y owner reales en producción tras aplicar (sondas de catálogo en el recibo de aplicación).
- NO VERIFICABLE: presencia real de importes negativos (afecta el nivel, no la privacidad).

Normas citadas desde las referencias de la skill: CRBV arts. 28 y 60; SC 332/2001 (finalidad, calidad y temporalidad); Ley Especial contra los Delitos Informáticos, arts. 20-22 (obtención y revelación indebida). El cierre de tenant reduce el riesgo de revelación entre clientes. Esto no es asesoría legal; conviene una segunda revisión con otro modelo.

## RONDA 2 — 2026-09-12 · 0404 aplicada y rama al día con `main`

Adopción explícita del worktree y la rama de la ronda 1, cuya sesión terminó y liberó su claim. Antes de editar: `guard` OK, `git status --porcelain=v1` vacío, `HEAD = 9755dfe183ea335043dea4a6aa1ea1cc1b13c4fd` y claim nuevo `pr78-update-worker-20260912-claude`. No se creó otra rama ni otro worktree, no se tocó el checkout principal ni ningún árbol ajeno, y **no se ejecutó nada contra Supabase**.

### Lo que cambió

- **0404 dejó de ser una espera.** `0404_portal_referidos_por_principal` se aplicó a producción el 2026-09-12 con OK nominal de Sam, ledger `20260912022404 / 0404_portal_referidos_por_principal`. El archivo de esta rama es el aplicado: `md5sum` local da `4f5ef947e393817f7c65f0710ff227e7` y 2952 B sobre `supabase/migrations/0404_portal_referidos_por_principal.sql`, los mismos del ledger; es comprobación **local sobre el archivo**, no una consulta a producción. Por eso `supabase/migrations-baseline.json` queda en `cutoff: 238` con `pendingBelowCutoff` vacío y `$doc` intacto.
- **Declaración de símbolos retirada.** `l04-portal-referral-program-pending-rpc` sale de `supabase/pending-migration-symbol-declarations.json`, que vuelve a `degradations: []`. Se retira junto con la espera, como advertía la ronda 1: con 0404 fuera de pendientes una declaración sobrante hace fallar el gate con exit 2. Los dos archivos quedan **idénticos a `origin/main`** (`git diff origin/main -- <archivo>` vacío en ambos) y ya no aparecen en el diff de la PR. El gate queda en **0 ROJO · 0 AMARILLO**, ahora con la versión de main que ve DDL dentro de bloques `DO`.
- **Nota de importación de la spec 0339** reescrita con el patrón de `docs/specs/0352-bank-reconciliation-rbac/spec.md`: migración aplicada, fecha, ledger, identidad del archivo y remisión a este handoff. Ya no anuncia espera ni bloqueo migrate-first; deja dicho que el orden se cumplió, porque la RPC existe en la base antes de fusionar el código que la consume. **Frontmatter intacto** (`status: done`, `updated: 2026-09-02`): el `done` sigue siendo el importado de #21.
- **Dos merges de `origin/main`**, los dos con el driver semántico **de main** y no con la copia de la rama: nació antes de #88/#93 y su driver viejo unía por `incomingFirstKeys`, así que habría resucitado las esperas que main ya retiró al aplicarlas. Se usó el override del punto 4 «Transición» del ADR-0002, con el script extraído de `origin/main:scripts/merge-generated-records.mjs` a un archivo fuera del repo (`git hash-object` del extraído = `4a5af4e5…`, el blob de main). Primer merge sobre `6c282b44`; segundo sobre `664bb4b2`, cuando el Director integró la PR #94 (SDD-0457, ENOBUFS del harness, hook Stop y `check-unpublished`) mientras corría la validación. Tras el primer merge la rama ya lleva el driver corregido y el `.gitattributes` de main —que además pone `supabase/pending-migration-symbol-declarations.json` bajo el driver—, así que el override del segundo fue redundante pero se conservó por disciplina.

### Ningún merge tuvo conflictos: qué resolvió el driver

De los 12 archivos que tocaba la rama y los 94 que main cambió entre `3c610701` y `6c282b44`, los **únicos compartidos** son los dos registros generados. Ningún archivo de código de producto de L04 (`lib/portal/portal-referral-queries.ts`, `app/portal/(app)/referidos/page.tsx`, los tres tests, la migración y su contrato) fue tocado por main, así que **no hubo conflicto de producto que resolver** y no se descartó ningún lado. El segundo merge (#94) sólo trae `scripts/`, sus pruebas, un handoff, la spec 0457 y el índice: comparte únicamente `docs/specs/README.md`.

`supabase/migrations-baseline.json` en el primer merge, clave por clave:

| Clave | Base `3c610701` | Esta rama `9755dfe1` | `origin/main` `6c282b44` | Resultado del driver |
|---|---|---|---|---|
| `0409_bank_reconciliation_rbac` | presente | igual a la base | retirada (aplicada) | **retirada** |
| `0418_portal_academia_tenant_boundary` | presente | igual a la base | retirada (aplicada) | **retirada** |
| `0419_portal_reclamos_tenant_boundary` | presente | igual a la base | retirada (aplicada) | **retirada** |
| `0430_portal_profile_change_requests_principal_tenant` | presente | igual a la base | retirada (aplicada) | **retirada** |
| `0404_portal_referidos_por_principal` | ausente | añadida por L04 | ausente | **conservada** por el merge y retirada aparte en `d254a7c6` |
| `cutoff` / `$doc` | 238 | 238 | 238 | 238, `$doc` de main |

Con el driver viejo de la rama las cuatro primeras habrían vuelto al archivo. El resultado del driver se reprodujo aparte con los tres blobs para poder separar el merge de la retirada: el merge commit `9ccde2ab` contiene exactamente lo que calculó el driver (baseline con `0404` como única espera) y la retirada de `0404` va en su propio commit.

`docs/specs/README.md` se resolvió por unión semántica en los dos merges y **no se editó a mano**: `corepack pnpm docs:index` posterior no cambió un byte ninguna de las dos veces. Queda en 430 specs, con la fila 0339 de esta rama y la 0457 de main, y `0339` fuera de la lista de huecos.

### Diff contra `origin/main` `664bb4b2` por archivo tras la ronda 2

`git diff origin/main...HEAD --stat` — 10 archivos, +873 −243 (este handoff aporta la mayor parte del Markdown):

| Archivo | Δ | Qué es |
|---|---|---|
| `supabase/migrations/0404_portal_referidos_por_principal.sql` | +78 | Migración aplicada en prod el 2026-09-12; idéntica al ledger en md5 y bytes. |
| `supabase/tests/0404_portal_referidos_por_principal.test.sql` | +192 | Contrato SQL de la RPC, importado del origen. |
| `lib/portal/portal-referral-queries.ts` | +45 −109 | `getMyReferralProgram(db)` sobre `get_portal_referral_program()`; deja de construir `service_role` y de calcular la facturación en el servidor. |
| `app/portal/(app)/referidos/page.tsx` | +4 −11 | Tres hunks: retira los imports `createAdminClient`/`getPortalClient`, corrige el comentario de aislamiento y llama la RPC con la sesión fallando cerrada (`if (!program) return null`). JSX sin cambios. |
| `lib/portal/__tests__/referrals.test.ts` | +93 −121 | Los 8 casos de main adaptados al snapshot de la RPC. |
| `lib/portal/__tests__/portal-referral-query.test.ts` | +70 | Test del origen, sin cambios. |
| `app/portal/(app)/referidos/__tests__/page.test.tsx` | +106 | Test nuevo: con RPC renderiza sin service_role; sin RPC la página devuelve null. |
| `docs/specs/0339-referidos-portal-por-principal/spec.md` | +81 | Spec con la nota de importación actualizada (0404 aplicada). |
| `docs/specs/README.md` | +3 −2 | Fila 0339, conteo 430 y hueco 0339 retirado. |
| `.agents/handoffs/c-l04-portal-referidos.md` | +201 | Este documento, con la ronda 1 y la ronda 2. |

**Ya no aparecen** `supabase/migrations-baseline.json` ni `supabase/pending-migration-symbol-declarations.json`: quedaron iguales a main. `git diff --check origin/main...HEAD` limpio.

### Validación de la ronda 2

`corepack pnpm verify` completo se midió sobre `9763ed96`, los tres commits de la ronda sobre `6c282b44`. El segundo merge `e70133dd` **no cambia una línea de producto**: `git diff --stat 9763ed96 e70133dd -- app lib supabase e2e components` sale vacío y el delta es sólo `scripts/`, sus pruebas, dos documentos y el índice; por eso se repitieron los pasos afectados (harness, docs, numbering, símbolos, ESLint de esos scripts) en lugar de volver a correr los de producto. Recibos fuera de Git en el scratchpad de la sesión: `verify.log` y el driver extraído `dtd-merge-driver-main.mjs`. No se copiaron credenciales, no se abrió ninguna conexión a Supabase y no se aplicó ni verificó nada en la base.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` / `claim` / `guard --owner` | **PASÓ**: guard al tomar el árbol, claim `pr78-update-worker-20260912-claude`, y `guard --owner` revalidado antes de cada commit y antes del segundo merge. Estado inicial vacío y `HEAD = 9755dfe1` como indicaba la asignación. No hay hooks de Git activos en este clon (`core.hooksPath` sin definir, `hooks/` sólo con `.sample`), así que el `--no-verify` del primer merge no salteó ninguna comprobación; los commits siguientes no lo usan. |
| Identidad de 0404 contra el ledger | **PASÓ**: `md5sum` local `4f5ef947e393817f7c65f0710ff227e7` y 2952 B, iguales a los del ledger `20260912022404`. Comprobación local sobre el archivo; **no** se consultó producción. |
| Merge 1 con el driver de main (override ADR-0002 §4) | **PASÓ**: `origin/main` `6c282b44`, sin conflictos. Baseline resuelto clave por clave (cuatro esperas retiradas, 0404 conservada) e índice por unión semántica. El baseline del driver se reprodujo después con los tres blobs y dio el mismo objeto, así que el merge commit conserva exactamente lo que calculó el driver. |
| Merge 2 con el driver de main | **PASÓ**: `origin/main` `664bb4b2` (PR #94), sin conflictos; único archivo compartido `docs/specs/README.md`. Baseline y declaraciones siguieron idénticos a main después del merge. |
| `git diff origin/main -- supabase/migrations-baseline.json` | **PASÓ**: vacío tras los dos merges. `cutoff: 238`, `pendingBelowCutoff` vacío, `$doc` intacto. |
| `git diff origin/main -- supabase/pending-migration-symbol-declarations.json` | **PASÓ**: vacío tras los dos merges. `degradations: []`. |
| `node scripts/check-pending-migration-symbols.mjs` | **PASÓ** las dos veces: `0 ROJO · 0 AMARILLO declarado(s)`, con el gate de main que ya ve DDL dentro de bloques `DO` (#90). |
| `corepack pnpm docs:index` / `corepack pnpm docs:check` | **PASÓ**: 430 specs, 27 huecos. El índice que dejó el driver ya era el canónico en los dos merges (`docs:index` no cambió un byte) y `docs:check` lo confirma sincronizado. |
| `corepack pnpm sdd:check` | **PASÓ**: sin números repetidos; conserva los choques históricos declarados de **migraciones**, ajenos a la spec 0339. |
| Vitest focal de referidos (3 archivos) | **PASÓ** las dos veces: 15 tests (8 adaptados, 5 del origen, 2 de página). |
| `corepack pnpm harness:test` tras el merge 2 | **PASÓ**: 81 pruebas, 0 fallos — cubre lo que trajo #94 (`harness-spawn`, `check-unpublished`, `harness-verify-hook`, `harness-worktree`). |
| ESLint de los cuatro scripts que trajo #94 | **PASÓ**: 0 problemas. |
| `git diff --check origin/main...HEAD` | **PASÓ**: sin espacios finales ni marcadores; 10 archivos en el diff. |
| `corepack pnpm verify` (sobre `9763ed96`) | **FALLÓ, exit 1** (22:34 a 23:18 −04:00). 16 de 17 pasos corrieron de verdad: **15 PASÓ** (harness 33 pruebas, lint, rsc-boundary 1597 módulos, typecheck, edge-functions 4, test 6742 en 534 archivos, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests 173 contratos, schema-rebuild, build), `migrations-applied` **NO DISPONIBLE** y `e2e` **FALLÓ**. Veredicto literal: `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde. |
| `verify` · `sql-tests` | **PASÓ**: 173 contratos con rollback total, incluido `0404_portal_referidos_por_principal.test.sql`. |
| `verify` · `schema-rebuild` | **PASÓ**: 431 migraciones inventariadas, 413 aplicadas desde cero, 18 sólo-ledger, aislamiento multi-tenant sobre 219 tablas. |
| `verify` · `build` | **PASÓ**: build de producción OK dentro del gate; ya no queda pendiente como en la ronda 1. |
| `verify` · `migrations-applied` | **NO DISPONIBLE**: `[SKIP] sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`. El ledger real no se midió en este árbol; la evidencia de que 0404 está aplicada es la que entregó el Director, no una consulta hecha aquí. |
| `verify` · `e2e` | **FALLÓ**. Primera pasada 26,8 min: 139 pasaron, 18 fallaron, 11 flaky, 18 omitidos. Reintento 1/1, 10,7 min: 149 pasaron, 17 fallaron, 2 flaky, 18 omitidos. **15 de esos 17** son los ambientales conocidos por falta de credenciales —`auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari, con el servidor registrando «Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY» en `proxy.ts:67`—: esos son **NO DISPONIBLE** por configuración ausente. `attachments-gastos-pilot-network.spec.ts:4` se cae en el `page.goto` de `/studio/login`, la misma causa. `calculadora-hidratacion.spec.ts:42` en chromium **no** es de credenciales: es flake de hidratación (pasó en la primera pasada de chromium y en la ronda 1), toca la calculadora pública y no hay una sola línea de esta rama ahí; se reporta como fallo, sin absolver. **Ningún spec de Referidos falló.** |
| `verify` · watchdog del e2e (SDD-0454) | **No hizo falta cortar**: el paso terminó por sí mismo en las dos pasadas, sin línea `watchdog:`. Después del gate: 0 procesos con este worktree en su línea de comando y 0 conexiones en el puerto 3367. No se ejecutó ningún `taskkill` y no se tocó proceso ajeno. |
| CI alojado «Calidad local sin secretos» sobre el SHA publicado `e0e57054` | **PASÓ**: los 14 pasos de calidad en verde (ESLint, frontera RSC, TypeScript, Edge Functions, unitarios, harness Director/Worker, documentación SDD, numeración SDD y migraciones, código contra migraciones pendientes, constantes de features, registro de componentes, gobernanza ejecutable, build de producción sin secretos y árbol reproducible). [run 34670656082](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34670656082). No cubre e2e autenticado ni el ledger real: siguen sin medirse. |
| Producción / Supabase | **NO EJECUTADO** por límite del encargo: no se aplicó ninguna migración, no se leyeron filas y no se abrió conexión alguna. |
| `/ui-check` | **NO EJECUTADO**: lo corre el Director. El JSX no cambia en esta ronda ni en la anterior. |

## VALIDACIÓN (RONDA 1)

Commit de producto validado: `dbc1132e7f132bcb738b33432d98c91aacf1eb84` (tree `edea0022`), sobre `3c610701`. Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4, Docker 29.7.2. Sin credenciales copiadas ni `.env` operativo. Recibos fuera de Git en la carpeta de evidencia de la sesión: `install.log`, `symbols-antes-declaracion.log`, `symbols-despues-declaracion.log`, `vitest-focal.log`, `typecheck.log`, `eslint-focal.log`, `docs-sdd-drivers.log`, `schema-rebuild.log`, `sql-contrato-0404-focal.log`, `verified-product-manifest.json`, `verify.log`, `verify.exit`.

| Comprobación | Estado y evidencia |
|---|---|
| `guard` + `claim --owner c-l04-worker-20260911-claude` | PASÓ; revalidado con `--owner` y rama antes del commit. |
| `corepack pnpm install --frozen-lockfile` | PASÓ, 24,7 s; lockfile intacto. Aviso heredado de pnpm sobre `pnpm.onlyBuiltDependencies`. |
| Blobs (`git hash-object` con y sin filtros) | PASÓ: 5 idénticos más la spec sin nota. |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ. |
| `corepack pnpm sdd:check` | PASÓ, 416 specs / 421 migraciones; colisiones históricas declaradas. |
| `corepack pnpm docs:index` y `docs:check` | PASÓ, 416 specs. |
| `node scripts/check-schema-rebuild.mjs` | PASÓ: inventario 421, 403 desde cero (incluye 0404), 18 sólo-ledger, aislamiento en 219 tablas; sin contenedores remanentes. |
| Contrato 0404 focal (contenedor propio `postgres:17`, 17.11) | PASÓ, rollback `t`; contenedor retirado. |
| `node scripts/check-pending-migration-symbols.mjs` | Antes de declarar: 1 ROJO esperado (queries:67). Después: PASÓ, 0 ROJO · 1 AMARILLO. |
| Vitest focal (3 archivos) | PASÓ, 15 tests: 8 adaptados, 5 del origen y 2 de página. |
| `corepack pnpm typecheck` | PASÓ. |
| ESLint de los 5 archivos TS/TSX tocados | PASÓ. |
| `git diff --check` y allowlist | PASÓ: 11 archivos de producto más este handoff. |
| `corepack pnpm verify` | FALLÓ / INCOMPLETO: detenido por el Worker según el protocolo del Director tras más de 15 min sin salida en el reintento E2E. 14 pasos PASÓ; `migrations-applied` NO DISPONIBLE; `e2e` FALLÓ/NO DISPONIBLE (colgado, detenido); `build` NO EJECUTADO dentro de verify. Sin veredicto propio: el `exit=0` del envoltorio es artefacto de la detención forzada, **no es verde**. |
| `/ui-check` | NO EJECUTADO: lo corre el Director (resumen JSX arriba). |
| E2E autenticado y `migrations-applied` | NO DISPONIBLE: sin credenciales Supabase; no se copiaron. |

Detalle del gate canónico (inicio 04:43:46, detención 05:28:54):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ. |
| lint | PASÓ, 0 errores; 8 advertencias en archivos intactos (`NewPurchaseWizard.test.tsx`, `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx`, `KommoClient.tsx`). |
| rsc-boundary | PASÓ, 1597 módulos. |
| typecheck | PASÓ. |
| edge-functions | PASÓ, 4 funciones. |
| test | PASÓ, 6691 tests en 528 archivos, 226,36 s. |
| docs:check | PASÓ, 416 specs. |
| numbering | PASÓ, con las colisiones históricas declaradas. |
| feature-constants | PASÓ, 5 banderas. |
| components:check | PASÓ. |
| governance:check | PASÓ. |
| migrations-applied | NO DISPONIBLE: SKIP sin `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; ledger real no medido. |
| pending-migration-symbols | PASÓ, 0 ROJO · 1 AMARILLO declarado (`get_portal_referral_program`). |
| sql-tests | PASÓ, 163 contratos, incluido `0404_portal_referidos_por_principal.test.sql`; rollback total. |
| schema-rebuild | PASÓ, 403 desde cero + 18 sólo-ledger; aislamiento en 219 tablas. |
| e2e | FALLÓ/NO DISPONIBLE: colgado, detenido por el Worker según el protocolo del Director. Puerto 3367. Primera pasada (8,7 min): 152 pasaron, 15 fallaron, 1 flaky y 18 omitidos. Los 15 fallos son `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari; el servidor registra la falta de URL/clave Supabase en `proxy.ts:67` (mismo patrón ambiental que L16; ninguno toca Referidos). Flaky: chromium `auth.spec.ts:74`. El reintento automático 1/1 dejó de producir salida a las 05:10:55; a las 05:28:54 se detuvo sólo el árbol propio con `taskkill /PID 5928 /T /F` (corepack → pnpm → verify.mjs 25988 → Playwright 34940 con 6 workers y sus navegadores → next dev 42672/21700 en 3367). Sin sobrevivientes ni escucha en 3367. Otros dos `verify.mjs` vivos (45176, 44676) son de otros Workers y no se tocaron. Sin reintento. |
| build | NO EJECUTADO dentro de verify; lo cubre `check-build.mjs` del CI «Calidad continua» sobre el SHA publicado (ver PR / BRANCH). |

## COMMITS

Ronda 1 (base `3c610701`):

- `dbc1132e7f132bcb738b33432d98c91aacf1eb84`: SDD-0339, migración/contrato 0404, spec con nota, adopción focal, tests, baseline, declaración e índice.
- `9755dfe183ea335043dea4a6aa1ea1cc1b13c4fd`: handoff de la ronda 1.

Ronda 2:

- `9ccde2ab66802a1dabc5f65af065930b7ec6d91d`: merge de `origin/main` `6c282b44` con el driver semántico de main; sin conflictos, baseline resuelto clave por clave.
- `d254a7c6`: retirada de la espera `0404_portal_referidos_por_principal` y de su declaración de símbolos; los dos archivos quedan iguales a main.
- `9763ed96`: nota de importación de la spec 0339 con la aplicación registrada; frontmatter intacto. Es el SHA sobre el que corrió `verify` completo.
- `e70133dd4684b6a674ba31297b007a000b997b7f`: segundo merge de `origin/main` `664bb4b2` (PR #94) pedido por el Director; sin conflictos, sólo el índice compartido.
- Commit que contiene este documento: cierre durable de la ronda 2; el hash final se registra en la PR.

## PR / BRANCH

[PR #78 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/78), base `main`, rama `codex/c-l04-portal-referidos`, worktree indicado arriba. Título de la ronda 2: «feat(studio): SDD-0339 — L04 referidos Portal por principal (0404 ya aplicada)»; se retiró el prefijo «[NO FUSIONAR ANTES DE APLICAR 0404]» porque la condición ya se cumplió. **La PR sigue en borrador**: la marca lista y la integra el Director. Rama publicada explícitamente a sí misma con `git push origin codex/c-l04-portal-referidos:codex/c-l04-portal-referidos`, sin force; sin merge, sin aplicar nada a Supabase, sin leer producción y sin deploy. Tras el push GitHub reporta la PR `MERGEABLE` / `mergeStateStatus: CLEAN` sobre `e0e570549591e7c4e5b2fe2b71a40fcfc328f6ea`, con «Calidad local sin secretos» en verde y el preview de Vercel disparado por el push (no se ejecutó ningún deploy a mano). Antes de esta ronda GitHub reportaba la PR `CONFLICTING` contra main; los dos merges de esta ronda son lo que la vuelve integrable y la dejan al día con `664bb4b2`.

## PENDIENTES DE ESTA TAREA

- Revisión del Director, `/ui-check` y CI alojado del último SHA; mantener la PR en borrador hasta que él decida.
- ~~MIGRATE-FIRST: aplicar 0404 antes de fusionar y luego retirar la espera, la declaración y la nota~~. **Hecho:** 0404 se aplicó el 2026-09-12 (ledger `20260912022404`) y esta ronda retiró la espera del baseline y la declaración `l04-portal-referral-program-pending-rpc`, y actualizó la nota de la spec 0339. El bloqueo migrate-first ya no aplica.
- El `e2e` del gate quedó FALLÓ y `migrations-applied` NO DISPONIBLE: el cierre canónico **no** está verde en este árbol y así se reporta. El CI alojado sobre el SHA publicado es la medición que falta.
- E2E autenticado y ledger real siguen sin medirse aquí; no son autorización para copiar credenciales ni para tocar producción.

## FUERA DE ALCANCE DETECTADO

- `lib/portal/referral-invite.ts:13-16` dice "AISLAMIENTO: igual que `portal-referral-queries.ts` — corre con el ADMIN client". Tras L04 esa comparación queda obsoleta (la invitación sigue con admin; las queries no). Es sólo un comentario y no está en la allowlist.
- La aceptación histórica de la spec 0339 cita `scripts/__tests__/portal-service-role-boundary.test.mjs` ("9 rutas / 17 construcciones"). Ese test no existe en main y no se importó (fuera del encargo). Tampoco se importaron la auditoría ni los handoffs de #21 que lista su allowlist.
- Diferencia de paridad 3 (importes negativos): el SQL debe ser idéntico al origen, así que cualquier ajuste requiere otra SDD/migración.
- Aviso heredado de pnpm sobre `pnpm.onlyBuiltDependencies`, sin cambio de configuración.
- Main ya trae el patrón `getPortalClientPrincipal` en otras páginas del Portal (L18/L11/L22). `app/portal/(app)/referidos/page.tsx` no lo usa: se apoya en el principal que exige `app/portal/(app)/layout.tsx:38-40` y en el acotado que hace la propia RPC desde `auth.uid()`. Unificar ese patrón en Referidos es tarea aparte.
- `e2e/calculadora-hidratacion.spec.ts:42` es flake de hidratación de la calculadora pública, ajeno a L04 y reproducible sólo bajo carga; conviene seguimiento propio si vuelve a aparecer.
- El e2e de `verify` sigue cayéndose por credenciales ausentes de Supabase (`auth.spec.ts`, `global-search.spec.ts`, y el `page.goto` de `/studio/login`): es ambiental, ya observado en la ronda 1 y en otras ramas del bloque C.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar la PR draft sobre el SHA publicado de la ronda 2, con base `origin/main` `664bb4b2`, correr `/ui-check` (0 líneas JSX cambian) y decidir si la diferencia de paridad por importes negativos exige seguimiento.
- **Ya no hay orden migrate-first que respetar:** 0404 está aplicada (ledger `20260912022404`) y la rama no declara ninguna espera. `git diff origin/main` sale vacío tanto en `supabase/migrations-baseline.json` como en `supabase/pending-migration-symbol-declarations.json`, así que esta PR no compite con ninguna otra por esos dos registros.
- Verificación por objeto de 0404 en producción: no se hizo en este árbol y no se pidió. Si hace falta el recibo, sirven las sondas de sólo catálogo que dejó la ronda 1 (`to_regprocedure`, `prosecdef`, `proconfig`, `has_function_privilege`, `md5(prosrc)`), fuera de esta tarea.
- Sondas sugeridas para el recibo de 0404, sólo catálogo y sin filas de negocio (las dejó la ronda 1): `to_regprocedure('public.get_portal_referral_program()') is not null`; `prosecdef` y `proconfig` (`search_path=""`) en `pg_proc`; `has_function_privilege` para anon/service_role = false y authenticated = true; `md5(prosrc)` frente al cuerpo del archivo, como en `b49f1c0b`.
- Alcance SQL: 0404 sólo crea la función, su comentario y su ACL (0404:7-78); no modifica objetos existentes. Cualquier reversión se evalúa en su momento según el runbook; no hay rollback probado en esta tarea.
- Cambios compartidos: `docs/specs/README.md` es el único registro generado que esta rama sigue tocando (fila 0339, conteo 430, hueco retirado). Si otra PR se integra antes, el driver de main resuelve la unión; esta rama ya lo lleva instalado y con `.gitattributes` al día.
- Sin subagentes ni sesiones consumidoras de este árbol. No se levantaron contenedores propios en esta ronda salvo los efímeros de `sql-tests` y `schema-rebuild` dentro de `verify`, que el propio gate retira; el e2e terminó solo y no dejó sobrevivientes ni el puerto 3367 ocupado.
- Ownership liberado al cierre con `node scripts/harness-worktree.mjs release --owner pr78-update-worker-20260912-claude`, después del último commit y del push. Se conservan worktree y rama. Si hace falta corregir algo tras el CI o la revisión, se vuelve a reclamar.
