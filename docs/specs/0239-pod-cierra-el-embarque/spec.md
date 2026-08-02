---
sdd: "0239"
title: "El POD del camionero cierra el embarque"
status: proposed
author: "Sam (founder) + Claude"
created: 2026-08-02
updated: 2026-08-02
supersedes: null
superseded_by: null
related: ["0025", "0030", "0156", "0321"]
confidencialidad: interna
---

# SDD-0239 · El POD del camionero cierra el embarque

## 1. El problema

`camionero_pod` graba foto, firma y receptor en `dispatch_pods` y **ahí termina**.
No toca `shipments`, no inserta en `shipment_events`, no programa aviso al cliente.
`camionero_advance_od` —que según el comentario del propio RPC "cambia el status
cuando es la última entrega"— sólo actualiza `dispatch_orders`.

Mientras tanto, el módulo Tracking **bloquea el estado `delivered` a mano** y le dice
al operador *"usa el POD sellado de Despacho"*. Es una promesa que el código no
cumple: por ese camino el embarque no se cierra nunca.

### 1.1 Estado real medido (2026-08-02, producción)

| Tabla | Filas |
|---|---|
| `dispatch_orders` | 0 |
| `dispatch_order_packages` | 0 |
| `dispatch_pods` | 0 |
| `warehouse_receipts_cn` con `shipment_id` | 0 de 6 |
| `shipments` en `delivered` | 4 (todos por `/studio/ve`) |

**El flujo nunca se ha usado.** No se están perdiendo entregas. Esto se arregla
*antes* de que se use, no *porque* esté sangrando — y esa distinción es la que
permite hacerlo bien en vez de rápido.

## 2. Lo que restringe la solución

### 2.1 El hito de entrega es gobernado, terminal e inmutable

La migración 0321 instaló `guard_ve_delivery_completion` sobre `shipments`. Para
pasar a `delivered` exige:

1. `dtd.ve_delivery_completion` (request_ref) seteada en la sesión;
2. `dtd.ve_delivery_completion_shipment` igual al `id` del embarque;
3. que el UPDATE **sólo** toque `status`, `delivered_at`, `pod_signed_by`,
   `updated_at`;
4. y una vez en `delivered`, **cualquier** cambio posterior se rechaza.

O sea: **el único camino legal es `complete_ve_delivery_governed`**, y marcar el
embarque equivocado **no se deshace**. Esto descarta de plano un `update shipments`
desde `camionero_pod`.

### 2.2 🔴 El camionero no tiene identidad para cerrar la entrega

`complete_ve_delivery_governed` arranca con:

```sql
v_actor uuid := auth.uid();
if v_actor is null then raise exception 've: autenticación requerida'; end if;
...
join public.user_tenants ut
  on ut.user_id = v_actor
 and ut.role in ('admin', 'operations', 'warehouse')
```

Exige **un usuario con sesión de Supabase y rol de ERP**. El camionero entra con
**PIN**: vive en `operario_pins`, deliberadamente fuera de `user_tenants`, y no tiene
`auth.uid()`.

**`camionero_pod` no puede llamar a ese RPC.** No es un detalle de implementación: la
gobernanza de 0321 decidió, a propósito, que sólo admin/operations/warehouse producen
un hito de entrega terminal e irreversible. El camionero está excluido por diseño.

Esto deja dos caminos, y **elegir es una decisión de autorización, no de código**:

| | Camino | Qué implica |
|---|---|---|
| **A** | Extender 0321 para aceptar a un operario como actor | Le da a un PIN de 4 dígitos el poder de producir un hito **irreversible**. Debilita a propósito un contrato que la gobernanza endureció. Necesita su propia entrada de auditoría con la identidad del operario. |
| **B** | El POD deja el embarque *listo para cerrar*; el cierre lo confirma escritorio | Mantiene al humano con rol en el lazo. El camionero no espera: su POD queda grabado y sellado. Cuesta un paso más y un aviso a la oficina. |

**Recomendación: B.** El costo de A es que un teléfono perdido con el PIN puede cerrar
entregas que no se deshacen; el costo de B es un clic de oficina. En un ERP donde la
entrega dispara avisos al cliente y cierra el ciclo de cobro, el clic es más barato
que lo irreversible.

**Esta spec queda bloqueada en esta decisión.** El §4 describe el camino A porque era
el diseño supuesto antes de encontrar el muro; se reescribe según lo que se decida.

