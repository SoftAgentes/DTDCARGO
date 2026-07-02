# Endurecimiento RBAC del Studio (2026-06-24)

> Remediación del hallazgo principal de la revisión de seguridad: **adopción
> parcial del RBAC por módulo (SDD-0085)**. El sistema estaba bien diseñado
> (`requireModuleView` por page + `moduleEditDenial` por server action, matriz
> `canAccessModule` fail-closed) pero la adopción era parcial y silenciosa: no
> hay gate central, así que cada módulo debía gatear solo y la mayoría no lo
> hacía. Mitigaban: auth requerida (layout `getUser`) + RLS por tenant. El
> hueco: **rol-dentro-del-tenant** (un `warehouse`/`support` podía ver/mutar
> módulos fuera de su matriz por URL o invocando la server action directo).

## Qué se arregló

### 1. Backstop de edición (`moduleEditDenial`) en mutaciones
Se agregó el guard como primer paso de cada server action de mutación en los
módulos sensibles que no lo tenían:

- **clientes** (9 actions: crear/editar/borrar, invitar/revocar/aprobar portal,
  verificar/marcar identidad, asignar asesor) + gate de vista.
- Vía codemod (19 módulos): `gastos, tarifas, seniat, fiscal, naviera, cn,
  cotizador, conversaciones, documentos, despacho, tms, kommo, fidelizacion,
  cola-qr, mailing, tracking/[id], tracking/nuevo, admin/rutas`.
- Manuales: `despacho/reglas`, `rendiciones`, `admin/agentes` (sus mutaciones
  delegan en helpers de lib, por eso el codemod no las cazó).

Ya estaban protegidos (no se tocaron): `ordenes-compra`/`ordenes-venta` (las
actions con guard viven en `lib/studio/{purchase,sales}-orders/actions.ts`; el
`(app)/actions.ts` es un barrel), `noticias-web` (`requireAdminWithTenant`),
`usuarios, operarios, costing, cobranzas, nomina, contabilidad, financiero-china,
facturacion, tesoreria, reclamos, academia`.

### 2. Gate de vista (`requireModuleView`) en pages sensibles
17 pages que no gateaban (ni page ni layout): `cn, cola-qr, conversaciones,
cotizador, despacho, despacho/dashboard, despacho/reglas, documentos, embarques,
fidelizacion, kommo, leads, proveedores, seniat, tarifas, tms, tracking`.

### 3. Test anti-drift
`lib/studio/rbac-actions-guard.test.ts` escanea `app/studio/(app)/**/actions.ts`
y **falla** si un archivo muta sin `moduleEditDenial` y no está en una ALLOWLIST
justificada. Esto cierra el barrido (cobertura completa hoy) y previene la
regresión: un módulo nuevo con mutaciones sin guard rompe el gate `verify.mjs`.

#### ALLOWLIST (excepciones documentadas)
| Archivo | Razón |
|---|---|
| `actions.ts` (raíz) | `signOut`: cierra la sesión del propio usuario. |
| `bugs/actions.ts` | Bug Reporter: cualquier staff reporta bugs (abierto). |
| `mis-bugs/actions.ts` | Bugs propios del usuario (abierto). |
| `ve/actions.ts` | App de operario VE: auth por PIN, no por rol de Studio. |
| `debug/actions.ts` | `recheckAll`: re-corre health checks, no muta negocio. |
| `admin/feature-flags/actions.ts` | Valida `role==='admin'` inline. |
| `ordenes-compra` · `ordenes-venta` | Barrels; guards en `lib/studio/*-orders/actions.ts`. |
| `marketing/noticias-web/actions.ts` | `requireAdminWithTenant` (gate admin propio). |

## Otros hallazgos de la revisión

- **`/api/debug/health`** — se eliminó el fallback de secreto por query param
  (`?key=`): quedaba en logs/historial/Referer. Solo `Authorization: Bearer`.

- **`/verificar` (RESUELTO · throttle por IP)** — página pública que usa
  `service_role` para verificar Shipping Marks (`DTD-NNNN`, secuenciales) y
  diplomas (`DTD-AC-YYYY-NNNN`). Ambos enumerables; la rama de **diploma exponía
  `student_name` (PII)** → cosecha de nombres por folio. **Mitigado con throttle
  por IP** (migr `0169` `public_verify_throttle` + `lib/public/verify-throttle.ts`,
  inyectado en `app/verificar/page.tsx`): pasado el límite (40 verificaciones /
  30 min por IP, generoso para escaneo de palet, ajustable) la página responde
  en **estado neutro** —ni confirma ni niega— sin tocar la DB ni revelar PII.
  Fail-open ante error del throttle (no rompe el escaneo legítimo). Tabla propia
  (no `portal_registro_throttle`) para no chocar con el límite de registro (5/60min).
  El throttle helper recibe el admin client por inyección porque `lib/public` no
  puede importar `@/lib/db` (frontera). **Pendiente menor:** la migr 0169 no se
  aplicó a una DB de prueba (espejo exacto de 0094, sin FKs ni funciones).

