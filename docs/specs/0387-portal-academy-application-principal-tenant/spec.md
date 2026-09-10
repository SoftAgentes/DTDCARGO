---
sdd: "0387"
title: Academia Portal en aplicación por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0093", "0362", "0386"]
confidencialidad: interno
---

# SDD0387 · Academia Portal en aplicación por principal y tenant

## Evidencia y autoridad

La numeración 0387 se comprobó contra 15 refs. Las lecturas de Academia y
`setLessonComplete` resuelven Shipping Mark con una RPC histórica; el comando
resuelve tenant mediante otra RPC. Sus filtros explícitos usan el markbox pero
no tenant. La migración 0418 ya prepara la defensa RLS correcta, pero sigue sin
aplicar y no sustituye la defensa de la aplicación.

Este slice usa sólo fixtures. No autoriza aplicar 0418, crear progreso real,
consultar alumnos/diplomas, hacer push, `main`, deploy o limpieza.

## Contrato acotado

- Resolver las tres lecturas y el comando con `getPortalClientPrincipal()`.
- Cortar sin consultar Academia ni escribir progreso si sesión, vínculo,
  cliente vivo o coherencia tenant/cliente no son válidos.
- Fijar `tenant_id` y Shipping Mark en inscripciones, diplomas y progreso; fijar
  tenant en cursos, módulos y lecciones.
- En alta/baja de progreso, fijar además curso y lección; conservar inscripción
  obligatoria, idempotencia, mensajes y revalidaciones.
- No cambiar schema, RLS, 0418, catálogo, cálculo de porcentaje o UI.

## Allowlist exacta

- `lib/portal/portal-academy-queries.ts`.
- `app/portal/(app)/academia/actions.ts`.
- `lib/portal/__tests__/academy-principal-scope.test.ts`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra lecturas/DML con relación incoherente y ausencia de tenant.
- [x] Principal inválido hace cero consultas de dominio y cero DML.
- [x] Todas las lecturas fijan tenant y las entidades propias fijan Shipping Mark.
- [x] Completar/descompletar conserva inscripción, idempotencia y scopes exactos.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] 0418 y producción permanecen gates independientes no verificados.
- [x] Checklist original sigue 56/106.

Gobernanza: la no conformidad de defensa explícita quedó corregida en la capa
de aplicación. No hay cambio visual ni nueva categoría de datos personales.
