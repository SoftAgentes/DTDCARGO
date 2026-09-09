---
sdd: "0388"
title: Proveedores Portal en aplicación por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0057", "0361", "0387"]
confidencialidad: interno
---

# SDD0388 · Proveedores Portal en aplicación por principal y tenant

## Evidencia y autoridad

La numeración 0388 se comprobó contra 15 refs. Las tres acciones CRUD de
proveedores resuelven Shipping Mark mediante `get_portal_client_markbox`; el alta
resuelve después el tenant por otra RPC, mientras editar y borrar no fijan tenant
en sus filtros. La migración 0417 prepara defensa RLS pero sigue sin aplicar.

Este slice usa sólo fixtures. No autoriza aplicar 0417, consultar o modificar
proveedores/compras reales, hacer push, `main`, deploy o limpieza.

## Contrato acotado

- Resolver alta, edición y borrado con `getPortalClientPrincipal()`.
- Cortar antes del dominio si sesión, vínculo, cliente vivo o coherencia
  tenant/cliente no son válidos.
- Fijar `tenant_id` y Shipping Mark en detección de duplicados, actualización,
  comprobación de compras y borrado lógico.
- Derivar tenant y Shipping Mark del principal en el INSERT; conservar
  validaciones, secuencia, perfil extendido, mensajes y revalidaciones.
- No cambiar schema, RLS, 0417, UI ni acciones de compras/prealertas.

## Allowlist exacta

- `app/portal/(app)/proveedores/actions.ts`.
- `app/portal/(app)/proveedores/__tests__/supplier-principal-scope.test.ts`.
- Ajuste mínimo del test histórico del mismo módulo si lo exige el principal.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra DML con principal incoherente y ausencia de tenant.
- [x] Principal inválido hace cero consultas/DML de proveedores o compras.
- [x] Alta deriva payload y duplicados del principal canónico.
- [x] Editar y borrar fijan tenant, Shipping Mark, id y borrado lógico.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] 0417 y producción permanecen gates independientes no verificados.
- [x] Checklist original sigue 56/106.

Gobernanza: la no conformidad de defensa explícita quedó corregida en el CRUD de
proveedores. No hay cambio visual ni nueva categoría de datos personales.
