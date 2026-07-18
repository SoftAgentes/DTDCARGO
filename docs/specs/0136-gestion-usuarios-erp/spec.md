---
sdd: "0136"
title: "Gestión de usuarios del ERP — alta por rol, reasignación y baja segura"
status: done
author: "Director (reserva de correlativo) + founder"
created: 2026-07-01
updated: 2026-07-14
supersedes: null
superseded_by: null
related: ["0024", "0085", "0135"]
confidencialidad: interno
---

# SDD-0136 · Gestión de usuarios del ERP (RESERVA)

> **Stub de reserva.** El correlativo 0136 queda tomado para el trabajo de gestión de
> los usuarios que operan el ERP. El análisis previo (clasificación de cuentas +
> matriz rol→persona + gaps del flujo de alta) lo produce la ventana `feat/usuarios-erp`
> en `docs/architecture/usuarios-erp-analisis.md`. Esta spec se completa **solo si el
> análisis concluye que hace falta código** (mejoras a `/studio/usuarios` + `app/invitar`).

## 1. Problema (a confirmar con el análisis)

Hoy conviven 21 cuentas `auth.users` pero solo 3 con rol de ERP (2 `admin` + 1
`warehouse`, una de ellas de prueba). El resto son clientes del portal, tests o
invitaciones sin activar. Falta: alta cómoda por rol, reasignación de rol, y baja
segura que distinga un cliente de portal activo de una cuenta huérfana.

## 2. Alcance (borrador — depende del análisis)

- Elegir **rol** al invitar (hoy el flujo `app/invitar` puede no pedirlo).
- **Reasignar** rol de un usuario existente sin recrearlo.
- **Desactivar** sin borrar (soft) + baja segura (revocar rol → confirmar no-portal →
  borrar `auth`).
- Respeta la matriz RBAC (SDD-0085): DINERO = solo `accounting` (+admin);
  `users`/`direccion`/`nomina`/`legal`/`financiero-china`/`mailing` = solo `admin`.

## 3. Notas

- El **enforcement** de permisos ya vive en `lib/studio/rbac.ts` + `rbac-guard.ts`
  (SDD-0085). Esta spec es de **gestión/administración** de las cuentas, no de la
  matriz en sí.
- La clasificación borrar/dejar y la matriz rol→persona salen del análisis; la
  ejecución en prod (altas/bajas) la hace el Director/founder, no una ventana.
- Reserva creada por el Director el 2026-07-01. Si el análisis concluye que basta
  con configuración (sin código), esta spec pasa a `superseded`/`done` sin desarrollo.
