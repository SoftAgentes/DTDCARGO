# SDD-0603 · Tramo 5e · Archivos liberados: barra superior, ficha de usuario, factura, documentos imprimibles, Mis reportes y un reporte

Parte del tramo 5 de [la spec](spec.md) («Filas y pantallas propias»). Cubre los 8 archivos que los tramos anteriores dejaron fuera porque estaban en las PRs #515 y #509, ya fusionadas. Aplica lo mismo que [4b](tramo-4b.md), [4c](tramo-4c.md), [4d](tramo-4d.md), [5a](tramo-5a.md) y [5c](tramo-5c.md): lo que avisa es `<Aviso>` (SDD-0628), lo que abre un registro es un «Abrir» real y nada que se oprima baja de 32 px. Rama `claude/0603-t5e-liberados-6ea340`, desde `origin/main` `cb240b17f`.

Sin migraciones, rutas, acciones de servidor, permisos, dependencias, CSS, tokens ni colores nuevos. Los textos visibles no cambian; «Abrir» es el único texto nuevo y ya estaba aprobado en la tabla de tramos. Pills, badges y chips de estado quedan igual. Los documentos que se imprimen no cambian.

## Allowlist

- `app/studio/(app)/_components/StudioTopbar.tsx`
- `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx`
- `app/studio/(app)/cobranzas/recibo/[code]/page.tsx`
- `app/studio/(app)/facturacion/[code]/page.tsx`
- `app/studio/(app)/legal/evidencia/[code]/page.tsx`
- `app/studio/(app)/mis-bugs/page.tsx`
- `app/studio/(app)/rendiciones/[code]/page.tsx`
- `app/studio/(app)/reportes/embarques-sin-facturar/page.tsx`
- Nuevas: `app/studio/_components/__tests__/claridad-t5e-contract.test.ts`, este documento y `.agents/handoffs/0603-t5e-liberados.md`

## Por archivo

| Archivo | Clasificación | Qué cambia |
|---|---|---|
| `UserDetailDrawer.tsx` | Cumple | Seis avisos pasan a `Aviso` compacto: «Es tu propio correo…» (atención), «Correo actualizado…» (éxito), «Esta persona nunca ha entrado…» (atención; sale el punto dorado, el icono lo pone `Aviso`), «Datos guardados.» (éxito), «Enlace enviado a …» (éxito, con el correo como título y «Copiar enlace» dentro) y el error general (error). Los errores de campo de `Campo` siguen como texto bajo su input. Filas: no aplica. |
| `facturacion/[code]/page.tsx` | Cumple | `StrandedCreditsNotice` deja la caja con contorno dorado y pasa a `Aviso` de atención con título. Los códigos de referido solo se leen: pierden el cajón y quedan como texto. «Volver al listado» era texto gris de 12 px: pasa a secundario `-sm`. Los vínculos de cliente y cotización (`FieldLink`) dejan el vino y usan `studio-link-quiet`. Las filas de «Recibos de cobranza» no abren nada por sí mismas: ya traen «Ver recibo». |
| `reportes/embarques-sin-facturar/page.tsx` | Cumple | Las dos cajas doradas («La tarifa congelada todavía no está disponible…» y «Lectura parcial…») → `Aviso` de atención. «← Reportes» era texto gris de 12 px: pasa a secundario `-sm`. Las filas de la tabla no abren nada: no aplica. |
| `mis-bugs/page.tsx` | Cumple | Cada tarjeta sigue abriendo con el ratón, sale del orden de Tab (`tabIndex={-1}`) y debajo trae «Abrir» (`studio-btn-ghost -sm`, nombre «Abrir reporte <folio>»), que lleva al mismo reporte. Avisos: no hay. |
| `StudioTopbar.tsx` | Cumple en parte | Avisos y filas: no aplica. Los ítems del menú de usuario y «Cerrar sesión» medían 29 px: suben a 32 px (`minHeight`). El buscador, el botón de usuario y los botones de icono ya traían contorno desde el tramo 1. |
| `cobranzas/recibo/[code]/page.tsx` | No aplica | «Estado: …» va dentro de `#recibo-cobranza`, el papel. Las acciones de pantalla ya son secundarios `-sm`. Sin cambios. |
| `legal/evidencia/[code]/page.tsx` | No aplica | La verificación de integridad va dentro de `#legal-expediente`, el papel. Las acciones de pantalla ya son secundarios `-sm`. Sin cambios. |
| `rendiciones/[code]/page.tsx` | No aplica | El aviso de anulación va dentro de `#rendicion-doc`, el papel. Las filas de recibos son lectura. Sin cambios. |

### Por qué el papel no se toca

Las tres páginas de `[code]` imprimen un único contenedor y anclan sus colores al tema claro dentro de `@media print`. `Aviso` pinta con `.studio-aviso*` de `studio.css`, con un icono y tokens que esas hojas no anclan; cambiar la caja cambiaría cómo sale el documento. Son parte de un documento probatorio, no avisos de la pantalla. En estas páginas no hay ningún aviso que exista solo en pantalla: lo único de pantalla es la barra de acciones y el equivalente en Bs del recibo, que siguen con `data-print-hide` como antes. El contrato vigila que no entre un `<Aviso>` al papel y que sus cajas sigan dentro del contenedor que se imprime.

### Excepciones que quedan, contadas en el contrato

