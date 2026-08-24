---
sdd: "0283"
title: "El aviso al cliente puede colgar de una compra, no sólo de un envío"
status: in-progress
author: "founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0156","0162","0281","0282"]
confidencialidad: interno
---

# DTD-0283 — El aviso cuelga de la compra

> La cura de raíz de SDD-0282. El cliente cuya carga llega a Yiwu antes de que
> exista su envío deja de quedarse sin aviso.

## Contexto

SDD-0282 hizo **visible** el problema: cuando el fan-out de la recepción no
encontraba un envío abierto para el Shipping Mark, descartaba el aviso y ahora
al menos deja una nota en la bitácora de la recepción.

Pero la causa de fondo es de schema:

```sql
shipment_id uuid not null references public.shipments(id)  -- migr 0247
```

Un aviso sólo puede existir si ya hay un envío. Y el momento en que el cliente
más quiere saber algo —"mi carga llegó a la bodega de Yiwu"— ocurre **antes** de
que el envío exista: el envío nace al consolidar, semanas después de que el
proveedor entregue. Ese hueco no es un caso raro: es el **normal en una primera
compra**.

## Alcance

### Entra

1. **Migración 0389** — `shipment_id` nullable, `prealerta_id` nuevo, CHECK de
   una sola ancla, e idempotencia partida en dos índices parciales.
2. **El motor acepta las dos anclas.** `ClientDomainEvent.ancla` pasa a ser una
   unión discriminada (`shipment` | `prealerta`), que es la forma honesta: la
   base ya lo garantiza con un CHECK, el tipo no debería permitir lo que la base
   rechaza.
3. **El fan-out de la recepción usa la compra cuando no hay envío.**
4. **El drain lleva al lugar correcto.** El aviso de una compra enlaza a
   `/portal/compras/[code]` (SDD-0281) y el correo dice "Compra", no "Envío".

### Decisiones

**El `trigger_event` NO cambia.** Sigue siendo `status:in_warehouse`: significa
lo mismo cuelgue de donde cuelgue. Así el tenant que ya lo tenía configurado no
pierde nada ni tiene que volver a configurarlo — simplemente deja de perder los
casos que antes se caían.

**La migración no siembra ninguna regla.** Encender un aviso le manda correo y
push a clientes reales; eso se decide desde Administración, no desde una
migración.

**Una compra no tiene ETA ni ETD**, y no es una carencia temporal: esas fechas
nacen del itinerario de la naviera, que no existe hasta que hay contenedor. Una
regla anclada ahí sobre un aviso de compra se salta. Inventarle "ahora" la
convertiría en un aviso inmediato que nadie pidió.

**Ambigüedad → no se avisa.** En el camino de la oficina, si el cliente tiene
dos o más compras abiertas y ninguna está atada a la recepción, no se elige: el
aviso llevaría al cliente al detalle de la compra equivocada, diciéndole que
llegó algo que no llegó. Queda en la nota de la bitácora y el operador escribe a
mano.

### 🔴 El código sale ANTES que la migración, y no puede romper

Diseño aditivo deliberado, igual que el outbox del registro: si el código llega
a producción con la 0389 **sin aplicar**, el insert del aviso de compra falla con
`42703` / `PGRST204`, se registra un aviso claro que nombra la migración, y el
sistema **se comporta exactamente como antes** — el aviso por envío sigue
saliendo y el cliente sin envío cae en la nota de la bitácora de SDD-0282.

Eso está probado, no supuesto: hay un test que fuerza `faltaMigracion` y exige
que el cliente **siga contando como sin avisar**. Si ese caso se diera por
avisado, la nota desaparecería justo en el entorno donde el aviso NO se está
mandando — el peor momento posible para callarse.

## Verificación

- 115 contratos SQL en verde, incluido el de la 0389.
- La migración se validó con **dos mutaciones**: quitar el CHECK de una sola
  ancla, y dejar el índice único original en vez de los dos parciales. Cada una
  pone el contrato en rojo con un mensaje distinto.
- El fallback de "falta la migración" también se validó con mutación.

## Aplicada

✅ **La migración 0389 está aplicada en producción** (2026-08-24), con el OK del
founder nombrándola y siguiendo el runbook: de a una, con el `name` = basename
exacto del archivo (`0389_aviso_que_cuelga_de_la_compra`).

Se sondeó ANTES (`prealerta_id` ausente, `shipment_id` NOT NULL, sin CHECK, con
el índice viejo, **0 filas en la cola** → riesgo cero sobre datos) y se verificó
DESPUÉS contra la base, no contra el `{"success": true}` de la herramienta:

| Chequeo | Resultado |
|---|---|
| `prealerta_id` existe | ✓ |
| `shipment_id` nullable | `YES` |
| CHECK de una sola ancla | `num_nonnulls(shipment_id, prealerta_id) = 1` |
| CHECK **validado** (no `NOT VALID`) | `true` |
| Índice viejo borrado | ✓ |
| Índices nuevos (envío · compra · búsqueda) | 3/3 |
| FK `on delete` | `c` = CASCADE |
| En el ledger | `0389_aviso_que_cuelga_de_la_compra` |

El paso `migrations-applied` del gate quedó en verde: *"no hay migraciones nuevas
sin aplicar"* (386 archivos · 396 en el ledger).

⚠️ **Falta encender la regla.** La migración habilita el camino pero **no siembra
ninguna regla de notificación** — a propósito. Hasta que el founder encienda el
aviso `status:in_warehouse` desde Administración, el motor programa contra la
compra pero no hay regla activa que despachar.

## Adjuntos

Ninguno.
