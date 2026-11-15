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

- `supabase/migrations/0538_studio_user_module_grants.sql`
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
- `supabase/migrations/0539_comercial_acepta_accesos_por_persona.sql`
  - `crm_puede_usar()` pasa a `user_has_module('kommo')`.
  - `crm_puede_editar()` es nueva; la usan las 5 policies de escritura del CRM y `crm_mover_etapa`, así que solo ver ya
    no edita.
  - `document_entity_authorized` suma el extra vigente; las entidades de dinero siguen por rol.
  - Tiene preflight contra drift de la 0444 y de la 0506.
- `supabase/migrations/0540_comercial_rls_por_modulo.sql` (ampliación 1 y 3)
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
- `lib/studio/rbac-guard.ts`: `getStudioAccess` carga los extras vigentes (con fallo cerrado suave si la 0538 no
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
    igual que la base con la 0539.
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
| Contratos SQL 0538 (56 aserciones), 0539 (caso Alejandro de punta a punta) y 0540, en PGlite con los `.sql` reales (`lib/studio/__tests__/user-module-grants.migration.test.ts`, 28 casos) | PASÓ |
| Control rojo de cada contrato, preflight anti-doble aplicación, 14 mutantes (8 de la 0538, 2 de la 0539 y 4 de la 0540) | PASÓ (todos caen con la aserción que nombran) |
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

`64f6fceeb`, `306c97536`, `48ffb82e6`, `e8c284f05`, `249ab33ec`, `5f8918190` (renumeración), `7afcc3e10` (0540),
`055709375` y `bed937852` (las pestañas de la ficha pasan a `.studio-tabs`/`.studio-tab` del contrato SDD-0603:
`UserDetailDrawer.tsx` y `acceso/permisos.css`, que pierde las clases `perm-tabs`). Los de la vuelta W-509 están en
su sección, al final. Ver `git log origin/main..HEAD`.

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
- La migración de la ampliación 1 (0540) no estaba en la spec.

## PENDIENTES DE ESTA TAREA

- **Aplicar 0538, 0539 y 0540** en prueba y producción, en ese orden y con el OK nominal de Sam, siguiendo
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
  con el mismo criterio que la RLS de `rates` en la 0540. Almacén con scope CN conserva la tarifa sugerida.
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
  vieja y con la nueva: falla igual, así que la 0540 no lo arregla ni lo empeora. Arreglo posible: una policy de SELECT
  aparte que deje ver lo borrado a quien edita, o RPC de borrado.
- **La propuesta de tarifa de la CN** (`cn/rate-snapshot-actions.ts`) lee rates, quotes y sales_orders con la sesión
  de almacén, así que «almacén no lee tarifas» se cumple solo fuera de la CN (scope VE). Para cerrarlo del todo, esa
  lectura tendría que pasar a service_role tras su gate `cn`; es del carril CN y no lo toqué.
- **`bandeja/page.tsx:100` y `lib/studio/chatwoot/agentes-ciclo.ts:87`** evalúan la Bandeja de TERCEROS solo por rol
  y desvío (sin extras de cada persona). Es coherente con que Bandeja no se ofrezca, pero habrá que tocarlo si se abre.
- **`listUnreadConversationsForBadge`** en `layout.tsx` sigue consultando aunque no se pinte el indicador; con la 0540
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

## Fusión con main y segunda renumeración (2026-11-14)

- Fusioné `origin/main` en la rama para resolver el conflicto que avisó Auto-fix. El único conflicto fue en
  `lib/studio/rbac-actions-guard.test.ts`. Ahí quedaron los comentarios de los dos lados y el inventario pasa de
  469 (main) a 472 (+3 de esta tarea). Las listas siguen congeladas en `{ excepciones: 20, deuda: 21 }`.
- Main ya selló y aplicó migraciones hasta la 0537, así que `migrations-lock` rechazaba las tres de esta tarea con
  `SIN_SELLO` porque tenían número por debajo del tope. Ninguna estaba aplicada en ningún entorno, así que las
  renumeré a **0538, 0539 y 0540** (antes 0529, 0530 y 0531), junto con sus `.test.sql`. Cambié los números en
  comentarios, pruebas y este handoff. Las menciones previas a «0529/0530/0531» en esta nota ya se leen con los
  números nuevos. Comprobé que ninguna rama remota ni PR abierta usa migraciones de la 0538 en adelante.
- Comprobaciones tras la fusión: `migrations-lock` sin fallos (3 nuevas sin sellar, que es lo esperado antes de
  aplicar); `check-pending-migration-symbols` 0 ROJO; `sdd:check` sin números repetidos; 26 archivos de pruebas
  focales con 832/832 (contratos PGlite y mutantes incluidos). No corrí `pnpm verify`.
- **Orden de aplicación vigente: 0538 → 0539 → 0540**, con OK nominal de Sam.

## Vuelta W-509 (2026-11-14): dejar la #509 lista para revisión

- **Owner / sesión:** Worker W-509 (subagente del Director), claim `W-509`. Worktree
  `.claude/worktrees/agent-a5d1243b82afbf481`, rama local `w509-permisos-por-persona` sobre
  `origin/claude/impl-permisos-por-persona-10d044` (cabeza de partida `bed937852`). Sin push: lo ordena el Director.
- **Sin corridas pesadas en esta vuelta** (orden del Director): no se corrieron `pnpm install`, vitest, typecheck,
  lint ni verify. Sí se corrieron scripts de Node sin `node_modules`.

### Fusión con main (`3893f717f`, trae la #488 y la #515)

- `git merge --no-edit origin/main`, sin rebase. Único conflicto: `lib/studio/rbac-actions-guard.test.ts`.
  - DEUDA: main la dejó en 3 (las de tarifas) y esta rama saca esas 3, así que queda vacía. Las demás entradas que
    conservaba esta rama (bugs, facturación, documentos, nómina) ya las había sacado main con la 0624.
  - Listas: `{ excepciones: 24, deuda: 0 }`. Esta rama no toca EXCEPCIONES; las 24 son de main.
  - Inventario: 472. Cuenta a mano: entre la base `da8d123ee` y main no cambia ningún `export async function` de
    los archivos de acciones del Studio (main asertaba 469, igual que la base). Esta rama suma tres en
    `usuarios/actions.ts` (`grantUserModuleAction`, `revokeUserModuleGrantAction`,
    `listUserAccessActivityAction`) y ningún archivo de acciones nuevo (`user-module-grants-queries.ts` no lleva
    `"use server"`). 469 + 3 = 472. **Sin correr la prueba.**
- `app/studio/(app)/usuarios/page.tsx`: se fusionó solo y conserva `await requireModuleView("users")` (l. 37) junto
  con `listTenantModuleGrants`.
- `migrations-baseline.json`, `pending-migration-symbol-declarations.json` y `migrations.lock.json`: esta rama no los
  toca; quedan como en main (espera de la 0528 y su degradación `claim_indemnity_entry_codes`). La 0538, la 0539 y
  la 0540 no llevan entrada: siguen siendo «nuevas sin sellar».
- Índice de specs: `node scripts/build-docs-index.mjs --check` PASÓ (617 specs, sincronizado); no hizo falta
  regenerar.

### Coordinación con la 0528 (verificado leyendo los `.sql`)

- Ninguna de las tres borra ni redefine `public.studio_can_read_money()`. Las funciones que crean o redefinen son
  otras: 0538 (`studio_module_*`, `user_has_module`, `studio_grant_user_module`, `studio_revoke_user_module_grant`),
  0539 (`crm_puede_usar`, `crm_puede_editar`, `crm_mover_etapa`, `document_entity_authorized`) y 0540
  (`user_has_any_module`).
- Ninguna toca policies de `journal_entries`, `journal_lines`, `payment_receipts`, `supplier_bills`,
  `supplier_payments` ni `expenses`, y ningún preflight busca `*_team_select`. Preflights:
  `0538_studio_user_module_grants.sql:55-77`, `0539_comercial_acepta_accesos_por_persona.sql:30-66` y
  `0540_comercial_rls_por_modulo.sql:43-71` (este último busca solo las 8 policies comerciales que reemplaza). Los
  `.test.sql` y `user-module-grants.migration.test.ts` tampoco las nombran.
- A la inversa, el preflight y el postflight de la 0528 solo miran sus seis tablas, que estas tres no tocan, así que
  el orden entre la 0528 y la 0538-0540 no importa para la base. **Sin cambios en migraciones; ningún blob cambió.**
- `check-pending-migration-symbols`: 0 ROJO, 1 AMARILLO declarado (el de la 0528). `migrations-lock`: 522 selladas
  (la mayor, 0537), 1 espera (0528) y 3 nuevas sin sellar (0538, 0539, 0540).

### Requisitos de la revisión de la #488 (spec 0622 §8)

- Ejemplos de motivo sin nombres de persona en los tres campos: alta (`AccesoPanel.tsx:561`, «Ej: cubre el CRM
  durante una ausencia»), quitar (`AccesoPanel.tsx:474`, «Ej: ya no cubre el CRM») y doble aviso
  (`DobleAvisoDialog.tsx:162`, «Ej: cubre el área durante unas vacaciones»).
- Aviso visible en los tres: `MOTIVO_AVISO_PII` (`lib/studio/user-module-grants.ts:152`), «No escribas datos
  personales en el motivo (cédula, teléfono, salud): queda guardado en Actividad.». En el alta y en el doble aviso va
  bajo el campo, enlazado con `aria-describedby`; en quitar va en el mensaje del diálogo. Estilo `.perm-motivo-aviso`
  en `permisos.css`, solo con tokens.
- Límite de 5 a 500 sin cambios (`reasonError`, `maxLength={500}` y el CHECK de la 0538).
- Ninguna prueba buscaba el texto viejo. Agregué a `AccesoPanel.test.tsx` un caso para el alta y quitar (placeholder
  y aviso) y una aserción del aviso en el doble aviso. **Sin correr.**
- Comentario vencido de `lib/studio/user-module-grants.ts:40-49` corregido: `users` no está en COVERED, y quotes,
  sales-orders, purchase-orders, conversaciones y rates ya no son «solo por tenant», porque la 0540 les puso
  `user_has_module`/`user_has_any_module`; suppliers sigue por tenant.

### `revisar-datos-ve` sobre lo que trata la #509 (inventario técnico, no es un juicio legal)

| Dato | Qué es | Quién lo ve | Retención |
|---|---|---|---|
| `studio_user_module_grants.user_id`, `granted_by` | IDs de personas del equipo | admin del tenant y la propia persona (`0538:245-251`) | borrar al usuario en `auth.users` borra sus filas (`0538:199`); `granted_by` pasa a null (`0538:205`) |
| `…reason` | texto libre de 5 a 500 caracteres (`0538:216-217`) | los mismos | revocar borra la fila; el texto queda en la bitácora |
| `…expires_at`, `sensitive_confirmed_at`, `effects_version` | fechas y versión del aviso | los mismos | igual que la fila |
| `entity_audit_log` (`studio_user_module_grant`) | actor, persona destino, módulo, ver/editar, vencimiento y motivo (`0538:471-501`, `0538:553-576`) | authenticated no tiene SELECT desde la 0270 (`0270_audit_governed_query_rbac.sql:588-591`) | append-only; quitar un extra no lo limpia |
| Extra de `conversaciones` | abre `conversations` y `conversation_messages` de clientes (`0540:131-149`) | quien reciba el extra | el de esas tablas |

- **CORRECTO:** aviso y ejemplos sin nombres (arriba); escritura solo por RPC (`0538:257-258`) y la RPC exige el rol
  admin de la base (`0538:400-401`); `users` no se ofrece en la UI (`user-module-grants.ts:70`, `admin_base`) y la
  base lo deja en solo lectura (`0538:231-232`); fixtures ficticios (`AccesoPanel.test.tsx:48-49`; el teléfono de
  `0539_comercial_acepta_accesos_por_persona.test.sql:271` usa el patrón 555).
- **ENCONTRADO:** «Actividad» lee `entity_audit_log` con la sesión (`usuarios/actions.ts:1329-1336`), pero desde la
  0270 authenticated no tiene SELECT ni policy de lectura sobre esa tabla (`0270:588-591`). En una base real la
  consulta falla y la acción devuelve la lista vacía sin avisar (`:1336`). Para la privacidad es fail-closed (nadie
  ve de más), pero la pestaña sale vacía. También está vencido el comentario de `rbac-actions-guard.test.ts:373`
  («la lectura de la bitácora la limita la RLS del tenant»). No lo cambié porque es lógica de lectura fuera de lo
  pedido. Un arreglo posible: leer con `audit_list_events` (0270) o con el cliente de servicio después de
  `tenantAdminGate`, filtrando por tenant.
- **ENCONTRADO (menor):** la persona destinataria también lee el motivo de su extra (`0538:250`). El aviso lo cubre,
  pero nada controla el contenido del texto.
- **NO VERIFICABLE:** qué motivos reales hay (no leí filas de producción, y la 0538 no está aplicada); si el extra de
  `conversaciones` tiene una finalidad documentada para cada persona (es una decisión de negocio); la retención de
  `entity_audit_log` (no encontré en el repo una purga para este tipo; la decide Sam).
- La skill recomienda una segunda revisión con otro modelo antes de integrar.

### Actividad arreglada (decisión del DG, 2026-11-14; commit `31c8e1897`)

`listUserAccessActivityAction` lee la bitácora con `createAdminClient()` dentro de la acción, sin migración nueva.
Cada condición tiene su prueba en `app/studio/(app)/usuarios/__tests__/actividad-acceso.test.ts`:

| Condición | Código (`usuarios/actions.ts`) | Prueba |
|---|---|---|
| Ver `users` y ser admin del tenant antes de leer | `:1342` `moduleViewDenial(supabase, "users")` (el equivalente de `requireModuleView` para acciones: no redirige), `:1344` `tenantAdminGate` (el mismo de `grantUserModuleAction`) | `:147` no-admin; `:155` con extra de `users` solo ver |
| Tenant de la sesión (`gate.tenantId`) y persona destino miembro de ese tenant en `user_tenants` | `:1349-1356` | `:163` admin de otro tenant; `:177` persona de otro tenant da error y no lee la bitácora; `:184` filtros de la comprobación |
| Filtros fijos `tenant_id`, `entity_type` y `entity_id` (la 0538 guarda `entity_id = p_user_id`), columnas y tope 50 | `:1317-1320`, `:1358-1365` | `:170` y `:218` sin eventos de otro tenant; `:196` caso feliz con columnas y `limit(50)` |

El doble del cliente de servicio honra los `.eq()`. Mutantes corridos a mano (2026-11-14):
- sin `.eq("tenant_id", …)` en la bitácora → **ROJO**, 3 de 8 caen (`:170`, `:196` y `:218`);
- sin la comprobación de miembro → **ROJO**, 2 de 8 caen (`:163` y `:177`).

Restauré el archivo y la suite volvió a 8/8. Corregí el comentario de `rbac-actions-guard.test.ts:371-378`. Un
error de lectura ya no se traga en silencio: devuelve un mensaje que la pestaña muestra.

**Desvío de la allowlist:** `app/studio/(app)/usuarios/__tests__/actividad-acceso.test.ts` es nuevo y no está en
§11 de la spec 0622. Hay que enmendarla.

### Corrida con turno (2026-11-14, la única pesada en la PC)

Cabeza medida: `ea59a6921`. `pnpm install --frozen-lockfile` una vez (47 s), sin junction.

| Comprobación | Resultado |
|---|---|
| Focales: `AccesoPanel.test.tsx`, `RolYAlcanceCard.test.tsx`, `user-module-grants.migration.test.ts` (PGlite 0538-0540), `rbac-actions-guard`, `rbac-view-guard`, `page-gates-sensibles`, `rbac.test.ts`, `rls-lectura-dinero-y-gastos.migration.test.ts`, `actividad-acceso.test.ts` | 1.ª corrida: FALLÓ 1 de 674. Era el caso nuevo del aviso de motivo, que nunca había corrido: lo rendericé con el CRM ya concedido, así que el buscador no lo ofrecía. Lo corregí en `ea59a6921` y `AccesoPanel.test.tsx` volvió a PASAR 11/11. Los otros 8 archivos PASARON (35 s), sin caídas por forks ni timeouts |
| `pnpm verify`: harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO, 1 AMARILLO), build | PASÓ |
| `pnpm verify`: test | PASÓ: 1127 archivos y 17906 pruebas (4 archivos y 26 pruebas en skip) |
| `pnpm verify`: e2e | PASÓ: 235, con 3 flaky que pasaron al reintento (`auth.spec.ts:81` en chromium y `company-photo-carousel.spec.ts:9` y `:64` en mobile-chrome) y 20 en skip |
| `pnpm verify`: migrations-applied | NO DISPONIBLE (el worktree no tiene `.env.local`) |
| `pnpm verify`: sql-tests y schema-rebuild | NO DISPONIBLE (sin Docker) |

