---
sdd: "0162"
title: "Aviso de recepción al cliente — cablear la recepción del operario (China) al motor de avisos SDD-0156"
status: done
author: "Sam (founder) + Forge Kanban (spec puente)"
created: 2026-07-18
updated: 2026-07-18
supersedes: null
superseded_by: null
related: ["0154", "0156", "0153", "0155", "0245"]
confidencialidad: interno
feature_schema: 1
feature_id: F-0162
scope_status: complete
implementation_status: complete
verification_status: verified
domain: general_code
artifact_type: code
priority: yellow
owned_paths: [app/m/cn/recibir/actions.ts]
shared_paths: [lib/studio/notifications/schedule-fanout.ts]
forbidden_paths: [.env*, supabase/migrations/**]
gate: node scripts/verify.mjs
acceptance_criteria: ["Al recibir por escaneo en /m/cn/recibir se programa el aviso status:in_warehouse para el envío del cliente resuelto por Shipping Mark", "Sin envío resoluble para un Shipping Mark la caja se salta sin mal-notificar a otro cliente (mismo contrato que scheduleReceiptVeReceived)", "El aviso respeta la configuración del cliente en el motor SDD-0156 (evento status:in_warehouse configurable slice A)", "node scripts/verify.mjs verde sin migración nueva (wiring app-layer)"]
risk_tags: [notificacion-cliente, china-ve]
task_effort: 5
effort_reason: "Wiring app-layer que espeja un patrón existente (scheduleReceiptVeReceived); riesgo acotado, sin migración; un archivo compartido."
build_method: yunque
build_method_reason: "Toca lib/studio/notifications/schedule-fanout.ts (archivo compartido por otros eventos)."
builder_skills: [karpathy-principles]
review_skills: [testing-engineer]
tickets: [T-001]
evidence_code: [lib/studio/notifications/schedule-fanout.ts, app/m/cn/recibir/actions.ts]
evidence_tests: [lib/studio/notifications/__tests__/schedule-fanout.test.ts]
evidence_migrations: []
human_decisions: []
future_scope: ["Aviso al equipo interno (Telegram) en la recepción — se evalúa por separado", "Caso apareció sin aviso (sin prealerta) — sigue por /m/cn/nueva fuera de este slice"]
---

# DTD-0162 — Aviso de recepción al cliente

> **Spec puente 0154 (recepción) ↔ 0156 (motor de avisos).** Cierra el *pendiente
> honesto* declarado "fuera de scope" en [SDD-0154](../0154-recibir-por-escaneo/spec.md):
> la recepción del operario en China deja el registro durable
> (`warehouse_receipt_events = 'received'`, RPC `0245`) pero **no dispara** el aviso al
> cliente. El motor [SDD-0156](../0156-notificaciones-cliente-journey/spec.md) ya expone
> el evento `status:in_warehouse` ("Recibido en bodega China · La carga llegó al galpón
> de Yiwu", slice A, configurable). **El gap es solo el cableado.**

## 1. Problema

Hoy, cuando el operario recibe una caja por escaneo (`/m/cn/recibir` → RPC
`receive_prealerta_as_operario`), el cliente **no se entera**. El push de estado
China→VE en la recepción no existe (gap conocido). Las specs 0153/0154/0155 quedan
`in-progress` con 0% de operación real, en parte por este eslabón faltante.

## 2. Solución

Espejar el patrón app-layer que ya existe para Venezuela. `scheduleReceiptVeReceived`
(en `lib/studio/notifications/schedule-fanout.ts`) programa `received_ve` resolviendo el
envío por Shipping Mark. Este slice agrega el equivalente para China y lo llama tras una
recepción exitosa.

### Incluye
- **`scheduleReceiptInWarehouse(admin, tenantId, markboxes, eventTime)`** en
  `lib/studio/notifications/schedule-fanout.ts` — mismo contrato que
  `scheduleReceiptVeReceived`, pero programa `status:in_warehouse` vía
  `scheduleForTargets`. Resuelve el envío no terminal más reciente por
  `client_markbox`; sin envío resoluble → salta la caja (no mal-notifica).
- **Cableado en `app/m/cn/recibir/actions.ts`** — tras la RPC de recepción exitosa,
  llamar la nueva función con el/los Shipping Mark de la(s) caja(s) recibida(s). No
  bloquea la recepción si el fanout falla (best-effort, como el patrón VE, con `try/catch`).

### Fuera de scope
- **Migración a prod.** Este slice es wiring app-layer; no toca `supabase/migrations`.
- **Aviso al equipo interno** (Telegram) en la recepción — evaluación aparte.
- **Caso "apareció sin aviso"** (sin prealerta) — sigue por `/m/cn/nueva`, no lo toca esta spec.

## 3. Verificación

1. `node scripts/verify.mjs` verde.
2. Test unitario del nuevo scheduler en
   `lib/studio/notifications/__tests__/schedule-fanout.test.ts` (espeja los casos de
   `scheduleReceiptVeReceived`: happy path + Shipping Mark sin envío resoluble).
3. Prueba con **carga real** (estrategia del founder): recibir una caja pre-declarada y
   confirmar que el cliente recibe el aviso según su configuración en SDD-0156.
