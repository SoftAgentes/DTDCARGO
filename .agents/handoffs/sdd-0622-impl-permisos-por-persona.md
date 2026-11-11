# Handoff — SDD-0622 · accesos adicionales por persona (implementación)

Fecha: 2026-11-11. Task ID: `sdd-0622-impl-permisos-por-persona`.
Owner / sesión escritora: Worker Claude Code `d028c1c9-impl-permisos-por-persona` (sesión hija de
`local_330539a7…`, «Permisos personalizados por usuario en ERP Studio», que hace de Director).
Sin subagentes.

- **Worktree:** `.claude/worktrees/impl-permisos-por-persona-10d044`. `harness-worktree guard` PASÓ; claim
  `d028c1c9-impl-permisos-por-persona` adquirido al empezar.
- **Rama:** `claude/impl-permisos-por-persona-10d044`, base `origin/main` `836b2cf19`.
- **SDD:** 0622, spec en la PR #488 (rama `origin/codex/sdd-permisos-por-persona`). **Esta PR depende de la #488**; no
  mezclé esa rama. La spec sigue allí: los desvíos de la allowlist que necesité van en «Desvíos de la allowlist».
- **Autorización:** publicar la rama propia y abrir la PR, sí (encargo). Merge, producción y aplicar migraciones, **no**.

## OBJETIVO ORIGINAL

Implementar la SDD-0622: rol base más accesos extra por persona que solo suman, por módulo (ver o ver y editar),
con motivo obligatorio, vencimiento opcional y doble aviso en módulos sensibles, también exigido por la RPC.
R1, R2 y R3 se resuelven con las propuestas de la spec (decisión del Director). Pasos:

1. migración de tabla, RPC y `user_has_module`;
2. TypeScript, sidebar y ⌘K;
3. RLS de Comercial, con el caso de aceptación de contabilidad + CRM editar;
4. dinero (R3), según cuántas piezas haya;
5. UI compacta y moderna en Usuarios;
6. cierre.

Ampliación del Director el 2026-11-11 (mensaje entre sesiones, auditoría de permisos):

- **(1)** RLS por módulo en rates, quotes, conversations, purchase_orders y sales_orders;
- **(2)** `crm_puede_usar` por `user_has_module`;
- **(3)** `chatwoot_conversations` por módulo;
- **(4)** sacar de DEUDA tres acciones de tarifas y cotizador;
- **(5)** dashboard e indicador de Conversaciones con overrides y extras.

**No tocar:** dinero de SDD-0624 (0528). Además me pidió renumerar: 0526 es de la #507 y 0528 de SDD-0624.

## COMPLETADO

**Base de datos (tres migraciones nuevas, sin aplicar en ningún entorno remoto):**

- `supabase/migrations/0529_studio_user_module_grants.sql`
  - **Tabla `studio_user_module_grants`:**
    - PK (tenant, persona, módulo);
    - CHECK de que siempre deja ver y de que editar implica ver;
    - motivo de 5 a 500 caracteres;
    - CHECK de confirmación (`sensitive_confirmed_at` + `effects_version`) sobre la lista literal de `LOCKED_MODULES`;
    - CHECK de solo lectura para `users`/`admin` (R1).
  - **RLS:** sin escritura para authenticated; lectura solo para la propia persona o el admin.
  - **`user_has_module(p_module, p_edit)`:** mismo orden que `canAccessModule`/`canEditModule` (admin → support sin
    edición → scope de almacén → desvío por rol, nunca sobre sensibles → default de código → extra vigente). Es security
    definer y no la ejecuta anon.
  - **`studio_grant_user_module`:**
    - solo el rol admin de la base;
    - nunca a uno mismo, a un admin ni a un desactivado o de otro tenant;
    - módulo conocido; motivo; vencimiento futuro;
    - en sensibles exige `p_confirm_sensitive` y versión de efectos;
    - los módulos del superadmin solo los concede `is_platform_admin()` (R2);
    - `users`/`admin` solo ver.
  - **`studio_revoke_user_module_grant`:** con motivo; borra la fila.
  - Las dos RPC escriben en `entity_audit_log` (entidad nueva `studio_user_module_grant`, dominio `governance`).
  - **Revocar = borrar.** Es lo que pedía el brief («elige y justifica»), y la justificación está en la cabecera: la PK
    significa «lo que tiene hoy», el rastro append-only queda en la bitácora y re-conceder es un upsert. Un extra
    vencido NO se borra: deja de contar solo y aparece en el filtro «vencidos».
  - **Copia SQL de la matriz:** `studio_module_default_roles` replica `ROLE_MODULE_ACCESS`, con una prueba anti-drift.