`verify` terminó con exit 0 y CIERRE INCOMPLETO: 14 de 17 comprobaciones medidas y sin fallos. Duró unos 29 min
(20:19 → 20:49).

### Pendientes

- Contratos SQL en Postgres real (workflow «Contratos SQL» de la PR) y el ledger, en la PR.
- ~~Enmendar la allowlist de la spec 0622 (archivo de prueba nuevo).~~ Hecho en `e4a82be1a`.
- «Caso Alejandro» en spec, pruebas y handoff: **sin tocar**, espera la decisión de Sam.

## Revisión Opus sobre `e4a82be1a`: CAMBIOS (2026-11-14, vuelta W-509)

El diseño quedó aprobado: no hay escalada, la 0540 no corta lecturas legítimas y R1-R3 se cumplen. Faltaban
procedimiento y blindaje. Sin vitest ni verify en esta vuelta: el turno lo pide el Director.

1. **Esperas y cabeceras.**
   - `migrations-baseline.json` › `pendingBelowCutoff` tiene las tres, con motivo, orden 0528 → 0538 → 0539 → 0540
     y el OK nominal. La 0528 va antes porque su preflight aborta si `studio_can_read_money()` ya existe y la fase
     de dinero la redefinirá encima. Hoy ninguna de las tres la crea.
   - Cabecera «⚠️ NO APLICADA A PRODUCCIÓN» en `0538:4`, `0539:4` y `0540:4`. La 0540 avisa el lock en `:9`: son
     **8** tablas vivas, no 7 (el SQL hace DROP/CREATE POLICY en 8).
   - El gate pidió declarar `studio_grant_user_module`, `studio_revoke_user_module_grant` y la tabla
     `studio_user_module_grants`. `user_has_module` y `crm_puede_editar` no salen porque ningún código TS los
     llama: solo los usa el SQL.
   - Hay dos declaraciones nuevas en `pending-migration-symbol-declarations.json` (`0538-rpc-conceder-y-quitar` y
     `0538-lectura-de-extras`).
