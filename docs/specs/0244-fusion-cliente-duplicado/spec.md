---
sdd: "0244"
title: "Fusión de cliente duplicado y prevención del Shipping Mark repetido"
status: done
author: "Sam (founder) + Claude"
created: 2026-08-03
updated: 2026-08-03
supersedes: null
superseded_by: null
related: ["0010", "0042", "0046", "0059", "0106", "0131", "0225"]
confidencialidad: interno
---

# SDD-0244 — Fusión de cliente duplicado y prevención del Shipping Mark repetido

## 1. El problema

Un cliente que **ya existe** entra a `/registro`, se registra como si fuera nuevo,
y el sistema le emite un **Shipping Mark nuevo**. Queda con dos identidades y dos
códigos: el viejo, que carga su historial, y el nuevo, que es el que acaba de
anotar y el que le va a pasar a su proveedor en Yiwu.

## 2. Diagnóstico medido en producción (2026-08-03)

Conteos agregados sobre `public.clients` (429 filas vivas):

| Familia de código | Cuántos | Origen |
|---|---|---|
| `DTD-A###` (letra + 3 dígitos) | 360 | Legado importado. Cero self-service |
| `DTD-####` (4 dígitos) | 58 | Los emite `next_markbox`. **51 del registro público** |
| Otros (`ITS-##`, `AD-###`, sueltos) | 11 | Residuos de migración |

### 2.1 El generador es ciego al legado

`next_markbox` y `next_markbox_service` calculan el correlativo con
`max((regexp_match(markbox, '^DTD-(\d+)$'))[1]::int) + 1`
(`0012_rls_perf_and_rpc_guards.sql:78`, `0109_next_markbox_service.sql:34`).

Ese regex **no matchea `DTD-A123`**, así que los 360 legados son invisibles para
el correlativo. Los dos mundos numéricos son independientes.

**Consecuencia buena:** hoy **no hay riesgo de reemitir un número ocupado**.
**Consecuencia a preservar:** ninguna de las dos funciones filtra `deleted_at`, así
que **un código soft-deleted queda quemado y no se reemite**. Esta spec depende de
esa propiedad y **no la toca**.

### 2.2 Por qué el dedup actual no los atrapa

El dedup de `app/registro/actions.ts:157` compara **sólo el documento** (`rif`).

- **144 legados no tienen documento cargado.** De esos, 27 tienen correo, 27
  tienen teléfono y **98 no tienen ninguna de las tres cosas**.
- Y cuando el documento sí está, **suele estar corrupto por la exportación de
  Excel**. Casos reales: `2108108.0` (Excel lo leyó como número y le añadió `.0`)
  y `123456/822326660` (dos valores concatenados). Ninguna normalización razonable
  hace match entre `2108108.0` y `V-20108108`.

**El correo y el teléfono son mejores llaves que el documento para el legado.**

### 2.3 Daño real hoy: 3 duplicados

| Viejo | Nuevo | Coincide por |
|---|---|---|
| `DTD-Y009` | `DTD-9009` | correo + teléfono + nombre |
| `DTD-A098` | `DTD-9017` | correo + teléfono |
| `DTD-J000` | `DTD-9001` | **sólo nombre** |

El tercero es débil: el viejo no tiene correo, teléfono ni documento, y el nombre
es común. **No se fusiona sin confirmación humana.**

Además, todos los legados tienen `created_at = 2026-06-12` — es la fecha de la
importación, no del alta. En el caso de `DTD-J000` el registro "nuevo" es del
**08-jun**, *anterior*: ese duplicado **lo creó la importación, no el registro**.
Por eso **la antigüedad de la fila no sirve para elegir superviviente**.

## 3. Decisión de diseño

### 3.1 No se renumera. Se fusiona.

`clients.markbox` **no es una referencia, es un valor copiado**. Se snapshotea
dentro de facturas (`lib/studio/invoice-types.ts:348`), expedientes sellados
(`lib/studio/legal/seal.ts:103`), prealertas, despachos, aduana, pagos y cobranzas.

Por eso **queda prohibido** `update clients set markbox = …` sobre una fila con
historial: las facturas y los expedientes quedarían apuntando a un texto que ya no
existe, y **un expediente sellado no se reescribe** — para eso está el sello.

### 3.2 Superviviente = el viejo. Datos ganadores = los del nuevo.

Gana el registro viejo **por su código**, porque carga el historial y porque es el
código que el cliente ya le pasó a su proveedor. Pero **los datos limpios los trae
el registro nuevo** (documento bien formado, correo, teléfono normalizado), así
que la fusión **los copia al superviviente donde éste los tenga vacíos**.

Esto es lo que convierte la fusión en una mejora de la base y no sólo en una
limpieza: cada fusión rellena uno de los 144 sin documento.

### 3.3 El código nuevo no se borra: se retira, y la propia fila es el alias

Entre que el cliente se registra y que alguien fusiona, **pudo darle ese código a
su proveedor en Yiwu y ya venir un bulto rotulado así**. Si el código deja de
existir, esa caja llega huérfana.