- `supabase/migrations/0530_comercial_acepta_accesos_por_persona.sql`
  - `crm_puede_usar()` pasa a `user_has_module('kommo')`.
  - `crm_puede_editar()` es nueva; la usan las 5 policies de escritura del CRM y `crm_mover_etapa`, así que solo ver ya
    no edita.
  - `document_entity_authorized` suma el extra vigente; las entidades de dinero siguen por rol.
  - Tiene preflight contra drift de la 0444 y de la 0506.
- `supabase/migrations/0531_comercial_rls_por_modulo.sql` (ampliación 1 y 3)
  - En rates, quotes, conversations, conversation_messages, purchase_orders, purchase_order_items y sales_orders, la
    policy `for all` por tenant se reemplaza por cuatro: escribir exige editar el módulo dueño; leer exige ver alguno de
    los módulos que hoy la consumen con la sesión.
  - En `chatwoot_conversations` lee quien ve Bandeja o CRM.
  - Ayudante nuevo: `user_has_any_module(text[], boolean)`.
  - La postcondición falla si queda una policy de authenticated sin módulo.

**Aplicación:**

- `lib/studio/rbac.ts`
  - `canAccessModule`/`canEditModule(role, id, overrides?, grants?)`: el 4.º argumento es opcional y las firmas viejas
    dan lo mismo (lo comprueba una prueba).
  - Nuevos: `effectiveModuleAccess` (con la fuente del permiso), `READ_ONLY_GRANT_MODULES`, `SENSITIVE_MODULE_EFFECTS`
    y `SENSITIVE_MODULE_EFFECTS_VERSION`.
  - La cabecera ya dice que la SDD-0622 reemplaza el punto D de la 0139.
- `lib/studio/rbac-guard.ts`: `getStudioAccess` carga los extras vigentes (con fallo cerrado suave si la 0529 no
  existe). Los cuatro gates los pasan, y R2 se mantiene: el segundo candado de superadmin sigue.
- `lib/studio/user-module-grants.ts` (puro): cobertura por módulo, estado concedible y validación del motivo.
  `lib/studio/user-module-grants-queries.ts`: lecturas.
- **Lo que evalúa a la persona de la sesión usa los extras:**
  - sidebar (`layout.tsx`, `StudioSidebar.tsx`) y ⌘K (`global-search/facets.ts`, `search-action.ts`);
  - exportaciones comercial y operativa, y PDFs de cotizador, facturación y estado de cuenta;
  - `clientes/[markbox]`, Bandeja (clientes y saldo), la consulta de Discord y el dashboard (`getStudioAccess`);
  - el indicador de Conversaciones del topbar (solo si ve el módulo).
- **CRM:**
  - `crm/tarjeta-actions.ts` y `CrmEmbudosSlot.tsx` ya no exigen el rol fijo admin/commercial: deciden por módulo,
    igual que la base con la 0530.
  - Los asesores incluyen a quien tiene el CRM concedido para editar.
- **Gates (ampliación 4):**
  - `cotizador::lookupSuggestedRate` → ver Cotizador;
  - `tracking/[id]::lookupRateForNewDestination` → editar Tracking y ver Cotizador;
  - `tarifas::previewRatesImportAction` → editar Tarifas.
  - Salen de DEUDA (24 → 21). Las 3 acciones nuevas de Usuarios se registraron (463 → 466).

**UI (`app/studio/(app)/usuarios`):**

- **Lista:** la columna «Accesos extra» con chips (índigo = extra, ámbar = sensible) y filtros «Con accesos extra»,
  «Con acceso sensible» y «Por vencer o vencidos».
