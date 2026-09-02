# Cierre técnico · SDD-0355 · saldo mínimo de Conversaciones

Fecha: 2026-09-02

Rol: worker

Estado: CERRADO LOCALMENTE · MIGRACIÓN ALOJADA PENDIENTE

## Resultado

- La RPC recibe el id del hilo y deriva el cliente dentro del tenant activo.
- Aplica permisos efectivos de Conversaciones, incluidos grant/revoke por rol.
- Devuelve sólo cliente, saldo y moneda; no expone facturas individuales.
- Excluye borradores, anuladas y soft-deleted. Conserva moneda dominante por
  total nominal, con empate determinista, y clamp de sobrepago a cero.
- `getClientContext` relee el cliente por RLS después de la RPC; un error o
  contexto no autorizado devuelve null en vez de un saldo cero inventado.

## Allowlist

- `app/api/studio/conversaciones/[id]/route.ts`
- `lib/studio/conversaciones/conversations-queries.ts`
- `lib/studio/conversaciones/conversations-types.ts`
- `lib/studio/conversaciones/__tests__/conversaciones.test.ts`
- `lib/studio/conversaciones/__tests__/client-context.test.ts`
- `supabase/migrations/0412_conversation_outstanding_facade.sql`
- `supabase/tests/0412_conversation_outstanding_facade.test.sql`
- `docs/specs/0355-conversation-outstanding-facade/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-conversation-outstanding-facade-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Evidencia ejecutada

- Vitest focal: 2 archivos / 41 pruebas, verdes.
- TypeScript y ESLint: verdes.
- SQL: 153/153 contratos con rollback total.
- Rebuild: 409 migraciones; 391 desde cero + 18 sólo-ledger; 219 tablas y
  2 tenants aislados.
- Docs, numeración, gobernanza, componentes y diff: verdes al cierre.

## Gates no cruzados

- 0412 no se aplicó a Cloud/Producción.
- No hubo push, merge, deploy, cambios de secretos ni lectura de PII.
- SELECT general de `invoices` permanece temporalmente hasta sustituir el
  resumen que consume Órdenes de venta.
