---
sdd: "0125"
title: "Reportar pago + comprobante en el portal"
status: draft
author: "agente-secundario (inventario portal)"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0042", "0044", "0054", "0079"]
confidencialidad: interno
---

# DTD-0125 — Reportar pago + comprobante en el portal

> ⚠️ **Número TENTATIVO** (Director confirma vs ramas en vuelo). Origen:
> `INVENTARIO-PORTAL.md` gap **#7**. **✅ Confirmado por el founder (2026-07-01): SÍ construir.**

## Contexto

Hoy `/portal/facturas` es read-only para el dinero: remite "escríbele a tu asesor" para pagar.
El cliente paga por transferencia offline y el asesor lo registra a mano, sin evidencia en el
sistema. El founder confirmó construir un flujo donde el **cliente reporta su pago y sube el
comprobante**, y el **asesor lo confirma** desde el Studio.

**No es una pasarela de pago.** El modelo sigue siendo DDP prepago por transferencia; esto solo
mete el **reporte + la evidencia** al sistema (baja fricción, deja rastro).

## Objetivo

- El cliente, desde el detalle de una factura, **reporta un pago**: monto, método, fecha y
  **comprobante** (imagen/PDF a Storage privado).
- La factura pasa a **"pago reportado"** (estado visible cliente + asesor).
- El asesor **confirma o rechaza** el reporte desde el Studio.

## No-objetivos

- Cobro en línea / pasarela (Stripe/Polar/pago móvil automático).
- Conciliación bancaria automática (SDD-0105 lo hace aparte; acá solo se **vincula** el pago
  confirmado).

## Modelo de datos (propuesta)

Tabla nueva `payment_reports` (mejor que un flag en `invoices` — soporta parciales/histórico):

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `tenant_id` | uuid not null | |
| `invoice_id` / `invoice_code` | | factura reportada |
| `client_markbox` | text not null | denormalizado para RLS del portal |
| `amount` | numeric | monto reportado |
| `currency` | text | |
| `method` | text | transferencia / pago_movil / zelle / binance / otro (decisión founder) |
| `paid_at` | date | fecha del pago según el cliente |
| `proof_path` | text | comprobante en bucket privado `payment-proofs` |
| `status` | text | `reportado → confirmado → rechazado` |
| `note` | text | nota del cliente / motivo de rechazo del asesor |
| `confirmed_by` | uuid | user que confirmó/rechazó |
| `confirmed_at` | timestamptz | |
| `created_at` | timestamptz default now() | |

- **Bucket Storage privado** `payment-proofs` (`{tenant_id}/{invoice}/{id}/archivo`, signed URL,
  solo admin + el dueño). PII/financiero → nunca público, nunca en git.
- **RLS:** portal self (`client_markbox = get_portal_client_markbox()`) para **insertar** y
  **leer** sus reportes; equipo `by tenant` para confirmar/rechazar. Defensa en profundidad
  (filtro explícito por markbox). Anti-abuso: rate-limit de reportes por factura.

## Flujo

1. Cliente en `/portal/facturas/[code]` → "Reportar pago" → form (monto/método/fecha/comprobante).
2. Se crea `payment_reports` en `reportado`; la factura muestra el chip "pago reportado".
   Aviso al asesor (mail/Telegram best-effort).
3. Asesor en el Studio (detalle de factura o cliente) ve el reporte + comprobante → **Confirma**
   o **Rechaza** (con motivo).
4. Al **confirmar**: se registra el pago contra la factura.

## Decisión clave abierta (founder): ¿qué hace "confirmar"?

- **(a) Solo marca** el reporte como confirmado y actualiza el saldo visible (más simple).
- **(b) Genera el asiento contable** DR caja/banco / CR cuenta por cobrar (integra con el hilo
  financiero — SDD-0079/0110) y/o crea el registro en Tesorería (SDD-0044).

> Recomendación V1: **(a)** para salir rápido; **(b)** en un slice siguiente cuando se ate a
> conciliación (SDD-0105).

## Otras decisiones abiertas

- **Métodos** habilitados (transferencia / pago móvil / Zelle / Binance / efectivo).
- **Parcial vs total:** ¿permitir reportar abonos parciales? (el modelo de tabla ya lo soporta.)
- ¿El cliente puede editar/borrar un reporte antes de que el asesor lo confirme?
- ¿Notificación al cliente cuando el asesor confirma/rechaza? (se apoya en SDD-0123 si existe.)

## Slices sugeridos

- **A** — tabla + bucket + form de reporte en el portal + chip "pago reportado" + aviso al asesor.
- **B** — confirmación/rechazo en el Studio + saldo actualizado (opción a).
- **C** — asiento contable / vínculo a Tesorería+conciliación (opción b).

## Verificación

- `node scripts/verify.mjs` verde + tests de aislamiento (un cliente solo ve/crea reportes de
  SU markbox) + el admin client no llega al bundle.
- Migración validada con `begin … rollback` en prod antes de aplicar.
- Bucket privado verificado (un cliente no firma URLs de otro).
