---
sdd: "0417"
title: Observabilidad estructurada de salud e integraciones
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0164", "0256", "0291", "0414", "0415", "0416"]
confidencialidad: interno
---

# SDD-0417 · Observabilidad estructurada de salud e integraciones

## Preguntas operativas

1. ¿Qué monitor o integración terminó, fue rechazado o falló?
2. ¿Qué volumen agregado revisó, encontró, notificó o encoló?
3. ¿El job corrió en `dry-run`, `live` o quedó inerte?
4. ¿Puede investigarse SeaRates, Kommo, correo y altas sin registrar Shipping
   Marks, destinatarios, tenants, previews ni errores crudos?

## Contrato acotado

- Adoptar el contexto común en `alta-health`, `mail-health`,
  `kommo-contact-status`, `ceo-brief`, `rate-expiry-alert` y
  `searates-refresh`.
- Reemplazar logs con objetos de negocio por eventos JSON con agregados
  allowlisted y correlación.
- Convertir fallos de lectura/refresco ya observables en respuestas genéricas
  correlacionadas; contener excepciones del handler.
- Mantener dry-run, caps, clasificación, respuestas exitosas y gates.

## Fuera de alcance

- Ejecutar monitores, enviar alertas, consultar proveedores o encender gates.
- Cambiar lógica interna de métricas, notificaciones o sincronización.
- Migrar logs internos legacy o Edge Functions en esta rebanada.
- Cloud, push, `main`, despliegue, datos, migraciones y limpieza.

## Allowlist exacta

- Los seis route handlers nombrados.
- `lib/observability/structured-logger.ts`.
- `app/api/cron/__tests__/health-routes-observability.test.ts`.
- Esta spec, acta, índice y checklist.

## Aceptación

- [x] RED confirma ausencia de correlación/eventos seguros.
- [x] Rechazo, éxito y fallo se prueban en las seis rutas.
- [x] Los logs contienen sólo métricas agregadas allowlisted.
- [x] Ningún sentinel sensible aparece en log o respuesta de error.
- [x] Suite completa, build y gates proporcionales quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; reuso del contexto común.
- `AUD-01` / `AUD-02`: cumplimiento; señal accionable sin identidad.
- `SEC-01`: cumplimiento; error genérico y correlacionado.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.

## Evidencia de cierre

- RED 18/18 y GREEN 22/22 en rutas/logger.
- Suite completa 7.358/7.358 en 582 archivos.
- TypeScript y ESLint verdes; build y gates documentales registrados en el acta.
- Acta: `docs/audits/2026-09-04-structured-health-crons.md`.
