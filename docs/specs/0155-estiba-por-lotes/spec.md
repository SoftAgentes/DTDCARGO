---
sdd: "0155"
title: "Estiba por lotes · escanear una caja monta el lote; posición por orden de carga"
status: in-progress
author: "founder"
created: 2026-07-17
updated: 2026-07-17
supersedes: "0152"
superseded_by: null
related: ["0152", "0153", "0154", "0047"]
confidencialidad: interno
---

# DTD-0155 — Estiba por lotes

## 1. Resumen en una línea

Al montar, el operario **escanea una caja** → el sistema dice **"es un lote de 12"** →
confirma la cantidad → **se montan las 12 de un golpe**. La posición a lo largo del
contenedor **la da el orden de carga** (la primera va al fondo); el operario solo elige
**izquierda / centro / derecha**.

## 2. Por qué reemplaza a SDD-0152

SDD-0152 modeló la estiba **caja por caja** con un tapeo de **1 de 18 zonas**
(fondo/medio/puerta × piso/arriba × izq/centro/der). Está en producción pero **nunca se
ejercitó con carga real** (medido 17-jul: 0 posiciones, 0 consolidaciones). El founder
describió el modelo real, que es más simple y más rápido en el galpón:

> "El operario escanea una caja. El sistema le indica que es un lote de 12. Las cuenta,
> confirma y se montan las 12. Como es la primera carga, va al fondo; el sistema le permite
> elegir si a la derecha, izquierda o el medio, nada más. De ahí, otra caja y lo mismo…
> puede dejar todo en modo por lotes y las vamos subiendo."

Como la tabla `consolidation_box_positions` está **vacía**, se reforma sin migrar datos.

## 3. El modelo

- **Lote** = las cajas de una misma **compra** (`prealerta_id`) que están **recibidas** en
  el almacén y **todavía sin montar**. Escanear cualquier caja del lote lo identifica entero.
- **Dos modos** (elección del operario, se puede fijar):
  - **Lote completo** — escanea 1, confirma "12", se montan las 12.
  - **Caja por caja** — el mismo RPC con cantidad = 1.
- **Posición a lo largo (fondo→puerta): automática por orden de carga.** No la tapea el
  operario. El primer lote montado es `load_order = 0` (fondo), el siguiente `1`, y así.
  El visor los dibuja de atrás hacia adelante en ese orden.
- **Posición al ancho: izquierda / centro / derecha (0/1/2).** Es lo ÚNICO que elige el
  operario por lote.
- **Altura: no se usa.** El founder no la menciona; se guarda 0 por compatibilidad.
- **Lote partido:** si de 20 solo caben 11, se montan 11 y **las 9 quedan recibidas sin
  montar** → disponibles para el próximo contenedor. No hay que hacer nada especial: las
  no-montadas siguen en el almacén. Eso genera "dos envíos en dos contenedores".

## 4. Datos (migración 0246, tabla vacía → ALTER limpio)

`consolidation_box_positions` gana:
- `load_order int` — el slot de profundidad, 0,1,2… por consolidación (orden de carga).
- `width_pos smallint check in (0,1,2)` — izq/centro/der.
- `lot_prealerta_id uuid` — la compra del lote (para agrupar en el visor).

Se conservan `zx/zy/zz` por compatibilidad con el visor de 0152, mapeados con la semántica
nueva: `zx = load_order`, `zy = 0`, `zz = width_pos`. El `zone_code` generado sigue válido.

**RPC `stuff_lot_as_operario(p_operario_id, p_consolidation_id, p_scanned_code, p_width, p_count)`**
(SECURITY DEFINER + service_role):
- valida operario CN, consolidación `consolidando`, caja **recibida** (el trigger
  `require_recibida` de 0244 lo refuerza) y sin montar;
- resuelve el lote por `prealerta_id`; `p_count` default = tamaño del lote, recortable
  (lote partido);
- `load_order` = siguiente por consolidación; monta las primeras `p_count` cajas por seq;
- devuelve `{lot_size, stuffed, remaining, load_order, width, prealerta_code, client}`.

**RPC `unstuff_lot_as_operario`** — deshace el último lote montado (corrección).

`stuff_box_as_operario` / `unstuff_box_as_operario` de 0241 **quedan** (sin datos, no
estorban) pero la pantalla nueva usa el RPC de lote.

## 5. Pantalla (mobile · `/m/cn/estibar/[consolidationId]`)

Rehace el flujo de 0152: escanear → **"Lote de N · <cliente> · compra <code>"** → toggle
**Lote completo / Caja por caja** + input de cantidad (para el lote partido) → botones
grandes **Izq / Centro / Der** → confirmar. Progreso "montadas X". El visor pasa a
dibujar por orden de carga (profundidad) × ancho (3), no las 18 zonas fijas.

## 6. Fuera de scope

- El aviso al cliente (mismo pendiente honesto que 0154).
- Balanceo de peso / capacidad automática: el CBM/tope de contenedor (66,4 CBM del
  workflow 40'HQ) puede avisar "ya no cabe", pero decidir el corte del lote partido lo
  hace el operario, no el sistema.

## 7. Verificación

1. `node scripts/verify.mjs` verde (con `migrations-applied` tras aplicar 0246).
2. Unit: tamaño de lote; lote partido (stuff < lot_size deja el resto sin montar);
   `load_order` incremental; el trigger `require_recibida` bloquea una caja no recibida.
3. Aplicar `0246` con OK del founder nombrándola.
4. Prueba con **carga real**, sin datos de prueba en prod. Al pasar → 0152 y 0155 a `done`
   en el mismo commit (0152 queda `superseded` por 0155).
