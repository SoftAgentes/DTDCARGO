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

## Revisión independiente (2026-11-11): APROBAR

Hallazgos bajos atendidos:
- El contrato de páginas ahora ignora los comentarios. Con eso aparecieron
  cuatro páginas que solo nombraban el gate en un comentario; ya lo llaman.
- Prueba unitaria de `listClaimEntryCodes`.
- Mensaje claro del ERP móvil para `support`.

Queda abierto: `claim_indemnity_entry_codes` usa una lista fija de roles y no
los overrides por rol. La SDD-0622 lo puede alinear con `user_has_module`.

## Pendiente de esta tarea

- **Aplicar la 0528 a producción.** Necesita un OK de Sam que nombre el archivo,
  y antes la 0470 y la 0511, que según sus cabeceras no están aplicadas. Hay
  que medir el ledger primero.
- **Ver el CI de GitHub en la PR.** Es el portón de integración.

## Coordinación con SDD-0622 (PR #509)

- La SDD-0622 usa las migraciones 0529 a 0531. La 0528 es de esta tarea.
- Para sumar accesos por persona en el dinero, la SDD-0622 redefine
  `studio_can_read_money()` sin tocar las policies.
- Conflictos esperados al integrar, en `usuarios/page.tsx` (la línea del gate),
  `rbac-actions-guard.test.ts` (las cuentas de DEUDA y EXCEPCIONES) y
  `rbac-view-guard.test.ts`.

## FUERA DE ALCANCE DETECTADO

- `legal/layout.tsx` exige el módulo `legal` y así bloquea
  `legal/expediente/[code]` a commercial y support. La capability
  `view_defense_file` les dio ese acceso el 2026-07-19. Es un defecto funcional
  que ya existía.
- La SDD-0622 lanzó un `pnpm verify` sin turno en paralelo con este; lo detuvo
  y lo avisó.
