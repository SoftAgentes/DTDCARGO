---
sdd: "0435"
title: Observabilidad estructurada en acciones de Usuarios
status: done
author: Codex
created: 2026-09-04
updated: 2026-09-04
supersedes: null
superseded_by: null
related: ["0024", "0136", "0250", "0272", "0433"]
confidencialidad: interno
---

# SDD-0435 · Observabilidad estructurada en acciones de Usuarios

## Problema

Las acciones de invitación, enlace de acceso y cambio de correo conservan ocho
`console.error` legacy. Mezclan texto libre con errores de Auth, PostgREST y
correo, sin correlador estable ni contrato de saneamiento.

## Contrato acotado

- Crear un logger canónico por invocación de cada acción afectada.
- Reemplazar los ocho logs libres por eventos estructurados con operación,
  etapa y error saneado.
- No registrar email, ID de usuario, token, enlace, payload ni texto del
  proveedor.
- Mantener exactamente la semántica best-effort y las respuestas actuales.

## Fuera de alcance

- Cambios de Auth, membresías, roles, RLS, correo o UX.
- Migraciones, Cloud, datos reales, push, `main`, despliegue y limpieza.

## Allowlist exacta

- `app/studio/(app)/usuarios/actions.ts`.
- `lib/observability/__tests__/structured-user-actions.test.ts`.
- Esta spec, su acta, el índice generado y el checklist operativo.

## Aceptación

- [x] RED detecta los ocho logs libres y la ausencia de eventos canónicos.
- [x] Las tres acciones afectadas crean su logger por invocación.
- [x] Los ocho eventos contienen sólo error saneado y etiquetas operativas.
- [x] Las pruebas focales, suite y gates canónicos quedan verdes.
- [x] El inventario legacy se vuelve a medir y documentar.

## Gobernanza

- `ERR-01`: cumplimiento; el registro técnico no cambia el error accionable de
  la interfaz ni sustituye su causa por texto genérico.
- `SGE-00.05`: cumplimiento; cada fallo técnico conserva correlador y etapa sin
  exponer identificadores ni datos de personas.
