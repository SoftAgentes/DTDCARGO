---
sdd: "0408"
title: Documentos de clientes con autorización del módulo Clientes
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0049", "0085", "0252", "0406", "0407"]
confidencialidad: interno
---

# SDD-0408 · Documentos de clientes con autorización del módulo Clientes

## Evidencia y autoridad

El Hub y el panel embebido enlazan `client` con el módulo `clients`, pero el
helper posterior a 0439 todavía trataba esa entidad como compatible para
cualquier rol activo del tenant. Eso permitía que roles sin Clientes, como
Marketing o Almacén, vieran y mutaran sus documentos desde el Hub transversal.

## Contrato acotado

- Añadir únicamente `client → clients` al contrato documental central.
- Replicar el default de Clientes: Comercial, Operaciones, Contabilidad y
  Soporte tienen vista; Soporte nunca edita.
- Honrar overrides positivos/negativos por tenant para módulos no bloqueados.
- Conservar gastos, envíos, tipos financieros, entidades aún no clasificadas,
  tenant exacto, usuario desactivado y grants actuales.
- Reutilizar sin recrear las policies y guards instalados por 0438.

## Fuera de alcance

- Cambios a datos o UI de Clientes.
- Proveedores, Naviera, Bitácora y documentos sin transacción.
- Aplicación alojada, push, `main`, despliegue o limpieza.

## Allowlist exacta

- `supabase/migrations/0440_client_document_entity_rbac.sql`.
- `supabase/tests/0440_client_document_entity_rbac.test.sql`.
- Esta spec, índice, auditoría y checklist del saneamiento.

## Aceptación

- [x] RED demuestra que `client` permanece abierto para Marketing tras 0439.
- [x] Defaults de Clientes coinciden con la matriz de aplicación.
- [x] Overrides positivos y negativos se respetan por tenant.
- [x] `support` permanece read-only aun con override de edición.
- [x] Usuario desactivado, tenant inyectado y acción desconocida fallan cerrados.
- [x] Contratos de gastos, envíos, finanzas y compatibilidad no cambian.
- [x] SQL completo 182/182 y rebuild de 437 migraciones quedan verdes.
- [x] 0440 permanece sin aplicar; checklist original conserva 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; el adjunto hereda la autorización de Clientes.
- `SGE-00.07`: cumplimiento; el helper central evita una regla paralela.
- `MP-01`: cumplimiento; policies y guards existentes consumen el nuevo mapa.
- `AUD-01`: no aplica; no cambia eventos ni persistencia auditada.
