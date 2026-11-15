# SDD-0603 · Tramo 5c · Filas y avisos de Tracking, Almacén CN, Documentos y Cobranzas

Parte del tramo 5 de [la spec](spec.md) («Filas y pantallas propias»). Aplica BD-037 a las pantallas que faltaban después del [tramo 5a](tramo-5a.md): lo que abre un registro es un botón real «Abrir», lo que avisa es `<Aviso>` (SDD-0628) y lo que solo se lee es texto. Rama `claude/0603-t5c-pantallas-210ac5`, desde `origin/main` `da8d123ee`, que ya trae `Aviso` y el patrón de Embarques.

Sin migraciones, rutas, acciones de servidor, permisos, dependencias, CSS, tokens ni colores nuevos. Los textos visibles no cambian; «Abrir» es el único texto nuevo y ya estaba aprobado en la tabla de tramos. Montos y cálculos no se tocan. Pills, badges y chips de estado quedan igual.

## Allowlist

Los 14 archivos del encargo, más sus pruebas y documentos:

- `app/studio/(app)/cn/_components/NewReceiptDrawer.tsx`, `RateSnapshotDrawer.tsx`
- `app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx`, `CobranzasClient.tsx`, `IdentifyPaymentDrawer.tsx`, `RecordatoriosDrawer.tsx`, `UnidentifiedPaymentDrawer.tsx`
- `app/studio/(app)/dashboard/_components/DashboardEditorDrawer.tsx`
- `app/studio/(app)/documentos/_components/DocumentosHubClient.tsx`
- `app/studio/(app)/embarques/_components/AsistenteBorrado.tsx`
- `app/studio/(app)/tracking/[id]/_components/ChangeDestinationModal.tsx`, `ShipmentPlanPanel.tsx`
- `app/studio/(app)/tracking/_components/ActiveShipmentList.tsx`
- `app/studio/(app)/tracking/nuevo/_components/CreateShipmentForm.tsx`
- Nuevas: `cobranzas/_components/CobranzasClient.abrir.test.tsx`, `tracking/_components/__tests__/ActiveShipmentList.abrir.test.tsx`, `app/studio/_components/__tests__/claridad-t5c-contract.test.ts`
- `docs/specs/0603-claridad-controles/tramo-5c.md`, `.agents/handoffs/0603-t5c-pantallas.md`

## Por archivo

| Archivo | Clasificación | Qué cambia |
|---|---|---|
| `CobranzasClient.tsx` | Cumple | Cada fila de la cola trae «Abrir» (`studio-btn-ghost -sm`, nombre «Abrir factura F-…»). La fila sigue abriendo con el ratón, sale del Tab (`tabIndex={-1}`) y deja de ser `role="button"`: el lector ya no lee toda la fila como un botón y la parada es «Abrir». La grilla suma 92 px, como en Embarques. La bandeja «Sin identificar» deja el contorno dorado: su encabezado es un `Aviso` de atención. |
| `CobranzaDrawer.tsx` | Cumple | Caja de error → `Aviso` de error. El panel de estado y saldo no es aviso: es un resumen con su `Badge`. Las secciones de nota y promesa son formularios. |
| `IdentifyPaymentDrawer.tsx` | Cumple | Error → `Aviso` de error; «El cliente ve» → `Aviso` de atención con título; el resumen de imputación → `Aviso` informativo. Cambia al elegir factura, no al escribir. |
| `UnidentifiedPaymentDrawer.tsx` | Cumple | Error → `Aviso` de error; «El cliente ve» → `Aviso` de atención con título. |
| `RecordatoriosDrawer.tsx` | Cumple | El error de vista previa o envío era texto rojo con `role="alert"` y es error de todo el panel → `Aviso` de error. |
| `DashboardEditorDrawer.tsx` | Cumple | Las dos notas con borde izquierdo azul → `Aviso` informativo compacto. Los íconos de color de cada KPI no son aviso. |
| `AsistenteBorrado.tsx` | Cumple | `Nota` devuelve `Aviso` (atención o error) y el `div role="alert"` que la envolvía sale, porque el error ya es `alert`. Los bloqueos dejan contorno y fondo rojos: son una lista de lectura bajo su título «No se puede eliminar por ahora». |
| `ChangeDestinationModal.tsx` | Cumple | Los dos errores del servidor → `Aviso` de error. La sugerencia de tarifa se recalcula mientras se escribe el destino (400 ms), así que no va en región viva: pierde caja y contorno verde y queda como texto con su botón «Usar». |
| `ShipmentPlanPanel.tsx` | Cumple | Error y «Plan guardado.» eran texto con color → `Aviso` de error y de éxito. |
| `CreateShipmentForm.tsx` | Cumple | Error general → `Aviso` de error. |
| `ActiveShipmentList.tsx` | Cumple | La tarjeta sigue el patrón de Embarques: los datos van en un `<button tabIndex={-1}>` que abre con el ratón y la parada de teclado es «Abrir» («Abrir embarque S-…»). La seleccionada lleva contorno de tinta y su «Abrir» con relleno de tinta (`studio-btn-dark`) y `aria-current`; el código y el fondo dejan el vino. |
| `NewReceiptDrawer.tsx` | Cumple | «Recepción huérfana» era texto sin contorno → secundario `-xs`. La franja de modo huérfano → `Aviso` de atención con título y acción (mismo texto del botón). El botón de quitar ítem medía 26 px sin contorno → `studio-icono-btn` (36 px). |
| `RateSnapshotDrawer.tsx` | Cumple | Error de carga y de envío → `Aviso` de error; «el CBM cambió» → `Aviso` de atención. «Quedaría así» se recalcula al escribir el precio: deja de ser región viva (`role="status"` y `aria-live` fuera; queda `aria-busy`). |
| `DocumentosHubClient.tsx` | Cumple en parte | No hay avisos y las filas no abren nada (ya tienen «Historial»). El vínculo de transacción pasa de texto vino a `studio-link-quiet`. El árbol de carpetas y los chips de vista quedan como estaban: la spec ya los dejó «sin decidir» (línea de pestañas que no son pestañas). |

