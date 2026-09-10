---
sdd: "0429"
title: Observabilidad estructurada en productores internos de avisos
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0146", "0151", "0422", "0428"]
confidencialidad: interno
---

# SDD-0429 · Observabilidad estructurada en productores internos de avisos

## Problema

Los productores de avisos de Bitácora y solicitudes de cambio conservan cuatro
logs libres. Sus errores pueden arrastrar texto de tareas, diferencias de datos,
mensajes de Telegram, rutas o identificadores de usuario/cliente.

## Contrato acotado

- Adoptar un logger canónico opcional en ambos productores.
- Propagarlo por las primitivas in-app, push, Telegram y drains que ya lo aceptan.
- Reemplazar cuatro logs libres por eventos con operación y etapa.
- Mantener máscara de canales, ruteo, idempotencia y semántica best-effort.

## Fuera de alcance

- Contenido, canales, datos o envíos reales.
- Permisos, RLS, migraciones y cambios de UI.
- Cloud, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `lib/studio/bitacora/notify.ts` y `lib/studio/change-request-notify.ts`.
- Suite de Bitácora, contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma cuatro logs libres en dos módulos.
- [x] Cero `console.*` libre queda en el alcance.
- [x] Tareas, diffs, mensajes, rutas e identificadores quedan fuera de logs.
- [x] Las primitivas reciben el correlador del productor.
- [x] Contratos focales, suite completa y gates canónicos quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; correlador propagado por el flujo.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados.
- `SEC-01`: cumplimiento; PII e identificadores fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
