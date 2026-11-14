# SDD-0603 · Tramo 5b · Filas y avisos de Contabilidad

Parte del tramo 5 de [la spec](spec.md) («Filas y pantallas propias»). Aplica BD-037 al módulo de Contabilidad: lo que abre un registro es un control real «Abrir», lo que avisa es `<Aviso>` (SDD-0628) y la selección va en tinta. Rama `claude/0603-t5b-contabilidad-05e824`, desde `origin/main` `375adebfb`: es `da8d123ee` más el tren #549, que no toca Contabilidad.

**Fuera, a propósito:** `PlanCuentasTab.tsx`, `LibroMayorTab.tsx`, `PorContabilizarTab.tsx`, `ExcepcionesCierreTab.tsx` e `IngresoDelPeriodoCard.tsx`, que no están en la allowlist; las pills, badges y chips de estado; los textos, montos, cálculos, permisos y acciones de servidor; y cualquier regla de CSS.

## Allowlist

Confirmada con el Subdirector de Contabilidad el 2026-11-14. Ninguno de sus cinco worktrees tenía trabajo en `contabilidad/_components/`.

`app/studio/(app)/contabilidad/_components/`: `AccountDrawer.tsx`, `ActivosFijosTab.tsx`, `AjustesDelCierre.tsx`, `AssetDrawer.tsx`, `CamposExcepcionCierre.tsx`, `ClosingDateDrawer.tsx`, `ConciliacionTab.tsx`, `ContabilidadClient.tsx`, `EntryDrawer.tsx`, `ExcepcionCierreDialog.tsx`, `LibroDiarioTab.tsx`, `LineMatchDrawer.tsx`, `ReportesTab.tsx`, `StatementDrawer.tsx`.

Además: `app/studio/(app)/contabilidad/__tests__/conciliacion-abrir.test.tsx` (nueva), `app/studio/_components/__tests__/claridad-t5b-contract.test.ts` (nuevo), este archivo y `.agents/handoffs/0603-t5b-contabilidad.md`.

Sin migraciones, rutas, acciones de servidor, permisos, dependencias, CSS ni colores nuevos.

## Clasificación

| Archivo | Clase | Qué cambia |
|---|---|---|
| `AccountDrawer.tsx` | aviso | La caja roja de error pasa a `Aviso tono="error" compacto`. |
| `ActivosFijosTab.tsx` | aviso | La caja de error pasa a `Aviso tono="error"`, con el mismo margen inferior de 12 px. Filas: no aplica, porque la fila del activo no abre nada. |
| `AjustesDelCierre.tsx` | aviso | `MensajeError` devuelve `Aviso tono="error" compacto` y conserva su `id`. |
| `AssetDrawer.tsx` | aviso | La caja de error pasa a `Aviso tono="error" compacto`. |
| `CamposExcepcionCierre.tsx` | aviso | La caja ámbar con contorno envolvía el aviso y los campos. Ahora el aviso es `Aviso tono="atencion" compacto` con el mismo `id`, y la superclave y el motivo van debajo, fuera de la región viva. El `role="group"` conserva su `aria-labelledby`. |
| `ClosingDateDrawer.tsx` | aviso | La caja de error pasa a `Aviso tono="error" compacto`. |
| `ConciliacionTab.tsx` | fila, selección y aviso | Ver «Extractos». `ErrorBanner` devuelve `Aviso tono="error"`. |
| `ContabilidadClient.tsx` | no aplica | Solo tiene botones de cabecera y `studio-tabs` (tramo 2). |
| `EntryDrawer.tsx` | aviso | La caja de error pasa a `Aviso tono="error" compacto`. |
| `ExcepcionCierreDialog.tsx` | aviso | La caja de error pasa a `Aviso tono="error" compacto` y conserva su `id`. |
| `LibroDiarioTab.tsx` | aviso | La caja de error de acción pasa a `Aviso tono="error"`. Filas: no aplica, porque la fila del asiento no abre nada (`EntryDrawer` solo crea). |
| `LineMatchDrawer.tsx` | aviso | La caja de error pasa a `Aviso tono="error" compacto`. |
| `ReportesTab.tsx` | no aplica | El error del filtro ya es texto con ícono, sin caja. |
| `StatementDrawer.tsx` | aviso | La caja de error pasa a `Aviso tono="error" compacto`. |

### Extractos (Conciliación)

