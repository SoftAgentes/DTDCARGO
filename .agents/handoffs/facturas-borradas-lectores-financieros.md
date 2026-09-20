# Handoff — facturas borradas fuera de los lectores financieros (SDD-0465)

Fecha: 2026-09-14. Task ID: `facturas-borradas-lectores-financieros`.
Owner / sesión escritora: `worker-w1-facturas-borradas-20260914` (Worker Claude Code, asignado por la sesión Director del 2026-09-14). Sin subagentes.

Estado de la tarea: lista-para-revision.

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/facturas-borradas-lectores-financieros` (preexistente, creado por el Director).
  - `guard` PASÓ y `claim --owner worker-w1-facturas-borradas-20260914` adquirido sobre el árbol limpio en `b07ad98b`. `guard --owner` revalidado antes de cada commit.
- **Rama:** `codex/facturas-borradas-lectores-financieros`, creada desde `origin/main` `b07ad98bda4da35086d8207640321a7995fc8f24`. `origin/main` seguía en ese SHA al publicar (fetch del 2026-09-14): no hizo falta integrar main.
- **SDD:** `docs/specs/0465-facturas-borradas-lectores-financieros/spec.md`, en `done` (los cinco criterios tienen evidencia abajo; PR y merge se registran aparte). Reserva del Director en `codex/sdd-reserve-0465-facturas-borradas-lectores-financieros` (`fd11416711913df5f4f271fc5ac84f9c586a0c98`), incorporada con cherry-pick como `3aaad629`. No se reservó otro número.
- **Dependencias:** ninguna. No depende de 0414 ni de 0415. Sin migración: `0230_fix_rls_soft_delete_blocked` dejó el filtro de borrados en la capa de aplicación a propósito y no hizo falta SQL.
- **Permisos usados:** commits locales selectivos; publicación de la rama y PR en borrador contra `main` (autorizados en el encargo). Sin merge, sin deploy, sin migraciones, sin leer filas de negocio, sin tocar ruleset ni borrar ramas. Producción Supabase no se tocó; no se buscaron credenciales ni se copió `.env`.

## OBJETIVO ORIGINAL

Que ninguna factura con soft delete cuente, cobre ni reciba recordatorios en Studio: los lectores financieros filtran `deleted_at` y el borrado lógico solo acepta los estados que la spec fije con evidencia.

Aceptación asignada:

1. `listInvoices`, `getInvoiceByCode` e `invoiceKpis` (`lib/studio/invoice-queries.ts`) excluyen `deleted_at` no nulo (no existe vista de papelera para facturas).
2. `receivablesQueue` (`lib/studio/payment-queries.ts`) excluye facturas borradas, y con ella la cola de Cobranzas y los recordatorios por correo.
3. `financeInvoiceKpis` (`lib/studio/dashboard/dashboard-kpi-queries.ts`), `revenueByShipment` (`lib/studio/costing/queries.ts`) y `applicableInvoicesForReferrer` (`lib/studio/fidelizacion/referral-credit-queries.ts`) excluyen facturas borradas.
4. `softDeleteInvoice` (`app/studio/(app)/facturacion/actions.ts`) restringe el estado permitido y responde con mensaje claro cuando no procede; la regla queda escrita en la spec con su justificación.
5. Un test de regresión por lector con una factura borrada en el fixture; ningún test existente se debilita.

Alcance: los archivos citados, sus tests, la spec 0465, el índice de specs y este handoff. Exclusiones: RLS y migraciones (0230 y 0414 no se tocan); Portal y `lib/portal`; nada de la PR #21; `supabase/migrations-baseline.json` intacto.

Las rutas reales de dos archivos difieren de las citadas en el encargo: `financeInvoiceKpis` vive en `lib/studio/dashboard/dashboard-kpi-queries.ts` y `applicableInvoicesForReferrer` en `lib/studio/fidelizacion/referral-credit-queries.ts`. Son las mismas funciones; no había otras con esos nombres.

## COMPLETADO

- **Criterios 1, 2 y 3 — lectores** (`fed55e04`). Los siete lectores agregan `.is("deleted_at", null)` a su consulta sobre `invoices`, en la base y no en memoria (misma forma que Fiscal, Reportes y Rendiciones ya usaban). Una factura borrada ya no se lista en ninguna pestaña, no se abre por código (`null` → `notFound()`/404 en el PDF), no suma a los KPI de Facturación ni del tablero, no es ingreso del embarque, no se ofrece al crédito de referido y no entra a la cola de Cobranzas.
- **Criterio 2 — efecto en recordatorios.** `receivablesQueue` es la única fuente de `previewRecordatorios`/`enviarRecordatorios` (SDD-0306). Con el filtro, una factura borrada no es destinataria, tampoco aparece como omitida (no existe para el criterio) y `intersectarPedido` la descarta aunque el navegador mande su código. `contextoDeEnvio` (SDD-0353) recibe la cola ya filtrada, así que `collections_mail_context` sólo se consulta por facturas vivas; no cambia la RPC ni 0410/0415 (SDD-0358). Probado en `lib/studio/__tests__/receivables-queue.test.ts`.
- **Criterio 4 — `softDeleteInvoice`** (`5787a62f`). Sólo acepta `borrador`. Lee `id, status, invoice_code, deleted_at`; `emitida/parcial/pagada/vencida` → «Solo las facturas en borrador pueden eliminarse. Esta está *estado*: si no corresponde, anúlala con un motivo y queda registrada.»; `anulada` → «Esta factura ya está anulada y se conserva como registro; no se elimina.»; ya borrada → «Esta factura ya está eliminada.»; no encontrada → «Factura no encontrada.». El UPDATE repite `status = 'borrador'` y `deleted_at is null` como guarda de carrera y, si no matchea, responde «La factura cambió de estado mientras se eliminaba…» sin revalidar. Revalida el listado y el detalle al borrar. La regla y su evidencia (MP-01 §2/§4/§5, asiento de venta SDD-0040, recibos SDD-0041, créditos SDD-0137, libro de ventas SDD-0073, `void_invoice_with_audit_reason` en 0294, `next_invoice_code` en 0077 sin reutilizar códigos, auditoría por trigger D2 SDD-0174) están en la spec.
- **Criterio 5 — tests.** 30 casos nuevos con una factura borrada en el fixture, sin cambiar ninguna aserción existente. Los dobles de Supabase **aplican** `is("deleted_at", null)` sobre las filas (y `eq`/`maybeSingle` donde hacía falta), así que quitar el filtro del lector vuelve a meter la borrada y la prueba cae; donde el fixture lo permite hay un control del doble (la misma fila con `deleted_at: null` sí entra).
  - `lib/studio/__tests__/invoice-queries.test.ts` (+5): `listInvoices` en `all` y `overdue`, filtro pedido a la base, `getInvoiceByCode` null/viva, `invoiceKpis`.
  - `lib/studio/__tests__/receivables-queue.test.ts` (nuevo, 7): exclusión aunque esté más vencida, filtros `is`/`neq` pedidos, no lee sus gestiones, `collectionKpis`, control del doble, recordatorio no sale ni la lista como omitida, `intersectarPedido`.
  - `lib/studio/dashboard/__tests__/dashboard-kpi-queries.test.ts` (nuevo, 3).
  - `lib/studio/costing/__tests__/queries.test.ts` (+1).
  - `lib/studio/fidelizacion/__tests__/referral-credit-queries.test.ts` (+1).
  - `app/studio/(app)/facturacion/__tests__/soft-delete-invoice.test.ts` (nuevo, 13): borrador escribe con guardas y revalida; sin match; error de base; cuatro estados rechazados sin escribir; anulada; ya eliminada; no encontrada; error de lectura; rechazo RBAC sin leer.
- **Reparación necesaria fuera de la allowlist asignada** (`5787a62f`): `scripts/__tests__/invoice-read-boundary.test.mjs` (gate SDD-0357) congela cuántas veces cada archivo llama `.from("invoices")` y exige revisar guard y tenant de cada caller nuevo. La lectura previa de `softDeleteInvoice` es ese caller: el inventario pasa de 10 a 11 en `facturacion/actions.ts` y de 45 a 46 en total, con un comentario en el gate y la revisión (guard `moduleEditDenial("invoices")`, cliente de sesión bajo RLS, cuatro columnas, propósito) en la spec. Ningún otro archivo cambia su conteo. Queda para tu OK explícito.
- **Spec 0465** completa y en `done`; índice regenerado con `docs:index` (453 specs) (`b5f05179`).

## VALIDACIÓN

| Comando | Alcance / SHA observado | Veredicto |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` | worktree en `b07ad98b` | PASÓ |
| `node scripts/harness-worktree.mjs guard` / `claim --owner …` / `guard --owner …` | antes de editar y antes de cada commit | PASÓ |
| `corepack pnpm exec vitest run` sobre los 6 archivos de tests tocados | árbol igual a `5787a62f` en esos archivos | PASÓ · 6 archivos, 77 tests |
| `corepack pnpm exec vitest run` completa | árbol previo al ajuste del inventario 0357 | 557 archivos PASARON, 1 FALLÓ: `scripts/__tests__/invoice-read-boundary.test.mjs` por el caller nuevo (10 → 11). Sin otro rojo. |
| `corepack pnpm exec vitest run scripts/__tests__/invoice-read-boundary.test.mjs app/studio/(app)/facturacion/__tests__/soft-delete-invoice.test.ts` | árbol igual a `5787a62f` | PASÓ · 2 archivos, 16 tests |
| `corepack pnpm exec eslint` sobre los 12 archivos tocados + el gate | ídem | PASÓ |
| `corepack pnpm typecheck` | árbol igual a `5787a62f` en producto | PASÓ (exit 0) |
| `corepack pnpm docs:index` · `docs:check` | `b5f05179` | PASÓ · 453 specs sincronizados |
| `corepack pnpm sdd:check` | `b5f05179` | PASÓ · sin números repetidos (los choques históricos de migraciones que imprime son informativos y preexistentes) |
| `git diff --check` | antes de cada commit | PASÓ |
| `E2E_PORT=3101 corepack pnpm verify` (corrida 1) | `b5f05179`, árbol limpio | FALLÓ sólo por `e2e` (ambiental) · 15 pasos PASARON · `migrations-applied` NO DISPONIBLE · desglose abajo |
| `E2E_PORT=3101 corepack pnpm verify` (corrida 2, log completo) | `b5f05179` + este handoff sin commit | Mismo resultado, con las líneas literales: `[OK] harness`, `[OK] lint`, `[OK] rsc-boundary`, `[OK] typecheck`, `[OK] edge-functions: 4 función(es) compilan`, `[OK] test` (`Test Files 558 passed (558)`, `Tests 7256 passed (7256)`), `[OK] docs:check`, `[OK] numbering`, `[OK] feature-constants: 5 bandera(s) coinciden con lo declarado`, `[OK] components:check`, `[OK] governance:check`, `[SKIP] migrations-applied: sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (¿worktree sin .env.local?)` → NO DISPONIBLE, `[OK] pending-migration-symbols: 0 ROJO · 0 AMARILLO declarado(s)`, `[OK] sql-tests`, `[OK] schema-rebuild`, `[FAIL] e2e (exit 1)` (intento 1: `15 failed · 18 skipped · 153 passed (9.6m)`; reintento del gate: `15 failed · 18 skipped · 152 passed (4.0m)`; los 15 son otra vez `auth.spec.ts` × 12 y `global-search.spec.ts` × 3, verificado con `test-results/.last-run.json` de esa corrida), `[OK] build`, resumen `[FAIL] verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` Sin línea `watchdog:`. |

