---
sdd: "0310"
title: "Barrido de cables sueltos — y el guard que impide perder una caja con historia"
status: in-progress
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0152", "0309"]
confidencialidad: interno
---

# DTD-0310 — La caja con historia

> Primer resultado del barrido sistemático de «cosas a medio conectar», que
> resultó ser el patrón más rentable de la sesión.

## El barrido, en números

Cuatro categorías, medidas sobre `main`:

| Categoría | Resultado |
|---|---|
| Eventos de correo declarados **sin disparador** | **4 de 10** |
| Migraciones con función/trigger **sin contrato** | **162** |
| …de esas, con triggers de **lógica propia** | **55** |
| `TODO`/`FIXME` en código vivo | 116 |

### Los 4 eventos sin disparador

`shipment_arrived` · `no_olvidar_recovery_requested` · `agent_run_failed` ·
`lead_dormant_reengagement`.

El primero es el que importa: **«tu carga llegó»** es justo el aviso que un
cliente espera. El de No-Olvidar es esperado (el módulo está dormante por
decisión del founder). Los otros dos son internos.

**No se cablearon acá**: cada uno necesita decidir a quién avisa y con qué
datos, y eso no se resuelve barriendo.

## Lo que sí se hizo: el contrato de las cajas físicas

De las 55, se eligió la de **recepción de mercancía en China** — uno de los
cuatro módulos que el founder nombró como prioritarios.

`sync_boxes_for_receipt` materializa **una fila por caja física** con código
escaneable (`DTD-B-NNNNNN`) a partir del conteo que declara el operario, y
**reconcilia** cuando ese conteo cambia.

### 🔴 El guard que se estaba corriendo sin red

Cuando el conteo **baja**, la función borra las cajas de `seq` más alto. La
versión original (**0240**) las borraba **sin mirar nada** — en ese momento la
estiba no existía. La **0241** la reescribió agregando:

```sql
and not exists (
  select 1 from public.consolidation_box_positions p
   where p.box_id = b2.id
)
```

**Perder una caja con historia de estiba es perder dónde está la mercancía de
un cliente dentro del contenedor.** Ese guard llevaba sin contrato desde que se
escribió.

### ⚠️ Otra vez: la función vive repartida

Igual que en SDD-0309, un contrato que cargara sólo la **0240** probaría el
borrado **sin** guard y saldría verde. Producción corre la de **0241** —
verificado contra `pg_get_functiondef`, no supuesto.

Por eso el archivo se llama por la migración que hoy es dueña de la función, y
carga las dos.

## Los cinco contratos

1. Una recepción materializa una fila por caja, con códigos únicos.
2. Subir el conteo crea **sólo las que faltan** — no duplica.
3. 🔴 **Bajar el conteo NO borra una caja ya estibada.** El escenario estiba
   justo la de `seq` más alto: la que el borrado elegiría primero.
4. 🔴 El correlativo **no colisiona entre tenants** — dos cajas con el mismo
   código hacen ambiguo el escaneo en bodega.
5. Asignarle dueño a una recepción huérfana **propaga el markbox** a sus cajas.

## Verificación

1. **121 contratos SQL** en verde, incluido el nuevo.
2. **Mutación**: quitando el `not exists` del guard, el contrato 3 se pone en
   rojo con *«se borró una caja YA ESTIBADA — se pierde dónde está la
   mercancía»*.
3. Gate completo `node scripts/verify.mjs`.

## Una decisión que NO se tomó

El portal dice **«Próximamente»** sobre los créditos de referidos. Al medirlo,
**ganar** el crédito ya es automático (SDD-0309) pero **usarlo** sigue siendo
manual (lo diseña SDD-0137).

El copy parecía obsoleto y **no lo es**: su propio docblock dice *«Copy honesto
— NO mostramos un saldo en dólares como si fuera dinero disponible»*. Es una
decisión deliberada de no prometer algo que el cliente todavía no puede gastar.
Se deja como está; cambiarla es decisión del founder.

## Lo que esta spec NO puede afirmar

- **Que las otras 54 migraciones estén bien.** Sólo se cubrió una. La lista
  queda medida y disponible, no resuelta.
- **Que el trigger funcione con datos reales.** El contrato corre sobre un
  Postgres desechable con stubs de fidelidad mínima.
