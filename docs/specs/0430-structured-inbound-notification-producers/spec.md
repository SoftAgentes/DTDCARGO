---
sdd: "0430"
title: Observabilidad estructurada en avisos de entrada
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0059", "0134", "0271", "0429"]
confidencialidad: interno
---

# SDD-0430 · Observabilidad estructurada en avisos de entrada

## Problema

Cinco productores que avisan al equipo sobre clientes, contactos, estimados,
cotizaciones y pagos conservan once logs libres. Los fallos pueden arrastrar
errores del proveedor e identificadores comerciales o personales.

## Contrato acotado

- Adoptar un logger canónico opcional en los cinco productores.
- Propagar el mismo correlador al despachador de Telegram.
- Reemplazar once logs libres por eventos con operación y etapa.
- Mantener destinatarios, contenido, ruteo y semántica best-effort.

## Fuera de alcance

- Contenido, canales, datos o entregas reales.
- Permisos, RLS, migraciones y cambios de UI.
- Cloud, push Git, `main`, despliegues y limpieza.

## Allowlist exacta

- `lib/studio/{new-client,cotizacion-request,contact-lead,estimado-lead,payment-report}-notify.ts`.
- Contrato nuevo, acta, índice y checklist.

## Aceptación

- [x] RED confirma once logs libres en cinco módulos.
- [x] Cero `console.*` libre queda en el alcance.
- [x] PII e identificadores comerciales quedan fuera de logs.
- [x] Telegram recibe el correlador de cada productor.
- [x] Contratos focales, suite completa y gates canónicos quedan verdes.

## Gobernanza

- `SGE-00.05`: cumplimiento; evidencia versionada.
- `SGE-00.07`: cumplimiento; correlador propagado por el flujo.
- `AUD-01` / `AUD-02`: cumplimiento; fallos estructurados.
- `SEC-01`: cumplimiento; PII e identificadores fuera de logs.
- `MP-01`: no aplica; dobles locales y cero ejecución alojada.
