---
sdd: "0400"
title: Cajas del Portal por principal y tenant coherentes
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0153", "0361", "0399"]
confidencialidad: interno
---

# SDD0400 · Cajas del Portal por principal y tenant coherentes

> **Nota de importación — 2026-09-11, actualizada tras la aplicación.** Esta spec entró a
> `main` desde la PR #21 con su contenido original, `status: done` incluido. Su migración
> `0432_portal_warehouse_boxes_tenant_boundary` **fue APLICADA a producción el 2026-09-11**
> con OK nominal de Sam (ledger `20260911235835 / 0432_portal_warehouse_boxes_tenant_boundary`)
> y se verificó contra el objeto; el registro y la vuelta atrás están en
> `.agents/handoffs/lote-11-migraciones-aplicadas-20260911.md`.

## Evidencia y autoridad

La policy `warehouse_boxes portal self read` compara tenant y Shipping Mark,
pero los obtiene mediante dos helpers independientes. `client_users.tenant_id`
no tiene una FK compuesta que lo obligue a coincidir con `clients.tenant_id`:
un vínculo incoherente puede combinar el tenant de la membresía con el Shipping
Mark del cliente de otro tenant.

El contrato usa únicamente dos tenants y principals sintéticos en PostgreSQL
desechable. No autoriza Cloud, datos reales, aplicación de la migración, push,
`main`, despliegue ni limpieza.

## Contrato acotado

- Sustituir sólo la rama Portal SELECT de `warehouse_boxes`.
- Exigir vínculo activo, cliente vivo y coherencia `client_id + tenant_id`.
- Ligar la caja al mismo tenant y Shipping Mark de ese principal.
- Conservar policy de equipo, RLS, ACL y acceso de `service_role` sin cambios.
- Rechazar cualquier drift de policies antes de modificar la tabla.

## Allowlist exacta

- `supabase/migrations/0432_portal_warehouse_boxes_tenant_boundary.sql`.
- `supabase/tests/0432_portal_warehouse_boxes_tenant_boundary.test.sql`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED reproduce lectura con vínculo tenant/cliente incoherente.
- [x] Principal coherente ve sólo sus cajas vivas.
- [x] Principal incoherente/revocado no lee ni escribe cajas.
- [x] Staff y `service_role` conservan sus contratos anteriores.
- [x] Preflight rechaza policy inesperada, ausente o RLS deshabilitada.
- [x] Contratos SQL, rebuild, documentación y gates proporcionales quedan verdes.
- [x] 0432 permanece sin aplicar y el checklist original sigue 56/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; autorización de servidor exige principal y tenant
  coherentes.
- `AUD-01`: no aplica; es una lectura y no crea eventos de negocio.
- `MP-01`: no aplica; no cambia permanencia ni retención.