### Excepciones que quedan, contadas en el contrato

- Contorno de estado como sección de formulario: los campos de la recepción huérfana (`NewReceiptDrawer`, borde izquierdo) y el GPS del destino terrestre (`CreateShipmentForm`, punteado). No avisan; agrupan campos.
- `role` crudo: el error de campo de `RateSnapshotDrawer` (alert, bajo su campo), «Cargando…» y «Solo un usuario elevado…» (status, texto); el canal único de anuncio del asistente de borrado (AVS-01); «No se pudieron contar los adjuntos.» en Tracking (status, texto al cargar).
- `tabIndex={-1}` en `ChangeDestinationModal` es el panel del diálogo, que recibe el foco.

## Roles vivos

- `alert` solo para errores que aparecen por una acción: guardar, enviar, cargar el panel que se acaba de abrir.
- `status` para lo que aparece al cargar o al elegir: «El cliente ve», la bandeja «Sin identificar», el modo huérfano, «el CBM cambió», las notas del editor del Dashboard y el aviso del asistente.
- Nada que cambie con cada tecla queda en una región viva: la sugerencia de tarifa y «Quedaría así» salen.
- Ningún secreto ni dato sensible quedó dentro de una región viva. El resumen de imputación lleva un monto y un código de factura, que no son secretos.

## Aceptación

- Cobranzas y Tracking: un «Abrir» por fila con clases de secundario, enfocable y con nombre «Abrir factura/embarque <código>»; la fila no es parada de Tab; Enter sobre «Abrir» abre lo mismo que el clic en la fila. Lo vigilan `CobranzasClient.abrir.test.tsx` y `ActiveShipmentList.abrir.test.tsx`.
- `claridad-t5c-contract.test.ts` cuenta, sin comentarios, por archivo: `<Aviso`, `role` crudo, `aria-live`, contorno de estado, «Abrir» y `tabIndex={-1}`. Total del grupo: 20 `<Aviso>`.
- Mutantes que deben morir: `<Aviso>` → `<p>`; volver la caja con contorno; quitar el import canónico; la fila de Cobranzas otra vez en el Tab; «Quedaría así» otra vez con `aria-live`. Y dos que prueban que los comentarios no cuentan: un `<Aviso` citado en un comentario no tapa el que se quitó, y comentarios con `role="alert"` no suman.
- Nada que se oprima baja de 32 px: «Abrir» es `-sm` (36/32), «Recepción huérfana» `-xs` (32) y quitar ítem `studio-icono-btn` (36/32).

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: todo lo nuevo es secundario; ningún primario nuevo. El vino sale de la selección de Tracking y del vínculo de Documentos. |
| Acción dominante | Cumple: no cambia la cantidad de primarios. |
| Semántica de color | Cumple: avisos por tono de `Aviso`; selección en tinta (excepción aprobada de la spec). |
| Contraste | Cumple por herencia: `--ctl-border` (16,49:1 claro, 13,08:1 oscuro), `studio-btn-dark`, `studio-icono-btn` y `.studio-aviso*`, ya medidos por `claridad-controles-contract`, `avisos-contract` y `dark-theme-contrast-contract`. |
| Tokens | Cumple: ninguno nuevo, ningún color nuevo, sin CSS. |
| Estados sin color | Cumple: cada aviso lleva icono; la seleccionada lleva `aria-current` además del relleno. |
| Light/dark | Cumple en contrato. Falta verlo en pantalla (ver Límites). |
| Movimiento reducido | Cumple: no se agrega movimiento. |

## Pendientes por choque (fuera de este tramo)

Están en PRs abiertas (#318 y #515) y no se tocaron. Van en un tramo posterior, cuando esas PRs se fusionen:

- `app/studio/(app)/cn/_components/AlmacenCnClient.tsx` (las filas de Almacén CN)
- `app/studio/(app)/cn/_components/ReceiptRowActions.tsx`
- `app/studio/(app)/tracking/[id]/page.tsx`
- `app/studio/(app)/tracking/[id]/FooterActions.tsx`
- `app/studio/(app)/tracking/[id]/ShipmentDataPanel.tsx`
- `app/studio/(app)/cobranzas/recibo/[code]/page.tsx`

También fuera de la allowlist: «Atención requerida» del Dashboard vive en `DashboardWidgets.tsx`, que no está en este encargo.

## Límites

- No se vio en pantalla con datos: se revisa en la imagen de prueba antes de fusionar, en claro, en oscuro y en compacto.
- Cobranzas conserva `studio-tracking-row`, cuya flecha «›» de la derecha convive con «Abrir». Quitarla es CSS, fuera de este tramo.
- El asistente de borrado ahora tiene una segunda región `status` cuando trae `aviso`: `Aviso` siempre declara su rol. Lo anoto por AVS-01 (un solo canal); las pruebas del asistente leen el primero, que sigue siendo el canal de anuncio.
- «Sin tarifa registrada…» de `ChangeDestinationModal` sigue en `--warning` como texto pequeño; es nota de campo, no franja, y no se midió aquí.
