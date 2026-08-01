---
sdd: "0200"
title: "Portal backfill — estado de operación coherente"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0042", "0174", "0196", "0199"]
confidencialidad: interno
---

# SDD-0200 — Portal backfill · estado de operación coherente

## 1. Propósito

Eliminar cuatro sincronizaciones de estado por efecto en el backfill del portal
sin cambiar Server Actions, destinatarios, límites ni datos.

## 2. Riesgo y políticas

Riesgo **R3**: la superficie envía invitaciones reales. SGE-00.02/.05/.07 exige
confirmación explícita, pending verdadero y resultados visibles sin estados
intermedios desconectados.

## 3. Contrato resultante

- cada resultado de tanda se maneja una sola vez por identidad;
- una tanda exitosa limpia la selección y una fallida la conserva;
- el editor se cierra sólo ante una respuesta exitosa posterior a su apertura;
- errores de edición dejan el formulario abierto para reintento;
- acciones, máximo por tanda, destinatarios y mensajes no cambian.

## 4. Allowlist exacta

1. `app/studio/(app)/admin/_components/PortalBackfillSection.tsx`
2. `app/studio/(app)/admin/_components/PortalBackfillSection.test.tsx`
3. `docs/specs/0200-portal-backfill-operation-state/spec.md`
4. `docs/architecture/module-sdd-map.md`
5. `docs/specs/README.md` — generado

## 5. Fuera de alcance

- Server Actions, Supabase, correo, WhatsApp, ACL, migraciones y Producción;
- copy, layout, estilos y límites de lote;
- reglas ESLint globales u otros módulos.

## 6. Verificación

- ESLint focalizado: **0 errores · 0 advertencias**;
- Vitest: **2/2** pruebas del cambio de identidad y contrato sin efectos;
- `pnpm typecheck`: verde;
- lint completo: **156 → 152 advertencias**, 0 errores;
- docs, gobernanza, componentes, plugin y `diff --check`: verdes.
