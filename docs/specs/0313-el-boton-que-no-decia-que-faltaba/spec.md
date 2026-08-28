---
sdd: "0313"
title: "Portal — paso 1 de Nueva compra: el alta de proveedor que no corría y el botón que no decía qué faltaba"
status: done
author: "Sam (founder) + Claude Code"
created: 2026-08-27
updated: 2026-08-27
supersedes: null
superseded_by: null
related: ["0173", "0057", "0098"]
confidencialidad: interno
---

# SDD-0313 — El paso 1 de "Nueva compra": el alta que no corría y el botón mudo

## 1. Qué lo disparó

Reclamo del equipo (2026-08-27), grabando un video tutorial del registro de una
compra en el portal del cliente:

> "al momento de seguir los pasos, el botón de 'registrar compra' no se activa.
> No sé si es que me falta algún paso o puede ser que no esté activo en este
> momento."

El asistente lo ve **todo cliente** desde el 2026-07-29
(`NEW_PURCHASE_WIZARD_LIVE = true`, `lib/portal/demo.ts:89`), así que no era un
caso de cuenta demo.

## 2. Qué se midió (navegador, no lectura)

Banco de medición temporal bajo `app/portal/probe-*` montando el asistente real
con props sintéticas (borrado al cerrar; receta en
`feedback_medir_sin_sesion_banco_de_medicion`).

### 2.1 El hallazgo grave: "Guardar proveedor" no hacía NADA

`SupplierPicker` renderizaba la ficha del proveedor nuevo como un `form`, y en el
asistente esa ficha queda **dentro** del `form` del paso 1
(`NewPurchaseWizard.tsx:163`). Anidar formularios es HTML inválido, y React lo
grita en consola ("cannot contain a nested form"), pero el daño real es peor que
un aviso: **React nunca despacha la acción**. Deja que el navegador navegue a su
URL centinela (`javascript:throw new Error('A React form was unexpectedly
submitted…')`), que la CSP `form-action 'self'` bloquea.

Resultado: el cliente pulsa "Guardar proveedor", **no pasa absolutamente nada**,
el proveedor no se crea, y "Registrar compra" queda apagado para siempre.

**Experimento controlado** — la prueba de que la causa es la anidación y no la
falta de sesión del banco:

| Escenario | ¿La acción llega al servidor? |
|---|---|
| El MISMO `SupplierPicker` **sin** formulario padre | sí — devuelve su error |
| `SupplierPicker` **dentro** del formulario del asistente | **nunca corre** |

Esto explica el reclamo entero: quien graba un tutorial arranca sin proveedores,
así que **siempre** cae en el camino de crear uno — el único que estaba roto.

### 2.2 El botón no decía qué faltaba

`disabled={pending || !supplierId}` con un único pie de página:
*"Escribe o elige un proveedor para continuar."* — que **le miente a quien ya
escribió**. Medido en móvil (375×812), con el botón centrado en pantalla el campo
de proveedor quedaba **1.778 px por encima del viewport**: hay que subir 2.459 px
para llegar al control que bloquea. El cartel nombraba algo invisible.

### 2.3 El cursor fingía que el sistema trabajaba

`disabled:cursor-wait` se aplicaba también cuando el botón estaba apagado por
falta de proveedor. De ahí sale, textual, *"puede ser que no esté activo en este
momento"*.

### 2.4 Cinco fallos del alta eran invisibles

`SupplierPicker` pintaba **sólo** `fieldErrors.name`. Las cinco rutas de
`createSupplierAction` que devuelven `{ error }` sin `fieldErrors`
(`actions.ts:323, :327, :354, :360, :395` — entre ellas "Tu sesión expiró") no se
mostraban en ninguna parte.

## 3. Divergencias del Norte que esto corrige

El Norte (`docs/design/studio/_norte/portal/app.jsx`) ya resolvía tres de estas
cosas; el repo transcribió sólo una parte. **No se inventa diseño: se restaura.**

| # | Norte | Qué había en el repo |
|---|---|---|
| D1 | `existingSel` (`:3371`) — escribir el nombre COMPLETO ya elige | `onChange` hacía `onSelect("")` siempre |
| D2 | `:3943` tiene DOS ramas: `isNew ? 'Guarda los datos del proveedor…' : 'Escribe o elige…'` | sólo se copió la rama `else` |
| D3 | El panel "en vivo" cuelga de `provOk` (`:3925`) | se pintaba SIEMPRE — mostraba "de mi proveedor **mi proveedor**" junto a un botón muerto |

## 4. Alcance (allowlist exacta)

```
app/portal/(app)/compras/nueva/SupplierPicker.tsx
app/portal/(app)/compras/nueva/NewPurchaseWizard.tsx
app/portal/(app)/compras/nueva/PurchaseStepDetalle.tsx
app/portal/(app)/compras/[code]/detalle/page.tsx      (nuevo)
app/portal/(app)/compras/[code]/page.tsx
app/portal/(app)/compras/ComprasList.tsx
app/portal/(app)/compras/page.tsx
app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx      (nuevo)
app/portal/(app)/compras/nueva/PurchaseStepDetalle.test.tsx    (nuevo)
```

