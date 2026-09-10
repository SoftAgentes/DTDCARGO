# Handoff Worker — bloque D, RBAC documento-entidad

Fecha: 2026-09-10 · Estado: lista para revisión en PR apilada.
Owner/claim: `worker-c2-bloque-d-20260910-root`.
Task ID: `c2-bloque-d-document-entity-rbac`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c2-bloque-d-document-entity-rbac`.
Rama: `codex/c2-bloque-d-document-entity-rbac`.
Base dura: `codex/c2-prerequisito-0416-portal-shipments@967bb375e488c6fca7fd123ec675a571a0ddcff5` (PR #47).
Origen selectivo: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (cabeza publicada de PR #21).

## OBJETIVO ORIGINAL

Cerrar el bloque D preservando de inmediato las 33 rutas locales sin respaldo,
rebasar la rama propia sobre el único prerrequisito externo de la cadena
0435→0444 y entregar una PR draft apilada sobre PR #47. El alcance es diez specs
SDD-0403–0412, diez migraciones 0435–0444, sus diez contratos SQL, las entradas
correspondientes de `pendingBelowCutoff`, el índice SDD regenerado y este handoff.

## COMPLETADO

- Se reclamó el worktree con owner `worker-c2-bloque-d-20260910-root` y se
  verificaron raíz, rama y aislamiento antes de escribir.
- Las 33 rutas pendientes se respaldaron antes del rebase en cuatro commits
  selectivos por unidad lógica: specs/índice, migraciones/baseline, contratos y
  handoff. Nunca se usó `git add -A`.
- Se rebasó exclusivamente esta rama sobre
  `codex/c2-prerequisito-0416-portal-shipments@967bb375`. La rama y el worktree
  del otro Worker no se modificaron.
- El único conflicto fue `docs/specs/README.md`: durante el rebase se conservó
  el índice de la base y después se regeneró con `corepack pnpm docs:index`, como
  exigía el encargo. `supabase/migrations-baseline.json` se integró sin conflicto
  y conserva la unión de entradas.
- La comparación posterior al rebase confirmó los 30 archivos del bloque con
  blobs idénticos 30/30 contra `ea9952a4`.
- Frente a `origin/main`, el baseline contiene exactamente once claves nuevas:
  el prerrequisito `0416_portal_shipments_tenant_boundary` de la base y las diez
  migraciones 0435–0444 del bloque. `cutoff` permanece en 238.
- La reconstrucción desde cero que había bloqueado la ronda anterior pasó
  completa en la primera iteración con 0416 presente.
- No se importó ningún archivo `app/**` o `lib/**`, no se tocó PR #21 ni ninguna
  de las otras PR, y no hubo merge, deploy, lectura de filas reales, escritura
  Cloud ni aplicación de migraciones.

## VALIDACIÓN

- **PASÓ** — `corepack pnpm install --frozen-lockfile`: pnpm 12.3.4; lockfile sin
  cambios.
- **PASÓ** — `corepack pnpm docs:index`: índice generado con 406 specs y 43
  huecos.
- **PASÓ** — `corepack pnpm sdd:check`: 406 specs y 414 migraciones; únicamente
  colisiones históricas eximidas por el gate.
- **PASÓ** — `corepack pnpm docs:check`.
- **PASÓ** — integridad posterior al rebase: base `967bb375` es ancestro; 30
  paths comprobados, 0 diferencias de blob contra `ea9952a4`.
- **PASÓ** — baseline: 11 claves nuevas frente a `origin/main`, incluidas 0416 y
  0435–0444; `cutoff` actual y de `origin/main` es 238.
- **PASÓ** dentro de `corepack pnpm verify` — harness 12/12; lint con 0 errores y
  8 warnings preexistentes; frontera RSC; TypeScript; 4 Edge Functions; Vitest
  513 archivos / 6496 pruebas; docs; numbering; feature constants; components y
  governance.
- **NO DISPONIBLE** dentro de `corepack pnpm verify` — `migrations-applied`
  emitió SKIP por ausencia de `NEXT_PUBLIC_SUPABASE_URL` y
  `SUPABASE_SERVICE_ROLE_KEY`; no se midió ni se declara pasado el ledger real.
- **PASÓ** dentro de `corepack pnpm verify` — `sql-tests`: 156 contratos en
  `postgres:17`, rollback total. Los contratos 0416 y 0435–0444 pasaron
  individualmente.
- **PASÓ** dentro de `corepack pnpm verify` — `schema-rebuild`: 414 archivos
  detectados; 396 migraciones aplicadas desde cero; 18 ledger-only verificadas;
  aislamiento multi-tenant validado sobre 219 tablas y dos tenants.
- **NO DISPONIBLE** dentro de `corepack pnpm verify` — E2E sin
  `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Primera corrida:
  153 pasaron, 18 omitidas y 15 fallaron. Reintento 1/1: 152 pasaron, 18
  omitidas, 15 fallaron y una prueba ajena quedó flaky pero pasó al reintento.
  Las 15 fallas en ambos intentos son las mismas cinco comprobaciones de login,
  portal y redirección auth en chromium, mobile-chrome y mobile-safari, con el
  error explícito de URL/clave Supabase ausentes. No se atribuyen como regresión
  del bloque D ni como cobertura pasada.
- **PASÓ** dentro de `corepack pnpm verify` — build de producción: compilación,
  TypeScript, 160 páginas estáticas y restauración automática de `tsconfig.json`.
- **FALLÓ** — resultado agregado de `corepack pnpm verify` (exit 1): 15 de 16
  pasos se ejecutaron; el único gate fallido fue E2E, clasificado arriba como
  NO DISPONIBLE por configuración pública ausente. Esto no es verde global.
- **PASÓ** — revisión de alcance previa al cierre: 33 paths y solo los 33 del
  allowlist; `git diff --check` sin hallazgos y árbol limpio antes de actualizar
  este handoff.

## COMMITS

- `3451d56e` — specs SDD-0403–0412 del RBAC documental.
- `7de2d61d` — migraciones 0435–0444 y sus esperas en el baseline.
- `a11c82ad` — contratos SQL 0435–0444.
- `db7c521f` — respaldo del handoff que existía antes del rebase.
- `9d93a707` — índice SDD regenerado después del rebase.
- El commit que contiene este cierre de handoff se registra como commit
  selectivo adicional; su SHA final queda visible en la rama y la PR.

## PR / BRANCH

- Head: `codex/c2-bloque-d-document-entity-rbac`.
- Base: `codex/c2-prerequisito-0416-portal-shipments` (PR #47, head
  `967bb375e488c6fca7fd123ec675a571a0ddcff5`).
- Dependencia dura: PR #47 se fusiona primero. Esta rama no debe rebasarse sobre
  `main` ni incorporar una copia de 0416.
- PR draft: se abrirá después de publicar la rama y su URL se fijará en el
  commit final de este handoff.
- Fusionar cualquiera de estas PR no autoriza aplicar migraciones a producción.

## PENDIENTES DE ESTA TAREA

- Ningún pendiente de implementación o validación focal del bloque.
- Completar la publicación autorizada, abrir la PR draft apilada y fijar aquí su
  URL final.

## FUERA DE ALCANCE DETECTADO

- Ocho warnings lint preexistentes en pruebas de Compras y componentes CRM.
- El E2E general no está disponible sin la configuración pública de Supabase;
  las 15 fallas reproducidas quedan documentadas arriba.
- `migrations-applied` no está disponible sin credenciales del ledger real.
- La prueba E2E `calculadora-semantic-colors.spec.ts` tuvo un fallo transitorio
  ajeno y pasó su retry; no se modificó.

## HANDOFF AL DIRECTOR

El bloque D está reconstruido y validado sobre su única dependencia externa. La
revisión debe conservar la topología apilada: PR #47 primero y luego esta PR. La
PR del bloque permanecerá draft y su merge no autoriza ejecutar
`0435_invoice_document_entity_rbac.sql`,
`0436_treasury_document_entity_rbac.sql`,
`0437_accounting_document_entity_rbac.sql`,
`0438_expense_document_entity_rbac.sql`,
`0439_shipment_document_entity_rbac.sql`,
`0440_client_document_entity_rbac.sql`,
`0441_supplier_document_entity_rbac.sql`,
`0442_naviera_document_entity_rbac.sql`,
`0443_bitacora_document_entity_rbac.sql` ni
`0444_unlinked_document_entity_rbac.sql` en producción. No hubo merge ni
aplicación de migraciones. Rama y worktree se conservan; el claim se libera al
terminar la publicación y la verificación remota.
