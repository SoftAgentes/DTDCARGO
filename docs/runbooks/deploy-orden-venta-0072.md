# Cierre del tapón · Deploy SDD-0072 Orden de venta a prod

Runbook para **destrabar el push de `main`** (módulo de facturación de la Orden
de venta) y aplicar sus 4 migraciones a prod. Lo corre **la ventana de
coordinación con el OK del founder** — NO una ventana secundaria, NO desde un
worktree de feature. Mismo principio que el resto de runbooks: el código ya está
en `main` (local), falta el gatillo de prod.

> ⚠️ Esto es un **deploy financiero irreversible** (crea facturas + asiento
> contable en prod). Leé los pre-requisitos antes de tocar nada.

## Qué destraba

`main` local quedó **adelante de `origin/main`** con todo el chain SDD-0072
(Fase 1 + 2 + 3). No se pushea porque el push dispara el deploy a prod (Vercel) y
la facturación necesita sus migraciones aplicadas primero. Cerrar el tapón =
aplicar las 4 migraciones **y luego** pushear `main`. Una vez hecho, el resto de
carriles que esperan detrás de `main` se pueden ir drenando.

## Pre-requisitos (todos ✅ al 2026-06-13)

- **Decisión "gate verificado"** → RESUELTA e implementada (Fase 3): la
  auto-factura exige un **flag humano explícito** ("verificada para facturar").
  Sin el flag, la recepción consolida pero NO factura. (`ui-ux-designer` ✅.)
- **Decisión IVA** → **OFF por ahora**. El gap RLS de `tenants.iva_enabled` es
  inofensivo mientras no se facture IVA. La capa fiscal va aparte (SDD-0073).
- **Review del motor (Fase 2)** → revisado + auditado adversarialmente: el git
  lo prueba (`cierra los 3 críticos del review`, `endurece H1/H2 del re-audit`).
  La nota "pendiente reviewer" del spec §11 es **vieja**, no un gap real.
- **QA a confirmar (2 min):** la **Fase 3** tiene `ui-ux` ✅ y gate 🟢 pero no hay
  un `reviewer` registrado. Es chica y aditiva (1 columna + 1 requisito de gate).
  Confirmá un review rápido o aceptala como bajo riesgo antes de pushear.

## Proyecto Supabase

- **ref:** `xpfuzqombmjmxvprjgmi` (name: DoorTuDoor)
- Migraciones aplicadas: https://supabase.com/dashboard/project/xpfuzqombmjmxvprjgmi/database/migrations
- SQL editor: https://supabase.com/dashboard/project/xpfuzqombmjmxvprjgmi/sql/new

## Paso 1 · Migraciones a prod (ORDEN ESTRICTO)

Aplicá **en este orden** (hay dependencias de FK; no las reordenes):

| # | Archivo | Qué hace | Forma |
|---|---|---|---|
| 1 | `0125_sales_orders.sql` | Tabla `sales_orders` (OV-YYYY-NNNN) + RLS fail-closed por tenant + RPC `next_sales_order_code` + columnas aditivas en `prealertas`/`quotes` | Crea tabla + RPC |
| 2 | `0127_sales_order_invoicing.sql` | 100% aditiva: columnas de puente recepción↔OV + idempotencia (`prealertas.invoice_id`). `add column if not exists` | Solo columnas |
| 3 | `0128_sales_order_invoicing_hardening.sql` | Denominador congelado (`invoicing_total_boxes`) + **RPC transaccional `sales_order_claim_and_invoice`** (núcleo financiero) | Columna + RPC |
| 4 | `0129_sales_order_invoice_verification.sql` | Flag humano: `warehouse_receipts_cn.invoice_verified_at` + `_by` + índice parcial. **Sin función nueva** | Solo columnas |

Todas son **idempotentes y aditivas** (sin DDL destructivo; `IF NOT EXISTS` en
columnas) → re-aplicar una a medias es seguro. Aplicalas por el mecanismo
habitual (MCP `apply_migration`, `supabase db push`, o pegar el SQL en el editor),
cada archivo tal cual está en `supabase/migrations/`.

> ⚠️ **`0126_fiscal_settings.sql` NO es de este chain** — es de otro carril
> (fiscal/SDD-0073) y quedó en el medio de la numeración por una colisión. NO
> hace falta para la Orden de venta y este chain no depende de él. Confirmá su
> estado por separado con la ventana que lo trabaja; si seguís el orden de arriba
> vas a "saltar" el 0126 y está bien (Supabase trackea cada migración por
> separado, no exige numeración contigua).

