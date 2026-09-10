---
sdd: "0406"
title: Documentos de gastos con autorización por módulo
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0049", "0085", "0224", "0252", "0403", "0404", "0405"]
confidencialidad: interno
---

# SDD-0406 · Documentos de gastos con autorización por módulo

## Evidencia y autoridad

La migración 0314 incorporó `expense` al enum documental, pero el contrato
TypeScript del Hub no lo reconocía. Además, el control instalado por 0435–0437
dejaba pasar cualquier entidad no financiera y no distinguía vista de edición.
Eso contradecía la matriz configurable del módulo `expenses`: por defecto
acceden `accounting`, `operations` y `warehouse`, y los overrides por tenant
pueden abrir o cerrar el módulo sin permitir que `support` edite.

Los endpoints de reserva y restauración ya comprobaban `moduleEditDenial`, pero
reautorizar y finalizar una carga no lo hacían antes de invocar el servicio.

## Contrato acotado

- Registrar `expense` como `Gasto`, enlazado a `/studio/gastos`.
- Exigir edición de Gastos en reautorización y finalización, antes de firmar o
  cambiar una reserva.
- Separar autorización documental de vista y edición, ligada al tenant exacto.
- Mantener `invoice`, `supplier_bill`, `supplier_payment` y `journal_entry`
  bloqueados a `accounting`/`admin`, sin overrides.
- Para `expense`, replicar defaults y overrides de `expenses`; `support` puede
  recibir vista explícita, pero nunca edición.
- Conectar el mismo punto de decisión a metadatos, bucket `documents`, intents,
  restauraciones y guards de RPC `SECURITY DEFINER`.
- Conservar `service_role`, tipos no restringidos y el candado de borrado físico.

## Fuera de alcance

- Cambiar la matriz, el bucket privado `erp-attachments` o datos de gastos.
- Autorizar otras entidades documentales.
- Aplicación alojada, push, `main`, despliegue o limpieza.

## Allowlist exacta

- `lib/studio/documents/types.ts` y su prueba.
- Helpers y prueba del Hub de Documentos.
- Rutas y prueba RBAC de reautorización/finalización de adjuntos.
- `supabase/migrations/0438_expense_document_entity_rbac.sql`.
- `supabase/tests/0438_expense_document_entity_rbac.test.sql`.
- Esta spec, índice, auditoría y checklist del saneamiento.

## Aceptación

- [x] RED demuestra los cuatro huecos de aplicación y la apertura SQL posterior
  a 0437.
- [x] El Hub reconoce `expense` y enlaza el módulo Gastos.
- [x] Reautorizar/finalizar responden 403 antes del servicio cuando falta edición.
- [x] Defaults, overrides positivos/negativos y `support` read-only coinciden con
  la matriz de Gastos.
- [x] Lectura y edición quedan separadas en filas y Storage.
- [x] El tenant inyectado, usuario desactivado y RPC privilegiadas fallan cerrados.
- [x] Los cuatro tipos financieros, tipos no restringidos y `service_role` se
  conservan.
- [x] 64 pruebas de dominio, regresión completa 7.296/7.296, TypeScript, lint,
  180 contratos SQL y rebuild de 435 migraciones quedan verdes.
- [x] 0438 permanece sin aplicar; checklist original conserva 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; cada adjunto hereda el módulo que autoriza la entidad.
- `SGE-00.07`: cumplimiento; UI, filas, Storage y RPC convergen en el mismo alcance.
- `MP-01`: cumplimiento; el guard se ejecuta antes de firmar o mutar una reserva.
- `AUD-01`: no aplica; no cambia eventos, razones humanas ni persistencia auditada.
- `ERR-01`: cumplimiento; las rutas conservan error mínimo y status 403.
