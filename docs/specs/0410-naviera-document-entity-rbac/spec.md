---
sdd: "0410"
title: Documentos de Naviera con autorización del módulo Naviera
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0047", "0049", "0085", "0252", "0407", "0409"]
confidencialidad: interno
---

# SDD-0410 · Documentos de Naviera con autorización del módulo Naviera

## Evidencia y autoridad

El Hub enlaza `consolidation` y `booking` con `/studio/naviera`, cuyas acciones y
layout usan el módulo `naviera`. Después de 0441 ambas entidades caían en la
compatibilidad abierta y Comercial podía verlas y mutarlas aunque la matriz
reserva Naviera a Operaciones y Contabilidad.

## Contrato acotado

- Añadir `consolidation → naviera` y `booking → naviera` a la única fuente
  interna del contrato documental.
- Replicar el default de Naviera: Operaciones y Contabilidad tienen vista y
  edición; Administrador conserva acceso total.
- Honrar overrides positivos y negativos por tenant; Soporte nunca edita.
- Conservar las entidades ya clasificadas, tipos financieros, entidades aún no
  clasificadas, tenant exacto, usuario desactivado y grants actuales.

## Fuera de alcance

- Cambios a datos, UI, tracking marítimo o acciones de Naviera.
- Bitácora y documentos sin transacción.
- Aplicación alojada, push, `main`, despliegue o limpieza.

## Allowlist exacta

- `supabase/migrations/0442_naviera_document_entity_rbac.sql`.
- `supabase/tests/0442_naviera_document_entity_rbac.test.sql`.
- Esta spec, índice, auditoría y checklist del saneamiento.

## Aceptación

- [x] RED demuestra que Comercial conserva ambas entidades tras 0441.
- [x] `consolidation` y `booking` comparten los defaults de Naviera.
- [x] Overrides positivos y negativos se respetan por tenant.
- [x] `support` permanece read-only aun con override de edición.
- [x] Usuario desactivado, tenant inyectado y acción desconocida fallan cerrados.
- [x] El mapa interno permanece sin `EXECUTE` para roles de API.
- [x] Contratos previos y compatibilidad de entidades restantes no cambian.
- [x] SQL completo 184/184 y rebuild de 439 migraciones quedan verdes.
- [x] 0442 permanece sin aplicar; checklist original conserva 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; los adjuntos heredan la autorización de Naviera.
- `SGE-00.07`: cumplimiento; ambas entidades amplían la fuente central.
- `MP-01`: cumplimiento; policies y guards existentes consumen el mismo motor.
- `AUD-01`: no aplica; no cambia eventos ni persistencia auditada.
