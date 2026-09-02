---
sdd: 0357
title: Cerrar lectura cruda de facturas por rol y principal Portal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0042
  - SDD-0139
  - SDD-0350
  - SDD-0354
  - SDD-0355
  - SDD-0356
confidencialidad: interno
---

# SDD-0357 — Lectura de facturas con autorización completa

## Evidencia y decisión

Después de 0411–0413, Fidelización/CRM, Conversaciones y Órdenes de venta usan
RPCs minimizadas. El inventario AST de `app/`, `lib/` y `supabase/functions/`
queda en 18 archivos / 45 llamadas literales directas a `from("invoices")`.
Se congela ese inventario; no sustituye una prueba de autorización dinámica.

- Finanzas y sus exports, estados de cuenta, búsqueda global y widgets:
  requieren `invoices|accounting|collections|costing|fiscal|reports`, o admin
  en Rendiciones. Los candados de dinero no admiten overrides.
- Fidelización conserva sólo consultas de aplicación de crédito: sus acciones
  exigen `moduleEditDenial("accounting")` antes de leer o mutar facturas.
- Kommo conserva un proceso con `service_role` y filtro explícito de tenant.
- Portal conserva queries RLS y contextos elevados controlados por principal.

La policy Portal histórica usa únicamente Shipping Mark. La restricción de
`clients` es `unique(tenant_id, markbox)` (0006), no global. Por tanto, conservar
esa policy sin tenant dejaría abierta una lectura cruzada al cerrar la interna.

1. Reemplazar SELECT interno tenant-wide por tenant + `accounting|admin` activos.
2. Mantener los estados y la lectura financiera de soft-deleted para auditoría;
   las queries de operación siguen excluyéndolos. No cambiar INSERT/UPDATE/DELETE.
3. Portal: exigir vínculo `client_users` activo de `auth.uid()`, cliente vivo,
   y coincidencia de tenant en vínculo, cliente y factura, además de Shipping
   Mark. Conservar exclusión de borradores y soft-deleted de la policy original.
4. No dar acceso interno por overrides de módulos no financieros. Esos módulos
   continúan funcionando mediante las tres RPCs de lectura mínima.
5. Rechazar preflight si faltan las RPCs o hay policies SELECT/ALL inesperadas.

## Allowlist exacta

- `supabase/migrations/0414_invoices_read_rbac.sql`
- `supabase/tests/0414_invoices_read_rbac.test.sql`
- `scripts/__tests__/invoice-read-boundary.test.mjs`
- `docs/specs/0357-invoices-read-rbac/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-invoices-read-rbac-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Gate constitucional

| Principio | Resultado y evidencia |
|---|---|
| SGE-00.01 | cumplimiento: no cambia verbos ni estados de negocio |
| SGE-00.02 | cumplimiento: no muta ni elimina registros; contratos de escritura conservada |
| SGE-00.03 | cumplimiento: R3, lectura financiera; matriz vigente de dinero, sin nueva fricción UI |
| SGE-00.04 | no aplica: no agrega acciones financieras ni de permanencia; no modifica auditoría |
| SGE-00.05 | cumplimiento: pruebas de rol, tenant, vínculo revocado, cliente retirado y Shipping Mark repetido |
| SGE-00.06 | cumplimiento: preflight valida dependencias y policies antes de sustituirlas |
| SGE-00.07 | cumplimiento: prueba integrada de RPCs con SELECT crudo denegado; Cloud no se declara medido |
| SGE-00.08 | no aplica: no cambia recorridos de usuario |
| SGE-00.09 | cumplimiento: reutiliza helpers de membresía y policies; no crea UI |
| SGE-00.10 | no aplica: sin modificación visual o interactiva |
| SGE-00.11 | cumplimiento: errores de preflight identifican dependencia o drift |
| SGE-00.12 | cumplimiento: migración alojada conserva gate humano específico |

MP-01: no cambia retención, borradores P2, hechos emitidos P3 ni evidencia P4.
No captura, exporta ni traslada PII. El fixture SQL es sintético y usa rollback.

## Aceptación

- Los cinco roles internos no financieros no pueden leer filas crudas.
- Accounting/admin ven sólo su tenant; identidad ausente/desactivada no ve.
- Portal activo ve únicamente sus facturas no borrador/vivas del tenant propio;
  un Shipping Mark igual en otro tenant no abre acceso. Revocado/cliente retirado
  o relación con tenant incoherente no ve filas.
- INSERT/UPDATE financieros y ausencia de DELETE físico permanecen; service_role
  conserva su operación explícita.
- 0411, 0412 y 0413 reales funcionan después de aplicar 0414 con rol comercial.
- Inventario AST, SQL, rebuild y verificador canónico pasan; los SKIP se separan.

## Gate alojado y límite

0414 requiere que 0411–0413 estén aplicadas Y que la aplicación que usa esas RPCs
ya esté desplegada y verificada. El preflight SQL no puede demostrar la versión
del frontend: esa comprobación humana es obligatoria antes del OK individual.
No ejecutar esta migración junto con un deploy implícito. El orden coordinado de
0410 (facade + cierre de mail_logs) necesita su propio preflight de compatibilidad.
No se cambia la autorización de otras tablas Portal, RPCs históricas ni views.
