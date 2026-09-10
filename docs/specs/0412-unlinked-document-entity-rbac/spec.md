---
sdd: "0412"
title: Documentos sin transacción y contrato documental fail-closed
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0049", "0060", "0085", "0252", "0403", "0411"]
confidencialidad: interno
---

# SDD-0412 · Documentos sin transacción y contrato documental fail-closed

## Evidencia y autoridad

Después de 0443, `none` seguía en la compatibilidad abierta: Soporte podía
editar documentos sin transacción pese a ser read-only. El mismo fallback
permitía insertar objetos en el bucket `documents` con un segundo segmento
inventado. En aplicación, `addDocumentVersion` era la única mutación del Hub que
no ejecutaba `moduleEditDenial("documents")` al inicio.

## Contrato acotado

- Añadir `none → documents` con los seis roles de vista del módulo Documentos y
  Soporte estrictamente read-only.
- Mapear el valor vacío a Documentos para preservar paths legados sin segundo
  segmento.
- Hacer fallar cerrada cualquier entidad que no sea uno de los 12 valores del
  enum auditado ni el vacío de compatibilidad.
- Añadir el guard de edición faltante al versionado antes de sesión, tenant,
  lectura de fila, Storage o RPC.
- Conservar entidades previas, tipos financieros, overrides, tenant exacto,
  usuario desactivado y grants del mapa interno.

## Fuera de alcance

- Consultar o transformar objetos/datos reales.
- Agregar nuevos tipos documentales o cambiar la taxonomía del Hub.
- Aplicación alojada, push, `main`, despliegue o limpieza.

## Allowlist exacta

- `app/studio/(app)/documentos/actions.ts`.
- `app/studio/(app)/documentos/__tests__/version-actions.test.ts`.
- `supabase/migrations/0444_unlinked_document_entity_rbac.sql`.
- `supabase/tests/0444_unlinked_document_entity_rbac.test.sql`.
- Esta spec, índice, auditoría y checklist del saneamiento.

## Aceptación

- [x] RED de aplicación demuestra que el versionado ignora el denial.
- [x] GREEN ejecuta el guard antes de cualquier efecto posterior.
- [x] RED SQL demuestra `none` editable por Soporte y path inventado escribible.
- [x] `none` y path vacío heredan Documentos; Soporte permanece read-only.
- [x] Los 12 valores del enum quedan clasificados y un tipo desconocido falla.
- [x] Overrides positivos/negativos, usuario desactivado, tenant y acción
  desconocida conservan el contrato.
- [x] El mapa interno permanece sin `EXECUTE` para roles de API.
- [x] Focal de aplicación 13/13, SQL completo 186/186 y rebuild 441 verdes.
- [x] Suite unitaria completa 7.299/7.299, TypeScript y lint quedan verdes.
- [x] 0444 permanece sin aplicar; checklist original avanza a 58/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; `none` hereda Documentos y el versionado se guarda.
- `SGE-00.07`: cumplimiento; se completa la fuente central y se retira el
  fallback abierto.
- `MP-01`: cumplimiento; capa de aplicación, metadata y Storage convergen.
- `AUD-01`: no aplica; no cambia eventos ni persistencia auditada.