- **Material de marca (`/marca/*`, `/interno/marca/d/*`)** con gate `getUser()`
  (no `getUserTenantId()`): un cliente del portal puede ver el brand-book. **No
  es bug** — es decisión del founder (2026-06-14, ver comentario en
  `app/marca/brand-book/page.tsx`) y material de baja sensibilidad. Si se
  quisiera cerrar a solo-equipo: `getUser` → `getUserTenantId` en los 3 archivos.

## Límite conocido
Esto cierra el rol-dentro-del-tenant a nivel **app** (page + action). La RLS de
la DB ya aislaba por tenant; el endurecimiento por rol a nivel DB (RLS que mire
el rol) sigue siendo defensa-en-profundidad futura para los módulos más
sensibles (clientes/dinero), como ya lo hace nómina vía `nomina_can_access()`.

---

# Hardening 3 · Desactivación real de usuarios (2026-07-02)

> Remediación de la auditoría del módulo de permisos (ventana secundaria,
> worktree `rbac-disabled-enforcement`). Hallazgo principal: **"Desactivar" un
> usuario era cosmético dos veces** — (a) el UPDATE directo a `user_tenants`
> era un no-op silencioso (sin policy de UPDATE para authenticated → 0 filas,
> sin error, la UI decía "ok"), y (b) aunque `disabled_at` quedara seteado,
> ningún eslabón lo filtraba: `get_user_tenant_id()` (helper de TODA la RLS),
> `current_studio_role()`, la policy SELECT de `user_tenants`, el layout y
> `getStudioRole` → el desactivado conservaba rol, sidebar y toda la data.

## Qué se arregló (migr 0200 + 0201 + app)

1. **DB (migr `0200_rbac_disabled_enforcement.sql`)**
   - `get_user_tenant_id()` + `current_studio_role()` filtran
     `disabled_at is null` → toda la RLS por tenant y los gates de poderes en
     triggers cierran de una para desactivados.
   - Policy SELECT de `user_tenants`: `user_id = auth.uid() AND disabled_at is
     null` → las policies viejas con subquery inline a user_tenants (0024
     dispatch_* y afines) también cierran.
   - RPC `studio_set_user_disabled(target, disabled)`: admin activo +
     anti-lockout (no desactivar al último admin activo; cubre
     auto-desactivación) — reemplaza el UPDATE no-op.
   - RPC `studio_revoke_invitation(id)`: admin activo, idempotente, bloquea
     revocar aceptadas — reemplaza el UPDATE bloqueado por
     `no_direct_update using(false)`.
2. **Auditoría (migr `0201_user_role_audit.sql`)** — tabla append-only
   `user_role_audit` + trigger AFTER UPDATE en `user_tenants`: registra
   `role_change` / `disable` / `enable` con actor y target por CUALQUIER vía
   (RPC, admin client, SQL). SELECT solo admins activos del tenant.
3. **App** — `getStudioRole` y el layout filtran `.is("disabled_at", null)`;
   `disableUserAction`/`enableUserAction` van por RPC + **ban/unban en Supabase
   Auth** (`auth.admin.updateUserById`, `ban_duration`) para matar la sesión
   viva (la RLS ya corta la data; el ban es cinturón — si falla se loggea y
   sigue). `revokeInvitationAction` va por RPC. `tenantHasOtherAdmins` se
   eliminó (con RLS own-row siempre devolvía false; el anti-lockout vive en el
   RPC).
4. **View gates que faltaban** — `calendario`, `etiquetas`, `ve`, `servicios`,
   `marketing/noticias-web` no tenían `requireModuleView` (URL tecleable).
5. **Tests anti-drift**
   - `rbac-view-guard.test.ts` (NUEVO, espejo del de actions): todo módulo del
     registro debe tener gate de vista o excepción justificada (allowlist:
     dashboard/mentions/bugs/mis-bugs).
   - `rbac.test.ts`: `NON_ADMIN` ahora se DERIVA de `STUDIO_USER_ROLES` (la
     lista hardcodeada dejó a `marketing` fuera de los candados de gobernanza);
     candado de dinero ahora verifica que SOLO accounting pasa.
6. **Menores** — password de invitación mín 6→8; copy "acceso por módulo
   configurable" → "definido por rol" (la matriz es estática por diseño,
   SDD-0124); cast `as never` en PermissionsSection → `StudioUserRole`.

## Residual aceptado

- Los helpers de correlativos de 0024 (`next_dispatch_order_code`,
  `next_route_code`, etc.) validan membership sin filtrar `disabled_at`; solo
  devuelven un código string y el INSERT posterior lo bloquea la RLS.
- El access token vivo de un desactivado puede seguir siendo válido hasta
  expirar (~1h) si el ban en Auth falla — pero la RLS ya le devuelve 0 filas
  desde el momento del disable.
- Los `denied` de matriz para el rol `marketing` en módulos neutrales
  (dashboard/menciones/bugs) son **decisión de matriz pendiente del founder**,
  no de enforcement.
