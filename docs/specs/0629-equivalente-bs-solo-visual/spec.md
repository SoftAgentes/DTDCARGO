---
sdd: "0629"
title: "Equivalente en bolívares, solo como vista, con su tasa, fecha y fuente"
status: in-progress
author: "founder"
created: 2026-11-13
updated: 2026-11-13
supersedes: null
superseded_by: null
related: ["0569", "0572"]
confidencialidad: interno
---

# SDD-0629 — Equivalente en bolívares, solo como vista

> Donde se muestra un monto en USD de una factura, un saldo o un recibo, se puede ver también cuánto sería en Bs y a qué tasa (valor, fecha y fuente). No cambia nada contable.

## Problema

Sam decidió el 2026-11-13: «todo el sistema trabaja en dólares». El bolívar es solo una vista: quien cobra o quien paga quiere saber cuánto sería en Bs y a qué tasa, sin que eso cree una segunda contabilidad. Las tasas ya existen (`fx_rates`, `fx_rate_on` y `to_usd`, migración 0495, SDD-0569; prioridad bcv > manual > operacion), pero ninguna pantalla de factura, saldo o recibo muestra el equivalente.

## Contrato

1. **Solo vista.** Ninguna columna nueva en Bs, ningún asiento, ningún recibo en Bs, ninguna migración. Los montos guardados y sus cálculos no cambian.
2. **A qué montos aplica.** Solo a montos en USD o USDT (USDT = USD 1:1). Un monto en VES ya está en Bs; uno en CNY no se encadena. En esos casos no se muestra nada.
3. **Qué tasa.** La de VES que devuelve `fx_rate_on(tenant, 'VES', fecha)`:
   - saldo abierto: la del día (Caracas);
   - total de una factura emitida: la del día de emisión (`issued_at`); un borrador, la del día;
   - recibo: la del día del pago (`received_at`).
4. **Falla cerrado.** Sin tasa, con una tasa inválida o con una tasa de un día posterior al pedido: «Bs: tasa no disponible». Nunca un cero ni un monto inventado. En el Studio se indica cargarla en Admin › Tasas; en el portal no.
5. **Tasa vieja con aviso.** `fx_rate_on` toma la última tasa anterior al día pedido. Se muestra con su fecha y un aviso: «No hay tasa del AAAA-MM-DD: es la última cargada, del AAAA-MM-DD.»
6. **Cuenta exacta.** `deUsdAMoneda` (en `lib/shared/fx.ts`) multiplica en decimal exacto (BigInt) y redondea a 2 decimales, mitad lejos de cero, como el resto del conversor.
7. **Texto de referencial.** «Equivalente referencial en bolívares. La cuenta se lleva en USD: este monto no es una factura ni un saldo en Bs.»
8. **Formato.** El del ERP (`fmtAmount`, en-US): «≈ Bs 3,650.00 · Tasa BCV 36.5000 Bs/USD del 2026-11-13». Fuentes: BCV, manual, de operación.

## Dónde se ve

| Superficie | Monto | Tasa |
|---|---|---|
| Studio › Factura (card del total) | Total facturado | día de emisión |
| Studio › Factura (card del total) | Saldo, si es > 0 | hoy |
| Studio › Cobranzas (bajo los KPI) | Por cobrar en USD (`porCobrarUsd`); los casos sin tasa a USD quedan fuera y se cuentan | hoy |
| Studio › Cobranzas › drawer del caso | Saldo a cobrar, si la factura es USD/USDT | hoy |
| Studio › Recibo (solo en pantalla) | Monto recibido, si es USD/USDT | día del pago |
| Portal › Factura | Total y saldo pendiente (si no está anulada) | emisión / hoy |
| Portal › Mis facturas (KPI) | Saldo pendiente, si no hay monedas mezcladas | hoy |

### PDF y papel: se deja para la facturación fiscal

Propuesta: el equivalente **no** entra en el PDF de la factura, en el estado de cuenta en PDF ni en el recibo impreso (en el recibo va con `data-print-hide`). Un monto en Bs impreso en un documento que el cliente guarda se lee como monto exigible y abre la pregunta fiscal (tasa BCV obligatoria, IGTF, libro de ventas). Cuando se implemente la facturación fiscal en Bs, esa SDD decide qué documento lleva el monto en Bs y con qué tasa. Hasta entonces, es solo pantalla.

