---
sdd: "0432"
title: Observabilidad estructurada en internals de conversaciones
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0148", "0149", "0416", "0423"]
confidencialidad: interno
---

# SDD-0432 · Observabilidad estructurada en internals de conversaciones

## Problema

El push de respuestas, el aviso inbound, el digest mensual y su extractor IA
conservan nueve logs libres. Algunos incorporan IDs, períodos, modelo o mensajes
de proveedores y pierden el correlador del cron en el flujo profundo.

## Contrato acotado

- Adoptar un logger canónico opcional en los cuatro internals.
- Propagarlo a push, Telegram, extractor IA y desde el cron mensual.
- Reemplazar nueve logs libres por eventos con operación y etapa.
- Mantener asignación, anti-spam, contenidos, resumen y semántica best-effort.

## Fuera de alcance

- Mensajes, resúmenes, entregas o datos reales.
- Cambios de prompts, modelos, permisos, RLS, migraciones o UI.
- Cloud, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `lib/studio/conversation-{reply-push,inbound-notify}.ts`.
- `lib/studio/conversaciones/{monthly-digest,digest-extract}.ts`.
- `app/api/cron/conversation-digests/route.ts`.
- Contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma nueve logs libres y ausencia del logger canónico.
- [x] Cero `console.*` libre queda en el alcance.
- [x] IDs, períodos, modelos y mensajes de proveedores quedan fuera de logs.
- [x] El correlador llega a push, Telegram y extractor desde el cron.
- [x] Contratos focales, suite completa y gates canónicos quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; correlador propagado por el flujo.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados.
- `SEC-01`: cumplimiento; PII, texto e identificadores fuera de logs.
- `MP-01`: no aplica; mock IA y cero ejecución alojada.
