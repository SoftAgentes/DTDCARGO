---
sdd: "0419"
title: Observabilidad estructurada en internals de salud
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0271", "0291", "0414", "0417", "0418"]
confidencialidad: interno
---

# SDD-0419 · Observabilidad estructurada en internals de salud

## Problema

Los handlers de salud ya emiten eventos seguros, pero cinco dependencias directas
mantienen catorce logs libres. Al fallar un envío, una lectura o la IA, esos logs
pueden incluir destinatarios, chat IDs, texto de proveedor o mensajes crudos y
rompen la correlación iniciada en el borde HTTP.

## Contrato acotado

- Permitir un logger estructurado sin `Request` para llamadas internas fuera de
  cron, con la misma redacción y un correlador nuevo.
- Propagar `cron.logger` desde `alta-health`, `mail-health`, `searates-refresh`
  y `ceo-brief` a sus dependencias directas.
- Reemplazar logs libres en altas sin acceso, ruteo Telegram, salud de correo,
  salud SeaRates y generación del brief.
- Mantener best-effort, fallback, deduplicación y resultados de cada canal.

## Fuera de alcance

- Migrar los demás logs legacy del repo o los workers drain.
- Enviar avisos, consultar proveedores/Cloud o usar datos reales.
- Migraciones, push, `main`, despliegues y limpieza.

## Allowlist exacta

- `lib/observability/structured-logger.ts` y sus pruebas.
- Los cinco módulos internos nombrados y su contrato fuente.
- Las cuatro rutas cron nombradas y sus pruebas existentes.
- Pruebas existentes de alta y ruteo Telegram.
- Esta spec, acta, índice y checklist general.

## Aceptación

- [x] RED detecta los catorce logs libres y la falta del logger interno.
- [x] Los cuatro handlers propagan su correlador a toda la rebanada.
- [x] Fallos best-effort registran sólo etapa, conteos y error resumido.
- [x] No aparecen destinatarios, chat IDs, tenants ni mensajes de proveedor.
- [x] Suite directa, completa, lint, docs, gobernanza y build quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; reuso del logger canónico.
- `AUD-01` / `AUD-02`: cumplimiento; señales accionables y correlacionadas.
- `SEC-01`: cumplimiento; identidad y errores libres fuera del log.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.

## Evidencia de cierre

- RED: 9 fallos; GREEN focal: 54/54.
- Suite completa: 7.381/7.381 en 585 archivos.
- TypeScript, ESLint y build de 158 rutas correctos.
- Cero `console.*` libre en los cinco internals; acta:
  `docs/audits/2026-09-04-structured-health-internals.md`.
