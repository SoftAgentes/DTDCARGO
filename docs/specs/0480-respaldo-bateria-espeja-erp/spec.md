---
id: 0480
slug: respaldo-bateria-espeja-erp
status: reserved
related: ["0475"]
---

# SDD-0480 — El recargo de baterías del respaldo vuelve a espejar el ERP

**RESERVA DE NÚMERO.** El contenido real lo escribe la sesión asignada en su
rama de trabajo. Este stub sólo existe para que el número quede tomado.

Reservado por coordinación el 2026-09-18, sobre `56fa2ae0`. Sin migración.

## El problema, en una línea

`CONFIG.recargoBateriaMult` vale `1.3` en `lib/calculadora.ts`, y el ERP sirve
`1.5`. Si Supabase se cae, los envíos con batería se cotizan 13,3 % por debajo.
Es el mismo modo de falla que resolvió la SDD-0475 para `tarifaBaseCBM`, y su
test de anclaje no cubre este valor.

## Alcance verificado

El 2026-09-18 se compararon todos los campos numéricos de `CONFIG` contra las
props públicas de `/tarifas` en producción: 9 alineados y éste el único
desalineado. Con esta tarea no queda ningún espejo desalineado conocido.