- **Ficha:** pestañas Perfil · Acceso · Actividad.
- **Pestaña Acceso:**
  - rol base como selector segmentado (`radiogroup` con flechas; sigue pidiendo motivo al aplicar);
  - accesos extra con el buscador «Agregar módulo o área…», que muestra el motivo de lo no concedible;
  - Ver/Editar, motivo, vencimiento y quitar con motivo (`ConfirmDialog`);
  - «Agregar todo Comercial»;
  - el aviso «Su rol ya lo da» cuando un extra no suma.
  - Incluye el bloque «Lo que puede ver» por área, con la fuente de cada permiso (rol, extra o sensible).
- **Doble aviso** (`acceso/DobleAvisoDialog.tsx`): lista de efectos de `SENSITIVE_MODULE_EFFECTS`, motivo, vencimiento,
  casilla «Entiendo…» y la opción «Solo ver»; también funciona con teclado (Esc, Tab atrapado).
- **Actividad:** lee el rastro de `entity_audit_log` de esa persona.
- **Server actions:** `grantUserModuleAction`, `revokeUserModuleGrantAction` y `listUserAccessActivityAction`, con
  `tenantAdminGate` primero y solo por las RPC.
- **Estilos:** `acceso/permisos.css`, solo con tokens; funciona en claro y oscuro.

**Paso 4 · Dinero (R3):** el inventario de la spec §12.2 da unas 45 piezas, más de 10. **No toqué funciones ni
policies de dinero.** En la UI, los módulos de dinero salen como «Requiere fase de dinero» y no se ofrecen. La
0528 de SDD-0624 crea `studio_can_read_money()`; cuando se haga la fase de dinero, sumar extras es redefinir esa
función con `user_has_module`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Contratos SQL 0529 (56 aserciones), 0530 (caso Alejandro de punta a punta) y 0531, en PGlite con los `.sql` reales (`lib/studio/__tests__/user-module-grants.migration.test.ts`, 28 casos) | PASÓ |
| Control rojo de cada contrato, preflight anti-doble aplicación, 14 mutantes (8 de la 0529, 2 de la 0530 y 4 de la 0531) | PASÓ (todos caen con la aserción que nombran) |
| Paridad `canAccessModule`/`canEditModule` (+ scope) ↔ `user_has_module` para 6 roles × 57 módulos × extras de cada clase + desvío por rol | PASÓ |
| Anti-drift de la matriz SQL ↔ `ROLE_MODULE_ACCESS`, `LOCKED_MODULES` (función y CHECK) y `SUPERADMIN_ONLY_MODULES` | PASÓ |
| `rbac.test.ts` (12 casos nuevos), `rbac-actions-guard.test.ts`, CRM, Usuarios (incluido `AccesoPanel.test.tsx`, 8 casos), dashboard, cotizador, tracking, tarifas, búsqueda global y Discord | PASÓ |
| `tsc --noEmit`, ESLint de los archivos tocados | PASÓ |
| `check-pending-migration-symbols` (0 ROJO) y `migrations-lock` (3 nuevas sin sellar, ninguna con número viejo) | PASÓ |
| Contratos SQL en Postgres 17 real (`scripts/ci-sql-tests.sh`, Docker) | NO EJECUTADO en local; lo corre el workflow «Contratos SQL» de la PR |
| `/ui-check` | PASÓ con ajustes menores aplicados (targets de 32 px, contraste de chips) |
| `pnpm verify` (2.ª corrida, con turno del Director) | exit 0, cierre INCOMPLETO por lo no medido. PASÓ (14): harness, lint, rsc-boundary, typecheck, edge-functions, test (1047 archivos · 16381 casos), docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO), e2e, build. NO DISPONIBLE (3): migrations-applied (sin `.env.local`), sql-tests y schema-rebuild (sin Docker) |
| `pnpm verify` (1.ª corrida) | FALLÓ con 20 rojos. 18 eran míos: 5 pruebas de gates contaban la nueva lectura de extras, más la consulta de Discord, cuyo doble no conoce la tabla. Arreglados con un doble igual al de los desvíos por rol y una lectura tolerante en Discord. Los otros 2 eran timeouts de 600 s (`entorno-prueba-scripts`, `migraciones`), cruzados con el verify de la 0624; aislados pasan 32/32 |

