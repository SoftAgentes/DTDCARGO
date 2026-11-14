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

- **Orden: aplicar la 0528 DESPUÉS de desplegar esta PR.** Aplicarla antes deja
  la comprobación del asiento de gastos en falso. La app que está hoy en main
  (`795b33ed7`) lee `journal_entries` con la sesión: `gastos/actions.ts:297`
  (`supabase.from("journal_entries")`) y `m/erp/actions.ts:354`
  (`expenseHistoryError(supabase, …)`). Con la 0528, comercial y operaciones ven
  0 filas, la comprobación del período cerrado y de la fecha histórica pasa y
  el gasto se edita sin mirar su asiento. Esta PR lee ese asiento con
  `createAdminClient()` y funciona con o sin la 0528. También Reclamos, en la
  app vieja, mostraría la columna del asiento vacía (degradación, no hueco).
- **Cómo se combina con que una espera frena la publicación.** La 0528 en
  `pendingBelowCutoff` frena la publicación de main mientras no se aplique, y
  no se puede aplicar antes de publicar. Una salida posible: publicar esta PR
  con la espera aceptada y aplicar la 0528 enseguida después, sin editar gastos
  en esa ventana (la app nueva funciona igual sin la 0528). Lo deciden el DG y
  Sam; no es una decisión de esta tarea.
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
- Las pruebas pesadas corrieron después, con turno (ver la subsección
  siguiente).

### Corrida con turno sobre `f67cbb269` (2026-11-14)

`pnpm install --frozen-lockfile` (1 min 28 s) y `pnpm verify` completo, de
17:54 a 18:36 (42 min), exit 0, con 14 de 17 pasos medidos.

| Comprobación | Resultado |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions (4), docs:check, numbering, feature-constants (7), components, governance, build | PASÓ |
| test (vitest) | PASÓ: 1123 archivos y 17811 pruebas; 4 archivos y 26 pruebas saltadas |
| pending-migration-symbols | PASÓ: 0 rojo y 1 amarillo declarado (la 0528) |
| e2e | PASÓ con aviso: 236 pasaron, 2 inestables y 0 fallaron; el worker de WebKit no cierra en Windows |
| migrations-applied | NO DISPONIBLE: el worktree no tiene `.env.local` |
| sql-tests, schema-rebuild | NO DISPONIBLE: sin Docker |
| `page-gates-sensibles`, `rbac-actions-guard`, `rbac-view-guard` y el contrato 0528 en PGlite, corridos aparte | PASÓ: 4 archivos y 543 pruebas |

## Revisión independiente sobre `1f661078d`: CAMBIOS, fase A (2026-11-14, W-515)

Local y sin push; main sin traer (eso va cuando entre la #488).

- **H1 (orden):** confirmado leyendo el código de main (ver «Pendiente»). Se
  escribió en la espera de `migrations-baseline.json`, en la cabecera de la
  0528 y en la spec §2.1.
- **H3 (preflight y postflight):** el preflight exige el conjunto exacto de
  policies de las seis tablas (nombre, comando, permisiva, roles), las huellas
  de lo que reemplaza (lecturas del tenant sin rol, gastos del dueño sin rol) y
  que las dos funciones no existan. El postflight exige el conjunto exacto que
  queda, tenant y `studio_can_read_money()` en cada lectura, gastos sin
  `support`, RLS sin FORCE y las dos funciones SQL, STABLE, DEFINER con
  `search_path` vacío, sin EXECUTE para PUBLIC ni anon. Patrón 0470/0511.
- **H4:** `notify pgrst, 'reload schema'` al final.
- **H5 (hecho):** `set search_path = ''` en las dos funciones; los cuerpos ya
  estaban calificados.
- **H6 (pendiente, para la 0622):** la RPC de Reclamos sigue con lista fija de
  roles y no mira `role_module_overrides` (0357). Alinearla es una decisión de
  producto que va con los accesos por persona.
- **H7:** solo comentarios en `cobranzas/actions.ts` (`getReceivableHistory`) y
  `tesoreria/actions.ts` (`getBillHistory`).
- **H8 (mutantes):** el contrato SQL suma un bloque `$funciones$` (DEFINER,
  search_path, PUBLIC/anon/authenticated) y una aserción estructural del helper
  en cada lectura. PGlite suma support editando gastos, la lectura sin helper en
  las cinco tablas, el helper INVOKER, la RPC con `search_path` público y las
  dos funciones sin revocar PUBLIC. Cada mutante que toca lo del postflight se
  prueba dos veces: con la migración entera (lo caza el postflight) y sin el
  postflight (lo caza el contrato). Más cuatro pruebas del preflight y una de
  que termine en `notify`. El mutante de las líneas sin helper ya no sobrevive.
- `pending-migration-symbol-declarations.json`: no cambia, porque no guarda
  huella del blob y los sitios citados no se movieron. `check-pending-migration-symbols`
  (0 rojo, 1 amarillo) y `migrations-lock` (1 espera: la 0528): PASÓ.
- NO EJECUTADO (falta turno): vitest y typecheck de lo nuevo.
- Riesgo a medir antes de aplicar: si producción tiene una policy que el repo no
  conoce en esas seis tablas, el preflight aborta sin cambiar nada. Es lo
  esperado; se mide con el ledger y `pg_policies` antes de pedir el OK.

## FUERA DE ALCANCE DETECTADO

- `legal/layout.tsx` exige el módulo `legal` y así bloquea
  `legal/expediente/[code]` a commercial y support. La capability
  `view_defense_file` les dio ese acceso el 2026-07-19. Es un defecto funcional
  que ya existía.
- La SDD-0622 lanzó un `pnpm verify` sin turno en paralelo con este; lo detuvo
  y lo avisó.
