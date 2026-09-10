---
sdd: "0411"
title: Adjuntos de Bitácora con autorización del módulo Bitácora
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0049", "0085", "0146", "0252", "0406", "0410"]
confidencialidad: interno
---

# SDD-0411 · Adjuntos de Bitácora con autorización del módulo Bitácora

## Evidencia y autoridad

La aplicación presenta Soporte como sólo lectura en Bitácora y sus Server
Actions aplican `moduleEditDenial`, pero el contrato documental posterior a 0442
trataba `bitacora_task` como compatible. Además, las tres policies del bucket
`bitacora` sólo comprobaban tenant: Soporte podía escribir directamente metadata
y objetos sin pasar por la interfaz ni las acciones.

## Contrato acotado

- Añadir `bitacora_task → bitacora` al mapa documental central.
- Replicar los seis roles de vista del módulo; Soporte permanece read-only.
- Honrar overrides de Bitácora sin permitir que uno de edición abra a Soporte.
- Proteger lectura, inserción y borrado del bucket `bitacora` con la misma
  decisión; esto cubre adjuntos de tareas y audios de actas.
- Conservar service role, tenant exacto, usuario desactivado, entidades previas y
  grants del mapa interno.

## Fuera de alcance

- Cambios a UI, datos, comentarios o ciclo de vida de tareas/actas.
- Documentos sin transacción y otros módulos RBAC.
- Aplicación alojada, push, `main`, despliegue o limpieza.

## Allowlist exacta

- `supabase/migrations/0443_bitacora_document_entity_rbac.sql`.
- `supabase/tests/0443_bitacora_document_entity_rbac.test.sql`.
- Esta spec, índice, auditoría y checklist del saneamiento.

## Aceptación

- [x] RED demuestra que Soporte escribe metadata y bucket tras 0442.
- [x] Los seis roles conservan vista; Soporte no obtiene edición.
- [x] Overrides negativos cierran vista/escritura y el positivo no abre Soporte.
- [x] Operaciones conserva alta, lectura y borrado de adjuntos y audio.
- [x] Usuario desactivado, tenant inyectado y acción desconocida fallan cerrados.
- [x] El mapa interno permanece sin `EXECUTE` para roles de API.
- [x] Contratos previos no cambian.
- [x] SQL completo 185/185 y rebuild de 440 migraciones quedan verdes.
- [x] 0443 permanece sin aplicar; checklist original conserva 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; metadata y binario heredan el mismo módulo.
- `SGE-00.07`: cumplimiento; no se crea un autorizador paralelo para Storage.
- `MP-01`: cumplimiento; lectura y mutaciones distinguen vista/edición.
- `AUD-01`: no aplica; no cambia eventos ni persistencia auditada.
