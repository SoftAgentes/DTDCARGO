---
sdd: "0425"
title: Observabilidad estructurada en Web Push del Portal
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0148", "0386", "0414", "0424"]
confidencialidad: interno
---

# SDD-0425 · Observabilidad estructurada en Web Push del Portal

## Problema

Las rutas de alta/baja, el opt-in del navegador y la configuración VAPID
conservan cinco logs libres. Los fallos pueden transportar endpoint, claves o
detalles internos sin correlación uniforme entre navegador y servidor.

## Contrato acotado

- Adoptar el logger canónico en las dos rutas, el componente y VAPID.
- Correlacionar cada respuesta de las rutas con `x-request-id`.
- Reemplazar cinco logs libres por eventos y campos permitidos.
- Mantener validación de principal, contrato HTTP y no-op seguro sin claves.

## Fuera de alcance

- Entrega Web Push real, suscripciones o datos reales.
- Cambios visuales, permisos/RLS, migraciones y variables alojadas.
- Cloud, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- Las dos rutas Web Push del Portal, `PortalPushOptIn` y `notify/vapid`.
- Suite de principal existente, contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma cinco logs libres en cuatro módulos.
- [x] Cero `console.*` libre queda en el alcance.
- [x] Endpoint, claves, payload, usuario y tenant quedan fuera de logs.
- [x] Todas las respuestas de las rutas llevan `x-request-id`.
- [x] Contratos Web Push, suite completa y gates canónicos quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; correlación por request y componente.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados.
- `SEC-01`: cumplimiento; secretos e identificadores fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