Capturas (Chrome headless a 1440×960, render real de los componentes con datos ficticios), en la carpeta de notas
compartidas del grupo, `sdd-0622-capturas/`:
`ficha-acceso-{light,dark}.png`, `buscador-light.png`, `doble-aviso-{light,dark}.png`, `actividad-light.png` y
`lista-con-extras-light.png`.

## COMMITS

`64f6fceeb`, `306c97536`, `48ffb82e6`, `e8c284f05`, `249ab33ec`, `5f8918190` (renumeración), `7afcc3e10` (0531) y
`055709375`. Ver `git log origin/main..HEAD`.

## Desvíos de la allowlist (§11 de la spec; hay que enmendarla en la #488)

- Archivos fuera de la lista, necesarios para que los extras se vean y funcionen donde se evalúa a la persona:
  - `app/studio/(app)/layout.tsx`, `_components/StudioSidebar.tsx`, `_components/StudioTopbar.tsx`;
  - `lib/studio/global-search/*`, `app/api/studio/{comercial,operativo}/export/route.ts`;
  - los PDFs (`cotizador`, `facturacion`, `clientes/[markbox]/estado-de-cuenta`), `clientes/[markbox]/page.tsx`,
    `bandeja/actions.ts` (solo la persona de la sesión), `lib/studio/client-account.ts`,
    `lib/studio/discord/consulta/consulta.ts` y `dashboard/page.tsx`;
  - CRM (`crm/tarjeta-actions.ts`, `CrmEmbudosSlot.tsx`, `lib/studio/crm-tablero.ts`);
  - las acciones de la ampliación 4.
- `lib/studio/user-module-grants.ts` es nuevo (puro); la spec nombraba solo el archivo de queries.
- La migración de la ampliación 1 (0531) no estaba en la spec.

## PENDIENTES DE ESTA TAREA

- **Aplicar 0529, 0530 y 0531** en prueba y producción, en ese orden y con el OK nominal de Sam, siguiendo
  `docs/runbooks/aplicar-migraciones-prod.md` (migrate-first). Fusionar sin aplicarlas frena la próxima publicación
  (puerta de migraciones).
- **Smoke con Sam (fase 7 de la spec):** conceder a Alejandro el CRM para editar desde la ficha y comprobar, con su
  sesión, el CRM de punta a punta.
- **Doble aviso hoy solo alcanzable por RPC.** El diálogo está hecho y probado, pero ningún módulo sensible está
  «cubierto», así que hoy la UI no lo abre. El dinero espera la fase 8 y `users`, `direccion`, `mailing` y `admin`
  tienen páginas que exigen rol admin en la app. La RPC sí acepta sensibles con confirmación. Abrir uno es mover su
  entrada en `GRANT_COVERAGE` cuando su base acepte el extra.
- **Bandeja no se ofrece:** el ciclo de agentes de Chatwoot (`lib/studio/chatwoot/agentes-*`) decide solo por rol.
  Tocarlo es del carril de Chatwoot.
- **Rol `custom` (fase 6 de la spec):** no está en esta PR.

## Revisión independiente (cabeza 92d9ee38f) — aprobada, con dos arreglos aplicados

- **M1 (decisión del Director):** `lookupRateForNewDestination` exige editar Tracking y ver el Cotizador **o** la CN,
  con el mismo criterio que la RLS de `rates` en la 0531. Almacén con scope CN conserva la tarifa sugerida.
  Prueba: `app/studio/(app)/tracking/[id]/__tests__/tarifa-sugerida-gate.test.ts` (almacén CN la recibe; almacén VE y
  marketing con Tracking concedido no).
- **Errores de red en el panel:** cada `startTransition` de `AccesoPanel.tsx` pasa por `llamar()`, que traduce una
  acción que lanza al error del panel. También la carga de Actividad. Pruebas en `AccesoPanel.test.tsx`.