## Lectura de la tasa en el portal

El cliente del portal no está en `user_tenants`: la RLS de `fx_rates` (`tenant_id = get_user_tenant_id()`) no le devuelve filas. La tasa no es un dato del cliente, sino la referencia del tenant. `lib/portal/tasa-referencial.ts` (server-only) la lee con el admin client y **siempre** con el tenant que la página ya resolvió: el de la factura leída con la RLS y el filtro tenant + Shipping Mark del principal (`getMyInvoice`), o el del principal (`getPortalClientPrincipal`). `fx_rate_on` filtra por `p_tenant_id`. Solo lectura, sin migración. Cualquier fallo es «tasa no disponible».

## Allowlist exacta

Producto:

- `lib/shared/fx.ts` — `deUsdAMoneda`.
- `lib/shared/equivalente-bs.ts` — nuevo: `equivalenteEnBs`, `textoEquivalenteBs`, la leyenda.
- `lib/studio/fx-rates.ts` — `tasasVesPorFecha`.
- `lib/portal/tasa-referencial.ts` — nuevo.
- `app/studio/_components/EquivalenteBs.tsx` — nuevo.
- `app/portal/_components/EquivalenteBs.tsx` — nuevo.
- `app/studio/(app)/facturacion/[code]/page.tsx`
- `app/studio/(app)/cobranzas/page.tsx`
- `app/studio/(app)/cobranzas/_components/CobranzasClient.tsx`
- `app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx`
- `app/studio/(app)/cobranzas/recibo/[code]/page.tsx`
- `app/portal/(app)/facturas/[code]/page.tsx`
- `app/portal/(app)/facturas/page.tsx`

Pruebas:

- `lib/shared/__tests__/equivalente-bs.test.ts`
- `lib/studio/__tests__/fx-rates-por-fecha.test.ts`
- `app/studio/_components/EquivalenteBs.test.tsx`
- `app/studio/(app)/cobranzas/_components/CobranzasClient.bs.test.tsx`

Documentos: esta spec, `docs/specs/README.md` (índice regenerado) y `.agents/handoffs/0629-equivalente-bs-solo-visual.md`.

Fuera de la allowlist, por frontera con el Worker 0630: `run_report_command`, `StudioInvoicePaymentReports`, `payment-report-actions.ts`, `app/portal/(app)/facturas/[code]/reportar/`, el esquema de `payment_receipts`, `register_collection_receipt` y `receipt-posting.ts`.

## Criterios de aceptación

1. Con una tasa del día, cada superficie de la tabla muestra «≈ Bs …», la tasa con 4 decimales, la fuente y la fecha.
2. Con una tasa de un día anterior, muestra el monto con esa tasa, su fecha y el aviso.
3. Sin tasa, muestra «tasa no disponible» y ningún cero; el portal no menciona Admin.
4. En VES y CNY no muestra nada; en USDT sí (1:1).
5. El recibo impreso y los PDF no cambian.
6. Pruebas unitarias del helper (exactitud, falla cerrada, tasa futura), de la lectura (una RPC por fecha, VES, tenant, null en error) y de los dos componentes y de Cobranzas, con y sin tasa y con tasa vieja. Montos inventados.
7. `pnpm verify` registrado en el handoff.

## Fuera de alcance

- La facturación fiscal en Bs (libro de ventas, IGTF, documentos fiscales con monto en Bs).
- El equivalente en los PDF y en el papel (ver arriba).
- La carga automática del BCV (#527).
- Equivalentes en otras pantallas (Contabilidad, Dirección, Reportes, móvil) y en CNY.
- Cambiar el formato de número a es-VE.

## Gobernanza

- VIS-01/VIS-02: texto secundario con tokens existentes (`--ink-soft`, `--ink-side-soft`, `text-grey-500`); el monto en Bs nunca compite con el USD (13 px frente a 24–42 px). Cumplimiento.
- ERR-01: la falta de tasa dice qué pasa y, en el Studio, qué hacer. Cumplimiento.
- CMP-01: dos componentes de presentación nuevos sin estado, uno por superficie (tokens distintos), con un solo texto compartido. No reemplazan ningún componente `canonical`.
- Datos personales: no se capturan ni se mueven datos personales. No aplica `revisar-datos-ve`.
