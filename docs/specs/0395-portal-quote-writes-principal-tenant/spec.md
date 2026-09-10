---
sdd: "0395"
title: Escrituras de cotizaciones Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0380", "0394"]
confidencialidad: interno
---

# SDD0395 · Escrituras de cotizaciones Portal por principal y tenant

## Evidencia y autoridad

La numeración 0395 se comprobó contra 15 refs. Solicitar una cotización y avanzar
un estimado derivan sólo el cliente, vuelven a resolver tenant con `service_role`
o confían en el tenant de la fila elevada. Los filtros admin no fijan siempre el
tenant del principal, por lo que una colisión de Shipping Mark puede cruzarlo.

Este slice usa sólo fixtures. No autoriza crear/avanzar cotizaciones reales,
enviar avisos reales, Cloud, push, `main`, deploy o limpieza.

## Contrato acotado

- Derivar el principal completo antes de construir el admin client.
- Cortar sin elevar ante principal inválido o incoherente.
- Usar tenant + Shipping Mark canónicos en correlativo, lectura, INSERT, UPDATE y
  aviso; no volver a resolver tenant desde una fila privilegiada.
- Conservar validación, idempotencia, mensajes, revalidación y redirect.
- No cambiar schema, RLS, UI ni cálculo de cotizaciones.

## Allowlist exacta

- `app/portal/(app)/cotizaciones/actions.ts`.
- `app/portal/(app)/estimados/actions.ts`.
- `lib/portal/__tests__/portal-quote-actions-principal-scope.test.ts`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra elevación con principal inválido y tenant/Shipping Mark legados.
- [x] Principal inválido produce cero construcción admin y cero DML.
- [x] Solicitud deriva correlativo, INSERT y aviso del principal canónico.
- [x] Avance fija tenant + Shipping Mark en lectura/UPDATE/aviso.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] Producción permanece no verificada y sin datos/avisos reales.
- [x] Checklist original sigue 56/106.

Gobernanza: la no conformidad de defensa antes de elevación quedó corregida. No
hay cambio visual ni nueva categoría de datos personales.