2. **Preflight exacto de la 0540** (`0540:65-89` y `:90-128`).
   - Comprueba, en las 8 tablas: dueño postgres, RLS sin FORCE, SELECT de authenticated, I/U/D esperados (no en
     `chatwoot_conversations`) y el conjunto exacto de 16 policies con nombre, cmd, roles, permisiva y md5 sin
     espacios de `qual|with_check` (método de la 0511).
   - Las huellas se midieron en PGlite sobre el fixture, que ahora copia literal todas las policies del repo
     (service_role y las dos del portal en su forma final de 0428/0433).
   - Indicio a favor: `166af319…` coincide con la huella que la 0511 midió **en producción** para la misma
     expresión.
   - anon no se afirma; el catálogo de producción lo mide el DG.
3. **Postflight de la 0540:** `or 0 = any (p.polroles)` en `:296`; las del portal, por nombre exacto en `:298`.
4. **Preflight de la 0539:** huellas de `crm_mover_etapa` y de las 5 policies del CRM (0506) en `0539:73-104`.
   Dos derivas de la 0506 en el contrato PGlite.
5. **La RPC rechaza lo no cubierto:**
   - `studio_module_is_grantable` (`0538:202`) es la copia de COVERED; la paridad TS↔SQL está en
     `user-module-grants.migration.test.ts`. El rechazo está en `0538:480`, después de los demás candados.
   - El contrato prueba los rechazos de Tesorería con confirmación (`4c`), Usuarios (`5b`), **admin** (`5g`), Legal
     incluso por el superadmin (`5f`) y la CN (`6e0`).
   - Las filas sensibles y la de la CN se cargan aparte, para seguir probando `user_has_module`.
   - Mutante: «la RPC concede módulos que la base no cubre».
   - **§13.3.3 sigue abierto para Sam**, anotado en la spec: ampliar la lista va con su migración.
   - Efecto: el doble aviso ya no es alcanzable ni por RPC mientras ningún sensible esté cubierto.