- Cada extracto trae al final un control real «Abrir», con `studio-btn studio-btn-ghost studio-btn-sm`, de 36 px o 32 en compacto. Es un enlace, porque abrir un extracto es navegar (`?extracto=<id>`). Su nombre accesible es «Abrir extracto <período> · <cuenta>».
- La fila sigue abriendo con el ratón, con el mismo enlace de antes, y sale del orden de Tab (`tabIndex={-1}`). Cada fila conserva una sola parada.
- **Extracto abierto:** antes llevaba fondo `--wine-tint` y contorno `--wine`. Ahora lleva fondo de superficie, contorno `--ctl-border` y «Abrir» en `studio-btn-dark` con `aria-current="true"`. Es el mismo patrón de la tarjeta de Tracking en la #552.
- **Decisión pendiente de confirmar:** el enlace del extracto abierto lo cerraba. La fila conserva ese comportamiento con el ratón, pero «Abrir» siempre lleva a su extracto: un botón que dice «Abrir» no cierra. Con teclado, el extracto se cierra cambiando de pestaña. Se consultó al Subdirector Rebrand y, sin respuesta, se tomó esta opción, que es la más conservadora.
- La columna de «Abrir» mide 92 px, como en Embarques (tramo 5a).

### Roles vivos

- Todos los errores de acción ya eran `role="alert"`: aparecen por una acción y son urgentes. Siguen así, ahora dentro de `Aviso`.
- El aviso del cierre de `CamposExcepcionCierre` pasa de no tener rol a `role="status"`. Aparece al abrir el cajón o el diálogo, no se repite con cada tecla, y la superclave queda fuera de la región.
- El aviso del libro diario (status, al cargar) y el error de exportar (alert) ya eran texto con ícono y sin caja: no cambian. Tampoco la nota de protección de la fila (`role="note"`).
- Nada que cambie con cada tecla entra en una región viva.

### Mayúsculas por CSS

Los `Aviso` de este tramo no llevan `titulo`, así que ningún título pierde las mayúsculas, a diferencia de la #552. Los encabezados de tabla en mayúsculas no cambian.

## Aceptación

- Cada extracto tiene «Abrir» con clases de secundario de tabla, enfocable, con nombre «Abrir extracto <período> · <cuenta>» y que lleva a ese extracto. La fila no es parada de Tab. El abierto va en tinta, con botón oscuro, `aria-current` y contorno `--ctl-border`, sin vino. Lo vigila `conciliacion-abrir.test.tsx`.
- Cuenta exacta por archivo de `<Aviso>`, roles crudos, `aria-live`, cajas de estado, contornos de estado, «Abrir», `tabIndex={-1}` y selección en vino. Los comentarios no cuentan. En total quedan 12 `<Aviso>`. Lo vigila `claridad-t5b-contract.test.ts`.
- La superclave no queda dentro del `<Aviso>` del cierre.
- Mutantes que mueren: `<Aviso>` vuelve a `<p>`; vuelve la caja roja; se quita el `Aviso` y se deja citado en un comentario; se cambia el import canónico; la fila del extracto vuelve al Tab; el abierto vuelve al vino; el aviso del cierre vuelve a caja ámbar; el diálogo pierde su `<Aviso>`. Un comentario que cite los patrones no suma.

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: «Abrir» es secundario y ninguna pantalla suma un primario. El vino sale de la selección del extracto. |
| Acción dominante | Cumple: no cambia la cantidad de primarios. |
| Semántica de color | Cumple: error y atención con `Aviso`, tono por ícono y fondo suave, texto en tinta (BRAND §Estados). |
| Contraste | Cumple por herencia: `.studio-aviso*` y `--ctl-border` ya están medidos en claro y en oscuro (`avisos-contract`, `claridad-controles-contract`, `dark-theme-contrast`). |
| Tokens | Cumple: ninguno nuevo, ningún color nuevo, solo clases existentes. |
| Estados sin color | Cumple: el extracto abierto se marca con `aria-current` y botón oscuro, no solo con color. |
| Light/dark | Cumple en contrato. Falta verlo en pantalla, en claro y en oscuro (ver Límites). |
| Móvil | La lista de extractos suma una columna de 92 px dentro de la misma tarjeta. |
| Movimiento reducido | Cumple: no se agrega movimiento. |

## Límites

- No se vio en pantalla con datos, porque el Studio pide sesión y datos. Se revisa en la imagen de prueba antes de fusionar, en claro, en oscuro y en compacto.
- `EntryDrawer.tsx` también lo tocan las PRs abiertas #529, #527, #526, #521, #520 y #312. El cambio es una sola caja, pero puede dar conflicto al integrarlas.
- Los errores en cajones cambian de forma: de caja roja con contorno a franja plana con ícono. El texto no cambia.