Desglose de `verify` (corrida 1). Mi captura conservó las últimas 150 líneas, así que el
veredicto por paso sale del resumen literal del gate — `16 de 17 pasos corrieron de verdad`,
`[AVISO] omitido: migrations-applied — no se midio (ver su [SKIP] arriba)`, `[OK] build`,
`[FAIL] verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` —
y del `test-results/.last-run.json` de esa corrida. La corrida 2 guarda el log completo para
citar cada línea.

| Paso | Veredicto |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, test, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests, schema-rebuild, build | PASÓ — los 16 pasos que corrieron menos el único fallo (`e2e`); `[OK] build` literal |
| migrations-applied | NO DISPONIBLE — sin credenciales de Supabase en el worktree (no se buscaron ni copiaron); el gate lo marca «CRÍTICOS SIN MEDIR». Es validación de release, no de esta tarea: no hay migración nueva. |
| e2e | FALLÓ — 15 tests fallidos de 186 listados, exactamente los basales conocidos: `auth.spec.ts` × 12 («Studio: form email+password, submit vacío no autentica», «Back: form email+password presente», «Portal: magic link (email, sin password)», «Portal: /entrar ofrece las dos puertas…» × chromium, mobile-chrome, mobile-safari) y `global-search.spec.ts` × 3 («sin sesión, /studio rebota al login» × 3 proyectos). Todos dependen de sesión/Supabase que este worktree no tiene. Mapeados desde `test-results/.last-run.json` con `playwright test --list --reporter=json`. No se reintentó en bucle. Ninguno toca Facturación, Cobranzas, tablero, costeo ni fidelización. |

