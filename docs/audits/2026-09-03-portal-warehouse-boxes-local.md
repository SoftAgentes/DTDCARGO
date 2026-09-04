---
title: Cajas Portal - principal y tenant coherentes
tipo: auditoria-tecnica
autor: Codex
created: 2026-09-03
updated: 2026-09-03
confidencialidad: interno
---

# Cajas Portal · SDD-0400 / 0432 · evidencia local

## Resultado

El contrato sintético reprodujo el cruce de `warehouse_boxes`: la policy
histórica combinaba el tenant de `client_users` con el Shipping Mark del cliente
referenciado, aunque ese cliente perteneciera a otro tenant. El RED devolvió
exit 3 después de confirmar una caja ajena visible.

La migración 0432 sustituye únicamente `warehouse_boxes portal self read` por
un vínculo activo que exige coherencia `client_id + tenant_id`, cliente vivo y
la misma identidad de la caja. No modifica filas, helpers, ACL, Storage, la
policy de equipo ni la habilitación RLS. Permanece local y sin aplicar.

## Evidencia ejecutada

- RED causal: principal incoherente leyó una caja ajena.
- GREEN focal: principal válido vio una caja; incoherente y revocado, cero.
- Staff conservó dos filas vivas de su tenant; `service_role`, las cinco del
  fixture incluido el histórico, antes del rollback total.
- Tres drifts rechazados: policy inesperada, policy objetivo ausente y RLS
  deshabilitada.
- 174/174 contratos SQL verdes.
- Rebuild de 429 migraciones: 411 desde cero, 18 sólo-ledger y aislamiento
  comprobado sobre 219 tablas con dos tenants de prueba.
- No hubo Cloud, filas reales, aplicación alojada, push, `main`, despliegue ni
  limpieza.

## Clasificación

- `SGE-00.05` — **cumplimiento:** la lectura exige principal y tenant coherentes.
- `AUD-01` — **no aplica:** no existe mutación ni evento de negocio.
- `MP-01` — **no aplica:** no cambia permanencia, borrado ni retención.
- Producción — **NO VERIFICABLE:** 0432 no se aplicó ni se consultó Cloud.
