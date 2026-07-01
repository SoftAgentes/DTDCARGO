---
sdd: "0131"
title: "Registro de cliente interno — persona/empresa (cédula vs RIF) + panel de completitud"
status: in-progress
author: "Claude Code (ventana construcción-de-norte) + founder"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0010", "0046", "0106", "0042"]
confidencialidad: interno
---

# SDD-0131 · Registro de cliente interno — persona/empresa + completitud

> El alta de cliente **interno** (`/studio/clientes`, cargada por un asesor) quedó atrás del alta
> **pública** del portal ([SDD-0042](../0042-portal-cliente/spec.md) Fase 6): el portal ya distingue
> **persona (cédula)** de **empresa (RIF)** y persiste `doc_kind`, pero el drawer del Studio pide un
> único campo "RIF (opcional)" que mezcla cédula y RIF y **nunca guarda `doc_kind`**. Resultado: los
> clientes internos nacen sin tipo de documento, la verificación de identidad (CNE/SENIAT) no los
> puede rutear, y no hay forma de ver **qué falta** para tener el perfil listo para operar.

## 1. Problema

- **Sin persona/empresa en el alta interna.** `ClientInput` / `validateClientInput()` no incluyen
  `doc_kind`; el drawer no lo pregunta. Todo cliente cargado por asesor queda con `doc_kind = null`.
- **Documento ambiguo.** Un solo campo con `RIF_REGEX` (acepta V/E/J/G/P). No separa cédula
  (`V/E-dígitos`) de RIF (`J/G-…-verif`) como hace `register-types.ts` en el portal.
- **Empresa sin contacto.** Para empresa, `name` es la razón social; la persona con la que se habla
  no tiene dónde ir (el portal la mete en `notes`, poco consultable).
- **No hay "qué falta".** Nada le dice al asesor qué campos faltan para completar el cliente.
- **MARKBOX** ✅ ya se autollena bien (`rpc next_markbox`) — no se toca.

## 2. Alcance

1. **Selector Persona / Empresa** en el drawer de alta+edición → campo de documento que cambia de
   etiqueta/validación (Cédula / RIF), campo **Nombre de contacto** solo para empresa, y persiste
   `doc_kind` + `contact_name`.
2. **Panel "Qué falta para completar"** — checklist derivado (sin estado nuevo en DB) que evalúa:
   tipo de documento, documento, email, teléfono, dirección, foto de documento, verificación de
   identidad. Se muestra en la **ficha del cliente** (card) y como **aviso al crear** (drawer).
3. Relajar el gate de la **card de verificación de identidad** para que aparezca en cualquier cliente
   con documento (hoy solo portal/foto), ahora que el alta interna sí fija `doc_kind`.

Fuera de alcance: badge de completitud en el listado; ancla `person_id` en el alta (SDD-0106 Fase 2);
verificación automática SENIAT (SDD-0046 Slice C).

## 3. Datos

- **`clients.contact_name`** (migración `0194`, aditiva/nullable): contacto operativo de empresa.
- `clients.doc_kind` — ya existe (0092). Ahora lo setea también el alta interna.
- Sin otras columnas nuevas; la completitud es **derivada** en la capa de app.

## 4. Diseño

- `lib/studio/client-types.ts`: `doc_kind` + `contact_name` en `ClientInput`; `CEDULA_REGEX` /
  `formatCedula` / `normalizeDocByKind`; `validateClientInput()` valida el documento **según el tipo**;
  helper puro `clientCompleteness(client)` → `{ items, doneCount, total, isComplete, missingLabels }`.
- `app/studio/(app)/clientes/actions.ts`: parsea y persiste `doc_kind` + `contact_name` en create/update.
- `ClientDrawer.tsx`: toggle persona/empresa, documento dinámico, contacto (empresa), "qué falta" tras crear.
- `[markbox]/page.tsx`: badge de tipo, contacto, card "Perfil del cliente · qué falta", gate identidad relajado.

## 5. Seguridad

- Sin cambios de RLS: las columnas heredan la multi-tenancy de `clients`.
- El índice único normalizado `clients_tenant_doc_unique` (0095) sigue siendo el backstop de dedup;
  el guard 23505 en las actions traduce el error. La validación por tipo NO relaja el dedup.

## 6. Aceptación

- [ ] Alta interna: elijo Empresa → pide RIF + razón social + contacto; elijo Persona → pide cédula.
- [ ] `doc_kind` y `contact_name` quedan persistidos y visibles en la ficha.
- [ ] Cédula inválida en modo Persona / RIF inválido en modo Empresa → error de campo claro.
- [ ] La card "qué falta" lista los campos faltantes y marca "completo" cuando están todos.
- [ ] `node scripts/verify.mjs` verde; sin tocar `main` ni aplicar la migración a prod.

## 7. Notas de integración (ventana secundaria)

- Rama `feat/construccion-norte`, worktree `DTD-worktrees/construccion-norte`. No merge/push/migración
  a prod desde esta ventana (Director). Renumerado por el Director en integración: migración `0194` y
  SDD `0131` (web-norte ocupó 0190-0193 / SDD-0120-0130). El índice `docs/specs/README.md` lo regenera el Director.