## COMMITS

- `3aaad629` — cherry-pick de la reserva SDD-0465 (`fd114167`).
- `bd0c437e` — `docs(handoff)`: contrato de la tarea antes del primer cambio de producto.
- `fed55e04` — `fix(studio)`: los siete lectores excluyen facturas borradas + tests por lector (criterios 1-3 y 5).
- `5787a62f` — `fix(studio)`: `softDeleteInvoice` sólo acepta borradores + su test + inventario SDD-0357 (criterio 4 y 5).
- `b5f05179` — `docs(sdd)`: spec 0465 e índice.
- `1e10d27b` — `docs(handoff)`: cierre (validación, pendientes, fuera de alcance); es el head con el que se abrió la PR #116.
- Cierre final: commit que contiene este documento con la URL de la PR (hash final en la PR).

## PR / BRANCH

- Rama `codex/facturas-borradas-lectores-financieros` → `origin/codex/facturas-borradas-lectores-financieros`, base `main` (`b07ad98b`), worktree arriba.
- PR: [#116](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/116), en borrador, base `main`. Abierta con head `1e10d27b`; el head a revisar es el commit que contiene esta línea (el último de la rama), que sólo cambia este handoff.

## PENDIENTES DE ESTA TAREA

Ninguno para la aceptación: los cinco criterios están implementados y probados. Huecos de validación que no dependen de un cambio de código de esta tarea, para que no queden escondidos: el e2e local falla por entorno (15 basales de `auth.spec`/`global-search.spec`, sin Supabase) y `migrations-applied` no se midió por falta de credenciales; ambos requieren un entorno con acceso.

## FUERA DE ALCANCE DETECTADO

1. **El drawer no muestra el rechazo.** `app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx:766` sólo actúa sobre `result.ok`; si el servidor rechaza el borrado, `result.error` no se ve. La UI sólo llega ahí con borradores (`isEditable`), así que el caso real es una carrera (emitida en otra pestaña). UI no asignada.
2. **Sin restauración ni papelera de facturas.** MP-01 §2 exige política de restauración para P2; un borrador eliminado sólo vuelve por SQL. Preexistente.
3. **Otros lectores de `invoices` sin filtro de `deleted_at`** (medidos con grep, no tocados): `lib/studio/collections-actions.ts:106`, `:379`, `:525` (registrar/identificar/anular cobro, por id); `app/studio/(app)/cobranzas/actions.ts:164` (`logActivity`, por id); `app/studio/(app)/cobranzas/recibo/[code]/page.tsx:119`; `app/studio/(app)/fidelizacion/actions.ts:388` (`applyReferralCredit`, por id); `lib/studio/accounting/referral-credit-posting.ts:354` (reversión, cliente admin); `lib/studio/kommo-contact-status.ts:215` (estado de contacto, cliente admin); `lib/studio/costing/queries.ts:510` (`latestVesFxRate`); `lib/studio/renditions/queries.ts:308` y `:479`. Son lookups por id que reciben ids de lectores ya filtrados o de recibos existentes; ninguno agrega, cobra ni escribe correo por sí solo. Si se quiere cerrar la frontera del todo, conviene un guard `deleted_at` en `registerCollectionFor`/`identifyPayment`/`applyReferralCredit`.
4. **La base sigue exponiendo borradas a un cliente PostgREST directo** con rol `accounting`/`admin` desde 0230 (por diseño). Cerrarlo en SQL es otra SDD con migración.
5. `sdd:check` imprime siete choques históricos de migraciones ya aplicadas (0277, 0297, 0336, 0342, 0362, 0363, 0394) marcados «NO se renumera»; preexistentes e informativos.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador sobre el SHA que registra la sección PR / BRANCH; integrar sólo con autorización de Sam. Sin migración que aplicar. El merge a `main` dispara Vercel porque el merge toca código (no es doc-only).
- **Decisión que te pido:** OK explícito al ajuste de `scripts/__tests__/invoice-read-boundary.test.mjs` (gate SDD-0357, fuera de la allowlist asignada): +1 caller de `.from("invoices")` por la lectura previa de `softDeleteInvoice`, revisado por guard y tenant en la spec. La alternativa sin tocar el gate sería un UPDATE condicionado sin lectura previa con un mensaje genérico, que pierde el mensaje por estado que pide el criterio 4; lo dejé con lectura previa.
- **Contratos compartidos:** `receivablesQueue` cambia a quién se le escribe el recordatorio (sólo facturas vivas con saldo vencido), documentado en la spec y probado; no cambia la RPC `collections_mail_context` ni 0410/0415 (SDD-0353/0358). Los otros tres Workers en paralelo no comparten archivos con esta tarea; `origin/main` no se movió desde la base.
- **Publicación:** rama publicada con `git push -u origin codex/facturas-borradas-lectores-financieros:codex/facturas-borradas-lectores-financieros`; PR en borrador contra `main`. El check «Calidad local sin secretos» hay que verificarlo por nombre sobre el SHA final (la facturación de Actions estaba bloqueada en handoffs anteriores).
- **Sesiones consumidoras y ownership:** ninguna otra sesión usa este worktree. El claim se libera al terminar (`release --owner worker-w1-facturas-borradas-20260914`); worktree y rama se conservan, no se eliminan.
