---
sdd: "0405"
title: Documentos de asientos con autorización por entidad
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0040", "0049", "0224", "0403", "0404"]
confidencialidad: interno
---

# SDD-0405 · Documentos de asientos con autorización por entidad

## Evidencia y autoridad

`journal_entry` enlaza un asiento del módulo Contabilidad, bloqueado por la
matriz a `accounting`/`admin`. Tras 0436, el helper documental ya protegía
facturas, CxP y órdenes de pago, pero todavía aceptaba asientos para
`commercial`.

## Contrato acotado

- Añadir únicamente `journal_entry` al conjunto financiero del helper central.
- Conservar los tres tipos financieros ya cerrados y todos los demás tipos.
- Reutilizar sin duplicación las policies y guards instalados por 0435.
- Mantener grants de helper y caminos de `service_role`.
- Probar con identidades sintéticas; no consultar ni escribir Cloud.

## Fuera de alcance

- `expense` y entidades operativas/comerciales.
- Cambios al libro contable, matriz de módulos, UI o datos reales.
- Aplicación alojada, push, `main`, despliegue o limpieza.

## Allowlist exacta

- `supabase/migrations/0437_accounting_document_entity_rbac.sql`.
- `supabase/tests/0437_accounting_document_entity_rbac.test.sql`.
- Esta spec, índice, auditoría y checklist del saneamiento.

## Aceptación

- [x] RED demuestra que 0436 aún acepta `journal_entry` para Comercial.
- [x] GREEN niega los cuatro tipos contables a `commercial`.
- [x] Contabilidad/Admin conservan los cuatro tipos.
- [x] Usuario desactivado queda cerrado y `shipment` no cambia.
- [x] Grants permanecen fail-closed para `PUBLIC`/`anon`.
- [x] SQL completo 179/179 y rebuild de 434 migraciones quedan verdes.
- [x] 0437 permanece sin aplicar; checklist original conserva 57/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; el adjunto hereda el módulo Contabilidad.
- `SGE-00.07`: cumplimiento; el helper central evita decisiones divergentes.
- `MP-01`: cumplimiento; los guards existentes consumen el nuevo alcance.
- `AUD-01`: no aplica; no cambia eventos ni persistencia.
