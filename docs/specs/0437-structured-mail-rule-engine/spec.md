---
sdd: "0437"
title: Observabilidad estructurada en el motor de reglas de correo
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0026", "0036", "0436"]
confidencialidad: interno
---

# SDD-0437 · Observabilidad estructurada en el motor de reglas de correo

## Problema

El motor best-effort de reglas de correo conserva seis logs libres que mezclan
IDs de reglas, destinatarios, eventos y errores del proveedor. No comparten el
saneamiento ni el correlador del logger canónico.

## Contrato acotado

- Crear un logger canónico por invocación de `fireMailEvent`.
- Reemplazar los seis logs por eventos con operación, etapa, modo, estado y
  error saneado cuando corresponda.
- No registrar tenant, regla, destinatario, email, variables, fuente o payload.
- Mantener la resolución, envío, métricas y semántica best-effort actuales.

## Fuera de alcance

- Cambios en reglas, plantillas, destinatarios, Resend, tracking o UI.
- Envíos reales, Cloud, migraciones, push, `main`, despliegue y limpieza.

## Allowlist exacta

- `lib/studio/mail/mail-rule-engine.ts`.
- `lib/observability/__tests__/structured-mail-rule-engine.test.ts`.
- Esta spec, su acta, el índice generado y el checklist operativo.

## Aceptación

- [x] RED detecta los seis logs y los eventos/logger ausentes.
- [x] El motor crea un logger por invocación.
- [x] Los seis eventos no incluyen IDs o datos de destinatarios.
- [x] Prueba focal, suite y gates canónicos quedan verdes.
- [x] El inventario legacy se vuelve a medir y documentar.

## Gobernanza

- `ERR-01`: cumplimiento; los fallos siguen sin romper al caller.
- `SGE-00.05`: cumplimiento; cada etapa queda correlacionada sin datos de
  destinatarios ni contenido de correo.
