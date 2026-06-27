---
sdd: "0085"
title: "RBAC por módulo del Studio — matriz rol×módulo + gate de vista y de acción"
status: done
author: "Claude Code (ventana rbac-modulos) + founder"
created: 2026-06-14
updated: 2026-06-27
supersedes: null
superseded_by: null
related: ["0024", "0007", "0076", "0048", "0020"]
confidencialidad: interno
---

# SDD-0085 — RBAC por módulo del Studio

> Aplica la **separación de poderes** que el doc `estructura-perfiles-dtdcargo.md` predica
> pero que el ERP no enforzaba. Hasta hoy el Studio solo distinguía **admin vs no-admin**:
> los 6 roles (SDD-0024) existían en DB pero los 4 intermedios no restringían ningún módulo
> (el único aislamiento real era `tenant_id`/RLS). Un `accounting` podía abrir **Usuarios**;
> un `operations` podía abrir **Tesorería** y, vía el bypass de server actions, mover plata.

## 0. Origen y principio

Sale del análisis "cuajar los servicios a los perfiles → roles del ERP" (sesión 2026-06-14,
hermano de `docs/specs/0076-configuracion-servicios/assets/FASE-FUTURA-motor-flujo-interno-y-rbac.md` §6).
Hallazgo: los ~14 roles de negocio **colapsan limpio en los 6 RBAC existentes** — **no se crean
roles nuevos**. El único hueco era el *enforcement* por módulo. Founder: **"simple gana"**.

## 1. Modelo

- **6 roles** (sin cambios, SDD-0024): `admin · commercial · operations · accounting · warehouse · support`.
  Un solo vocabulario en todo el sistema — el `owner_role` del motor de flujo (FASE-FUTURA)
  reusa estos mismos.
- **Matriz módulo×rol** (`lib/studio/rbac.ts`, `ROLE_MODULE_ACCESS`): por cada `id` del registro
  de módulos (`lib/studio/modules.ts`), la lista de roles no-admin con acceso de **vista**.
  - `admin` ve y edita TODO (implícito; no figura en la matriz).
  - `support` es **read-only V1**: ve lo permitido, nunca edita.
  - **Fail-closed**: un módulo sin entrada = solo admin.
- **Data pura** → `modules.ts` + `rbac.ts` se importan desde el sidebar (client), el layout, las
  pages y las actions. Los guards server-side viven en `rbac-guard.ts`.

## 2. Candados de gobernanza (separación de poderes)

| Candado | Regla | Por qué |
|---|---|---|
| **Dinero = accounting** | `treasury·accounting·invoices·collections·costing·reports·fiscal` → solo `accounting` (+admin). NUNCA `operations`/`commercial`. | Tesorería mueve plata; los libros son sensibles. **Yolimar = accounting, NO admin.** |
| **Admin-only duro** | `users·admin·direccion·renditions·financiero-china·legal·no-olvidar·mailing` → solo `admin`. | Gestión de roles (keystone), plata internacional, recovery custodial, gates legales, reglas de correo. |
| **Operations verifica, no mueve plata** | `operations` ve operación + registra gastos, pero ningún módulo de tesorería/contabilidad. | El doc lo exige: Operador-ERP ≠ Tesorería. |
| **Sourcing = commercial** | `suppliers·purchase-orders` incluyen `commercial`. | José = commercial. |

## 3. Tres capas de enforcement

1. **Sidebar (UX)** — `StudioSidebar` filtra los links por `canAccessModule(role, id)`. Solo
   esconde; no es seguridad. El layout pasa `role` (antes pasaba `isAdmin`).
2. **Vista (page, seguridad real)** — un `layout.tsx` por módulo sensible llama
   `requireModuleView("<id>")`: si el rol no puede ver, **redirect** a `/studio/resumen?denied=<id>`.
   Un layout por carpeta cubre todo el subtree (lista + detalle) sin tocar las pages existentes.
   `admin/` usa layouts en las hojas (`agentes`, `feature-flags` = admin; `rutas` = operations) +
   guard inline en `admin/page.tsx`, porque `admin/rutas` NO es admin-only.
3. **Acción (seguridad real)** — las server actions son invocables como un endpoint (el bypass de
   Next.js: una action se puede disparar desde cualquier ruta que pase el proxy, sin renderizar su
   page). Por eso las mutaciones sensibles validan su propio permiso con
   `moduleEditDenial(supabase, "<id>")` → `{ error }`.

## 4. Cobertura V1 (lo implementado en este carril)

