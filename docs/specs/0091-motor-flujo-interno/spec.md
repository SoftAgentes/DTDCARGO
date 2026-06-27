---
sdd: "0091"
title: "Motor de flujo interno por servicio (N8N-lite) — implementación de SDD-0076 FASE-FUTURA"
status: done
author: "Claude Code (ventana motor-flujo) + founder"
created: 2026-06-16
updated: 2026-06-27
supersedes: null
superseded_by: null
related: ["0076", "0090", "0085", "0026", "0020"]
confidencialidad: interno
---

# SDD-0091 — Motor de flujo interno por servicio

> Cada servicio tiene un **flujo de trabajo interno configurable** (estilo N8N, simple): pasos
> + disparadores + 4 niveles de automatización. Es la **pista 2** que la oferta (SDD-0090) dispara
> vía `fireWorkflowEvent('oferta_aceptada')`.

## Contexto

El **diseño completo está aprobado** y vive en los assets de SDD-0076 (no se re-litiga acá):
- `docs/specs/0076-configuracion-servicios/assets/FASE-FUTURA-motor-flujo-interno-y-rbac.md` — el motor (10 nodos, 4 niveles, regla dura, fase pre-bodega, mapeo servicios→owner_role).
- `docs/specs/0076-configuracion-servicios/assets/FASE-FUTURA-capa-interna-y-frentes.md` — fulfillment/costo/margen + frentes operativos.

Esta spec **implementa** ese diseño por slices. Reusa infra LIVE: el patrón gemelo `mail_rules`/`mail_logs`
+ `fireMailEvent()` (SDD-0026), el RBAC por módulo (SDD-0085, los 6 `StudioUserRole`), el runtime IA
(SDD-0020), y los generadores existentes (`fillPacklist`, push, comentarios+@mención).

**Principio rector del founder:** la config del tipo de servicio es **de una sola vez** ("set once,
simple y correcto"). Por eso el motor es una **tabla de pasos**, NO un BPMN ni un canvas arrastrable.

## Alcance

### Slice 1 (esta entrega) — Fundación del motor
- Migración **0143**: `service_workflow_steps` (definición, gemela de `mail_rules`) + `workflow_step_runs`
  (traza, gemela de `mail_logs`, idempotente por `(step_id, source_kind, source_id)`). RLS + `revoke from anon`.
- `lib/studio/workflow/types.ts`: tipos + `validateWorkflowStepInput()` con la **REGLA DURA** + `planStepRun()`.
- `lib/studio/workflow/queries.ts`: queries puras `(supabase) => …`.
- `lib/studio/workflow/workflow-rule-engine.ts`: `fireWorkflowEvent()` — gemelo best-effort de `fireMailEvent()`.
- Tests del validador, `planStepRun` y la selección de pasos del engine.
- **Sin UI, sin IA, sin wiring a server actions vivas.** El engine corre solo cuando se lo llame (próximo slice).

### Slices futuros (fuera de esta entrega)
- **S2 — Wiring + ejecución:** cablear `fireWorkflowEvent()` al lado de los `fireMailEvent` existentes;
  el "drain" que ejecuta los pasos `pending` (niveles 1–2: mail/push/tarea) delegando a infra existente.
- **S3 — UI:** tab "Flujo" en `ServicioDrawer` (lista simple) + bandeja de compuerta (`awaiting_human`).
- **S4 — Fase pre-bodega:** entidad `proveedor` ligera + campos de coordinación + trigger `cliente_anuncia_carga_cn` + canal `wechat` (registro manual).
- **S5 — Capa interna/fulfillment:** campos de `service_configs` (§2 del doc capa-interna) + patrón tercero+auto_request.
- **S6 — IA (niveles 3–4):** `ejecutar_ia` → `runAgent`, `solicitar_a_tercero` → `needs_approval` (tras `ANTHROPIC_API_KEY`).

## Diseño (Slice 1)

### Tablas
`service_workflow_steps` — la definición que el founder configura:
`service_key` (NULL = backbone de todos los núcleo) · `momento` · `orden` · `nombre` · `node_kind` (10) ·
`owner_role` (los 6 `StudioUserRole`) · `automation_level` (4) · `trigger_event` · `ai_skill_slug?` ·
`template_ref?` · `channel?` · `sla_hours?` · `depends_on text[]` · `active`.

`workflow_step_runs` — la traza/ejecución: `step_id` · `source_kind` · `source_id` · `status`
(pending/awaiting_human/done/skipped/failed) · `result_note?` · timestamps. Unique idempotente.

**Convención del repo:** enums lógicos = `text` + `CHECK` (como `charge_moment` en 0130, `charge_mode` en
0142), NO pg enums (evita el dolor de `ALTER TYPE`). `trigger_event` = `text` validado por all-list en código
(`WORKFLOW_EVENTS`) porque los eventos crecen (reusa el vocabulario de `mail_rule_event` + suma los de hito).

### Los 10 nodos + 4 niveles + REGLA DURA
Nodos: `enviar_email · enviar_whatsapp · recordatorio_interno · crear_tarea · avanzar_estado ·
montar_documento · solicitar_doc_cliente · solicitar_a_tercero · esperar_confirmacion_humana · ejecutar_ia`.
Niveles: `manual · asistido · auto_con_compuerta · automatico`.

**REGLA DURA (candado en `validateWorkflowStepInput`):** lo que mueve dinero o escribe a un **cliente** o
**tercero** NUNCA puede ser `automatico` (tope = `auto_con_compuerta`). Nodos gated: `enviar_email`,
`enviar_whatsapp`, `solicitar_doc_cliente`, `solicitar_a_tercero`.

### `fireWorkflowEvent()` (best-effort, gemelo de `fireMailEvent`)
Lee los pasos activos del evento+tenant (`service_key = X OR NULL`, ordenados), y por cada paso crea
idempotentemente una fila en `workflow_step_runs` con el estado inicial que decide `planStepRun()`:
`pending` si el paso es `automatico` y NO gated; `awaiting_human` en cualquier otro caso (va a la bandeja
de compuerta). **Slice 1 NO ejecuta los efectos** (mail/push/etc.) — solo registra la traza; la ejecución
es S2. Nunca rompe al caller (try/catch, log y sigue).

## Migración 0143 (descrita, NO aplicada — la aplica coordinación)
`supabase/migrations/0143_workflow_engine.sql`. Idempotente. RLS por tenant + `revoke all … from anon`
(100% ERP-side, la whitelist pública nunca las ve). Índices: `(tenant_id, trigger_event)` para la query del
engine, FK `step_id`, y unique `(step_id, source_kind, source_id)`. Sin funciones nuevas con `EXECUTE`.
Skills Supabase (seguridad + postgres-best-practices) invocados.

## Adjuntos
El diseño completo (nodos, niveles, fase pre-bodega, mapeo servicios→roles) vive en los 2 docs FASE-FUTURA
de SDD-0076 (ver Contexto). Sin binarios.