**Ninguna server action se toca**, no hay migración y no cambia el esquema. La
ruta nueva reusa `getPrealertaByCode` (scopeada por `client_markbox`) y
`updatePrealertaDetalleAction` tal como están.

## 5. Qué se hizo

1. **La ficha del proveedor nuevo deja de ser un formulario.** Pasa a `div` y el
   botón, a `type="button"` que despacha la acción con
   `startTransition(() => newSupplierAction(collectSupplierForm(...)))`. El helper
   arma el `FormData` leyendo los `input[name]` de la tarjeta y omite radios sin
   marcar, igual que haría el navegador. Sirve en los DOS consumidores (con y sin
   formulario padre) sin que el selector tenga que saber dónde vive.
2. **El pie del botón pasa a tener tres estados** — los dos del Norte más uno
   propio, porque acá crear un proveedor pide un clic extra en "+ Crear «X»" que
   el Norte no tiene. Se lifta el borrador con la prop **opcional**
   `onDraftSupplierChange`; opcional porque `NewPurchaseForm` es el segundo
   consumidor del selector.
3. **Aviso pegado al campo** cuando hay texto escrito sin elegir. Va como `p` y NO
   como `PortalFieldError`: ese trae `role="alert"` fijo y dispararía una alerta
   del lector de pantalla en cada tecla, además de pintar de rojo algo que es
   guía, no error.
4. **`aria-describedby` + `aria-live="polite"`** en el pie (BTN-01 §6: la
   explicación no puede depender de enfocar el botón deshabilitado).
5. **`cursor-wait` sólo cuando `pending`**; si no, `cursor-not-allowed`.
6. **Se pinta `newSupplierState.error`** y el botón del alta gana `aria-busy`.
7. **Fidelidad al Norte**: nombre exacto autoselecciona (D1), panel condicionado a
   que haya proveedor (D3).
8. **Enter deja de ser una trampa**: cascada exacto → única parcial → crear. Antes,
   con varias parciales sin exacto, empujaba a **crear un duplicado** teniendo los
   candidatos a la vista; y con nombre exacto más dos o más parciales no ejecutaba
   ninguna rama, así que Enter no hacía nada.

### 5.1 · El combobox se puede usar sin ratón (A11Y-01)

Patrón APG completo sobre el buscador de proveedor: `role="combobox"` +
`aria-expanded` + `aria-controls` + `aria-autocomplete="list"` +
`aria-activedescendant`; el desplegable pasa a `<ul role="listbox">` con
`<li role="option">` de id estable y `aria-selected`. ↑/↓ recorren, Home/End
saltan a los extremos, Enter activa la opción resaltada y Escape cierra — **el
foco nunca sale del input**, como manda el patrón.

- Las opciones (incluida "+ Crear «X»") viven en **una sola lista**: es lo que
  permite que las flechas lleguen también a crear.
- La opción activa **no se distingue sólo por color** (WCAG 1.4.1): lleva un
  cursor `▸` visible además del fondo.
- El `<label>` gana `htmlFor` y el input un `id`; se **quita** el `aria-label`
  para que el nombre accesible sea la etiqueta VISIBLE "Proveedor"
  (WCAG 2.5.3 · Label in Name). Las instrucciones de teclado se mudan a un
  `aria-describedby` con texto `sr-only`, que es su lugar.
- El `onBlur` con `setTimeout(120)` —una carrera que con teclado cerraba la
  lista antes de poder activar nada— se reemplaza por un blur **de contenedor**
  que mira `relatedTarget`.

### 5.2 · El paso 2 tiene ruta propia y ya no pierde el trabajo

- **Ruta nueva `/portal/compras/[code]/detalle`.** Carga la compra por código
  (scopeada por markbox → 404 si es ajena) y monta `PurchaseStepDetalle` en modo
  `suelto`. Si el estado ya no es `anunciada` redirige al detalle en vez de
  ofrecer un formulario que el servidor va a rebotar.
- 🔴 **Precarga obligatoria.** `validatePrealertaInput({ requireDetalle: false })`
  cae a `PREALERTA_DESCRIPCION_PENDIENTE` y `boxes = 1` con los campos vacíos:
  servir esta pantalla en blanco y guardar **pisaría** lo que el cliente ya
  tenía. Los valores guardados viajan como `defaultValue`, y la descripción de
  relleno del servidor se muestra **vacía** (no es texto del cliente).
- **Cómo se llega:** tarjeta "Te falta el detalle de esta compra" en
  `/portal/compras/[code]`, y aviso "Falta el detalle — complétalo" en la card
  de la lista. Sin eso el cliente no tiene cómo enterarse: la descripción que ve
  es el relleno del servidor y parece un dato real.
- **"Lo lleno después" deja de descartar.** Era un `type="button"` que sólo
  cambiaba de fase: el form nunca se enviaba y todo lo escrito y adjuntado se
  perdía sin avisar. Ahora, en cuanto hay algo tocado, **el atajo desaparece** y
  en su lugar va "Lo que pusiste se guarda al avanzar" — no hay nada que saltar,
  y no se duplica la acción del botón principal. Cuando sí se muestra, gana
  `min-h-[44px]` + relleno (WCAG 2.2 §2.5.8: como texto pelado medía ~17 px,
  siendo la única salida del paso).

