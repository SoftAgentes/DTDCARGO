---
sdd: "0710"
title: "Studio · Embarques: fila con insignia de rastreo"
status: in-progress
author: "Claude (Worker) para Dir_DTD"
created: 2026-11-23
updated: 2026-11-24
supersedes: null
superseded_by: null
related: ["0603", "0688", "0709", "0522", "0560"]
confidencialidad: interno
---

# SDD-0710 — Embarques: fila con insignia de rastreo

> Pedido de Sam (2026-11-23), textual: «hay que trabajar un poquito la parte visual, ya que el "Abrir" está
> estorbando con unas letras. En realidad hay que poner como una insignia o algo de tracking, ya que "Abrir" está muy
> grande, igual que "Ver proceso", y visualmente no tiene buen aspecto». Se le dibujaron tres opciones y eligió la **A**.
> El repo es público: sin datos de clientes, montos ni secretos.

**Etiquetas de evidencia:** **C** código leído · **D** documento · **I** inferencia.

## 1. Problema

Cada fila del listado de Embarques (`EmbarquesClient.tsx`) termina en un botón `studio-btn-ghost studio-btn-sm`
«Abrir ›» de 92 px (**C**), y la fila bloqueada para eliminar repite el motivo completo en dos líneas más un segundo
botón grande, «Ver los pasos» (**C**). Con ambos, la fila se ve cargada y compite con el texto.

## 2. Comportamiento (opción A)

1. **Se quita «Abrir ›».** El **código** del embarque pasa a ser el control que abre el detalle: botón con aspecto de
   enlace, color `--accion-text`, subrayado. Mismo destino y mismo `onRowClick` que antes. Se mantiene el clic en
   cualquier parte de la fila con el ratón.
2. **Insignia «Rastrear».** Píldora pequeña con el icono de ubicación (`Icon.pin`), dentro de la celda de Progreso,
   al lado de la barra. Es un enlace a `/studio/tracking/<id>` (el mismo destino que ya usa el detalle). Borde y texto
   en `--accion-text`, sin hex nuevos. No abre el detalle al oprimirla.
3. **Aviso de bloqueo de una línea.** «No se puede eliminar: tiene X. Primero anula, elimina o desvincula eso en su
   módulo.» se muestra como «No se elimina: tiene X», con candado (`Icon.lock`) delante. «Ver los pasos» pasa a ser un
   enlace corto (`studio-emb-pasos`) en esa misma línea. El texto completo sigue en la página: queda para lectores de
   pantalla (`studio-sr-only`) y como `title`; la descripción accesible de la casilla no cambia.
4. **Columnas.** Desaparece la columna final de 92 px; la de Progreso pasa de 110 a 190 px para alojar la insignia y la
   del Código de 130 a 150 px. Encabezado y filas siguen usando las mismas columnas.

**No cambia:** permisos, datos, acciones de servidor, casillas y barra de acciones masivas, el texto de
`shipmentDeleteBlockReason` (lo usan la acción de servidor y la API), el detalle en panel.

## 3. Reglas de botones (8 reglas + simetría SDD-0688)

- Regla 2: toque de 32 px (`min-height: 32px`) en código, insignia y «Ver los pasos».
- Regla 6: foco visible (`outline` de 2 px en `--accion-text`); el código y la insignia son paradas de Tab; la fila
  completa no lo es.
- Regla 7: sentence case, tuteo; «Rastrear» es verbo.
- Simetría 1: la etiqueta de verbo+sustantivo se cumple con el nombre accesible («Rastrear embarque <código>»,
  «Abrir embarque <código>»); la etiqueta visible corta es la excepción de enlace en fila de tabla, no un botón.
- Simetría 2: en la fila quedan **dos** acciones visibles (código y «Rastrear»), más «Ver los pasos» solo en filas
  bloqueadas. Simetría 5: el icono va a la izquierda de la etiqueta.
- Simetría 6: la etiqueta no se corta (`white-space: nowrap` en la píldora, ancho calculado para caber).
- No se usa `<Aviso>` por fila: su franja plana con `role="status"` repetido en cada fila anunciaría decenas de
  mensajes; el motivo conserva el patrón vigente (`<p id>` referenciado por `aria-describedby` de la casilla).

