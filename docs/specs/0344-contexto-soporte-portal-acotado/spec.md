---
sdd: 0344
title: Encapsular el contexto privado de Soporte del Portal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0102
  - SDD-0147
  - SDD-0148
  - SDD-0149
  - SDD-0335
confidencialidad: interno
---

# SDD-0344 — Contexto privado de Soporte acotado

## Estado real

`/portal/soporte` construía `service_role` en el RSC y lo reutilizaba para
evidencia firmada, hilo, id realtime y resúmenes, suministrando ids desde la
página.

## Decisión

1. Crear un contexto `server-only` sin parámetros controlados por la página.
2. Resolver otra vez el cliente desde `auth.uid()` y obtener reclamos/envíos por
   sesión/RLS antes de elevar.
3. Construir un solo cliente interno para evidencia y conversación, acotado a
   los ids recién resueltos.
4. Conservar reclamos, envíos y asesor RLS si falla la elevación; ocultar la
   información privada que no pudo verificarse.

## Gobernanza

- `cumplimiento`: identidad, reclamos y envíos se derivan desde la sesión.
- `cumplimiento` ERR-01: fallo interno no produce evidencia ni conversación.
- `cumplimiento`: el RSC no puede suministrar ids ni un cliente admin.
- `no aplica`: escritura, borrado, migración o cambio visual.

## Allowlist exacta

- `app/portal/(app)/soporte/page.tsx`
- `lib/portal/support-private-context.ts`
- `lib/portal/__tests__/support-private-context.test.ts`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0344-contexto-soporte-portal-acotado/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-support-context-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Principal no Portal no ejecuta lecturas ni construye admin.
- El contexto usa reclamos propios para evidencia y el client id recién
  resuelto para la conversación.
- Un fallo de admin conserva sólo datos de sesión y devuelve privados vacíos.
- Soporte sale del inventario RSC; baseline: 4 rutas / 9 construcciones.
- Unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Modificar reclamos, mensajes, evidencia, Storage, RLS o Realtime.
- Aplicar migraciones, desplegar o escribir en Cloud/Producción.
