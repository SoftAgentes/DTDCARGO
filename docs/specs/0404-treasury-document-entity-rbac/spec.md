---
sdd: "0404"
title: Documentos de Tesorería con autorización por entidad
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0044", "0049", "0224", "0403"]
confidencialidad: interno
---

# SDD-0404 · Documentos de Tesorería con autorización por entidad

## Evidencia y autoridad

`supplier_bill` y `supplier_payment` representan respectivamente una cuenta por
pagar y una orden de pago. Ambas enlazan el módulo Tesorería, cuyo acceso está
bloqueado a `accounting`/`admin`.

SDD-0403 instaló un único control reutilizado por filas, Storage, reservas,
restauraciones y guards de RPC, pero deliberadamente restringió sólo
`invoice`. El RED confirmó el estado incremental exacto: `commercial` ya no
podía acceder a factura, pero el helper todavía aceptaba CxP y pagos.

## Contrato acotado

- Añadir `supplier_bill` y `supplier_payment` al conjunto financiero del helper
  documental central.
- Conservar `invoice` cerrado y no modificar ningún otro tipo.
- Reutilizar las policies y triggers de 0435; no duplicarlos ni cambiar ACL.
- Mantener el comportamiento de workers y `service_role`.
- Validar con identidades sintéticas y PostgreSQL desechable, sin Cloud.

## Fuera de alcance

- `journal_entry`, `expense` y entidades operativas/comerciales.
- Cambios a tablas de Tesorería, UI, matriz de módulos o datos reales.
- Aplicación alojada, push, `main`, despliegue o limpieza.

## Allowlist exacta

- `supabase/migrations/0436_treasury_document_entity_rbac.sql`.
- `supabase/tests/0436_treasury_document_entity_rbac.test.sql`.
- Esta spec, índice, auditoría y checklist del saneamiento.

## Aceptación

- [x] RED demuestra que 0435 aún acepta CxP y pagos para `commercial`.
- [x] GREEN niega `invoice`, `supplier_bill` y `supplier_payment` a Comercial.
- [x] Contabilidad/Admin conservan los tres tipos financieros.
- [x] Usuario desactivado queda cerrado y `shipment` no cambia.
- [x] Grants del helper siguen fail-closed para `PUBLIC`/`anon`.
- [x] SQL completo 178/178 y rebuild de 433 migraciones quedan verdes.
- [x] 0436 permanece sin aplicar; checklist original conserva 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; CxP y pagos heredan el módulo Tesorería.
- `SGE-00.07`: cumplimiento; se reutiliza una decisión central ya conectada.
- `MP-01`: cumplimiento; los guards de 0435 consumen el helper actualizado.
- `AUD-01`: no aplica; no cambia eventos ni permanencia.
