---
sdd: "0239"
title: "El POD del camionero cierra el embarque"
status: in-progress
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

Se recomendó **B**. **El founder eligió A** (2026-08-02), con el riesgo planteado por
escrito antes de decidir. Queda asentado acá y en la cabecera de la migración para que
dentro de seis meses conste que fue deliberado y no un descuido.

**Cómo se implementa A sin romper la gobernanza.** El guard de 0321 **no se toca**: el
chequeo de `auth.uid()` vive dentro del RPC, no en el trigger, y el trigger sólo exige
las variables de sesión y su allowlist de columnas. Así que se agrega un **segundo
camino autorizado** —`camionero_pod_v2`— con su propia verificación de identidad
(`operario_pins`, región VE, rol camionero/supervisor, activo) y su propia entrada de
auditoría con `actor_type='operario'`, un tipo de actor que el contrato de auditoría
**ya soporta** (45 usos en el repo). El guard sigue siendo el punto de control.

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

- RPC nuevo `camionero_pod_v2` (migración `0336`) que, además de grabar el POD:
  1. valida la identidad del operario igual que v1;
  2. **aborta entera** si algún paquete de la OD no resuelve a un embarque — ni
     siquiera queda el POD (§3);
  3. cierra cada embarque **cuyos paquetes en esa OD estén TODOS en `entregado`**,
     seteando las variables de sesión que exige el guard de 0321;
  4. deja evento en `shipment_events` (con `created_by` NULL: esa columna referencia
     `auth.users` y el camionero entra con PIN) y audita con `actor_type='operario'`,
     `sealed_dispatch_pod: true`;
  5. conserva el GPS del POD.
- `camionero_pod` (v1) queda, marcado como deprecado **condicionalmente**, para no
  romper una PWA vieja en campo. No se borra en esta spec.

**Dos correcciones que sólo aparecieron al implementar:**

1. **La firma viva de `camionero_pod` tiene 12 argumentos, no 8.** La de 0025 fue
   *dropeada* por `0068_pod_partial_and_gps_addons.sql:69`, que la recreó con GPS
   (`pod_lat`, `pod_lng`, `pod_accuracy_m`, `pod_gps_status`). La v2 espeja la viva.
2. **Existe POD parcial por paquete.** 0068 agregó
   `dispatch_order_packages.delivery_status` (`pendiente|entregado|rechazado|retornado`).
   Por eso el criterio de cierre no es "hay POD" sino "todos los paquetes de ese
   embarque quedaron `entregado`": un paquete retornado significa que esa entrega no
   se completó. Eso **no** es error —es una entrega parcial legítima— a diferencia del
   vínculo faltante, que sí aborta.
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

`0336_pod_closes_shipment.sql` — **escrita y verificada localmente, NO aplicada a
producción**. Aplicarla requiere el OK del founder nombrándola
(`docs/runbooks/aplicar-migraciones-prod.md`).

Verificación local: `check-schema-rebuild` la aplica desde cero sobre un Postgres
limpio (311 migraciones) y el contrato `supabase/tests/0336_pod_closes_shipment.test.sql`
cubre los tres caminos —fallo fuerte, cierre gobernado con auditoría de operario, y
entrega parcial que NO cierra— más los grants. Validado con mutación: al desactivar el
fallo fuerte el contrato se pone rojo.

## 7. Criterios de aceptación

1. Un POD sobre una OD cuyos paquetes resuelven a un embarque deja ese embarque en
   `delivered`, con `pod_signed_by` = receptor y un evento en `shipment_events`.
2. Un POD que no resuelve **no** crea fila en `dispatch_pods` y devuelve un error
   nombrando el paquete que falló.
3. Con `DTD_POD_CLOSES_SHIPMENT` apagado, el comportamiento es idéntico al de hoy.
4. `node scripts/run-sql-tests.mjs` y `node scripts/check-schema-rebuild.mjs` verdes.
