---
sdd: "0415"
title: Observabilidad estructurada de workers drain
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0036", "0091", "0156", "0414"]
confidencialidad: interno
---

# SDD-0415 · Observabilidad estructurada de workers drain

## Preguntas operativas

1. ¿Cuál worker rechazó, completó o falló una ejecución concreta?
2. ¿Cuántas filas procesó, entregó, difirió, omitió o dejó fallidas?
3. ¿El fallo ocurrió en el límite del drain antes de poder producir conteos?
4. ¿Puede correlacionarse la respuesta sin registrar destinatarios, payloads,
   tokens ni mensajes crudos?

## Contrato acotado

- Extraer a un contexto reusable la autorización, respuesta correlacionada,
  evento de terminación y error seguro de los cron.
- Adoptarlo en `bug-notifications-drain`, `client-notifications-drain`,
  `push-drain` y `workflow-drain`.
- Conservar sus respuestas exitosas y la semántica de los drains.
- Convertir una excepción no controlada del worker en respuesta genérica 500,
  correlacionada y sin detalle crudo.

## Fuera de alcance

- Ejecutar cron, drenar outboxes o enviar notificaciones reales.
- Migrar los diez cron restantes o las Edge Functions en esta rebanada.
- Cloud, push, `main`, despliegue, datos reales, migraciones y limpieza.

## Allowlist exacta

- `lib/observability/cron-request-context.ts`.
- `lib/observability/structured-logger.ts`.
- Los cuatro route handlers de workers nombrados.
- `app/api/cron/__tests__/drain-routes-observability.test.ts`.
- Esta spec, acta, índice y checklist de saneamiento.

## Aceptación

- [x] RED demuestra que los cuatro workers no correlacionan ni contienen fallos.
- [x] Rechazo, éxito y excepción tienen evento y `x-request-id` estables.
- [x] Los conteos de cada dominio aparecen sin payloads ni identificadores.
- [x] Ningún sentinel sensible aparece en log o respuesta.
- [x] Pruebas completas y gates proporcionales quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; alcance y pruebas trazables.
- `SGE-00.07`: cumplimiento; contexto común para evitar divergencia.
- `AUD-01` / `AUD-02`: cumplimiento; correlación y métricas seguras.
- `SEC-01`: cumplimiento; fail-closed y error genérico.
- `MP-01`: no aplica; no cambia el modelo persistente ni activa workers.

## Evidencia de cierre

- RED 12/12 y GREEN 16/16 en el contrato directo de rutas/logger.
- Suite completa 7.328/7.328 en 580 archivos.
- TypeScript y ESLint verdes; build y gates documentales registrados en el acta.
- Acta: `docs/audits/2026-09-04-structured-drain-crons.md`.