**No hace falta una tabla de alias.** `clients_tenant_id_markbox_key` es
`UNIQUE (tenant_id, markbox)` **sin** filtro de `deleted_at`, así que la ficha
fusionada **retiene su markbox** aunque quede soft-deleted. La propia fila es el
alias y `merged_into_client_id` es el redirect: una columna en vez de una tabla
nueva, sin superficie de RLS extra y sin riesgo de desincronización.

Y como `next_markbox` hace `max()+1` **sin** filtrar `deleted_at`, el código
retirado queda **quemado**: doble protección contra reemitirlo.

La recepción de almacén resuelve el redirect con `resolve_markbox`.

### 3.4 La fusión nunca es automática

El sistema **propone** candidatos con su razón de coincidencia; un humano
**confirma**. El caso `DTD-J000` es la prueba de por qué.

## 4. Alcance

### Parte A — Prevención (que no se emita el código)

1. Bifurcación al entrar a `/registro`: *"¿Ya eres cliente de DTD Cargo?"* → Sí
   lleva a recuperar acceso; No sigue al registro.
2. Dedup ampliado en `app/registro/actions.ts`: además del documento, **correo
   normalizado** y **teléfono normalizado** (últimos 7 dígitos).
3. Mismo dedup en `app/api/registro/check/route.ts`, **manteniendo el contrato
   `{ exists: boolean }`** — nunca PII (regla de privacidad ya vigente en el route).

### Parte B — Fusión (arreglar lo que ya pasó)

4. Migración `0341`: `clients.merged_into_client_id`, índices funcionales de
   dedup, y las RPC `merge_clients` (atómica), `resolve_markbox`,
   `client_duplicate_candidates` y `find_duplicate_client_service`.
   **Sin tabla de alias** — ver §3.3.
   Migración `0342`: `phone_match_key()`, porque los teléfonos de relleno del
   legado (`0000000`, `1234567`…) no identifican a nadie y como llave le
   bloqueaban el registro a un cliente nuevo real.
5. Query de candidatos a duplicado con razón de coincidencia.
6. UI en Studio › Clientes: revisar y fusionar con confirmación humana.
7. Resolución por alias en la recepción de almacén (Yiwu y VE).

### Fuera de alcance

- **Los 98 sin documento, correo ni teléfono.** No hay dedup posible por software;
  se resuelve completando la base. Es trabajo de datos, no de código.
- Renumerar el legado a `DTD-####`. No aporta y rompe códigos ya rotulados.
- Fusión automática sin humano.

### Brechas conocidas (decididas, no olvidadas)

- **`app/m/ve/camionero/actions.ts`** actualiza `clients.facade_photo_url`
  filtrando por markbox y `deleted_at is null`. Contra un código retirado eso
  afecta **0 filas en silencio** (no da error): la foto de fachada quedaría
  subida pero sin asociar. No se resolvió acá porque el markbox de ese flujo sale
  de una fila interna, no de una etiqueta física, y meterle un `resolve_markbox`
  previo le cobra un viaje extra a la DB en el camino caliente de una PWA con
  mala conexión. Se arregla cuando se toque ese módulo.
- **La bifurcación del registro es una banda, no una pantalla que obligue a
  elegir.** Es deliberado: el registro es EXPRESS por decisión de producto
  (founder 2026-06-07) y una interstitial le cobra un clic al 100% de los
  visitantes para atajar a una minoría. Si el founder prefiere el portón duro, es
  un cambio de una pantalla — la capa que de verdad no se puede saltar (el dedup
  del servidor) ya está.

## 5. Criterios de aceptación

- [x] Un legado con correo o teléfono conocido que intenta registrarse **no recibe
      código nuevo**: se le ofrece recuperar acceso.
      *(`register-dedup-tres-llaves.test.ts`; verificado contra prod.)*
- [x] `/api/registro/check` sigue devolviendo **sólo** `{ exists: boolean }`.
      *(No se tocó: se dejó document-only a propósito para no crear un oráculo de
      "¿este correo tiene cuenta?" consultable desde el navegador.)*
- [x] La fusión mueve el acceso, rellena los huecos del superviviente, retira el
      código nuevo y deja el nuevo con `merged_into_client_id`.
- [x] Un markbox retirado **sigue resolviendo** al superviviente en recepción.
      *(`warehouse-cn-markbox-retirado.test.ts`, validado con mutación.)*
- [x] Un markbox retirado **nunca se reemite** por `next_markbox`: la fila lo
      retiene y ni el unique ni el correlativo filtran `deleted_at`.
- [x] La fusión es atómica: o pasa entera o no pasa.
- [x] Ninguna factura ni expediente sellado se reescribe.
      *(`merge_clients` no toca `markbox` ni `legal_acceptances`.)*
- [x] Un teléfono de relleno **no bloquea** a un cliente nuevo real *(0342)*.

**Verificación en prod (2026-08-03):** 0341 y 0342 aplicadas con OK del founder
nombrándolas, verificadas objeto por objeto. 429 clientes, cero filas
modificadas. `find_duplicate_client_service` reconoce documento, correo y
teléfono reales, e ignora `0000000` / `1234567`.
