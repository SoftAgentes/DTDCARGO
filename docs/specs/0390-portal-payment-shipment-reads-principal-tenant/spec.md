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

> **Nota de extracción a `main` — 2026-09-14** (tarea `portal-reportes-principal-0390-0397`).
> Esta spec entró a `main` con el bloque A de la PR #21 (`44c751ea`, 2026-09-09) con su
> `status: done` de origen, pero sin su código: L14 (PR #104) tomó
> `lib/portal/payment-report-queries.ts` y `lib/portal/__tests__/payment-reports.test.ts` en su
> versión `bcf111a8` y excluyó este slice (hallazgo en
> `.agents/handoffs/c-l14-portal-comandos-recibos.md`). La rama
> `codex/portal-reportes-principal-0390-0397` extrae desde `refs/dtd/pr/21` (`ea9952a4`) el commit
> `08ec803d` con identidad por blob, sin merge de la rama entera: `payment-report-queries.ts`
> (`f0464875`), `shipment-events-queries.ts` (`443f205e`),
> `__tests__/portal-read-principal-scope.test.ts` (`2528616c`) y los ajustes mínimos de
> `payment-reports.test.ts` (`e1c75f6f`) y `shipment-events.test.ts` (`bac6d4dc`). En las cuatro
> rutas preexistentes `main` era idéntico al padre del commit, así que el hunk de 0390 es
> exactamente la diferencia con el head de #21 y no pisa nada de L14. No se importan la
> auditoría, el checklist ni el handoff del saneamiento
> (`docs/audits/2026-09-02-codex-arranque-checklist.md`,
> `docs/audits/2026-09-03-portal-payment-shipment-reads-local.md`,
> `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`): no están en `main` y quedan fuera
> del alcance; la casilla «Checklist original sigue 56/106» describe ese artefacto de #21 y no
> aplica en `main`. Sin migración ni cambio de RLS. La evidencia de esta extracción (vitest focal,
> typecheck, lint y `verify` por paso) vive en
> `.agents/handoffs/portal-reportes-principal-0390-0397.md`; el estado `done` queda efectivo en
> `main` con la integración de esa PR, que el Director serializa después del smoke de L14.

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
