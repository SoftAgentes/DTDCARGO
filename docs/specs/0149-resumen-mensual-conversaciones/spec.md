---
sdd: "0149"
title: "Resumen mensual de conversaciones con IA — histórico navegable del lado del ERP"
status: done
author: "Claude Code (sesión Director) + founder"
created: 2026-07-05
updated: 2026-08-02
supersedes: null
superseded_by: null
related: ["0056", "0148", "0146"]
confidencialidad: interno
---

# SDD-0149 · Resumen mensual de conversaciones (IA)

> Complemento de la retención de conversaciones (SDD-0148): el cliente ve solo los
> **últimos 90 días** en el portal, pero **nosotros conservamos todo para siempre**.
> Este SDD suma, del lado del ERP, un **resumen mensual con IA** por cliente
> ("Conversaciones de \<mes anterior\>") — un histórico condensado, navegable por mes
> o completo, sin tener que releer hilos largos.

## Contexto / problema

Con SDD-0148 el chat de Soporte quedó activo y el hilo completo se guarda en
`conversation_messages` (retención indefinida). El cliente ve una ventana rodante de
90 días; el histórico viejo sigue en la DB pero releer meses de mensajes es tedioso.
El founder quiere un **reporte mensual** guardado: "que lo he chateado y puedes ver
todo — el historial completo o por mes".

Es un patrón conocido (Intercom/Zendesk generan analítica; acá sumamos un digest
**por cliente** con IA, aprovechando la infra que ya usa Bitácora para las actas).

## Objetivo

Un **cron mensual** que, por cada cliente con actividad de conversación el mes
anterior, genere y guarde un **resumen con IA** del hilo de ese mes; y una **vista en
el ERP** para navegarlo (por mes o histórico completo). Si un cliente no tuvo
actividad ese mes, **no se guarda nada**.

## Alcance

**Dentro:**
- Tabla `conversation_monthly_digests` (`tenant_id`, `client_id`, `conversation_id`,
  `period` = primer día del mes resumido (date), `summary` (text/markdown),
  `message_count`, `in_count`/`out_count`, `generated_at`, `model`). Unique
  `(client_id, period)` (idempotente: re-correr el cron no duplica).
- **Cron mensual** (`/api/cron/conversation-digests`, día 1) que:
  1. Toma el mes ANTERIOR (rango date).
  2. Por cada conversación con ≥1 mensaje en ese rango, junta el hilo del mes.
  3. Llama al LLM (misma infra/gateway que Bitácora) para armar un resumen breve:
     temas tratados, pedidos/promesas, estado al cierre del mes. Prompt acotado, sin
     PII innecesaria más allá de lo ya conversado.
  4. Upsert en `conversation_monthly_digests` (on conflict `(client_id, period)`).
  5. Best-effort por cliente: un fallo de IA en uno no frena a los demás; se loguea.
- **Vista ERP**: dentro de `/studio/conversaciones` (panel del cliente) o en el
  detalle del cliente — selector de mes + el resumen; y "ver histórico completo"
  (lista de meses con resumen). Solo lectura.

**Fuera (por ahora):**
- Mostrarle el resumen al **cliente** (V1 es interno; se puede sumar después como
  "tu historial resumido" en el portal).
- Resúmenes en tiempo real / on-demand (esto es batch mensual).
- Borrado/anonimización del hilo viejo (se conserva; retención = decisión aparte).

## Diseño / enfoque

- **Reúso IA**: el mismo cliente LLM + patrón de prompt de Bitácora (SDD-0146 arma
  actas desde transcripción). Acá la "transcripción" es el hilo del mes. Modelo y
  gateway configurables por env (como Bitácora).
- **Idempotencia**: unique `(client_id, period)` + upsert → el cron se puede re-correr
  sin duplicar; si el hilo del mes cambió (raro, post-cierre), el re-run actualiza.
- **Cron**: entrada fina en `app/api/cron/...` protegida por secret (patrón de los
  crons existentes), agendada día 1 ~03:00. Procesa en lotes para no reventar el LLM.
- **Sin tocar el hilo**: los `conversation_messages` no se modifican; el digest es una
  capa aparte que apunta a la conversación.
- **Multi-tenant + RLS**: la tabla con `tenant_id` + RLS por tenant (equipo lee sus
  digests). El cron escribe con service_role.

## Decisiones para el founder

1. **¿El resumen se le muestra al cliente** (como "tu historial") o queda **solo
   interno** (V1)? (Recomiendo V1 interno; sumarlo al portal después.)
2. **Granularidad**: ¿un digest por **conversación×mes** (hay 1 hilo por cliente en
   canal portal, así que ≈ por cliente×mes) o un digest por **cliente×mes** unificando
   canales? (Recomiendo por cliente×mes; hoy el portal es 1 hilo.)
3. **Modelo/costo**: ¿qué modelo para el resumen (barato tipo Bitácora vs mejor)? Al
   ser mensual y batch, el costo es bajo.

## Fases

- **Fase 1 — Backend del digest**: tabla + migración + cron + generación IA + idempotencia.
- **Fase 2 — Vista ERP (LIVE)**: **solo historial** (decisión founder — no selector
  mes-por-mes; cada resumen ya trae su período/fecha). En el panel del cliente del hilo
  (`ConversationThread`): sección "Historial de resúmenes", lista cronológica (reciente
  primero) con período + resumen + nº de mensajes. La API `/api/studio/conversaciones/[id]`
  suma `digests` (`listClientConversationDigests`). Solo lectura; vacío hasta el 1er cron.
- **Fase 3 — exponer el resumen al cliente en el portal (implementada)**: el `summary`
  interno NO se reusa (está escrito para el asesor). El cron genera un SEGUNDO resumen
  **client-facing** (2ª persona, cálido, sin notas internas) vía
  `summarizeMonthThreadForClient`, guardado en la columna nueva
  `conversation_monthly_digests.client_summary` (migración 0224, nullable). El portal
  (`/portal/soporte`) muestra "Tu conversación, mes a mes" leyendo SOLO `client_summary`
  vía `listPortalConversationDigests` (admin scopeado por client_id, nunca expone el
  interno). Best-effort: si la IA del cliente falla, se guarda el interno igual y el
  portal no muestra ese mes.

## Verificación

- `node scripts/verify.mjs` + `pnpm build` verdes.
- Cliente con actividad el mes pasado → se genera 1 digest (upsert idempotente).
- Cliente SIN actividad → no se genera nada.
- Re-correr el cron no duplica (unique `(client_id, period)`).
- La vista ERP muestra por mes + histórico; el hilo completo sigue intacto.
