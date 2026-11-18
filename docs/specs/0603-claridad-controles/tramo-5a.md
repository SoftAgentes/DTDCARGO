# SDD-0603 · Tramo 5a · «Abrir» en Embarques y controles del Dashboard

Parte del tramo 5 de [la spec](spec.md) («Filas y pantallas propias»). Aplica la regla de BD-037 a dos pantallas: lo que se oprime lleva contorno de tinta, sombra y un verbo; lo que solo se lee es texto sin cajón. Rama `claude/0603-t5a-filas-625f67`, desde `origin/main` `11f90a32e`.

**Fuera, a propósito:** Cobranzas (`CobranzasClient.tsx` está en la PR abierta #519); los avisos de estas pantallas, como «Atención requerida» del Dashboard, que van con el componente de SDD-0628; y cualquier regla de CSS, porque `studio.css` es de otro Worker en esta ola. El prototipo `codex/rediseno-studio-prueba` se leyó, pero su clase `.studio-fila-abrir` no se adopta: este tramo usa solo clases que ya existen.

## Allowlist

- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.abrir.test.tsx` (nueva)
- `app/studio/(app)/dashboard/_components/DashboardWidgets.tsx`
- `app/studio/(app)/dashboard/_components/__tests__/DashboardWidgets.claridad.test.tsx` (nueva)
- `docs/specs/0603-claridad-controles/tramo-5a.md`, `.agents/handoffs/0603-t5a-filas.md`

`EmbarquesClient.borrado.test.tsx` no se toca, porque está en la PR abierta #314. Sigue pasando sin cambios.

Sin migraciones, rutas, acciones de servidor, permisos, dependencias, CSS ni colores nuevos.

## Qué cambia

### Embarques

- Cada fila trae al final un botón real «Abrir», con `studio-btn studio-btn-ghost studio-btn-sm`: 36 px, o 32 en compacto. Su nombre accesible es «Abrir embarque S-2026-NNNN». Llama a lo mismo que la fila: abre el detalle del embarque en el panel.
- La fila completa sigue abriendo con el ratón y con el mismo `onClick`. Sale del orden de Tab (`tabIndex={-1}`): antes cada fila era una parada de Tab y ahora lo es «Abrir». La cantidad de paradas no cambia; cambia cuál es, y ahora tiene un nombre corto que dice qué abre en lugar de leer toda la fila.
- La grilla suma una columna de 92 px. Se midió con Archivo 700 real en Chrome: «Abrir» mide 31,9 px a 13,5 px y 30,7 px a 13 px. Con relleno, separación, icono y contorno, el botón ocupa unos 81 px en la vista normal y unos 70 en la compacta. El ancho mínimo de la tabla pasa de 824 a 926 px, y de 930 a 1032 con la columna «Adjuntos»; lo que no cabe se desplaza en horizontal dentro de la tarjeta, como antes.
- No cambian el orden, las rutas ni lo que pasa al oprimir. «Abrir» es el único texto visible nuevo, aprobado en la tabla de tramos de la spec.

### Dashboard (`DashboardWidgets.tsx`)

- **Acciones rápidas:** de cajón gris a secundario (`studio-btn studio-btn-ghost`), con icono y verbo en 700. Se quitan los colores en línea: los pone la clase, también al invertirse con el cursor. El icono deja el vino, que queda para la acción principal.
- **«Ver todos →», «Calendario →», «Ir a nómina →»:** de texto vino a secundario de 32 px (`studio-btn-xs`).
- **Filas de «Embarques en curso» y «Próximos por llegar»:** llevan `studio-tracking-row`, la fila que se abre del tramo 1, con flecha fija a la derecha y realce al pasar el cursor y al enfocar. «Próximos por llegar» deja el cajón gris. El relleno derecho sube a 28 px para la flecha.
- **Estados** de esas filas: de texto suelto a `Badge` neutro, que es texto con icono y sin cajón.
- **Nómina · resumen:** los cuatro números solo se leen, así que pierden el cajón gris y quedan como texto.
- Sin cambios en el gráfico, que ya usaba `.studio-tabs` desde el tramo 2, ni en «Atención requerida», que es un aviso y va con SDD-0628.

## Aceptación

- Cada fila de Embarques tiene un botón «Abrir» con clases de secundario de tabla, enfocable y con nombre «Abrir embarque <código>». La fila no es parada de Tab. Enter sobre «Abrir» abre el mismo detalle que un clic en la fila. El encabezado y las filas tienen las mismas columnas. Lo vigila `EmbarquesClient.abrir.test.tsx`.
- En el Dashboard, las acciones rápidas y los enlaces de cabecera llevan clases de secundario y no tienen color en línea. Las filas que abren un embarque llevan `studio-tracking-row` y van sin fondo propio. Los estados van con icono y sin fondo, y los números de nómina sin cajón. Lo vigila `DashboardWidgets.claridad.test.tsx`.
- Mutantes: quitar `tabIndex={-1}` de la fila y quitar `studio-tracking-row` del Dashboard hacen fallar una prueba cada uno.
- Nada que se oprima baja de 32 px: `-sm` y `-xs` miden 32 px como mínimo en las dos densidades.

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: todo lo nuevo es secundario. Ninguna pantalla suma un primario; el vino sale de los iconos de acciones rápidas y de los enlaces. |
| Acción dominante | Cumple: no cambia la cantidad de primarios. |
| Semántica de color | Cumple: los estados conservan su texto; el `Badge` neutro no da a entender éxito ni alerta. |
| Contraste | Cumple por herencia: contorno `--ctl-border` (16,49:1 en claro, 13,08:1 en oscuro) y texto `--ink`, ya medidos y vigilados por `claridad-controles-contract.test.ts`. |
| Tokens | Cumple: ninguno nuevo y ningún color nuevo. Solo clases existentes. |
| Estados sin color | Cumple: estado con texto e icono; selección y foco, sin cambios. |
| Light/dark | Cumple en contrato, porque todo sale de clases que ya cubren los dos temas. Falta verlo en pantalla, en claro y en oscuro: ver Límites. |
| Móvil | Sin cambios de criterio: la tabla de Embarques ya se desplazaba en horizontal dentro de su tarjeta; ahora necesita 102 px más. |
| Movimiento reducido | Cumple: no se agrega movimiento. |

## Límites

- No se vio en pantalla con datos: el Studio pide sesión y datos, y no se abrió la imagen de prueba. Se revisa en la imagen de prueba antes de fusionar, en claro, en oscuro y en compacto.
- `Badge` neutro en el Dashboard: el estado del embarque usa el icono neutro, no el tono por estado de Embarques, porque esa función (`statusBadgeTone`) es privada de `EmbarquesClient.tsx`. Compartirla sería otro archivo, fuera de la allowlist.
