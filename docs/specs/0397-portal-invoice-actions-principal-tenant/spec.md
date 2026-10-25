---
sdd: "0397"
title: Acciones de facturas Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0358", "0365", "0396"]
confidencialidad: interno
---

# SDD0397 · Acciones de facturas Portal por principal y tenant

> **Nota de extracción a `main` — 2026-09-14** (tarea `portal-reportes-principal-0390-0397`).
> Esta spec entró a `main` con el bloque A de la PR #21 (`44c751ea`, 2026-09-09) con su
> `status: done` de origen y sólo una parte de su código: L14 (PR #104) adoptó el hunk de
> `2d0628d0` en `app/portal/(app)/facturas/[code]/reportar/actions.ts` (principal de L18 sin
> releer `clients`) y en `lib/portal/__tests__/payment-report-consumers.test.ts`, y recortó
> `lib/portal/__tests__/portal-invoice-actions-principal-scope.test.ts` a los tres casos del
> reporte (`636d292a`), dejando fuera la aceptación legal (hallazgo en
> `.agents/handoffs/c-l14-portal-comandos-recibos.md`). La rama
> `codex/portal-reportes-principal-0390-0397` completa la extracción desde `refs/dtd/pr/21`
> (`ea9952a4`) con identidad por blob, sin merge de la rama entera:
> `aceptar/actions.ts` (`a6c5e992`: principal canónico antes de construir admin y tenant +
> Shipping Mark del principal sin releer `clients.tenant_id`), `aceptar/__tests__/actions.test.ts`
> (`94ffc956`: mock de `getPortalClientPrincipal`) y el test de scope completo (`814ef869`), que
> sustituye el recorte de L14 por ser su superconjunto (mismos mocks y casos del reporte, más los
> mocks legales y el caso de aceptación). Las escrituras de reportes siguen pasando sólo por los
> comandos de 0421 (`lib/portal/payment-report-commands.ts`); sin DML directo ni
> `confirm_payment_report`. No se importan la auditoría, el checklist ni el handoff del
> saneamiento (`docs/audits/2026-09-02-codex-arranque-checklist.md`,
> `docs/audits/2026-09-03-portal-invoice-actions-local.md`,
> `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`): no están en `main` y quedan fuera
> del alcance; la casilla «Checklist original sigue 56/106» describe ese artefacto de #21 y no
> aplica en `main`. Sin migración ni cambio de RLS. La evidencia (vitest focal, typecheck, lint y
> `verify` por paso) vive en `.agents/handoffs/portal-reportes-principal-0390-0397.md`; el estado
> `done` queda efectivo en `main` con la integración de esa PR, que el Director serializa después
> del smoke de L14 y de aplicar 0422 y 0423.

## Evidencia y autoridad

La numeración 0397 se comprobó contra 15 refs. La aceptación legal y el reporte
de pago construyen un cliente `service_role` después de derivar sólo el cliente
y vuelven a leer su tenant con privilegios. La cancelación usa el helper legado
aunque el comando SQL reautoriza la sesión.

Este slice usa sólo fixtures. No autoriza aceptaciones, reportes, comprobantes,
avisos o datos reales; tampoco Cloud, push, `main`, deploy o limpieza.

## Contrato acotado

- Derivar el principal completo antes de construir el admin client.
- Cortar sin elevar ante principal inválido o incoherente.
- Usar tenant, cliente y Shipping Mark del principal canónico sin releerlos.
- Exigir el principal canónico antes de enviar una cancelación por RPC de sesión.
- Conservar validaciones, evidencia legal, idempotencia, Storage, avisos y RPCs.
- No cambiar schema, RLS, UI, documentos legales ni ciclo de estados de pago.

## Allowlist exacta

- `app/portal/(app)/facturas/[code]/aceptar/actions.ts`.
- `app/portal/(app)/facturas/[code]/aceptar/__tests__/actions.test.ts`.
- `app/portal/(app)/facturas/[code]/reportar/actions.ts`.
- `lib/portal/__tests__/payment-report-consumers.test.ts`.
- `lib/portal/__tests__/portal-invoice-actions-principal-scope.test.ts`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra elevación con principal inválido y tenant legado.
- [x] Principal inválido produce cero construcción admin y cero DML elevado.
- [x] Aceptación usa tenant + Shipping Mark canónicos sin releer `clients`.
- [x] Reporte fija tenant + Shipping Mark canónicos sin releer `clients`.
- [x] Cancelación exige principal canónico antes del RPC de sesión.
- [x] Pruebas focales/históricas/Portal, tipos, lint y gates quedan verdes.
- [x] Producción permanece no verificada y sin efectos reales.
- [x] Checklist original sigue 56/106.

Gobernanza: corrección aplicada de defensa antes de elevación. No hay cambio
visual ni nueva categoría de datos personales.
