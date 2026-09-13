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

> **Nota de importación — 2026-09-12.** Esta spec se importa desde la PR #21 (`ea9952a4`; commit
> `702de3f4`) con su contenido original, `status: done` incluido: ese estado describe el cierre técnico
> local de la rama de origen, no un release. `0414_invoices_read_rbac` está **PENDIENTE DE APLICAR** y
> declarada en `supabase/migrations-baseline.json`; fusionar no autoriza aplicarla. Lote L07 del bloque C:
> **0407 → 0411, 0412 y 0413 → despliegue de L07 y smoke por roles → 0414**. Precisión medida en local
> encima de `main`: si 0414 se aplica con el código de `main` todavía desplegado, o si se revierte sólo la
> app después, no hay error; RLS devuelve cero filas a los roles no financieros, Fidelización, CRM y
> Reportes dejan a todos los clientes en Bronze, Conversaciones muestra saldo 0 y el drawer de la OV
> «Facturas · 0». Tras 0414 accounting y admin conservan lectura y escritura de su tenant y las tres RPC
> siguen respondiendo. En el Portal, un vínculo coherente conserva sus facturas y, si su Shipping Mark se
> repite en otro tenant, deja de ver las del otro tenant, que la policy histórica exponía (medido).
> **Frontera aceptada por el Director como intencional (ronda 2):** un vínculo activo cuyo cliente está
> borrado, o cuyo vínculo y cliente no coinciden de tenant, deja de leer facturas **sin ningún mensaje de
> error**: la lectura devuelve cero filas. Las páginas del Portal ya mandan a esos principales a
> `/entrar` desde el layout (`app/portal/(app)/layout.tsx:39-40`); la descarga del PDF por URL no pasa
> por el layout (`app/portal/(app)/facturas/[code]/pdf/route.ts:41-44`) y pasa de entregar la factura a
> responder 404 «Factura no encontrado.».
>
> **Test de inventario (ronda 2).** `scripts/__tests__/invoice-read-boundary.test.mjs` entra idéntico al
> origen (blob `97c82149`), sin ajustar su lista de lectores: el inventario que congela, 45 llamadas
> directas `from("invoices")` en 18 archivos, coincide con el código real de esta rama, y sus imports
> (`canAccessModule` de `lib/studio/rbac.ts` y `KPI_CATALOG` de `lib/studio/dashboard/dashboard-catalog.ts`)
> existen en `main`, así que no requiere código de producto ausente (SDD-0322, SDD-0390 u otros). Pasa
> focal 3/3. Control rojo: un lector ficticio de `invoices` fuera de la lista lo hace fallar (19 archivos
> contra 18) y, al retirarlo, vuelve a verde. Las PR #104 y #105 no alteran ese inventario: un conteo AST
> de los 15 archivos de producción que tocan da 0 cambios. No se importan el checklist
> `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs `2026-09-02-*` de la allowlist;
> entran fuera de ella el registro de migraciones pendientes, que exige el gate `migrations-applied`, y el
> handoff `.agents/handoffs/c-l07-fidelizacion-conversations.md`, donde quedan el inventario de lectores y
> escritores, la paridad, los locks y la vuelta atrás de 0414 probada en local (sección «VUELTA ATRÁS DE
> 0407 Y 0414»: el catálogo de `invoices` queda idéntico al de antes de 0414 después de aplicarla y
> revertirla).
>
> **Desviación respecto del origen**, pre-autorizada por el Director el 2026-09-12 antes de cualquier
> aplicación: `0414` fija `set local lock_timeout = '5s'` y `statement_timeout = '60s'` antes de su
> primer lock, al nivel superior del archivo. Toma ACCESS EXCLUSIVE sobre `invoices` y ACCESS SHARE sobre
> `clients` y `client_users`: con un lector que retenía `invoices` 15 s, el archivo de origen esperó
> 13,99 s y dejó 11,99 s en cola a un lector nuevo; el archivo actual corta a los 5,0 s y se revierte
> entero. El tope rige sólo dentro de la transacción de aplicación, como la de `apply_migration`; en
> autocommit no tiene efecto, a diferencia de 0450 y 0451, que lo fijan dentro de su bloque `do`. El
> contrato `0414` anula los topes que dejó 0407 en su transacción antes de incluir 0414 y agrega la
> aserción estática y la comprobación en transacción, así que la migración y su contrato ya no son
> idénticos al origen.

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
