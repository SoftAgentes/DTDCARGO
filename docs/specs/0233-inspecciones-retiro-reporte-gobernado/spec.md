---
sdd: "0233"
title: "Retiro gobernado de reportes de Inspecciones"
status: done
author: "Sam (founder) + Codex"
created: 2026-08-01
updated: 2026-08-01
supersedes: null
superseded_by: null
related: ["0066", "0174", "0215", "0219"]
confidencialidad: interno
---

# SDD-0233 — Retiro gobernado de reportes de Inspecciones

## 1. Objetivo

Corregir exclusivamente la decisión R3 que antes se presentaba como “Eliminar
reporte”, identificada por REV-SGE-039. El acto pasa a ser “Retirar del Studio”:
reporte, metadata activa de fotos y AUD-01 cambian juntos bajo rol, tenant,
estado esperado, lock e idempotencia.

Los objetos privados del bucket `inspections` se conservan. El slice no afirma
borrado físico ni redefine retención, recuperación o purga de Storage. No
certifica el módulo completo ni modifica carga o retiro individual de fotos.

## 2. Decisiones

- La capability conserva los editores existentes: membresías activas `admin`,
  `operations` y `commercial`; `support` permanece read-only.
- El RPC acepta reportes vivos `draft` o `final` y exige el estado observado por
  la UI para detectar carreras.
- El retiro marca `deleted_at` del reporte y de toda metadata fotográfica activa
  en una sola transacción, con actor, motivo, request ref y AUD-01.
- AUD-01 registra `storage_disposition=retained_private_objects` y
  `physical_objects_deleted=false`.
- Se revoca `DELETE` directo a `authenticated` en reportes y fotos; service_role
  conserva su gate operativo separado.
- Un trigger impide el soft-delete directo y vuelve terminal el retiro.
- `request_ref` hace replay seguro; reutilizarla con otro reporte, estado o
  motivo falla sin mutar.
- La UI usa `ConfirmDialog` canonical con lenguaje honesto, motivo obligatorio,
  presión sostenida, foco seguro, pending/error y referencia estable.

## 3. Políticas

| Política | Resultado del slice |
|---|---|
| SGE-00 | cumplimiento: reporte, metadata de fotos y auditoría cambian juntos |
| MP-01 | cumplimiento: rol activo, tenant y estado se verifican bajo lock en DB |
| BTN-01 | cumplimiento: abrir el diálogo no retira el reporte |
| HTD-01 | cumplimiento: presión sostenida + alternativa accesible |
| AUD-01 | cumplimiento: actor, motivo, request ref y disposición son atómicos |
| ERR-01 | cumplimiento: errores públicos estables y referencia segura |
| FRM-01 | cumplimiento: motivo obligatorio preservado al fallar |
| LOD-01 | cumplimiento: pending y doble envío bloqueados |
| A11Y-01 | cumplimiento: diálogo canonical, foco, teclado y live regions |
| UPL-01 | excepción controlada: Storage se retiene y se declara, no se purga |
| NUM-01 | no aplica: la decisión no captura números |

## 4. Allowlist

- `.agents/plugins/plugins/erp-studio-governance/references/policy-registry.json`
- `app/studio/(app)/inspecciones/actions.ts`
- `app/studio/(app)/inspecciones/_components/InspeccionesClient.tsx`
- `lib/studio/inspecciones/validators.ts`
- `lib/studio/inspecciones/queries.ts`
- `lib/studio/inspecciones/__tests__/retirement-governance.test.ts`
- `supabase/migrations/0323_inspection_report_retirement_governance.sql`
- `supabase/tests/0323_inspection_report_retirement_governance.test.sql`
- `docs/specs/0233-inspecciones-retiro-reporte-gobernado/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/inspections-r3-report-retirement-implementation-2026-08-01.md`

## 5. Aceptación

- Rol no permitido, tenant ajeno y membresía deshabilitada no retiran.
- Hard-delete y soft-delete directo no retiran reportes ni fotos.
- Estado, motivo o request ref inválidos producen error y cero cambios.
- Replay idéntico recupera la misma evidencia; una request ref no sirve para
  otro reporte, estado o motivo.
- Reporte, metadata activa de fotos y AUD-01 quedan atómicos.
- Una falla del writer de auditoría revierte todo el retiro.
- El hito retirado no se restaura ni se altera mediante la superficie ordinaria.
- UI declara que Storage se conserva y no presenta el retiro como borrado físico.
- Tests focales, contratos SQL, schema rebuild, TypeScript y validadores pasan.

## 6. Gates externos

La migración 0323 queda preparada y validada sólo en local. Aplicarla a
Producción exige autorización futura que nombre exactamente
`0323_inspection_report_retirement_governance`. Este slice no autoriza
0316–0322, Cloud, Vercel, purga de Storage ni integración a `main`.
