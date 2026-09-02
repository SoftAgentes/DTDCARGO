# Cierre técnico · SDD-0356 · referencias mínimas de facturas

Fecha: 2026-09-02

Rol: worker

Estado: CERRADO LOCALMENTE · MIGRACIÓN ALOJADA PENDIENTE

## Resultado

- Órdenes de venta ya no consulta `invoices` directamente. La RPC recibe como
  máximo 500 ids y comprueba tenant, órdenes vivas y permiso efectivo del módulo.
- Conserva todos los estados para trazabilidad; sólo devuelve id, código,
  monto y estado al componente. `created_at` se usa únicamente en paginación.
- Propaga fallos de lectura o truncamiento, sin inventar “sin facturas”.
- Respeta overrides, membresía activa y aislamiento en ambos lados del join.

## Allowlist

- `lib/studio/sales-orders/queries.ts`
- `lib/studio/__tests__/orders-relations-batch.test.ts`
- `supabase/migrations/0413_sales_order_invoice_facade.sql`
- `supabase/tests/0413_sales_order_invoice_facade.test.sql`
- `docs/specs/0356-sales-order-invoice-facade/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-sales-order-invoice-facade-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Evidencia ejecutada

- Vitest focal: 1 archivo / 5 pruebas, verdes.
- Suite completa: 526 archivos / 5.954 pruebas, verdes.
- TypeScript y ESLint: verdes.
- SQL: 154/154 contratos con rollback total.
- Rebuild: 410 migraciones; 392 desde cero + 18 sólo-ledger; 219 tablas y
  2 tenants aislados.
- Docs, numeración, gobernanza, componentes y diff: verdes al cierre.

## Gates no cruzados

- 0413 no se aplicó a Cloud/Producción.
- No hubo push, merge, deploy, cambios de secretos ni lectura de PII.
- SELECT general de `invoices` permanece hasta el cierre con inventario de
  consumidores financieros, Portal y procesos de servicio.
