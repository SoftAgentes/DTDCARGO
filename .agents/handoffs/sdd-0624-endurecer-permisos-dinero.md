# Handoff · SDD-0624 — Endurecimiento de permisos: dinero, gastos y deuda RBAC

- Rama: `claude/endurecer-permisos-dinero` (worktree `.claude/worktrees/endurecer-permisos`)
- Base: `origin/main` en `836b2cf19`
- Fecha: 2026-11-11
- Encargo: Sam pidió una revisión exhaustiva de permisos y avanzar los arreglos
  («Haz esta tarea aquí: Endurecer permisos: dinero, gastos y DEUDA»).

## Hecho

- Migración `0528_rls_lectura_dinero_y_gastos.sql`. La lectura de
  `journal_entries`, `journal_lines`, `payment_receipts`, `supplier_bills` y
  `supplier_payments` queda para accounting y admin, con el helper
  `studio_can_read_money()`. Se agrega la RPC `claim_indemnity_entry_codes` para
  Reclamos. Support deja de escribir gastos.
- Reclamos usa la RPC. Si la base todavía no la tiene, vuelve a leer la tabla
  directamente.
- `POST /api/studio/agents/run` exige el módulo Admin.
- Cada página sensible tiene su propio `requireModuleView`. Un contrato nuevo lo
  exige.
- La lista DEUDA del anti-drift baja de 24 a 3. Las 3 que quedan son de tarifas
  y le tocan a la SDD-0622.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Contrato 0528 en PGlite (con control rojo y 5 mutantes) | PASÓ, 8/8 |
| `page-gates-sensibles`, `rbac-actions-guard`, `rbac-view-guard`, `route-gate` y pruebas de documentos y bitácora | PASÓ, 587/587 |
| `pnpm verify`, corrida completa sobre `9c58088dc` | FALLÓ por 3 pruebas (ver abajo) |
| Prueba de Cobranzas (`hoy-caracas`): el doble no tenía `requireModuleView` | Corregida en `29c9c8671`, PASÓ 13/13 |
| `entorno-prueba-scripts` y `migraciones.test.mjs`: timeout de 600 s | Coincidieron con un verify ajeno lanzado en paralelo. Reintento aislado sobre `29c9c8671`: PASÓ 32/32 |
| `migrations-applied`, `sql-tests`, `schema-rebuild` | NO DISPONIBLE: worktree sin `.env.local` y sin Docker. El contrato SQL corre en su lugar en PGlite |
| `docs:check`, `sdd:check` | PASÓ |
| `pnpm verify` completo sobre `5422a1716`, tras la revisión | exit 0, 14/17 PASÓ: harness, lint, rsc-boundary, typecheck, edge-functions, test, docs, numbering, feature-constants, components, governance, pending-migration-symbols, e2e (233 pasaron, 5 inestables y 0 fallaron, con el aviso conocido de WebKit en Windows) y build. NO DISPONIBLE: migrations-applied, sql-tests y schema-rebuild |

## Revisión independiente (2026-11-11): APROBAR

Hallazgos bajos atendidos:
- El contrato de páginas ahora ignora los comentarios. Con eso aparecieron
  cuatro páginas que solo nombraban el gate en un comentario; ya lo llaman.
- Prueba unitaria de `listClaimEntryCodes`.
- Mensaje claro del ERP móvil para `support`.

Queda abierto: `claim_indemnity_entry_codes` usa una lista fija de roles y no
los overrides por rol. La SDD-0622 lo puede alinear con `user_has_module`.

## Pendiente de esta tarea

- **Aplicar la 0528 a producción.** Necesita un OK de Sam que nombre el archivo.
  La 0470 y la 0511 ya están aplicadas y selladas (candado, 2026-10-19 y
  2026-11-03), aunque sus cabeceras digan otra cosa. Hay que medir el ledger
  primero. Al aplicarla se retira su espera con
  `infra/ops/migraciones/retirar-espera.mjs`, que también la sella.
