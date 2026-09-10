---
sdd: "0407"
title: Documentos de envíos con autorización de Tracking
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0042", "0049", "0085", "0252", "0286", "0359", "0406"]
confidencialidad: interno
---

# SDD-0407 · Documentos de envíos con autorización de Tracking

## Evidencia y autoridad

Los documentos de envío existen en dos familias deliberadamente coexistentes:
`documents(entity_type = shipment)` para el Hub/DocsPanel y
`shipment_documents` + `shipment-docs` para la experiencia Portal. El control
documental posterior a 0438 todavía trataba `shipment` como no restringido.

Además, las acciones legacy de subida y borrado confiaban en que el usuario
hubiera llegado desde la página protegida, aunque una Server Action puede
invocarse directamente. La tabla y el bucket permitían CRUD por tenant sin
distinguir vista de edición. La policy Portal de 0416 ya estaba correctamente
ligada a principal, cliente, envío y tenant, y debía preservarse.

## Contrato acotado

- Exigir permiso de edición de `tracking` al inicio de ambas Server Actions.
- Añadir `shipment → tracking` al helper documental tenant-aware.
- Replicar defaults y overrides de Tracking; `support` conserva vista y nunca
  obtiene edición.
- Aplicar ese alcance al Hub, `shipment_documents` y `shipment-docs`.
- Separar lectura, inserción, actualización y borrado del camino interno.
- Mantener la policy Portal aditiva y SELECT-only sin cambios.
- Conservar tipos financieros, gastos, aislamiento de tenant y `service_role`.

## Fuera de alcance

- Cambiar la lectura Portal, el modelo de Shipping Mark o el contenido de envíos.
- Retirar una de las dos familias documentales.
- Autorizar las demás entidades del Hub.
- Aplicación alojada, push, `main`, despliegue o limpieza.

## Allowlist exacta

- `app/studio/(app)/tracking/[id]/document-actions.ts` y su prueba RBAC.
- `supabase/migrations/0439_shipment_document_entity_rbac.sql`.
- `supabase/tests/0439_shipment_document_entity_rbac.test.sql`.
- Esta spec, índice, auditoría y checklist del saneamiento.

## Aceptación

- [x] RED de aplicación demuestra que subir/borrar omiten el guard de Tracking.
- [x] RED SQL demuestra que Marketing ve y muta ambas familias por compartir tenant.
- [x] Las Server Actions rechazan antes de consultar dominio o Storage.
- [x] Defaults y overrides de Tracking gobiernan Hub, legado y bucket.
- [x] `support` conserva lectura y no muta aun con override de edición.
- [x] La policy Portal continúa dando sólo la lectura propia y no acceso directo
  al Hub ni al bucket.
- [x] Gastos, tipos financieros, tenant exacto y `service_role` se conservan.
- [x] 63 pruebas focales, TypeScript, lint, 181 contratos SQL y rebuild de 436
  migraciones quedan verdes.
- [x] 0439 permanece sin aplicar; checklist original conserva 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; ambos modelos heredan el módulo Tracking.
- `SGE-00.07`: cumplimiento; la misma decisión gobierna Hub, legado y Storage.
- `MP-01`: cumplimiento; el consumidor verifica permiso antes de I/O de dominio.
- `AUD-01`: no aplica; no cambia eventos ni razones humanas.
- `ERR-01`: cumplimiento; las acciones conservan el mensaje mínimo del guard.
