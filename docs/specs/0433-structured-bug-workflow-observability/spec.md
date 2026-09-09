---
sdd: "0433"
title: Observabilidad estructurada en el flujo de bugs
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0036", "0421", "0429"]
confidencialidad: interno
---

# SDD-0433 · Observabilidad estructurada en el flujo de bugs

## Problema

Las rutas para tomar, cambiar estado, adjuntar replay y responder bugs, junto
con sus Server Actions, conservan nueve logs libres. Parte de ellos incorpora
IDs o mensajes de proveedores y las respuestas HTTP no llevan un correlador
uniforme. Dos fallos además exponen detalles crudos de Storage o PostgREST.

## Contrato acotado

- Adoptar el logger canónico en las cuatro rutas y en las Server Actions.
- Reemplazar nueve logs libres por eventos con operación y etapa.
- Propagar el correlador a las notificaciones internas del flujo.
- Correlacionar todas las respuestas HTTP con `x-request-id`.
- Devolver errores seguros sin mensajes crudos de proveedores.
- Mantener el ciclo, permisos, contenido, replay y efectos best-effort.

## Fuera de alcance

- Bugs, mensajes, replays o datos reales.
- Cambios de estados, permisos, RLS, migraciones o UI.
- Cloud, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `app/api/studio/bugs/[id]/{take,state,replay,messages}/route.ts`.
- `app/studio/(app)/bugs/actions.ts`.
- Contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma nueve logs libres y ausencia del logger canónico.
- [x] Cero `console.*` libre queda en el alcance.
- [x] IDs, cuerpo y mensajes de proveedores quedan fuera de logs.
- [x] Todas las respuestas HTTP incluyen el correlador.
- [x] Storage y PostgREST no exponen mensajes crudos al cliente.
- [x] El logger se propaga a las notificaciones internas.
- [x] Contratos focales, suite completa y gates canónicos quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; correlador propagado por el flujo.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados sin sustituir la
  bitácora de negocio.
- `SEC-01`: cumplimiento; texto e identificadores fuera de logs y respuestas.
