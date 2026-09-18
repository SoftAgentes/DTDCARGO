---
id: 0478
slug: tarifa-programada-a-futuro
status: reserved
related: ["0255", "0336", "0475", "0476"]
---

# SDD-0478 — Programar una tarifa futura sin dejar el sitio sin tarifa

**RESERVA DE NÚMERO.** El contenido real lo escribe el Worker asignado en su
rama de trabajo. Este stub sólo existe para que el número quede tomado.

Reservado por coordinación el 2026-09-18, sobre `78410913`.
Migración asignada, si la tarea la necesita: `0459`.

## El problema, en una línea

El índice `rates_one_public_cbm_per_tenant_modo` admite una sola tarifa pública
con precio por modalidad. Para dejar lista la tarifa que rija después del
2026-11-29 hay que despublicar la vigente, y en el intervalo el sitio no tiene
tarifa pública.

Hallazgo registrado como FUERA DE ALCANCE nº1 del handoff de SDD-0476.

## Fecha que lo vuelve urgente

La tarifa DDP vigente ($850) vale hasta el **2026-11-29**. La siguiente tiene que
poder cargarse antes de esa fecha sin abrir un hueco.
