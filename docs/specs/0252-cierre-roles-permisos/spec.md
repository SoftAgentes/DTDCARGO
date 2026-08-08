---
sdd: 0252
title: Cierre del carril roles y permisos — superadmin, matriz editable, recuperación
status: in-progress
author: Claude (ventana roles y permisos 2026-08-07)
created: 2026-08-07
updated: 2026-08-07
supersedes: null
superseded_by: null
related: [0024, 0085, 0124, 0139, 0250]
confidencialidad: interna
---

# SDD-0252 · Cierre del carril roles y permisos

Continuación de SDD-0250. El founder revisó las 6 decisiones pendientes que
dejó `docs/operaciones/prompt-cierre-permisos-2026-08-07.md` y aprobó las 6
recomendaciones sin ajustes (2026-08-07). De las 6, dos no requieren código
(Yolimar+nómina se queda igual · rol `support` se queda igual). Las otras
cuatro son el alcance de este spec.

## Problema

1. **Sólo 2 llaves están tras superadmin** (migr 0355: feature flags + tocar
   otro admin). Legal, No-Olvidar, Financiero China y Rendiciones siguen
   abiertos a cualquier `admin` del tenant — hoy eso incluye a dos directores
   que no son superadmin.
2. **Fiorella (marketing) no ve Documentos** (`rbac.ts:119`) — es el único rol
   excluido de un módulo transversal que todos los demás sí ven.
3. **El Studio no tiene recuperación de contraseña self-service.** El login
   cae en un `mailto:` a Sam — mismo hueco que cerró SDD-0250 para el "enviar
   acceso" administrado, pero sin la mitad que el usuario dispara solo.
4. **La matriz rol×módulo es de sólo lectura** (`PermissionsSection.tsx`,
   SDD-0124) — vive 100% en código. SDD-0139 dejó cláusula de reapertura para
   volverla editable en DB ("revisar recién con el primer pedido real del
   founder"); el pedido del founder del 2026-08-07 es ese gatillo.

## Decisión

### 1 · Superadmin en 4 módulos más

`SUPERADMIN_ONLY_MODULES` nuevo en `rbac.ts` = `financiero-china`, `legal`,
`no-olvidar`, `renditions`. Direccion y Mailing se quedan en admin-por-rol
(menor daño, cualquier director los necesita).

**Dirección se cambia sola, dos capas:**
- App: `requireModuleView`/`moduleEditDenial` (el gate real, per SDD-0085) le
  suman `isPlatformAdmin()` cuando el módulo está en el set nuevo — mismo
  patrón que ya usa `platformAdminDenial`.
- DB: mirror mecánico de 0355 en las policies "by admin" que SÍ existen hoy —
  `legal_docs` (write/update/delete), `renditions` e `rendition_receipts`
  (insert/update). Se agrega `is_platform_admin()` a la condición, igual que
  hizo 0355 con `feature_flags`.

**Lo que NO se toca, a propósito:**
- `financiero-china`: sus 5 tablas (`supplier_charges`, `supplier_credit_notes`,
  `currency_conversions`, `partner_ledger_entries`, `supplier_claim_offsets`)
  tienen RLS por TENANT, no por rol — es el patrón documentado de SDD-0085 (el
  gate real vive en la app). Subir el gate de app a superadmin es consistente
  con cómo ya estaba gateado; rediseñar su RLS es trabajo aparte, más grande y
  no pedido.
- `no-olvidar`: su RPC de mutación (`no_olvidar_rotate_kek`) usa un concepto de
  "admin" PROPIO (`no_olvidar_user_keys.role`), separado de `user_tenants`. Es
  un sistema custodial M-of-N **dormante** (memoria del proyecto: cero pago,
  no re-proponer). Se gatea sólo el ACCESO a la pantalla del Studio; el RPC
  custodial no se toca — cruzar dos conceptos de "admin" distintos en una
  migración de una tarde es más riesgo del que este pedido pide asumir.

### 2 · Matriz editable en DB

Nueva tabla `studio_role_module_overrides` (tenant_id, role, module_id,
can_view, can_edit) — sólo guarda DESVÍOS del default de `ROLE_MODULE_ACCESS`;
fila ausente = aplica el default de código (cero riesgo si la tabla queda
vacía). RPC `studio_set_role_module_access` (security definer, admin-only,
mismo nivel que el módulo `admin` hoy — NO se sube a superadmin, 0355 fue
deliberadamente chica) **rechaza duro** cualquier `module_id` en
`LOCKED_MODULES` (dinero ∪ admin-only) — el candado de gobernanza de SDD-0139
se mueve a la DB como invariante ejecutable, igual que ya lo es en TypeScript
(`rbac.test.ts`).

Lectura: `canAccessModule`/`canEditModule` ganan un 3er parámetro opcional
`overrides` (default `undefined` → 100% el comportamiento actual, cero blast
radius en los 14 call sites existentes). Se hidrata en los DOS puntos reales
de enforcement (`rbac-guard.ts`) y en el único punto UX (`StudioSidebar`, vía
`app/studio/(app)/layout.tsx`) — el resto de los 57 `page.tsx` no cambian.

`PermissionsSection.tsx` (hoy read-only) gana un wrapper cliente: celdas no
bloqueadas ciclan Ø → Ver → Ver+Editar al click, llaman la server action. Las
bloqueadas muestran el candado y no son clickeables (ni lo intentan — el
candado real es el RPC, esto es UX).

**Fuera de alcance** (SDD-0139 lo mantiene descartado): overrides POR USUARIO.
Esto es sólo por ROL — afecta a todos los que tengan ese rol en el tenant.

### 3 · Fiorella + Documentos

Una palabra: `documents` gana `"marketing"` en `ROLE_MODULE_ACCESS`.

### 4 · Recuperar contraseña self-service

`/studio/login/recuperar` — página + server action nueva. Reusa
`studio_access_tokens` (migr 0354, ya piensa en consumo-en-POST) generando el
token igual que `sendAccessLinkAction`, pero disparado por el propio usuario
sin sesión. Throttle por IP reusando `portal_registro_throttle` con prefijo
`studio-recuperar:` — mismo patrón que `/api/contact`. Respuesta genérica
siempre (exista o no el email) para no permitir enumeración, igual que el
magic-link del portal.

`LoginForm.tsx`: el link "¿Olvidaste tu contraseña?" apunta ahí en vez de al
`mailto:`.

## Fuera de alcance

- Overrides por usuario (matriz) — sigue descartado por SDD-0139.
- RLS por rol en Financiero China — patrón ya documentado y aceptado de RLS
  por tenant (SDD-0085); no se rediseña acá.
- El RPC custodial de No-Olvidar — sistema dormante, memoria dice no
  reproponer.
- Elevar Dirección/Mailing a superadmin — founder decidió dejarlos en admin.

## Testing

- `rbac.test.ts`: casos nuevos para `SUPERADMIN_ONLY_MODULES`, para
  `documents`+marketing, y para `canAccessModule`/`canEditModule` con
  `overrides` (incluyendo que un override sobre un módulo LOCKED se ignora).
- Tests contractuales SQL (con mutación, no decorativos) para: la policy
  nueva de `legal_docs`/`renditions`/`rendition_receipts` (un admin no-platform
  falla, un platform admin pasa) y para `studio_set_role_module_access`
  (rechaza LOCKED_MODULES, acepta el resto, respeta tenant).
- `node scripts/verify.mjs` en verde antes de aplicar nada a producción.