- ✅ `lib/studio/modules.ts` (registro extraído del sidebar, data pura).
- ✅ `lib/studio/rbac.ts` (matriz + `canAccessModule` / `canEditModule` / `moduleIdForPath` / `isKnownModule`).
- ✅ `lib/studio/rbac-guard.ts` (`requireModuleView` / `moduleEditDenial` / `getStudioRole`).
- ✅ Sidebar filtra por rol; layout pasa `role`; `<DeniedToast>` + empty-state del nav (rol sin módulos).
- ✅ **View gate** (`layout.tsx` por carpeta) en 22 módulos sensibles: dinero (tesorería,
  contabilidad, facturación, cobranzas, costing, reportes, fiscal, gastos), admin-only (usuarios,
  admin, dirección, rendiciones, financiero-china, legal, no-olvidar, mailing, admin/agentes,
  admin/feature-flags), operativos restringidos (naviera, operarios, órdenes-compra/venta,
  admin/rutas).
- ✅ **Action gate** (`moduleEditDenial`) en TODO el superficie de escritura de dinero/sensible —
  porque **la RLS scope-a por tenant, NO por rol**, así que acá el gate es el control REAL contra el
  bypass de server actions:
  `usuarios` · `tesoreria` · `contabilidad` · `facturacion` · `cobranzas` · `costing` ·
  `financiero-china` (admin-only) · `operarios` · `sales-orders` · `purchase-orders`.
  El puente OC→Bill (`receivePurchaseOrder`) exige **`treasury`** (causar la CxP es acto contable),
  cerrando el bypass que detectó la auditoría. El hook interno `autoInvoiceForReceipt` (admin-client,
  disparado por la consolidación CN) NO se gatea — rompería el flujo SDD-0072.
- ✅ Test anti-drift `lib/studio/rbac.test.ts`: matriz ↔ registro + candados de gobernanza +
  **presencia del gate de acción** en cada actions.ts sensible (atrapa una mutación nueva que olvide
  el guard — el hueco que la 1ª pasada dejó y cazó el auditor adversarial).

## 5. Seguridad: por qué el gate de acción importa

La RLS del Studio scope-a por `tenant_id`, **no por rol** (salvo `user_tenants`/`user_invitations`,
que sí tienen policies admin-only — por eso `usuarios` ya estaba protegido en DB). Para los módulos
de dinero (tesorería, contabilidad, etc.) la RLS deja pasar a cualquier miembro del tenant. Entonces:

- El **view gate** evita que un `operations` *abra* Tesorería y obtenga la referencia de la action.
- Pero un insider podría extraer el action-id del bundle e invocarla igual → **el `moduleEditDenial`
  en la action es el único control que realmente lo frena.** Por eso `tesoreria` lleva guard de acción.

## 6. Follow-up (siguiente carril)

- ⏳ **Confirmar con el founder** el candado del puente OC→Bill: `receivePurchaseOrder` ahora exige
  `treasury` (solo accounting/admin causan la CxP). Si el founder quiere que `operations` reciba OCs,
  relajar a `purchase-orders`. Default conservador = separación de poderes.
- ⏳ Gate de acción en `naviera` (14 mutaciones, integridad operativa — NO mueve plata; ya tiene
  view gate) y en `gastos` (RLS ya scope-a a cn-team; minor).
- ⏳ Gate central por `proxy.ts` (header `x-pathname` → `moduleIdForPath` → `canAccessModule`) para
  cubrir de una los GET de los módulos NO sensibles (hoy se esconden en el sidebar pero la URL es
  tecleable). Se descartó en V1 por blast-radius del proxy compartido.
- ⏳ Endurecer `getStudioRole` con `.eq("user_id", …)` explícito antes del tenant-switcher
  multi-tenant (hoy depende de la RLS de `user_tenants`; `limit(1)` sin orden → rol arbitrario si el
  user está en N tenants). No explotable en V1 single-tenant.
- ⏳ Hacer la matriz **editable por tenant en DB** + la "Matriz rol→persona" (titular/suplente) como
  tabla (alimenta el `owner_role` del motor de flujo). Hoy la sección `admin?section=permissions`
  es placeholder (SDD-0024).
- ⏳ Roles móviles (`operario_pins.role`: bodeguero/camionero, enum aparte) no entran en esta matriz.

## 7. No-objetivos

- No se crean roles nuevos (los 14 de negocio colapsan en 6).
- No se toca RLS ni hay migración (capa de app).
- No se toca el sitio público ni el back ni el móvil.
