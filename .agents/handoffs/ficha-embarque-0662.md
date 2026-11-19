# Handoff — SDD-0662 · Ficha del embarque: ancho completo y «Asignar cliente» a la vista

- **Fecha:** 2026-11-18
- **Rama:** `claude/ficha-embarque-0662`, desde `origin/main` `82caee939`
- **Spec:** `docs/specs/0662-ficha-embarque-ancho-y-asignar-cliente/spec.md`
- **Número:** asignado por el Director General.

## Qué pidió Sam

Sobre la ficha de un embarque sin cliente (Shipping Mark comodín `DTD-0000`):

1. «Que él pueda asignarle cliente, ya que ahorita está como bloqueado.»
2. «Que abra en computadora a pantalla completa y hacerla responsive para computadora también, ya que abre con mucho espacio a los laterales.»

## Qué se encontró

- «Pasar a otro cliente» (SDD-0645) ya existía. Lo ve quien tiene la acción `reassign_shipment_owner` (admin, operaciones o comercial) y puede ver nombres de clientes (SDD-0531). Quedaba al final de la columna derecha, y a quien no tiene la acción la ficha no le decía que existe.
- La pantalla no bloquea a nadie por error: decide por el rol. No se cambió ningún permiso; abrir la acción a otro rol pide migración (la RPC de la 0551 repite el rol) y no entra aquí.
- La página fijaba `maxWidth: 1200` y dos columnas.

## Qué se hizo

- `page.tsx`: sin tope de ancho. Tres zonas (`datos`, `operacion`, `seguimiento`) sobre `.studio-ficha-embarque-grid`: una columna hasta 900 px, dos hasta 1600 px, tres desde 1600 px. La franja «Cliente» sube debajo del encabezado.
- `ClienteDelEmbarque.tsx` (nuevo): decide qué muestra la franja.
  - Con permiso: monta `ReassignClientPanel`; si el embarque está sin cliente (`esSinCliente`: vacío o `DTD-0000`), con `sinCliente`.
  - Sin permiso: Shipping Mark y un `<Aviso>` con los roles que pueden hacerlo, leídos de `CAPABILITIES` (no nombra personas).
  - Sin ver nombres: Shipping Mark y un `<Aviso>`; el buscador no se monta.
- `ReassignClientPanel.tsx`: prop `sinCliente`. Con ella el panel avisa «Este embarque no tiene cliente asignado» y el botón es principal y dice «Asignar cliente»; el modal lleva ese título. Sin ella, igual que antes.
- `studio.css`: clases `.studio-ficha-embarque-*`. Se quitó `.studio-detail-grid`, que solo usaba esta página.

## Validación

| Comprobación | Resultado |
|---|---|
| vitest `app/studio/(app)/tracking` + `avisos-contract` + `claridad-controles-contract`, `--maxWorkers=2`, sobre `2896d25e0` | PASÓ: 163 pruebas, 16 archivos |
| Prueba con el cambio roto (se ignora `puedeVerNombres` y `sinCliente`) | PASÓ: fallan 3 pruebas de `ClienteDelEmbarque.test.tsx` y 1 de `ocultar-nombres-cn.test.tsx` |
| `node scripts/check-numbering.mjs` e índice de specs | PASÓ |
| `/ui-check` (lectura del código) | PASÓ con dos ajustes aplicados: margen por token y tres columnas desde 1600 px en vez de 1500 |
| tsc, eslint, `pnpm verify`, `docs:check`, `governance:check`, `components:check` | NO EJECUTADO en local; quedan para el CI |
| Vista en navegador (claro, oscuro, compacto, los tres anchos) | NO EJECUTADO: nadie ha visto la ficha corriendo |
| e2e | NO EJECUTADO |

No se leyó producción. Los datos de las pruebas son inventados.

## Pendientes de esta tarea

- Ver la ficha en el navegador en los tres anchos, en claro y en oscuro.
- Traer `main` antes de sacar la PR de borrador: hoy entran cambios que tocan `studio.css`.

## FUERA DE ALCANCE DETECTADO

- La ficha tiene varios botones principales a la vez («Subir documento» dos veces, «Guardar planificación»). Con «Asignar cliente» son cuatro en un embarque sin cliente. BTN-01 pide uno por contexto; ordenarlo es otra tarea.
- `ShipmentDataPanel.tsx` usa un emoji de candado en las etiquetas de Cliente y Shipping Mark, y su texto de ayuda («no se editan acá») no remite al cambio de cliente.
- La acción `reassign_shipment_owner` no incluye a contabilidad. Si Sam quiere que ese rol asigne clientes, es una decisión suya y pide migración.
