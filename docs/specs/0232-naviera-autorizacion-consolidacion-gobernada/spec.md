---
sdd: "0232"
title: "Autorización gobernada de consolidación Naviera"
status: done
author: "Sam (founder) + Codex"
created: 2026-08-01
updated: 2026-08-01
supersedes: null
superseded_by: null
related: ["0047", "0157", "0174", "0215"]
confidencialidad: interno
---

# SDD-0232 — Autorización gobernada de consolidación Naviera

## 1. Objetivo

Corregir exclusivamente la decisión R3 `solicitada → consolidando` identificada
por REV-SGE-039. La autorización debe resolver actor, tenant y rol activo,
bloquear la solicitud, reservar el correlativo definitivo y registrar AUD-01 en
una sola transacción reproducible e idempotente.

No se modifica el rechazo, la estiba, el cierre del contenedor, las reservas,
los itinerarios ni el tracking marítimo. Este slice no certifica el módulo
completo.

## 2. Decisiones

- La capability conserva los editores existentes de Naviera: membresías activas
  `admin`, `operations` y `accounting`.
- La única precondición es una solicitud viva en estado `solicitada`, sin ref ni
  evidencia de autorización previa.
- El RPC bloquea la fila, genera el `DTD-CONSOL-NNNN`, transiciona y escribe actor,
  timestamp, motivo, request ref y AUD-01 atómicamente.
- La reserva del correlativo reintenta colisiones y nunca se quema antes de una
  transición confirmada.
- Un trigger impide el bypass PostgREST y vuelve inmutables el correlativo, actor
  y timestamp después de autorizar.
- `request_ref` hace replay seguro; reutilizarla con otra solicitud o motivo
  falla sin mutar.
- El aviso push al operario permanece best-effort después del commit de DB; no
  forma parte de la verdad de autorización.
- La UI reemplaza el clic directo por `ConfirmDialog` canonical con consecuencia,
  motivo obligatorio, presión sostenida, foco seguro y referencia estable.

## 3. Políticas

| Política | Resultado del slice |
|---|---|
| SGE-00 | cumplimiento: correlativo, estado, actor y auditoría cambian juntos |
| MP-01 | cumplimiento: rol activo, tenant y estado se verifican bajo lock en DB |
| BTN-01 | cumplimiento: abrir el diálogo no ejecuta la autorización |
| HTD-01 | cumplimiento: presión sostenida + alternativa accesible |
| AUD-01 | cumplimiento: actor, motivo, request ref y resultado son atómicos |
| ERR-01 | cumplimiento: errores públicos estables y referencia segura |
| FRM-01 | cumplimiento: motivo obligatorio preservado durante error/reintento |
| LOD-01 | cumplimiento: pending y doble envío bloqueados |
| A11Y-01 | cumplimiento: diálogo canonical, foco, teclado y live regions |
| NUM-01 | no aplica: el correlativo lo reserva la DB; la UI no captura números |
| UPL-01 | no aplica: la autorización no captura ni modifica archivos |

## 4. Allowlist

- `.agents/plugins/plugins/erp-studio-governance/references/policy-registry.json`
- `app/studio/(app)/naviera/actions.ts`
- `app/studio/(app)/naviera/_components/NavieraClient.tsx`
- `app/studio/(app)/naviera/__tests__/consolidation-authorize.test.ts`
- `lib/studio/naviera/types.ts`
- `lib/studio/naviera/queries.ts`
- `supabase/migrations/0322_naviera_consolidation_authorization_governance.sql`
- `supabase/tests/0322_naviera_consolidation_authorization_governance.test.sql`
- `docs/specs/0232-naviera-autorizacion-consolidacion-gobernada/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/naviera-r3-consolidation-authorization-implementation-2026-08-01.md`

## 5. Aceptación

- Rol no permitido, tenant ajeno y membresía deshabilitada no autorizan.
- `UPDATE` directo no puede ejecutar `solicitada → consolidando`.
- Estado, motivo o request ref inválidos producen error y cero cambios.
- Replay idéntico recupera la misma referencia; una request ref no sirve para
  otra solicitud o motivo.
- Correlativo, estado, actor, timestamp y AUD-01 quedan atómicos e inmutables.
- Una falla del writer de auditoría revierte toda la autorización.
- UI exige motivo y confirmación sostenida, conserva la referencia al fallar y
  no presenta el aviso push como prueba del commit.
- Tests focales, contratos SQL, schema rebuild, TypeScript y validadores
  canónicos pasan.

## 6. Gates externos

La migración 0322 queda preparada y validada sólo en local. Aplicarla a
Producción exige autorización futura que nombre exactamente
`0322_naviera_consolidation_authorization_governance`. Este slice no autoriza
0316–0321, Cloud, Vercel ni integración a `main`.
