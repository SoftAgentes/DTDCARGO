---
sdd: "0230"
title: "Cierre gobernado de ruta TMS"
status: done
author: "Sam (founder) + Codex"
created: 2026-08-01
updated: 2026-08-01
supersedes: null
superseded_by: null
related: ["0017", "0019", "0219"]
confidencialidad: interno
---

# SDD-0230 — Cierre gobernado de ruta TMS

## 1. Objetivo

Corregir exclusivamente la transición R3 `en_ruta → completado` identificada
por REV-SGE-039. La decisión debe verificar actor, tenant, rol, ruta, shipment y
recursos bajo lock. Ruta, camión, chofer, shipment, timeline y AUD-01 cambian
juntos o ninguno cambia.

No se certifica el módulo completo ni se modifica la creación, el inicio o la
cancelación de rutas, GPS, incidencias, costos o el POD final.

## 2. Decisiones

- La capability admite membresías activas `admin`, `operations` y `warehouse`,
  coherente con el gate vigente del módulo TMS.
- La única precondición aceptada es ruta `en_ruta` y shipment
  `out_for_delivery` del mismo tenant.
- Si hay camión o chofer vinculados, deben existir, pertenecer al tenant, estar
  `en_ruta` y no participar en otra ruta activa.
- La tabla de rutas expone por primera vez un consumidor UI de la action. Usa
  `ConfirmDialog` canonical con ruta, shipment, camión, chofer, consecuencia,
  motivo obligatorio, presión sostenida y alternativa accesible.
- Un trigger impide que PostgREST o la action legacy declaren `completado`.
- `completado` es terminal: estado, progreso, timestamp y vínculos operativos
  quedan sellados.
- `request_ref` hace replay seguro. Reutilizarla con otra ruta o motivo falla.
- Ruta, recursos, shipment `last_mile`, timeline con actor y evento
  `tms_route_completed` se escriben en una transacción.
- La action traduce errores técnicos a copy público estable.

## 3. Políticas

| Política | Resultado del slice |
|---|---|
| SGE-00 | cumplimiento: el éxito exige convergencia transaccional de seis efectos |
| MP-01 | cumplimiento: rol activo, tenant y estados se verifican bajo lock en DB |
| BTN-01 | cumplimiento: el primer clic sólo abre la confirmación |
| HTD-01 | cumplimiento: presión sostenida + alternativa accesible |
| AUD-01 | cumplimiento: actor, motivo, request ref y mutación son atómicos |
| ERR-01 | cumplimiento: errores públicos estables y referencia segura |
| FRM-01 | cumplimiento: motivo obligatorio preservado ante error |
| LOD-01 | cumplimiento: pending y doble envío bloqueados |
| A11Y-01 | cumplimiento: diálogo canonical, foco, teclado y live regions |
| NUM-01 | no aplica: el progreso sólo se presenta y el RPC lo fija en 100 |
| UPL-01 | no aplica: el cierre no carga ni mueve archivos |

## 4. Allowlist

- `.agents/plugins/plugins/erp-studio-governance/references/policy-registry.json`
- `app/studio/(app)/tms/actions.ts`
- `app/studio/(app)/tms/_components/RoutesTab.tsx`
- `lib/studio/tms-types.ts`
- `lib/studio/tms-queries.ts`
- `lib/studio/__tests__/tms-route-completion-governance.test.ts`
- `supabase/migrations/0320_tms_route_completion_governance.sql`
- `supabase/tests/0320_tms_route_completion_governance.test.sql`
- `docs/specs/0230-tms-cierre-ruta-gobernado/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/tms-r3-route-completion-implementation-2026-08-01.md`

## 5. Aceptación

- Rol no permitido, tenant ajeno y membresía deshabilitada no mutan.
- `UPDATE` directo no puede declarar `completado`.
- Ruta, shipment, camión o chofer incompatibles producen error y cero cambios.
- Un recurso compartido por otra ruta activa no se libera.
- Replay idéntico retorna `replayed`; una request ref no sirve para otra ruta.
- Ruta, recursos, shipment, timeline y AUD-01 quedan atómicos con actor y motivo.
- Una falla del writer de auditoría revierte todos los efectos.
- La ruta completada y sus vínculos quedan inmutables.
- UI presenta objeto y consecuencia, exige motivo y bloquea doble envío.
- Tests focales, contratos SQL, TypeScript y validadores canónicos pasan.

## 6. Gates externos

La migración 0320 queda preparada y validada sólo en local. Aplicarla a
Producción exige autorización futura que nombre exactamente
`0320_tms_route_completion_governance`. Este slice no autoriza las migraciones
0316–0319, Cloud, Vercel ni integración a `main`.
