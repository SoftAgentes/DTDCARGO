---
sdd: "0390"
title: Lecturas Portal de pagos y eventos por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0132", "0134", "0389"]
confidencialidad: interno
---

# SDD0390 · Lecturas Portal de pagos y eventos por principal y tenant

## Evidencia y autoridad

La numeración 0390 se comprobó contra 15 refs. Reportes de pago y eventos de
envío todavía resuelven sólo Shipping Mark mediante la RPC histórica; sus
lecturas explícitas no fijan tenant. Las defensas RLS preparadas no sustituyen
el corte temprano y el scope de aplicación.

Este slice usa sólo fixtures. No autoriza consultar reportes, comprobantes,
envíos o eventos reales; tampoco Cloud, push, `main`, deploy o limpieza.

## Contrato acotado

- Resolver las tres lecturas Portal con `getPortalClientPrincipal()`.
- Cortar sin consultar dominio ante sesión, vínculo, cliente vivo o coherencia
  tenant/cliente inválidos.
- Fijar tenant + Shipping Mark en reportes de pago.
- Fijar tenant del evento, tenant del envío y Shipping Mark en hitos y actividad.
- Conservar mapeos, orden, límites y fallbacks actuales.
- No cambiar schema, RLS, UI ni flujos Studio/admin.

## Allowlist exacta

- `lib/portal/payment-report-queries.ts`.
- `lib/portal/shipment-events-queries.ts`.
- `lib/portal/__tests__/portal-read-principal-scope.test.ts`.
- Ajustes mínimos en los dos tests históricos de estos módulos.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra consultas con Shipping Mark legado y sin tenant.
- [x] Principal inválido produce cero consultas de dominio.
- [x] Reportes fijan tenant + Shipping Mark canónicos.
- [x] Eventos y actividad fijan tenant de evento/envío + Shipping Mark.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] Producción permanece no verificada y sin datos reales.
- [x] Checklist original sigue 56/106.

Gobernanza: la no conformidad de defensa explícita quedó corregida en las tres
lecturas. No hay cambio visual ni nueva categoría de datos personales.
