---
sdd: "0436"
title: Observabilidad estructurada en contabilidad de Cobranzas
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0041", "0068", "0435"]
confidencialidad: interno
---

# SDD-0436 · Observabilidad estructurada en contabilidad de Cobranzas

## Problema

Los efectos contables best-effort de cobros conservan siete `console.error`
legacy. Incluyen el código de recibo y texto libre del resultado contable, sin
correlador ni saneamiento central.

## Contrato acotado

- Crear un logger canónico por invocación de las cuatro operaciones afectadas.
- Reemplazar los siete logs por eventos con operación, etapa, estado y error
  saneado.
- No registrar recibo, factura, tenant, monto, moneda, cuenta ni texto libre.
- Mantener la semántica best-effort: ningún fallo contable nuevo bloquea cobros.

## Fuera de alcance

- Cambios en cobros, saldos, asientos, auditoría D2, RLS o UI.
- Migraciones, Cloud, datos reales, push, `main`, despliegue y limpieza.

## Allowlist exacta

- `lib/studio/collections-actions.ts`.
- `lib/observability/__tests__/structured-collections-accounting.test.ts`.
- Esta spec, su acta, el índice generado y el checklist operativo.

## Aceptación

- [x] RED detecta los siete logs libres y los eventos/loggers ausentes.
- [x] Las cuatro operaciones crean un logger por invocación.
- [x] Los siete eventos no incluyen identificadores o importes de negocio.
- [x] Pruebas focales, suite y gates canónicos quedan verdes.
- [x] El inventario legacy se vuelve a medir y documentar.

## Gobernanza

- `ERR-01`: cumplimiento; la observabilidad no altera resultados ni respuestas.
- `SGE-00.05`: cumplimiento; los fallos best-effort conservan correlación y
  etapa sin datos financieros ni identificadores de negocio.