6. **Opcionales:**
   - Hechos:
     - mutantes de borrado y de OC/OV en la 0540 (aserciones `6a-6f` nuevas);
     - `getMyModuleGrants`, `getTenantGrantsByUser` y Discord leen `DECISION_COLUMNS`, sin `reason`, `granted_by`
       ni fechas.
   - **No hechos** (quedan pendientes):
     - `getMyModuleGrants` sin filtro por tenant (cambia firma y dobles);
     - el `id`/`aria-describedby` fijo del alta (`perm-motivo`, `perm-motivo-aviso`): hoy hay un solo formulario
       a la vez, y `useId` lo resolvería;
     - la lista de asesores del CRM sin desvíos por rol.
7. **El handoff de la 0624 sale de esta rama:** `61d36cca3` lo devuelve a como está en main. Su cambio vive en la
   PR #570 (`claude/docs-0624-handoff-aplicacion`, `c767ce51b`, solo ese archivo), sin fusionar.
8. Los blobs de 0538-0540 cambiaron; las declaraciones quedaron regeneradas.

**Validación liviana (sin vitest):**
- Corrí los tres contratos en PGlite con un script de Node, igual que `contract()`: TEST 0538 dio 61 aserciones,
  TEST 0539 dio 32 y TEST 0540 dio 34.
- Los 32 mutantes, derivas, controles rojos y dobles aplicaciones caen con la aserción que nombran.
- `check-pending-migration-symbols`: 0 ROJO y 3 AMARILLO.
- `migrations-lock`: 522 selladas y 4 esperas.
- `node --test` de migrations-lock y pending-migration-symbols: 38/38.
- `docs:check` y `sdd:check`: PASÓ.

**Allowlist:** suma `migrations-baseline.json` y `pending-migration-symbol-declarations.json`.
