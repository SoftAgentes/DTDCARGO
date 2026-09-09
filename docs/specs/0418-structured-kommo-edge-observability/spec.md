---
sdd: "0418"
title: Observabilidad estructurada de Edge Functions Kommo
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0043", "0074", "0083", "0244", "0256", "0288", "0414"]
confidencialidad: interno
---

# SDD-0418 · Observabilidad estructurada de Edge Functions Kommo

## Problema

Las cuatro Edge Functions de Kommo no correlacionan solicitudes y mantienen
doce `console.*` con formatos libres. El caso de mayor riesgo es el dry-run de
write-back: imprime el payload completo de una fila de negocio.

## Contrato acotado

- Crear un logger Edge compatible con Deno que emita una línea JSON por evento.
- Conservar un `x-request-id` válido o generar uno nuevo, y devolverlo en toda
  respuesta de las cuatro funciones.
- Admitir sólo métricas operativas allowlisted; secretos, identidad, payloads,
  rutas, consultas y mensajes de error se redactan o resumen.
- Reemplazar los doce logs libres de `kommo-sync`, `kommo-webhook`,
  `kommo-writeback` y `kommo-push-client`.
- Mantener los gates, dry-run, reintentos, efectos y contratos exitosos.

## Fuera de alcance

- Desplegar Edge Functions, consultar Kommo/Supabase o usar datos reales.
- Aplicar migraciones, cambiar secretos, habilitar escrituras o ejecutar crons.
- Push, `main`, Cloud, despliegues web y limpieza de worktrees.
- Migrar logs internos fuera de estas cuatro funciones.

## Allowlist exacta

- `supabase/functions/_shared/structured-logger.ts` y su prueba.
- Los cuatro `supabase/functions/kommo-*/index.ts` existentes.
- `supabase/functions/kommo-sync/sync.ts`.
- Las pruebas del logger, del contrato fuente y del handler real del webhook.
- Esta spec, acta, índice y checklist general.

## Aceptación

- [x] RED demuestra que falta el helper y persisten logs libres.
- [x] Toda respuesta incluye `x-request-id` sin aceptar IDs inseguros.
- [x] Los errores conservan sólo nombre y código seguro; nunca mensaje o stack.
- [x] No queda `console.*` fuera del helper en el alcance Kommo.
- [x] `deno check` valida las cuatro entradas.
- [x] Suite directa, suite completa, lint, docs, gobernanza y build quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada y trazable.
- `SGE-00.07`: cumplimiento; helper único para las cuatro funciones.
- `AUD-01` / `AUD-02`: cumplimiento; señal accionable sin identidad.
- `SEC-01`: cumplimiento; errores externos genéricos y correlacionados.
- `MP-01`: no aplica; pruebas locales y cero ejecución alojada.

## Evidencia de cierre

- RED: helper ausente y 8 contratos fuente fallidos.
- GREEN directo: 38/38, incluidos los 25 contratos del handler real de webhook.
- Suite completa: 7.371/7.371 en 584 archivos.
- `deno check`: 4/4 Edge Functions; build: 158 rutas.
- Acta: `docs/audits/2026-09-04-structured-kommo-edge-observability.md`.
