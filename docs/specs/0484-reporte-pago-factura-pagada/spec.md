---
id: 0484
slug: reporte-pago-factura-pagada
status: reserved
related: ["0365", "0421"]
---

# SDD-0484 — Los comandos de reportes de pago frente a una factura ya pagada

**RESERVA DE NÚMERO.** El contenido real lo escribe la sesión asignada en su
propia rama de trabajo. Este stub sólo existe para que el número quede tomado.

Reservado por coordinación el 2026-09-18, sobre `1d80c18a`. Migración
reservada: **`0464`**.

## Lo que se verifica

Dos posibles defectos de `0421_payment_report_commands.sql`, que está aplicada
en producción (ledger `20260913224126`) y no se edita:

1. La función que ejecuta los comandos rechaza facturas borradas, en borrador o
   anuladas, pero no revisa si la factura ya está pagada.
2. El motivo de cancelación de un reporte no se guardaría en ningún lado.

Si se confirman, el arreglo va en la migración `0464`, que reemplaza la función.
La regla de negocio para una factura pagada la decide Sam.

## Orden frente a L14

`0422` y `0423` esperan en `pendingBelowCutoff` el smoke de los comandos, y sus
preflights leen el estado que dejó la 0421. La `0464` no puede romper esos
preflights: su lugar en el orden se decide con el Director antes de publicar.