**Hallazgos bajos: pendientes que se deciden más adelante, sin código en esta PR.**

- **La RPC concede módulos que la base todavía no cubre.** La UI solo ofrece los cubiertos, pero un admin que llame
  `studio_grant_user_module` directo puede conceder, por ejemplo, Tesorería a comercial: la app le muestra el módulo y la
  base le niega los datos. ¿Hay que limitar la RPC a la lista cubierta?
- **Revocar no exige superadmin**, ni siquiera sobre los 4 módulos del superadmin. Quitar solo resta; ¿alcanza un admin?
- **Los extras reviven al reactivar a la persona.** Suspender no los borra, y al reactivar vuelven los vigentes.
  ¿Deben vencer o quitarse al suspender?
- **`getMyModuleGrants` no filtra por tenant**, solo por `user_id`. Hoy es un tenant por persona y la RLS limita al
  tenant de la sesión, pero con varios tenants por usuario habría que filtrar por el tenant activo.

## FUERA DE ALCANCE DETECTADO

- **El borrado lógico con la sesión ya fallaba antes de esta PR** en rates, quotes, conversations, purchase_orders y
  sales_orders (`cotizador/actions.ts:499`, `tarifas/actions.ts:260`). Postgres aplica la policy de SELECT a la fila
  nueva de un UPDATE que lee la tabla, y la `for all` filtraba `deleted_at is null`. Lo medí en PGlite con la policy
  vieja y con la nueva: falla igual, así que la 0531 no lo arregla ni lo empeora. Arreglo posible: una policy de SELECT
  aparte que deje ver lo borrado a quien edita, o RPC de borrado.
- **La propuesta de tarifa de la CN** (`cn/rate-snapshot-actions.ts`) lee rates, quotes y sales_orders con la sesión
  de almacén, así que «almacén no lee tarifas» se cumple solo fuera de la CN (scope VE). Para cerrarlo del todo, esa
  lectura tendría que pasar a service_role tras su gate `cn`; es del carril CN y no lo toqué.
- **`bandeja/page.tsx:100` y `lib/studio/chatwoot/agentes-ciclo.ts:87`** evalúan la Bandeja de TERCEROS solo por rol
  y desvío (sin extras de cada persona). Es coherente con que Bandeja no se ofrezca, pero habrá que tocarlo si se abre.
- **`listUnreadConversationsForBadge`** en `layout.tsx` sigue consultando aunque no se pinte el indicador; con la 0531
  devuelve vacío. Es costo menor.

## Impacto documental

- **Canónico actualizado:** la cabecera de `lib/studio/rbac.ts` (overrides por persona).
- **Pendiente:**
  - la spec 0622, en su PR #488 (allowlist, estado de R1/R2/R3 según la decisión del Director, coberturas);
  - el índice de specs al fusionar.
- **Graphify, Archify y Obsidian:** NO EJECUTADOS. Los publica el Director desde main integrado (regla de la casa).

## Cruce previsto con SDD-0624 (`claude/endurecer-permisos-dinero`, aviso del Director 2026-11-11)

Quien integre segunda resuelve:
- `app/studio/(app)/usuarios/page.tsx`: hay que conservar el `await requireModuleView("users")` de la 0624 (su contrato
  `page-gates-sensibles.test.ts` lo exige) junto con mi carga de extras (`listTenantModuleGrants`).
- `lib/studio/rbac-actions-guard.test.ts`: la 0624 deja `{ excepciones: 24, deuda: 3 }`, y las 3 de DEUDA son las que
  saca esta PR. Con las dos ramas juntas: borrar esas 3 entradas y dejar `{ excepciones: 24, deuda: 0 }`; el
  inventario, 466 más lo que sume la 0624.
- `lib/studio/rbac-view-guard.test.ts`: esta PR no lo toca.

## HANDOFF AL DIRECTOR

PR contra main en borrador; depende de la #488. No fusionar sin aplicar las tres migraciones (o sin decidir con Sam
`aceptar-pendiente`). Revisión independiente: la lanza el Director.
