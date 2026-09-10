# 0449 aplicada a producción — 2026-09-10

Tarea: aplicar `0449_prealerta_exact_box_reception`. Ejecutada por el Director con
autorización nominal de Sam («aplica la 0449 también»), conforme a
`docs/runbooks/aplicar-migraciones-prod.md`.

## Resultado

**APLICADA.** Ledger de prod: 412 → 413, con el basename exacto.

## LO MÁS IMPORTANTE: la recepción de Yiwu NO cambió hoy

Esta migración arrastraba desde el inicio la condición «avisar a Yiwu antes, porque cambia
cómo reciben». **Verificado antes de aplicar: hoy no cambia nada de la recepción.**

- 0449 crea `receive_prealerta_boxes_as_operario`. **No menciona ni toca
  `receive_prealerta_as_operario`**, que es la RPC que el código de `main` llama desde que la
  PR #40 revirtió la recepción CN.
- Comprobado después: la RPC vieja **sigue viva** en producción.
- O sea: la función nueva quedó creada y **nadie la llama**. La exigencia de códigos de caja
  exactos permanece dormida hasta que una PR cambie el código para llamarla.

**El aviso a Yiwu sigue haciendo falta, pero para ese cambio de código, no para esta
migración.** Aplicarla hoy no altera cómo escanean.

## Lo que SÍ se activó de inmediato

1. **Trigger `packing_list_reconcile_labels`** sobre `packing_list_submissions` — camino vivo:
   6 envíos, los 6 en los últimos 30 días. Al recibir un packing list del proveedor,
   sincroniza `prealertas.boxes` con lo declarado. Está bien guardado: no hace nada si la
   compra está cerrada, si el conteo sale de 1..1000, o si **ya hay alguna caja recibida**.
2. **El editor de etiquetas del Studio pasa a funcionar.** Estaba deshabilitado por diseño
   («guardar requiere habilitar la migración del PR») porque `shipping_label_versions` no
   existía. Ahora existe.

## Integridad de la transcripción

247 líneas por el conector. md5 de los tres cuerpos calculados **desde el archivo antes de
aplicar** y comparados después:

| función | resultado |
|---|---|
| `receive_prealerta_boxes_as_operario` | **coincide** |
| `save_shipping_label_presentation` | **coincide** |
| `reconcile_labels_after_packing_list` | **coincide** |

## Verificación posterior, contra el OBJETO

| comprobación | resultado |
|---|---|
| dueño de las tres funciones | `postgres` |
| `shipping_label_versions` | creada, **RLS activa**, 2 policies, 0 filas |
| trigger en `packing_list_submissions` | 0 → 1, **HABILITADO** |
| `receive_prealerta_as_operario` (la vieja) | **sigue viva** |
| ledger | 412 → **413**, basename exacto |
| datos de negocio | 27 prealertas · 177 cajas vivas · 6 packing lists — **sin cambio** |

Sin preflight propio: la migración no trae bloque de aborto. Se verificaron a mano las 12
dependencias (tablas, tipos enumerados, columnas y `get_user_tenant_id()`) antes de escribir.

## Efecto sobre el gate de SDD-0450

`pending-migration-symbols` pasó de **1 AMARILLO a 0 ROJO · 0 AMARILLO**: los símbolos
`shipping_label_versions` y `save_shipping_label_presentation` ya existen en producción. Se
retiró su declaración de degradación de `supabase/pending-migration-symbol-declarations.json`,
que es lo que el propio `$doc` de ese archivo manda al dejar de estar pendiente la migración.

## Este cambio

Saca `0449_prealerta_exact_box_reception` de `pendingBelowCutoff`. Pendientes declarados:
**14 → 13**. **El `cutoff` no se toca**, sigue en 238.

## PENDIENTES DE ESTA TAREA

Ninguno de aplicación.

## FUERA DE ALCANCE DETECTADO

- **`humanizeReceiveError` no traduce `P0136` ni `P0137`**, que son los dos errores que emite
  la RPC nueva —«selecciona las cajas presentes, incluida la escaneada» y «las cajas cambiaron
  o ya fueron recibidas»— y los más probables del flujo nuevo. Hoy es inocuo porque nadie la
  llama; **quien cambie el código para usarla tiene que cerrar esto en la misma PR**, o el
  operario volverá a ver un mensaje genérico ante un fallo con causa concreta.
- La cabecera del propio archivo dice «prepares SQL only, no production application». Era un
  comentario de cuando se escribió; la autorización de Sam lo supera, pero conviene corregir
  esa línea para que no contradiga el estado real.
- Quedan **13 migraciones declaradas pendientes**.
