---
sdd: "0403"
title: Documentos de factura con autorización por entidad
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0049", "0060", "0224", "0350", "0357"]
confidencialidad: interno
---

# SDD-0403 · Documentos de factura con autorización por entidad

## Evidencia y autoridad

El Hub de Documentos es transversal y permite acceso a seis roles, mientras
que Facturación es un módulo de dinero bloqueado a `accounting` y `admin`.
La base no trasladaba ese candado a los documentos polimórficos: la policy
`documents by tenant` y las policies del bucket `documents` autorizaban sólo
por tenant.

El fixture histórico confirmó que un usuario `commercial` del mismo tenant
podía leer el metadato, enumerar/firmar el objeto y ver las colas de subida y
restauración de una fila `entity_type = invoice`. Las RPC
`add_document_version`, `finalize_document_upload`,
`soft_delete_document`, `reauthorize_document_upload` y
`request_document_restore` son `SECURITY DEFINER`; cambiar sólo la RLS de la
tabla no cerraría sus escrituras privilegiadas.

## Contrato acotado

- Hacer que `invoice` herede el candado de Facturación:
  `accounting`/`admin` únicamente.
- Aplicarlo a filas, objetos Storage, reservas de subida y solicitudes de
  restauración.
- Cubrir escrituras `SECURITY DEFINER` con guards de trigger que evalúen el
  principal original de la solicitud.
- Conservar el comportamiento histórico de todos los demás tipos documentales.
- Conservar aislamiento por tenant, soft delete, `service_role`, workers,
  auditoría, versionado y retención.
- Validar sólo con identidades y documentos sintéticos en PostgreSQL local;
  no consultar filas reales ni aplicar Cloud.

## Fuera de alcance

- Autorizar en este mismo slice `supplier_bill`, `supplier_payment`,
  `journal_entry`, `expense` u otras entidades.
- Cambiar la matriz de roles, overrides, módulos, pantallas o taxonomía.
- Aplicar 0435, hacer push, integrar `main`, desplegar o limpiar worktrees.

## Allowlist exacta

- `supabase/migrations/0435_invoice_document_entity_rbac.sql`.
- `supabase/tests/0435_invoice_document_entity_rbac.test.sql`.
- Esta spec, el índice generado, la auditoría y el checklist de saneamiento.

## Aceptación

- [x] RED reproduce las cuatro superficies visibles para `commercial`.
- [x] `invoice` queda oculto y no mutable para roles no financieros.
- [x] El bucket impide leer, subir y borrar objetos bajo `/invoice/`.
- [x] Los guards bloquean mutaciones de factura dentro de RPC privilegiadas.
- [x] `accounting`/`admin` conservan el acceso legítimo.
- [x] Tipos no financieros, otro tenant, usuario desactivado y `service_role`
  conservan sus contratos esperados.
- [x] SQL completo 177/177 y rebuild de 432 migraciones quedan verdes.
- [x] 0435 permanece sin aplicar y el checklist original conserva 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; el recurso hereda el candado del módulo dueño.
- `SGE-00.07`: cumplimiento; las cuatro superficies aplican la misma decisión.
- `MP-01`: cumplimiento; las RPC privilegiadas dejan de saltar la autorización.
- `AUD-01`: no aplica; el slice no cambia eventos ni persistencia de auditoría.
