# L04 — Referidos del Portal por principal (RPC 0404)

Fecha: 2026-09-11. Task ID: `c-l04-portal-referidos`.
Owner / sesión escritora: `c-l04-worker-20260911-claude`. Estado: lista-para-revision en PR borrador; **NO FUSIONAR antes de aplicar y verificar 0404** (migrate-first).
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l04-portal-referidos`.
Rama: `codex/c-l04-portal-referidos`. Base: `3c6107012f754953323202a7386b3e7811593814` (origin/main sin cambios al cierre).
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

## VALIDACIÓN

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

- `dbc1132e7f132bcb738b33432d98c91aacf1eb84`: SDD-0339, migración/contrato 0404, spec con nota, adopción focal, tests, baseline, declaración e índice.
- Commit que contiene este documento: cierre durable del handoff; hash final en la PR.

## PR / BRANCH

[PR #78 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/78), base `main`, rama `codex/c-l04-portal-referidos`, worktree indicado arriba. Título: «[NO FUSIONAR ANTES DE APLICAR 0404] feat(studio): SDD-0339 — L04 referidos Portal por principal (migrate-first)». Rama publicada explícitamente a sí misma; sin merge, sin aplicar 0404, sin leer producción y sin deploy. El SHA final y la corrida del CI «Calidad continua» sobre ese SHA, que cubre el build no ejecutado dentro de verify, se registran en la PR; el commit de este documento sólo añade Markdown al producto validado en `dbc1132e`.

## PENDIENTES DE ESTA TAREA

- Revisión del Director, `/ui-check` y CI alojado del último SHA; mantener la PR en borrador.
- MIGRATE-FIRST, fuera de esta autorización: OK nominal de Sam para `0404_portal_referidos_por_principal` → aplicar de a una con name exacto según el runbook → verificar el objeto → en esta rama, retirar la espera del baseline y la declaración y actualizar la nota de la spec, como hizo `b49f1c0b` → sólo entonces fusionar.
- E2E autenticado y ledger real quedan sin medir; no son autorización para copiar credenciales ni aplicar migraciones.

## FUERA DE ALCANCE DETECTADO

- `lib/portal/referral-invite.ts:13-16` dice "AISLAMIENTO: igual que `portal-referral-queries.ts` — corre con el ADMIN client". Tras L04 esa comparación queda obsoleta (la invitación sigue con admin; las queries no). Es sólo un comentario y no está en la allowlist.
- La aceptación histórica de la spec 0339 cita `scripts/__tests__/portal-service-role-boundary.test.mjs` ("9 rutas / 17 construcciones"). Ese test no existe en main y no se importó (fuera del encargo). Tampoco se importaron la auditoría ni los handoffs de #21 que lista su allowlist.
- Diferencia de paridad 3 (importes negativos): el SQL debe ser idéntico al origen, así que cualquier ajuste requiere otra SDD/migración.
- Aviso heredado de pnpm sobre `pnpm.onlyBuiltDependencies`, sin cambio de configuración.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar la PR draft sobre el SHA publicado y la base `3c610701`, correr `/ui-check` (0 líneas JSX) y decidir si la diferencia de paridad por importes negativos exige seguimiento antes de aplicar.
- **Orden migrate-first:** OK nominal de Sam → aplicar sólo `0404_portal_referidos_por_principal` con name exacto → verificar el objeto → retirar en esta rama la espera del baseline **y** la declaración, juntas: con 0404 fuera de pendientes, una declaración sobrante hace fallar el check con exit 2 → actualizar la nota de la spec → fusionar. Fusionar no autoriza aplicar y aplicar no autoriza fusionar.
- Sondas sugeridas tras aplicar, sólo catálogo y sin filas de negocio: `to_regprocedure('public.get_portal_referral_program()') is not null`; `prosecdef` y `proconfig` (`search_path=""`) en `pg_proc`; `has_function_privilege` para anon/service_role = false y authenticated = true; `md5(prosrc)` frente al cuerpo del archivo, como en `b49f1c0b`.
- Alcance SQL: 0404 sólo crea la función, su comentario y su ACL (0404:7-78); no modifica objetos existentes. Cualquier reversión se evalúa en su momento según el runbook; no hay rollback probado en esta tarea.
- Archivos compartidos con otros lotes (#69–#74, L05, L02, L06): baseline e índice usan el driver `dtd-generated-records`, pero `supabase/pending-migration-symbol-declarations.json` **no** está en `.gitattributes`. Si otro lote añade su degradación (L05 lo hace en su rama), el conflicto será textual y hay que unir ambas entradas a mano.
- Sin subagentes ni sesiones consumidoras de este árbol. Contenedores efímeros propios (`dtd_l04_sqlfocal` y el de rebuild) retirados; árbol de verify detenido sin sobrevivientes.
- Ownership liberado al cierre con `node scripts/harness-worktree.mjs release --owner c-l04-worker-20260911-claude`, después del último commit, push y edición de la PR. Se conservan worktree y rama. Si hace falta corregir algo tras el CI o la revisión, se vuelve a reclamar.
