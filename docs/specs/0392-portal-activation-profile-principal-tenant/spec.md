---
sdd: "0392"
title: Activación y completitud Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0042", "0138", "0391"]
confidencialidad: interno
---

# SDD0392 · Activación y completitud Portal por principal y tenant

## Evidencia y autoridad

La numeración 0392 se comprobó contra 15 refs. Activación y completitud todavía
resuelven `client_id` y Shipping Mark mediante RPCs históricas separadas; sus
lecturas de cliente, envíos y direcciones no fijan todos los scopes del principal.

Este slice usa sólo fixtures. No autoriza consultar perfiles, fotos, direcciones
o envíos reales; tampoco Cloud, push, `main`, deploy o limpieza.

## Contrato acotado

- Resolver ambos derivados con `getPortalClientPrincipal()`.
- Cortar sin consultar dominio ante principal inválido o incoherente.
- Fijar tenant + id de cliente al leer aprobación/foto/dirección legacy.
- Fijar tenant + Shipping Mark al contar envíos; y tenant + id + Shipping Mark al
  contar direcciones vivas.
- Conservar razones de activación, fallbacks y booleanos actuales.
- No cambiar schema, RLS, UI, fotos, direcciones ni borrado 0427.

## Allowlist exacta

- `lib/portal/portal-queries.ts`.
- `lib/portal/__tests__/portal-activation-profile-principal-scope.test.ts`.
- Ajustes mínimos en `activation.test.ts` y `profile.test.ts`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra dominio alcanzable con ids legados y principal incoherente.
- [x] Principal inválido produce cero consultas de dominio.
- [x] Activación fija tenant, cliente y Shipping Mark canónicos.
- [x] Completitud fija tenant, cliente y Shipping Mark canónicos.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] Producción permanece no verificada y sin datos reales.
- [x] Checklist original sigue 56/106.

Gobernanza: la no conformidad de defensa explícita quedó corregida en ambos
derivados. No hay cambio visual ni nueva categoría de datos personales.