- Fondo de estado en línea: el realce de «Cerrar sesión» al pasar el cursor (`StudioTopbar`); las cajas de los tres documentos imprimibles (una en recibo, dos ramas en expediente, una en rendición); y los dos chips del resumen de Mis reportes, que son pastillas de lectura.
- `role` crudo: el resumen global de «Embarques sin facturar» (`status`, texto sin caja, con su `aria-label`).
- `tabIndex={-1}`: la tarjeta de Mis reportes. El `tabIndex={0}` de la región con desplazamiento de la tabla de «Embarques sin facturar» se queda: es lo que permite desplazarla con el teclado.
- Menú de usuario: sus ítems son filas de un menú desplegable, sin contorno propio. El menú es el contenedor con contorno y sombra; aquí solo se corrige la altura.

## Roles vivos

- De `alert` a `status`: «Es tu propio correo…» (aparece al abrir el formulario y se queda) y el aviso de créditos sin liberar de la factura (se deriva del estado cada vez que la factura se abre; no responde a una acción). En Fidelización, el aviso equivalente (`StrandedCreditsBanner`, tramo 4d) quedó `urgente`; aquí se aplica la regla del encargo: lo persistente es `status`.
- De sin rol a `status`: «Esta persona nunca ha entrado…» y «Enlace enviado a …».
- Sigue `status`: «Correo actualizado…», «Datos guardados.» y los dos avisos de «Embarques sin facturar».
- Sigue `alert`: el error general de la ficha, que responde a una acción.
- Nada que cambie con cada tecla queda en una región viva. «Copiar enlace» cambia a «Copiado» al oprimir, no al escribir.
- Ningún secreto dentro de una región viva: el enlace de acceso nunca se pinta, solo va al portapapeles. Dentro del aviso quedan el correo de la persona, que ya estaba en pantalla, y el botón. El aviso de créditos lleva códigos de referido y montos, que no son secretos.

## Aceptación

- `claridad-t5e-contract.test.ts` cuenta, sin comentarios, por archivo: `<Aviso`, `role` crudo, `aria-live`, contorno de estado, fondo de estado, «Abrir» y `tabIndex={-1}`. Total del grupo: 9 `<Aviso>`.
- Papel: ningún `<Aviso>` en las tres páginas imprimibles; sus fondos de estado están dentro del contenedor que se imprime; `[data-print-hide]` sigue oculto al imprimir.
- Mis reportes: «Abrir» es secundario `-sm` con nombre «Abrir reporte <folio>» y el mismo destino que la tarjeta; la tarjeta no es parada de Tab.
- «Volver al listado» y «← Reportes» son secundarios `-sm`. La factura no usa vino en vínculos de lectura. Los dos botones de texto del menú de usuario llevan `minHeight: 32`. El enlace de acceso no aparece como texto.
- Mutantes que deben morir: `<Aviso>` → `<p role="alert">`; volver la caja con fondo y contorno; quitar el import canónico; la tarjeta otra vez en el Tab; el aviso de créditos otra vez `alert` con contorno; un `<Aviso>` dentro del papel del recibo. Y dos que prueban que los comentarios no cuentan.
- Nada que se oprima baja de 32 px: «Abrir», «Volver al listado» y «← Reportes» son `-sm` (36/32); «Copiar enlace» sigue `-xs` (32); los ítems del menú, 32.

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: todo lo nuevo es secundario; ningún primario nuevo. El vino sale de los vínculos de la factura. |
| Acción dominante | Cumple: no cambia la cantidad de primarios. |
| Semántica de color | Cumple: avisos por tono de `Aviso`. |
| Contraste | Cumple por herencia: `.studio-aviso*`, `studio-btn-ghost` y `studio-link-quiet`, ya medidos por `avisos-contract`, `claridad-controles-contract` y `dark-theme-contrast-contract`. |
| Tokens | Cumple: ninguno nuevo, ningún color nuevo, sin CSS. Se borran colores en línea. |
| Estados sin color | Cumple: cada aviso lleva icono y `role`. |
| Light/dark | Cumple en contrato. Falta verlo en pantalla (ver Límites). |
| Impresión | Sin cambios: los tres documentos imprimibles no se editaron. |
| Movimiento reducido | Cumple: no se agrega movimiento. |

## Límites

- No se vio en pantalla con datos: se revisa en la imagen de prueba antes de fusionar, en claro, en oscuro y en compacto.
- Mis reportes: cada tarjeta crece unos 44 px por la fila de «Abrir», que queda debajo de la tarjeta y no dentro, porque `BugCard.tsx` está fuera de la allowlist. La tarjeta sigue siendo un vínculo para el lector de pantalla, con todo su contenido como nombre; la parada de teclado es «Abrir».
- Los textos de éxito de la ficha pasan de verde a tinta sobre fondo verde suave, y el error de rojo a tinta sobre fondo rojo suave: es la regla de `Aviso` (texto siempre en tinta).
- El párrafo del aviso de créditos pasa de gris a tinta y de 12,5 a 14 px, la letra de `Aviso`.

## Pendientes que pasan por Sam (no se tocaron)

- Mis reportes, chips del resumen: «Total» va con relleno de tinta, que con BD-037 se lee como algo que se oprime, y no se oprime. Además traen colores de respaldo en hex. Son pastillas, fuera de este encargo.
- `BugCard.tsx` (fuera de la allowlist): el folio va en vino y `MiniBadge` es propio. Poner «Abrir» dentro de la tarjeta pide editarlo.
- Factura: el código en el encabezado va en un cajón con contorno y solo se lee.
- Menú de usuario: «Admin» y «DTD» están fijos en el código, no salen del rol real. No es de este tramo.