## 6. Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| BTN-01 §5 (Disabled explica el motivo) | no conformidad → corregida | §2.2, §5.2 |
| BTN-01 §5 (Loading no se finge) | no conformidad → corregida | §2.3, §5.5 |
| BTN-01 §6 (explicación no depende del foco) | no conformidad → corregida | §5.4 |
| BTN-01 §2 (tipo HTML declarado; un submit inequívoco) | no conformidad → corregida | §5.1 |
| SGE-00.02 (no perder trabajo en silencio) | no conformidad → corregida | §2.1, §2.4 |
| SGE-00.07 (no mostrar estado falso) | no conformidad → corregida | D3 |
| ERR-01 / FRM-01 (el error se ve) | no conformidad → corregida | §5.6 |
| A11Y-01 (combobox sin patrón ARIA ni teclado) | no conformidad → corregida | §5.1 |
| WIZ-01 (Atrás no borra datos · no se pierde trabajo entre pasos) | no conformidad → corregida | §5.2 |
| WIZ-01 (URL permite retomar un proceso largo) | no conformidad → corregida | §5.2 |
| CMP-01 | no aplica | no se crea ni se deprecia primitiva |
| MP-01 / AUD-01 | no aplica | no hay borrado ni permanencia nueva |

## 7. Lo que queda ABIERTO (no entra acá)

- **Lector de pantalla real.** El patrón ARIA está puesto y medido en el DOM
  (atributos, roles, `aria-activedescendant` siguiendo a las flechas), pero
  **no se probó con NVDA/VoiceOver**. A11Y-01 §Gate lo pide y ningún gate
  automático lo cubre.
- **Teclas del sistema operativo.** La navegación por flechas se verificó en
  Chrome con eventos despachados por script y en jsdom con `userEvent`; el
  panel del navegador no estaba componiendo, así que **no se pudo pulsar una
  tecla física**. Queda por confirmar en una sesión real.
- `revalidatePortal` no cubre `/portal/compras/nueva`.
- Los adjuntos rechazados por peso o mime se siguen descartando sin mensaje
  (§7.1).

### 7.1 La misma enfermedad en los pasos 2 y 3

El barrido encontró el mismo patrón —bloquear o descartar sin nombrar lo que
pasa— más adelante en el recorrido. **Nada de esto explica el reclamo recibido**
(ése vive en el paso 1), y nada de esto entra en la allowlist de §4. Queda
anotado para decidir con el founder:

| Gravedad | Qué pasa | Dónde |
|---|---|---|
| ✅ resuelto | Una compra registrada sin detalle no se podía completar nunca → ruta propia (§5.2) | — |
| ✅ resuelto | "Lo lleno después" descartaba todo lo escrito → el atajo desaparece al haber contenido (§5.2) | — |
| ✅ resuelto | Re-guardar pisaba lo guardado con "Pendiente" y 1 caja → la pantalla precarga (§5.2) | — |
| alto | Los adjuntos rechazados por peso o mime se descartan **sin mensaje**, mientras el checklist los marca en verde. | `actions.ts` (best-effort) |
| medio | El consentimiento de servicios es `required` nativo, pero el botón NO se apaga por él: se ve activo, no registra, y el único aviso es la burbuja del navegador. Es el mismo defecto que este SDD corrige, en su otra forma. | `PrealertaAddons.tsx:433` |
| medio | La barra de 3 pasos parece pestañas y no responde al clic. (El paso 2 **suelto** ya tiene "Volver a la compra" y "Cancelar"; dentro del asistente sigue sin salida propia.) | `PurchaseWizardSteps.tsx:33` |
| medio | "Volver al paso 2" del paso 3 sigue siendo texto gris de 12 px sin área táctil. El de `PurchaseStepDetalle` ya se corrigió (§5.2). | `PurchaseStepConfirm.tsx:81` |

## 8. Tests (escritos y validados con mutación)

1. `NewPurchaseWizard.test.tsx` — **el asistente no anida formularios**: que
   `[...container.querySelectorAll("form")].some(f => f.parentElement?.closest("form"))`
   sea `false`. Es el que habría cazado §2.1.
2. `NewPurchaseWizard.test.tsx` — invariante: *si el botón está deshabilitado hay
   exactamente UNA instrucción visible y nombra el paso que falta*.
3. `SupplierPicker.test.tsx` — un alta que falla en el servidor se ve en pantalla
   (mock devolviendo `{ error }` y luego `findByRole("alert")`).
4. `SupplierPicker.test.tsx` — Enter con dos o más parciales y sin exacto NO abre
   el alta.

El único contrato que hoy nombra `SupplierPicker`
(`state-reconciliation-contract.test.ts:9`) lo lee **como texto**: verifica que el
archivo contenga `queueMicrotask` y `cancelled = true`. No puede ponerse rojo por
ningún comportamiento. Sigue verde tras este cambio, y eso no prueba nada.