## Paso 2 · Smoke-check post-migración (antes de pushear)

En el SQL editor de prod, confirmá:

1. **Columnas/FKs nuevas existen:** `sales_orders` (tabla), `invoices.sales_order_id`,
   `warehouse_receipts_cn.invoice_verified_at`, `prealertas.invoice_id`.
2. **RLS sin regresión:** `sales_orders` tiene RLS habilitado y políticas por
   `tenant_id` (fail-closed, espejo de 0124 `purchase_orders`).
3. **Anti-deuda anon (importante):** verificá que las RPCs nuevas NO sean
   ejecutables por `anon`:
   ```sql
   select p.proname,
          has_function_privilege('anon', p.oid, 'EXECUTE') as anon_puede
   from pg_proc p
   where p.proname in ('next_sales_order_code','sales_order_claim_and_invoice');
   ```
   Si `next_sales_order_code` da `anon_puede = true` (como su gemela
   `next_purchase_order_code` antes del fix 0124b), abrí un **`0130`** espejo de
   `0124b_revoke_anon_next_po_code.sql` (`revoke execute … from public, anon`)
   y aplicalo. El núcleo `sales_order_claim_and_invoice` corre server-side con
   admin client, pero igual no debería ser anon-ejecutable.

## Paso 3 · Push de `main` + verificar live

1. Desde la **ventana de coordinación**, con el working tree de `main` limpio:
   ```bash
   git branch --show-current   # debe decir: main
   git fetch origin
   git log origin/main..main --oneline   # revisá que sea SOLO el chain 0072
   git push origin main
   ```
2. Vercel deploya solo (push a `main` = prod). Esperá el build.
3. **Verificá live:** `https://dtdcargo.com/api/debug/health` (200 OK + commit
   esperado). Entrá a Studio → módulo **Órdenes de venta**: la lista carga, se
   crea una OV desde un estimado, y la recepción CN muestra el toggle
   "verificada para facturar".
4. **Prueba de humo del motor (con un cliente de prueba):** marcá una recepción
   como verificada → consolidá → debería generar la factura `emitida` + el evento
   en el timeline. Sin el flag → consolida pero NO factura.

## Paso 4 · Limpieza de doc (post-deploy, no urgente)

En `docs/specs/0072-orden-venta-sales-order/spec.md`:
- Flipear la nota "Pendiente: `reviewer`" de Fase 2 (§11) → reviewer + audit
  hechos (git).
- Marcar las 2 decisiones (gate verificado · IVA off) como **resueltas** en Fase 3.
- `status` del spec a `done` si esto cierra el alcance (correr luego
  `node scripts/build-docs-index.mjs` para regenerar el índice).

## Heads-up de producto (NO bloquea)

El monto de la auto-factura es **prorrateo por cajas** sobre el snapshot, **no
recálculo por CBM real** (spec §11, "validar con el founder"). Funciona así hoy.
Si el founder quiere CBM real, es un cambio acotado en
`computeReceiptInvoiceAmount` (`lib/studio/sales-orders/invoicing.ts`) — decisión
para antes o después del push, no frena el tapón.

## Rollback / si algo sale mal

- Las migraciones son **aditivas** → no hay que revertir schema para un rollback
  de app. Si el deploy de app falla, revertí el push (`git revert`/redeploy del
  commit previo en Vercel); las columnas nuevas quedan inertes sin la app que las
  usa.
- Si una factura sale mal: **anular** la factura (status `anulada`) rehabilita la
  caja (FK `on delete set null` + el guard de idempotencia la devuelve al pool).
  No borres filas a mano.
- `redirect_to`/auth no aplican acá (no toca el portal).

## Checklist final (coordinación)

- [ ] Fase 3 con review confirmado (o aceptada como bajo riesgo)
- [ ] 0125 → 0127 → 0128 → 0129 aplicadas en orden
- [ ] 0126 (otro carril) confirmado por separado
- [ ] Smoke-check schema + RLS + anon-execute de RPCs
- [ ] `git push origin main` desde coordinación
- [ ] `/api/debug/health` OK + prueba de humo del motor
- [ ] Limpieza de doc del spec (post)
