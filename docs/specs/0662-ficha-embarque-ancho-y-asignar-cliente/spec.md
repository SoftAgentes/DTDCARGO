---
sdd: "0662"
title: "Ficha del embarque: ancho completo y «Asignar cliente» a la vista"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0013", "0531", "0645", "0659"]
confidencialidad: interno
---

# SDD-0662 — Ficha del embarque: ancho completo y «Asignar cliente» a la vista

> La ficha `/studio/tracking/[id]` usa todo el ancho de la pantalla, y el cambio de cliente deja de estar escondido al final de la columna derecha: queda arriba, y un embarque sin cliente lo pide con un llamado claro.

## Contexto

Pedido de Sam del 2026-11-18, sobre la ficha de un embarque que todavía no tiene cliente (Shipping Mark comodín `DTD-0000`):

1. «Que él pueda asignarle cliente, ya que ahorita está como bloqueado.»
2. «Que abra en computadora a pantalla completa y hacerla responsive para computadora también, ya que abre con mucho espacio a los laterales; que si se abre en toda la pantalla, se visualice bien.»

Lo que se midió en el código (sin consultar producción):

- «Pasar a otro cliente» (SDD-0645) existe, pero se monta en la columna derecha, debajo de Acciones, Plan operativo y Legal. Solo lo ve quien tiene la acción `reassign_shipment_owner` (administrador, operaciones o comercial) y puede ver nombres de clientes (SDD-0531). A quien no la tiene, la ficha solo le muestra los campos Cliente y Shipping Mark con candado y «no se editan acá»: nada dice que el cambio existe ni quién lo hace.
- La página fija `maxWidth: 1200` y la grilla `.studio-detail-grid` tiene dos columnas fijas. En un monitor ancho quedan franjas vacías a los lados.

## Alcance

Solo aplicación. Sin migraciones y sin cambiar permisos.

1. **Ancho.** Se quita el tope de 1200 px. La grilla de la ficha pasa a tres zonas:
   - **datos**: datos del envío y los dos paneles de documentos;
   - **operación**: acciones, plan operativo y expediente legal;
   - **seguimiento**: historial de cambios de cliente, «Esto verá el cliente» y timeline.

   Tres columnas desde 1600 px de ancho de ventana; dos columnas (datos a la izquierda, operación y seguimiento apiladas a la derecha) entre 900 y 1600 px; una columna por debajo de 900 px, como hoy.
2. **Cliente arriba.** Una franja «Cliente» queda debajo del encabezado, a todo el ancho, antes de la grilla:
   - Con permiso: el Shipping Mark actual y el botón «Pasar a otro cliente» (el mismo modal de SDD-0645).
   - Con permiso y embarque sin cliente (Shipping Mark vacío o `DTD-0000`): un aviso de atención «Este embarque no tiene cliente asignado» y el botón principal «Asignar cliente». El modal es el mismo, con ese título.
   - Sin permiso: el Shipping Mark y una nota que dice qué roles pueden cambiar el cliente. No nombra personas.
   - Sin ver nombres de clientes (equipo de China, SDD-0531): el Shipping Mark y una nota. El buscador de clientes no se monta, tenga el rol que tenga.

## No entra

- Abrir `reassign_shipment_owner` a otro rol: la RPC de la migración 0551 repite el rol; pediría migración.
- Cambiar el rol de un usuario: es de Sam, en Usuarios.
- Cambios al modal de «Pasar a otro cliente» más allá del título y la etiqueta del botón que lo abre.
- Los paneles de datos, documentos, plan, timeline y comentarios por dentro.

## Reglas que se conservan

- SDD-0531 (PIPL): sin `puedeVerNombres` no se monta nada que busque o muestre nombres de clientes.
- SDD-0645: el servidor y la base repiten el permiso; mostrar el botón no lo concede.
- BTN-01: una sola acción principal por contexto. «Asignar cliente» es principal solo en el embarque sin cliente; «Pasar a otro cliente» sigue secundario.
- Avisos con `<Aviso>`; colores por tokens; clases nuevas con prefijo `.studio-ficha-embarque-`.

## Allowlist

- `app/studio/(app)/tracking/[id]/page.tsx`
- `app/studio/(app)/tracking/[id]/_components/ClienteDelEmbarque.tsx` (nuevo)
- `app/studio/(app)/tracking/[id]/_components/ReassignClientPanel.tsx`
- `app/studio/(app)/tracking/[id]/_components/__tests__/ClienteDelEmbarque.test.tsx` (nuevo)
- `app/studio/(app)/tracking/[id]/_components/__tests__/ReassignClientPanel.test.tsx`
- `app/studio/(app)/tracking/__tests__/ocultar-nombres-cn.test.tsx` (solo si la página deja de montar el panel directamente)
- `app/studio/studio.css`
- `docs/specs/0662-ficha-embarque-ancho-y-asignar-cliente/`, `docs/specs/README.md`
- `.agents/handoffs/ficha-embarque-0662.md`

## Criterios de aceptación

1. Con permiso y Shipping Mark `DTD-0000` (o vacío), la ficha muestra el aviso «Este embarque no tiene cliente asignado» y el botón «Asignar cliente», que abre el modal.
2. Con permiso y un cliente real, muestra «Pasar a otro cliente», sin aviso.
3. Sin permiso, no hay botón: hay una nota con los roles que pueden hacerlo.
4. Sin `puedeVerNombres`, el buscador no se monta aunque el rol tenga la acción, y la franja no contiene nombres.
5. La página no fija ancho máximo; la grilla responde a los tres anchos descritos.
6. Las pruebas existentes de SDD-0531 y SDD-0645 siguen pasando.
