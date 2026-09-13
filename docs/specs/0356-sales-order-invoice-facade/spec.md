---
sdd: 0356
title: Minimizar referencias de facturas en Órdenes de venta
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0072
  - SDD-0252
  - SDD-0322
  - SDD-0350
confidencialidad: interno
---

# SDD-0356 — Facturas mínimas por orden de venta

> **Nota de importación — 2026-09-12; actualizada el 2026-09-13.** Esta spec se importa desde la PR
> #21 (`ea9952a4`; commit `3ca9a79d`) con su contenido original, `status: done` incluido: ese estado
> describe el cierre técnico local de la rama de origen. Su migración
> `0413_sales_order_invoice_facade` **fue APLICADA a producción el 2026-09-13** por el Director con
> OK nominal de Sam, la última de las cuatro del lote (ledger `20260913224453 /
> 0413_sales_order_invoice_facade`, md5 `f501e4e17df340b6dc9dbf86e19c721a`, 3337 bytes; el ledger
> quedó en 457 filas), con el archivo de esta rama idéntico al aplicado: `git show
> HEAD:supabase/migrations/0413_sales_order_invoice_facade.sql` da el mismo md5 y los mismos 3337
> bytes, sólo LF; es el blob `4d927a53`, idéntico al origen. Se aplicó con `apply_migration` y name
> exacto por el conector `claude.ai Supabase` (proyecto `xpfuzqombmjmxvprjgmi`), `{"success": true}`
> al primer intento y sin leer ninguna fila de negocio. Postflight, leído del catálogo sin filas:
> `sales_order_invoice_refs` SECURITY DEFINER, STABLE, `search_path=""`, owner postgres, EXECUTE
> para `authenticated` y sin EXECUTE para `anon`, comentario presente. Advisors de seguridad de
> producción antes y después del bloque 0407 + 0411 + 0412 + 0413, comparados hallazgo por hallazgo:
> sólo cambió `authenticated_security_definer_function_executable`, de WARN 175 a WARN 178, con
> exactamente las tres RPC del lote, `public.sales_order_invoice_refs` incluida; `anon` sigue sin
> EXECUTE (su lint quedó en 22) y los demás hallazgos no cambiaron (detalle en SDD-0354). Es el
> efecto esperado, no una regresión. El registro de esta ronda está en
> `.agents/handoffs/c-l07-fidelizacion-conversations.md` («RONDA 4»). Por eso 0413 ya **no** figura
> como espera en `supabase/migrations-baseline.json` ni tiene declaración en
> `supabase/pending-migration-symbol-declarations.json`; el orden migrate-first se cumplió: la RPC
> existe en la base antes de fusionar el código que la consume, así que `listInvoicesForSalesOrder`
> ya no puede caer en `PGRST202`. Lote L07 del bloque C: **0407, 0411, 0412 y 0413 (aplicadas) →
> fusión y despliegue de esta PR y smoke por roles → 0414**. La medición local de la ronda 1 sigue
> valiendo como descripción de lo que pasaría sin la RPC: PGRST202, `listInvoicesForSalesOrder`
> lanza y la página de Órdenes de venta falla en cuanto hay una orden.
>
> Cortes: de `lib/studio/sales-orders/queries.ts` sólo entran el import de `fetchAllByIds`,
> `SalesOrderInvoiceRef` sin fechas y `listInvoicesForSalesOrder` sobre el nuevo
> `listInvoicesBySalesOrder`. No entran `listPrealertasBySalesOrder` ni la columna `sales_order_id`
> de prealertas, que son de SDD-0322 (commit `1faff60b`), cuyo código no está en `main`.
> `lib/studio/__tests__/orders-relations-batch.test.ts` nace recortado a los casos de facturas
> (agrupación por RPC sin consulta por orden, error que no se vuelve vacío y lote vacío), más un
> caso nuevo: el helper de una orden delega en la misma RPC. Se omiten los casos de ítems de compra,
> de prealertas y la lectura de las páginas, que son de SDD-0322. La página
> `app/studio/(app)/ordenes-venta/page.tsx` no está en la allowlist y sigue pidiendo las referencias
> por orden: el criterio «sin una query por orden» se cumple en el helper, no en la página. Paridad
> medida contra `main` con datos sintéticos y PostgREST: mismos estados, mismo filtro de facturas
> borradas y mismo aislamiento; **diverge** donde `main` truncaba en 200 facturas por orden (200 →
> 210) y oculta las facturas de una orden borrada, que la página no lista. No se importan el
> checklist `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs `2026-09-02-*` de
> la allowlist; entran fuera de ella el registro de migraciones pendientes, por la espera de 0414, y
> el handoff `.agents/handoffs/c-l07-fidelizacion-conversations.md`. Sin desviaciones en SQL ni en
> el contrato.

## Estado real

El drawer de Órdenes de venta sólo usa id, código, monto y estado de factura.
La query leía `invoices` directamente y enviaba fechas que el componente no
consume. Además, su catch convertía un fallo de lectura en “sin facturas”.

## Decisión

1. Crear `sales_order_invoice_refs(uuid[])`, sin tenant arbitrario y limitada
   a 500 órdenes por llamada; el helper conserva lotes y paginación completa.
2. Exigir permiso efectivo de `sales-orders`, incluyendo overrides. El default
   sigue siendo `commercial|operations|accounting`, con admin universal.
3. Exigir que tanto la orden como la factura pertenezcan al tenant activo y
   estén vivas. Conservar todos los estados de factura para su trazabilidad.
4. Devolver sólo id de factura/orden, código, total, estado y `created_at` para
   ordenar páginas. La aplicación no transmite fechas al componente.
5. Propagar errores y truncamiento, sin presentar un vacío inventado.
6. Mantener todavía la policy SELECT general de `invoices` hasta el slice de
   cierre con inventario de consumidores.

## Gate SGE-00 y privacidad

- `cumplimiento` SGE-00.05/06: rol efectivo, membresía y tenant se prueban en SQL;
  ids de otro tenant o de órdenes retiradas no devuelven facturas.
- `cumplimiento` SGE-00.11: errores de la RPC no se convierten en listas vacías.
- `cumplimiento` MP-01: se excluyen cliente, líneas, tasas, notas y datos fiscales.
- `no aplica`: UI, escritura financiera, captura o traslado de PII.

## Allowlist exacta

- `lib/studio/sales-orders/queries.ts`
- `lib/studio/__tests__/orders-relations-batch.test.ts`
- `supabase/migrations/0413_sales_order_invoice_facade.sql`
- `supabase/tests/0413_sales_order_invoice_facade.test.sql`
- `docs/specs/0356-sales-order-invoice-facade/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-sales-order-invoice-facade-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- El helper no consulta `invoices` directamente ni ejecuta una query por orden.
- Roles, overrides, membresía desactivada, dos tenants, soft-delete y límite
  de lote quedan cubiertos por SQL con rollback.
- El componente no recibe fechas; fallos no producen falsos vacíos.
- Vitest focal, TypeScript, lint, SQL, rebuild, docs, numeración, gobernanza,
  componentes y diff pasan.

## Fuera de alcance

- Endurecer todavía SELECT de `invoices` o cambiar creación/estados de factura.
- Cambiar moneda o formato visual del drawer.
- Aplicar 0413 a Cloud/Producción.