## 4. Accesibilidad

| Requisito | Cómo |
|---|---|
| Nombre de la insignia | `aria-label="Rastrear embarque <código>"` |
| Nombre del código | `aria-label="Abrir embarque <código>"` (el mismo que tenía el botón «Abrir») |
| Sin controles anidados | la fila pasa de `<button>` a `<div>` con clic de ratón; el código y la insignia son hermanos |
| Contraste | `--accion-text` sobre `--bg-surface`; medido en la revisión visual (§6) |
| Teclado | Tab recorre casilla → código → insignia → «Ver los pasos»; Enter activa |

## 5. Criterios de aceptación

- **CA-1** Ninguna fila del listado tiene un botón con texto «Abrir» ni `studio-btn-ghost` (contrato en
  `EmbarquesClient.abrir.test.tsx`); la fila no reserva una columna de 92 px.
- **CA-2** El código es un botón `studio-emb-codigo` con nombre «Abrir embarque <código>», `tabIndex` 0, que abre el
  mismo detalle con Enter.
- **CA-3** Cada fila trae un enlace «Rastrear embarque <código>» a `/studio/tracking/<id>`; oprimirlo no abre el detalle.
- **CA-4** El motivo de bloqueo se ve en una línea con candado; el texto completo sigue siendo la descripción accesible
  de la casilla; «Ver los pasos» sigue abriendo el asistente.
- **CA-5** Sin migraciones, sin cambios de permisos, datos ni acciones de servidor.
- **CA-6** `pnpm verify` (o su subconjunto aplicable, anotando SKIPs) en verde.

## 6. Allowlist exacta de la enmienda (2026-11-24)

- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`
- `app/studio/studio.css` (solo reglas de clases del cambio, si hace falta)
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.abrir.test.tsx`
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.borrado.test.tsx`
- `docs/specs/0710-embarques-fila-insignia-rastreo/spec.md`
- `.agents/handoffs/sdd-0710-candado-embarques-20261124.md`

## 7. Carril

La enmienda modifica selección que alimenta una acción destructiva: requiere revisión previa y CI verde en el SHA final; `node scripts/carril.mjs` clasifica el diff.

## 8. Fuera de alcance

Filtros, detalle en panel, la pantalla de Tracking y el resto de listados con «Abrir». La barra de selección sí pertenece al alcance de esta enmienda.


## Enmienda 2026-11-24: consulta desde la selección (opción A)

Esta enmienda sustituye el punto 2.3, CA-4 y el alcance anterior de casillas/barra.
El código azul y Rastrear se conservan. La fila bloqueada lleva un candado pequeño
junto a Rastrear, con nombre accesible `No se puede eliminar` y descripción completa
procedente de `shipmentDeleteBlockReason`. No muestra motivo visible ni pasos hasta seleccionarla.
La casilla permite consulta por teclado y ratón; al marcarla, la barra muestra el
motivo corto mediante `motivoCorto` y `Ver los pasos` abre el asistente SDD-0560 existente
cuando hay plan consultable. Al desmarcar desaparece la ayuda.
La selección masiva sigue incluyendo solo elegibles. La selección mixta cuenta todas
las filas seleccionadas, pero la confirmación y el payload usan exclusivamente las
elegibles actuales. Sin elegibles no se muestra Eliminar. Perder permiso o lectura
desmonta barra, confirmación y asistente. El servidor conserva sus verificaciones.
Sin cambios de datos, permisos, migraciones ni conexión con Faro.

Validación pendiente en el handoff de la enmienda; no implica aceptación visual ni cierre canónico.

### Revisión del Director: barra y varias consultas

Con selección mixta, la acción dice `Eliminar N…`, donde N es el número de elegibles
de la confirmación y el payload. El conteo general conserva todas las seleccionadas.
La barra pasa de fija a sticky dentro del flujo y elimina el colchón de 96 px;
su altura máxima es 40dvh con desplazamiento vertical y foco de teclado. Todos los
motivos y accesos al asistente se conservan, con texto que puede envolver en móvil.
La comprobación real del viewport móvil sigue pendiente de turno y arnés.