### 2.3 La cadena POD → embarque existe pero está vacía

```
dispatch_pods.od_id
  → dispatch_order_packages (package_kind + package_id · FK POLIMÓRFICO)
    → warehouse_receipts_cn.shipment_id   ← nullable, poblado al 0%
      → shipments.id
```

`dispatch_order_packages` denormaliza `markbox`, que identifica al **cliente**, no al
embarque: un cliente puede tener varios embarques en vuelo. No sirve para resolver.

El comentario de esa tabla dice *"FK polimórfico (FK explícito en SDD-0030)"*.
**SDD-0030 está marcada `done` y esa parte nunca se construyó.** La deuda de este
POD y ese `done` falso son el mismo problema.

## 3. Decisión de diseño: fallar fuerte, no en silencio

Si el POD no puede resolver a qué embarque pertenece, **la operación falla con error
explícito**. No se salta el cierre, no se registra "parcial", no se deja para después.

**Por qué.** Con `shipment_id` al 0%, un cierre "best-effort" resolvería a `NULL`
siempre y el resultado sería un no-op silencioso: la UI diría entregado, el embarque
seguiría abierto y nadie se enteraría. Es exactamente el defecto que esta spec viene
a corregir, reintroducido con otra cara. Un error ruidoso en la PWA del camionero se
diagnostica en minutos; un cierre que no cierra se descubre cuando reclama el cliente.

**Consecuencia aceptada:** hasta que `warehouse_receipts_cn.shipment_id` se pueble, el
POD con cierre **rechazará** la confirmación. Por eso el comportamiento va detrás de
un flag (§5) y el poblado del vínculo es requisito de activación, no trabajo posterior.

## 4. Alcance

### 4.1 Entra

- RPC nuevo `camionero_pod_v2` que, además de grabar el POD:
  1. resuelve los embarques de la OD por la cadena de §2.2;
  2. si algún paquete no resuelve → **excepción**, transacción abortada, sin POD;
  3. por cada embarque cuyos paquetes en esa OD quedaron todos entregados, llama a
     `complete_ve_delivery_governed` con el `request_ref` del POD;
  4. el aviso al cliente sale por el motor de SDD-0156, que ese RPC ya dispara.
- `camionero_pod` (v1) queda, marcado como deprecado, para no romper una PWA vieja
  en campo. No se borra en esta spec.
- Contrato SQL que prueba: (a) POD que resuelve → embarque `delivered` + evento;
  (b) POD que no resuelve → excepción y **cero** filas en `dispatch_pods`;
  (c) segundo POD sobre embarque ya entregado → rechazado por el guard.

### 4.2 No entra

- **Poblar `warehouse_receipts_cn.shipment_id`.** Es trabajo de datos y de SDD-0030;
  acá sólo se consume el vínculo.
- Convertir el FK polimórfico en explícito (SDD-0030).
- Entregas parciales por paquete (`dispatch_pods.package_id` sigue nullable, V2).
- Tocar `warehouse_receipts_ve` como fuente de la cola de despacho.

## 5. Activación

Flag `DTD_POD_CLOSES_SHIPMENT`, **apagado por defecto**. Con el flag apagado la PWA
sigue llamando a `camionero_pod` v1 y nada cambia. Requisitos para encenderlo:

1. `warehouse_receipts_cn.shipment_id` poblado para las recepciones vivas;
2. una entrega de prueba de punta a punta en un tenant de prueba;
3. OK del founder nombrando la migración, según el runbook de migraciones a prod.

## 6. Migración

`0336_pod_closes_shipment.sql` — **escrita, no aplicada**. Aplicarla a producción
requiere el OK del founder nombrándola (`docs/runbooks/aplicar-migraciones-prod.md`).

## 7. Criterios de aceptación

1. Un POD sobre una OD cuyos paquetes resuelven a un embarque deja ese embarque en
   `delivered`, con `pod_signed_by` = receptor y un evento en `shipment_events`.
2. Un POD que no resuelve **no** crea fila en `dispatch_pods` y devuelve un error
   nombrando el paquete que falló.
3. Con `DTD_POD_CLOSES_SHIPMENT` apagado, el comportamiento es idéntico al de hoy.
4. `node scripts/run-sql-tests.mjs` y `node scripts/check-schema-rebuild.mjs` verdes.
