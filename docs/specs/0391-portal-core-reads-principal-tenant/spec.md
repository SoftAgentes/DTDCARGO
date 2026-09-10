---
sdd: "0391"
title: Lecturas núcleo Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0042", "0390"]
confidencialidad: interno
---

# SDD0391 · Lecturas núcleo Portal por principal y tenant

## Evidencia y autoridad

La numeración 0391 se comprobó contra 15 refs. Las listas/detalles de envíos y
facturas, documentos y próximo arribo aún resuelven sólo Shipping Mark mediante
la RPC histórica y no fijan tenant en la consulta. RLS no sustituye la defensa
explícita de aplicación frente a una sesión híbrida.

Este slice usa sólo fixtures. No autoriza consultar facturas, envíos, documentos
o Storage reales; tampoco Cloud, push, `main`, deploy o limpieza.

## Contrato acotado

- Resolver las seis lecturas con `getPortalClientPrincipal()`.
- Cortar sin consultar dominio ante principal inválido o incoherente.
- Fijar tenant + Shipping Mark en envíos, facturas y documentos.
- Conservar códigos, estados internos excluidos, borrado lógico, orden, límites,
  mapeos y ETA actuales.
- No cambiar schema, RLS, UI, descargas ni flujos Studio/admin.

## Allowlist exacta

- `lib/portal/portal-queries.ts`.
- `lib/portal/__tests__/portal-core-read-principal-scope.test.ts`.
- Ajustes mínimos en `invoices.test.ts` y `dashboard.test.ts`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED demuestra consultas con Shipping Mark legado y sin tenant.
- [x] Principal inválido produce cero consultas de dominio en las seis lecturas.
- [x] Envíos, facturas y documentos fijan tenant + Shipping Mark canónicos.
- [x] Se conservan mapeos, filtros funcionales, orden, límites y ETA.
- [x] Pruebas focales/Portal, tipos, lint y gates documentales quedan verdes.
- [x] Producción permanece no verificada y sin datos reales.
- [x] Checklist original sigue 56/106.

Gobernanza: la no conformidad de defensa explícita quedó corregida en las seis
lecturas. No hay cambio visual ni nueva categoría de datos personales.
