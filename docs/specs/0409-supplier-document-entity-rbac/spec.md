---
sdd: "0409"
title: Documentos de proveedores con autorización del módulo Proveedores
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0049", "0085", "0252", "0406", "0407", "0408"]
confidencialidad: interno
---

# SDD-0409 · Documentos de proveedores con autorización del módulo Proveedores

## Evidencia y autoridad

El Hub enlaza `supplier` con documentos transversales, pero el helper posterior
a 0440 todavía trataba esa entidad como compatible para cualquier rol activo del
tenant. Eso permitía a Contabilidad, Almacén, Marketing o Soporte acceder aunque
la matriz de aplicación reserva Proveedores a Comercial y Operaciones.

## Contrato acotado

- Añadir únicamente `supplier → suppliers` al contrato documental central.
- Replicar el default de Proveedores: Comercial y Operaciones tienen vista y
  edición; Administrador conserva acceso total.
- Honrar overrides positivos y negativos por tenant para roles no bloqueados.
- Extraer el mapa entidad/módulo a una función interna reutilizable, sin permiso
  de ejecución para roles de API.
- Conservar clientes, gastos, envíos, tipos financieros, entidades aún no
  clasificadas, tenant exacto, usuario desactivado y grants actuales.

## Fuera de alcance

- Cambios a datos o UI de Proveedores.
- Naviera, Bitácora y documentos sin transacción.
- Aplicación alojada, push, `main`, despliegue o limpieza.

## Allowlist exacta

- `supabase/migrations/0441_supplier_document_entity_rbac.sql`.
- `supabase/tests/0441_supplier_document_entity_rbac.test.sql`.
- Esta spec, índice, auditoría y checklist del saneamiento.

## Aceptación

- [x] RED demuestra que `supplier` permanece abierto para Contabilidad tras 0440.
- [x] Defaults de Proveedores coinciden con la matriz de aplicación.
- [x] Overrides positivos y negativos se respetan por tenant.
- [x] `support` permanece read-only aun con override de edición.
- [x] Usuario desactivado, tenant inyectado y acción desconocida fallan cerrados.
- [x] El mapa interno no es ejecutable por roles de API.
- [x] Contratos de clientes, gastos, envíos, finanzas y compatibilidad no cambian.
- [x] SQL completo 183/183 y rebuild de 438 migraciones quedan verdes.
- [x] 0441 permanece sin aplicar; checklist original conserva 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; el adjunto hereda la autorización de Proveedores.
- `SGE-00.07`: cumplimiento; una fuente interna amplía el helper central.
- `MP-01`: cumplimiento; policies y guards existentes consumen el mismo motor.
- `AUD-01`: no aplica; no cambia eventos ni persistencia auditada.