- **2026-11-13, tras traer main (0532 sellada):** la 0528 quedó por debajo de la
  mayor sellada y el candado la marcó `SIN_SELLO`. Se declaró como espera en
  `migrations-baseline.json`, con la degradación de
  `claim_indemnity_entry_codes` en `pending-migration-symbol-declarations.json`.
- **Ver el CI de GitHub en la PR.** Es el portón de integración.

## Cruce con SDD-0576 (fechas Caracas), 2026-11-13

Al traer main (`e5169e86e`), la SDD-0576 agregó dos comprobaciones que leen el
asiento vivo de un gasto en `journal_entries` antes de editarlo: el cierre del
período y la fecha histórica. Estaban en `app/m/erp/actions.ts` y en
`app/studio/(app)/gastos/actions.ts`. Con la 0528, comercial, operaciones y
almacén ya no leen esa tabla: verían 0 filas y la comprobación pasaría en falso.
Luego el cliente de servicio anula el asiento y lo vuelve a asentar, y el
disparador de cierre puede negar la anulación sin que nadie se entere. Las dos
lecturas pasan a `createAdminClient()`. Siguen filtradas por tenant y por el id
del gasto, que ya se leyó con la sesión del usuario. Los dobles de sus pruebas
devuelven el mismo cliente.

## Coordinación con SDD-0622 (PR #509)

- La SDD-0622 usa las migraciones 0538, 0539 y 0540 (renumeradas desde 0529 a
  0531; medido en la PR #509, cabeza `bed937852`, 2026-11-14). La 0528 es de
  esta tarea.
- Para sumar accesos por persona en el dinero, la SDD-0622 redefine
  `studio_can_read_money()` sin tocar las policies.
- Conflictos esperados al integrar, en `usuarios/page.tsx` (la línea del gate),
  `rbac-actions-guard.test.ts` (las cuentas de DEUDA y EXCEPCIONES) y
  `rbac-view-guard.test.ts`.

## Vuelta 2026-11-14 (W-515): main al día, sin pruebas pesadas

- Merge de `origin/main` (`4a59f10bf`) sobre `013c39c5a`, sin conflictos. Ningún
  archivo de la rama lo tocó main; el contrato de la 0528 y el
  `requireModuleView("users")` de `usuarios/page.tsx` quedan iguales.
- `migrations-baseline.json` y `pending-migration-symbol-declarations.json`
  iguales a `013c39c5a`; frente a main solo suman la entrada de la 0528.
  `migrations.lock.json` igual a main (solo selladas; la 0528 no va ahí).
- Las migraciones nuevas de main (0532 a 0537) no tocan las policies que
  reemplaza la 0528; la 0534 solo mira `invoices_team_select`.
- `rbac-actions-guard`: la #515 no agrega ni quita acciones exportadas ni
  archivos de actions, así que el 469 y los 82 archivos siguen vigentes.
- Livianas, solo Node: `docs:check` (615 specs, índice sincronizado),
  `sdd:check`, `check-pending-migration-symbols` (0 rojo, 1 amarillo declarado)
  y `migrations-lock` (522 selladas, 1 espera: la 0528). PASÓ.
- NO EJECUTADO en esta vuelta, va con turno: `pnpm install`, vitest de los
  contratos (`page-gates-sensibles`, `rbac-*`, 0528 en PGlite) y `pnpm verify`.
  `page-gates-sensibles` debe confirmar que las páginas nuevas de main no
  necesitan gate.

## FUERA DE ALCANCE DETECTADO

- `legal/layout.tsx` exige el módulo `legal` y así bloquea
  `legal/expediente/[code]` a commercial y support. La capability
  `view_defense_file` les dio ese acceso el 2026-07-19. Es un defecto funcional
  que ya existía.
- La SDD-0622 lanzó un `pnpm verify` sin turno en paralelo con este; lo detuvo
  y lo avisó.
