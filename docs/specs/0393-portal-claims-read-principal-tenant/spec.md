---
sdd: "0393"
title: Reclamos Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0101", "0392"]
confidencialidad: interno
---

# SDD0393 · Reclamos Portal por principal y tenant

## Evidencia y autoridad

La numeración 0393 se comprobó contra 15 refs. `listMyClaims` es la última
lectura Portal que todavía resuelve sólo Shipping Mark mediante la RPC histórica
y no fija tenant en su consulta explícita.

Este slice usa sólo fixtures. No autoriza consultar reclamos o resoluciones
reales; tampoco Cloud, push, `main`, deploy o limpieza.

## Contrato acotado

- Resolver la lista con `getPortalClientPrincipal()`.
- Cortar sin consultar dominio ante principal inválido o incoherente.
- Fijar tenant + Shipping Mark en la lectura de reclamos vivos.
- Conservar campos, mapeo, orden y límite actuales.
- No cambiar schema, RLS, UI ni creación/gestión de reclamos.

## Allowlist exacta

- `lib/portal/portal-claims.ts`.
- `lib/portal/__tests__/portal-claims-principal-scope.test.ts`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra consulta con Shipping Mark legado y sin tenant.
- [x] Principal inválido produce cero consultas de dominio.
- [x] Reclamos fijan tenant + Shipping Mark canónicos.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] Producción permanece no verificada y sin datos reales.
- [x] Checklist original sigue 56/106.

Gobernanza: la no conformidad de defensa explícita quedó corregida. No hay cambio
visual ni nueva categoría de datos personales.
