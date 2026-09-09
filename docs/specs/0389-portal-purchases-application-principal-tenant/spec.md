---
sdd: "0389"
title: Compras Portal en aplicación por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0098", "0173", "0361", "0388"]
confidencialidad: interno
---

# SDD0389 · Compras Portal en aplicación por principal y tenant

## Evidencia y autoridad

La numeración 0389 se comprobó contra 15 refs. Crear una compra, pedirle un
servicio y completar su detalle resuelven Shipping Mark y tenant mediante RPCs
separadas. El proveedor, la compra y el catálogo de add-ons no fijan tenant en
todos sus filtros explícitos. La migración 0417 prepara defensa RLS pero sigue
sin aplicar y no sustituye la defensa de aplicación.

Este slice usa sólo fixtures. No autoriza aplicar 0417, subir adjuntos reales,
crear compras/servicios reales, hacer push, `main`, deploy o limpieza.

## Contrato acotado

- Resolver las tres acciones con `getPortalClientPrincipal()` y cortar antes del
  dominio con un principal inválido.
- Fijar tenant + Shipping Mark al resolver proveedor/compra; fijar tenant en el
  catálogo de add-ons y en todo DML de compra/servicio.
- Derivar del principal los identificadores usados en códigos, adjuntos y eventos.
- Conservar validaciones, reintentos, consentimiento, idempotencia, mensajes,
  subida best-effort y revalidaciones.
- No cambiar schema, RLS, 0417, UI ni CRUD de proveedores ya cerrado.

## Allowlist exacta

- `app/portal/(app)/proveedores/actions.ts`.
- `lib/studio/prealertas/queries.ts`.
- `app/portal/(app)/proveedores/__tests__/prealerta-principal-scope.test.ts`.
- `lib/studio/prealertas/__tests__/portal-query-tenant-scope.test.ts`.
- Ajuste mínimo del test histórico `update-prealerta-detalle.test.ts`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra dominio alcanzable con principal inválido y scopes sin tenant.
- [x] Principal inválido hace cero consultas/DML de compras y add-ons.
- [x] Alta deriva proveedor, compra, código y extras del principal canónico.
- [x] Servicio y detalle fijan tenant + Shipping Mark de punta a punta.
- [x] Los helpers consultados por estas acciones aceptan y aplican tenant explícito.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] 0417 y producción permanecen gates independientes no verificados.
- [x] Checklist original sigue 56/106.

Gobernanza: la no conformidad de defensa explícita quedó corregida en las tres
acciones y sus helpers. No hay cambio visual ni nueva categoría de datos personales.
