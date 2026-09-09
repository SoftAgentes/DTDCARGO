---
sdd: "0398"
title: Contextos privados Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0383", "0397"]
confidencialidad: interno
---

# SDD0398 · Contextos privados Portal por principal y tenant

## Evidencia y autoridad

La numeración 0398 se comprobó contra 15 refs. Siete fachadas privadas todavía
derivan sólo el cliente antes de construir `service_role`; cinco vuelven a leer
su tenant con privilegios. El hub y el detalle de compra tampoco pasan siempre
el tenant ya autenticado a las lecturas RLS de compras/proveedores/documentos.

Este slice usa sólo fixtures. No autoriza leer Portal, conversaciones, facturas,
embarques, compras, documentos o datos reales; tampoco Cloud, push, `main`,
deploy o limpieza.

## Contrato acotado

- Derivar el principal completo antes de construir cualquier admin client.
- Cortar sin elevar ante principal inválido o incoherente.
- Eliminar relecturas privilegiadas de tenant desde `clients`.
- Propagar tenant + Shipping Mark canónicos en compras/proveedores/documentos.
- Conservar degradación segura, contratos de salida y comportamiento visual.
- No cambiar schema, RLS, Storage, UI ni retención.

## Allowlist exacta

- `lib/portal/{portal-shell,portal-acceptance,support,portal-home,shipment,shipments-hub}-private-context.ts`.
- `lib/portal/purchase-operational-detail.ts`.
- Sus siete pruebas homónimas en `lib/portal/__tests__/`.
- `lib/portal/__tests__/private-context-principal-guard.test.ts`.
- `lib/studio/prealertas/queries.ts` y sus pruebas focales de scope.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra los siete usos legados y las cinco relecturas admin.
- [x] Principal inválido produce cero construcción admin.
- [x] Ninguna fachada relee tenant desde `clients` con `service_role`.
- [x] Hub y detalle de compra fijan tenant + Shipping Mark en lecturas RLS.
- [x] Pruebas focales/históricas/Portal, tipos, lint y gates quedan verdes.
- [x] Producción permanece no verificada y sin lecturas reales.
- [x] Checklist original sigue 56/106.

Gobernanza: corrección aplicada de defensa antes de elevación. No hay cambio
visual ni nueva categoría de datos personales.
