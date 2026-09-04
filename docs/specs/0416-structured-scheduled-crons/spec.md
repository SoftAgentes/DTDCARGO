---
sdd: "0416"
title: Observabilidad estructurada de jobs programados
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0143", "0146", "0149", "0414", "0415"]
confidencialidad: interno
---

# SDD-0416 · Observabilidad estructurada de jobs programados

## Preguntas operativas

1. ¿Qué job programado terminó, fue rechazado o falló al abrir su cola?
2. ¿Cuántos tenants, conversaciones, personas o correos procesó sin nombrarlos?
3. ¿Estaba el recordatorio frío desactivado por su gate?
4. ¿La respuesta y el log comparten correlación sin filtrar destinatarios,
   tenant IDs, contenido ni errores crudos?

## Contrato acotado

- Adoptar el contexto de SDD-0415 en `bitacora-digest`,
  `conversation-digests`, `mail-scheduled` y `portal-cold-reminder`.
- Registrar sólo conteos agregados, modo/gate, duración y estado HTTP.
- Convertir los fallos de lectura ya manejados por las rutas en respuesta 500
  genérica y correlacionada.
- Preservar horarios, selección, idempotencia, caps, gate y respuesta exitosa.

## Fuera de alcance

- Ejecutar envíos, abrir colas reales, activar `PORTAL_COLD_REMINDER` alojado.
- Cambiar la lógica interna de digest, correo o recordatorio.
- Migrar los seis cron restantes o las Edge Functions en esta rebanada.
- Cloud, push, `main`, despliegue, datos, migraciones y limpieza.

## Allowlist exacta

- Los cuatro route handlers nombrados.
- `lib/observability/structured-logger.ts`.
- `app/api/cron/__tests__/scheduled-routes-observability.test.ts`.
- Esta spec, acta, índice y checklist.

## Aceptación

- [x] RED confirma ausencia de correlación/eventos seguros.
- [x] Rechazo, éxito y fallo de lectura se prueban en las cuatro rutas.
- [x] Los logs contienen sólo agregados allowlisted.
- [x] Ningún sentinel sensible aparece en log o respuesta.
- [x] Suite y gates proporcionales quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; reuso del contexto aprobado.
- `AUD-01` / `AUD-02`: cumplimiento; métricas sin identidad.
- `SEC-01`: cumplimiento; errores genéricos y correlacionados.
- `MP-01`: no aplica; pruebas con dobles y sin ejecutar jobs reales.

## Evidencia de cierre

- RED 12/12 y GREEN 16/16 en el contrato directo de rutas/logger.
- Suite completa 7.340/7.340 en 581 archivos.
- TypeScript y ESLint verdes; build y gates documentales registrados en el acta.
- Acta: `docs/audits/2026-09-04-structured-scheduled-crons.md`.
