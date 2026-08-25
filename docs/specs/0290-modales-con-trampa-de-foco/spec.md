---
sdd: "0290"
title: "Todos los modales del ERP atrapan el foco — y uno era invisible a grep"
status: in-progress
author: "founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0019"]
confidencialidad: interno
---

# DTD-0290 — Los modales atrapan el foco

> WCAG 2.1.2 (sin trampa de teclado) y 2.4.3 (orden del foco). Quien navega con
> teclado o lector de pantalla abría un modal y el Tab se iba a la página de
> atrás, dejándolo escribiendo en un formulario que no ve.

## Lo que decía el backlog y lo que había de verdad

`docs/design/studio/erp-faseb-pendientes.md` (2026-07-10) listaba **~16 modales**
sin `DrawerShell`. Medido hoy: son **23 archivos** con `role="dialog"` fuera del
shell, pero **4 ya usaban `useDialogA11y`** — se migraron después de escribir ese
documento y nadie lo actualizó.

## La decisión de diseño: el hook, no el shell

El backlog pedía migrarlos todos a `DrawerShell`. **No es lo que se hizo**, y a
propósito: `DrawerShell` impone su chrome (header, título, botón cerrar, footer),
y varios de estos overlays son otra cosa —un editor con pestañas, una paleta ⌘K,
un modal de publicación con su propio tema—. Migrarlos habría cambiado su
apariencia y su estructura para arreglar un problema de **teclado**.

Lo que les faltaba vive aislado en `useDialogA11y`, el mismo hook que
`DrawerShell` usa por dentro: foco inicial, restauración al cerrar, Escape y
focus-trap. Aplicarlo **no cambia un pixel**.

## Alcance

**17 modales** con el hook cableado. Dos quedan fuera **porque no son modales**:

| Fuera | Por qué |
|---|---|
| `ShippingMarkChip` | Popover posicionado, sin `aria-modal`. |
| `PortalCalcFab` | Panel flotante de un FAB, sin `aria-modal`. |

Atrapar el foco en un overlay **no modal** es incorrecto: el usuario tiene que
poder tabular hacia afuera. Los dos ya cierran con Escape.

## Dos cosas que aparecieron al hacerlo

### 🔴 Un archivo era INVISIBLE para grep

`BugReportModal.tsx` tenía un **byte NUL crudo** (`0x00`) en el fuente, línea
285: `.split(state.folio ?? "<NUL>")`. Con eso, `grep` clasifica el archivo como
**binario y lo saltea** — o sea que **todo barrido de texto del repo lo estaba
omitiendo en silencio**, incluido el que produjo la lista de este spec.

El valor es correcto: es un centinela que nunca aparece en el texto, para no
partir el mensaje cuando no hay folio. Lo que estaba mal era escribirlo como byte
crudo. Ahora va escapado (`"\0"`), mismo runtime, archivo de texto otra vez.

> ⚠️ Y queda comentado por qué **no** puede ser `""`: `split("")` parte el string
> en CARACTERES y renderizaría un `<span>` por letra.

### El hook no servía para los modales inline

`useDialogA11y` monta su efecto de foco inicial una sola vez. Para un modal que
**es** su componente (el caso de casi todos los drawers) eso es correcto: monta y
desmonta con el diálogo. Pero para los que se renderizan **inline** dentro de un
componente que vive siempre (`{abierto && <div role="dialog">…}`), el efecto
corría al montar el padre —con el panel todavía sin existir— y el foco inicial
nunca ocurría.

Se agregó la opción **`enabled`** (default `true`, aditiva: ningún llamador
existente cambia). La usan `StateActionsPanel` y `FooterActions`.

## Los Escape que ya existían

Seis modales tenían su propio `useEffect` de Escape. Se reemplazaron por el hook
en vez de dejar dos manejadores compitiendo — pero **conservando la lógica donde
tenía capas**:

- `PublishModal`: con el popover de firma abierto, Escape cierra el popover y
  **no** el modal. Esa lógica se le pasa al hook como su `onClose`.
- `GlobalSearchModal` (⌘K): ya enfocaba el input y ya cerraba con Escape; sólo le
  faltaba el trap. Se usa `initialFocusRef` para que el foco siga yendo al input
  — el operador tiene que poder tipear de inmediato.

## Lo que NO se verificó

🔴 **No se probó con teclado ni con lector de pantalla.** El cambio está
verificado por typecheck, lint, tests y build — no por tabular dentro de un modal
real. Es exactamente el tipo de arreglo que pide esa pasada antes de darlo por
bueno.

## Adjuntos

Ninguno.
