---
sdd: "0139"
title: "RBAC: metodología definitiva — matriz en código + capabilities + scope de almacén (decisión Codex/panel)"
status: done
author: "Claude Code (ventana secundaria · worktree rbac-disabled-enforcement) + founder"
created: 2026-07-02
updated: 2026-07-02
supersedes: null
superseded_by: null
related: ["0085", "0124", "0024", "0093"]
confidencialidad: interno
---

# SDD-0139 · RBAC: metodología definitiva

> Cierra la pregunta "¿la matriz de permisos se vuelve editable como la mockeó
> el Norte?" con una decisión evaluada por 3 vías independientes: **Codex**
> (opinión externa), **panel de 3 agentes expertos** (arquitecto RBAC, experto
> Supabase/RLS, diseñador de producto) y **juez de síntesis**. El founder
> eligió aplicar la receta de Codex (2026-07-02).

## 1. Decisión (los 5 ejes)

| Eje | Decisión | Por qué (dimensionado a DTD: 1 tenant real, 3-15 usuarios) |
|---|---|---|
| **A. Fuente** | ⭐ **Matriz EN CÓDIGO** (deploy para cambiar). NO editable en DB, NO híbrido todavía. | Git + PR + tests anti-drift = el control y la trazabilidad ISO 9001 correctos. Editable en DB = drift silencioso, permisos rotos por UI, peor auditoría. |
| **B. Granularidad** | **V·E binario** + **capabilities explícitas** (`canSpecial`) para actos peligrosos. NO V/C/E/D. | "Delete/Approve no son CRUD genérico, son reglas de negocio" (Codex). V/C/E/D del mock del Norte = falsa precisión, cuadruplica el enforcement. |
| **C. Almacén CN/VE** | **`warehouse_scope` por usuario** (`cn·ve·all`, migr 0202) como atributo operativo. NO dimensión de la matriz, NO el picker de 9 hubs del mock (hay 2 hubs reales). | Es la promesa del Norte con valor real (Yiwu ≠ Valencia). Rol = qué módulos; scope = qué lado. |
| **D. Overrides por usuario** | **NO.** Rol puro + scope. | "Nadie recuerda por qué María tiene algo distinto al rol". Si alguien necesita otro acceso → el rol está mal asignado. |
| **E. Migración** | Sin cambio de firmas: `canAccessModule`/`canEditModule` intactos (choke point único). Candados pasan de comentario a **invariante ejecutable** (`LOCKED_MODULES` + tests). | Todo el enforcement (sidebar, view gates, action gates, ⌘K) ya hace funnel por esas 2 funciones. |

**Descartado formalmente** (si se re-propone, exigir gatillo de negocio real):
matriz editable en DB (revisar recién con el "empleado 4-5" o el primer pedido
real del founder, como spec propia), V/C/E/D por celda, overrides por usuario,
motores de policies externos (Casbin/OPA), picker de hubs individuales.

## 2. Implementado en este lane

- **`LOCKED_MODULES`** (`lib/studio/rbac.ts`): `MONEY_MODULES` (8, default =
  exactamente `['accounting']`) + `ADMIN_ONLY_MODULES` (8, default `[]`).
  Test con snapshot independiente: editar los sets o la matriz de un módulo
  candado rompe el gate.
- **Capabilities** (`CAPABILITIES` + `canSpecial()` + `capabilityDenial()`):
  registro de ACTOS peligrosos con roles explícitos. Primera real:
  `approve_money` (causar CxP) — el puente OC→Bill (`receivePurchaseOrder`)
  dejó de "prestarse" el gate del módulo treasury. Se agregan solo cuando el
  flujo existe; cero aspiracionales.
- **`warehouse_scope`** (migr `0202`): columna en `user_tenants` (`cn·ve·all`,
  default `all`) + RPC `studio_set_user_warehouse_scope` (admin activo) +
  registro en `user_role_audit` (`scope_change`, trigger). Enforcement:
  `scopeAllowsModule()` en sidebar + `requireModuleView` + `moduleEditDenial`
  para los módulos con lado (`cn`, `qrqueue`, `labels` = CN · `ve` = VE);
  admin no se filtra. UI: columna "Almacén" en `/studio/usuarios` (selector
  solo para operations/warehouse/support; el resto "—", admin "Todos").
- **Visor** (SDD-0124, sigue read-only): candado 🔒 (icono `Icon.lock`, no
  emoji) en módulos LOCKED + leyenda; copy de la sección admin corregido (ya
  no promete "read/write/approve").
- `service-catalog` suma `accounting` a la matriz (edita precio+cuenta de
  Academia dentro de servicios — SDD-0093; el gate de vista nuevo la dejaba
  afuera).

## 3. Row-level (fase futura, gatillo = 2º almacenista por lado)

El scope hoy gatea MÓDULOS. Filtrar FILAS por almacén dentro de módulos mixtos
(inventario, tms, despacho) queda para cuando haya más de un usuario por lado —
primero como filtro en queries server-side, después como RLS.

## 4. No-objetivos

- No se tocan las firmas ni los call sites de `canAccessModule`/`canEditModule`.
- No se crean roles nuevos ni roles custom por tenant.
- No se toca el sitio público, el back ni el móvil.
