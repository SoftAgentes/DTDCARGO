---
sdd: "0396"
title: Acciones elevadas Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0380", "0395"]
confidencialidad: interno
---

# SDD0396 · Acciones elevadas Portal por principal y tenant

## Evidencia y autoridad

La numeración 0396 se comprobó contra 15 refs. Referidos y reclamos construyen
un cliente `service_role` después de resolver sólo el cliente y vuelven a leer
su tenant con privilegios. El reclamo tampoco fija tenant + Shipping Mark en la
lectura elevada del embarque.

Este slice usa sólo fixtures. No autoriza invitaciones, reclamos, correos,
adjuntos o datos reales; tampoco Cloud, push, `main`, deploy o limpieza.

## Contrato acotado

- Derivar el principal completo antes de construir el admin client.
- Cortar sin elevar ante principal inválido o incoherente.
- Usar tenant, cliente, Shipping Mark y user del principal canónico.
- Fijar tenant + Shipping Mark al validar el embarque elevado de un reclamo.
- Conservar validaciones, mensajes, correo/evidencia best-effort y revalidación.
- No cambiar schema, RLS, UI, recompensas ni ciclo de vida de reclamos.

## Allowlist exacta

- `app/portal/(app)/referidos/actions.ts`.
- `app/portal/(app)/reclamos/actions.ts`.
- `lib/portal/__tests__/portal-elevated-actions-principal-scope.test.ts`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra elevación con principal inválido y tenant/Shipping Mark legados.
- [x] Principal inválido produce cero construcción admin y cero DML.
- [x] Referidos usa tenant, cliente y Shipping Mark canónicos sin releer `clients`.
- [x] Reclamos fija tenant + Shipping Mark en la lectura elevada del embarque.
- [x] Reclamos registra tenant, cliente, Shipping Mark y user canónicos.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] Producción permanece no verificada y sin datos/correos/adjuntos reales.
- [x] Checklist original sigue 56/106.

Gobernanza: corrección aplicada de defensa antes de elevación. No hay cambio
visual ni nueva categoría de datos personales.
