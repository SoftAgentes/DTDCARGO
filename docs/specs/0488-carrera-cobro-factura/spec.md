---
sdd: "0488"
title: "RESERVADO — El registro de cobros en facturas pasa a ser atómico"
status: draft
author: "Director dtdcargo-18"
created: 2026-09-18
updated: 2026-09-18
supersedes: null
superseded_by: null
related: ["0484", "0421"]
confidencialidad: interna
---

# SDD-0488 — El registro de cobros en facturas pasa a ser atómico

**RESERVA DE NÚMERO.** El contenido real lo escribe la sesión asignada en su
propia rama de trabajo. Este stub sólo existe para que el número quede tomado.

Reservado por coordinación el 2026-09-18, sobre `1b64bdae`. Migración
reservada: **`0467`**.

## El hallazgo

Lo encontró el Worker de la SDD-0484 y lo confirmó el Director leyendo el
código: `lib/studio/collections-actions.ts` lee la factura sin lock, inserta el
cobro y después escribe `paid_amount` como valor absoluto en otra llamada. Dos
cobros concurrentes, o un cobro concurrente con una confirmación de reporte de
pago, pierden una actualización. `identifyPaymentFor` y `voidReceiptFor` repiten
el patrón.

## Alcance

Una RPC que toma la factura `for update`, valida el saldo y registra o anula el
cobro en una sola transacción, con reproducción de dos sesiones reales, control
rojo y un mutante sin `for update`. La regla de saldo la decide Sam.
