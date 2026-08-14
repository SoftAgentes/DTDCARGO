---
sdd: 0263
title: La dirección de la bodega en Alibaba, medida contra el formulario real
status: in-progress
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0099]
confidencialidad: interna
---

# SDD-0263 · La dirección de la bodega en Alibaba, medida contra el formulario real

## Problema

El cliente que copia nuestra guía **no puede terminar el formulario de Alibaba**.
Reportado por el founder el 2026-08-14 y medido el mismo día contra el
formulario en vivo (`logistics.alibaba.com/luyou/shipto/list.htm`, cuenta real,
locale español), no contra documentación ni recuerdo.

Cuatro fallos, todos en el mismo bloque de copia:

| # | Lo que publicamos | Lo medido en Alibaba |
|---|---|---|
| 1 | Destinatario `DTD-Canopy - DTD-XXXX` | Rechazado. Error literal bajo el campo: **«Debe estar en chino»** |
| 2 | Ciudad `义乌市` (Yiwu) | La Ciudad es **`金华市`** (Jinhua). Yiwu no está en ese selector |
| 3 | *(no lo mencionamos)* | Hay un tercer selector, **Distrito**, **obligatorio** → ahí va `义乌市` |
| 4 | Dirección en una línea | El formulario la parte en dos: dirección + apartamento/suite |

El fallo 3 es el que tranca: aunque el cliente adivine la ciudad, la guía nunca
le dice que existe un campo obligatorio más, así que el botón «Enviar» no pasa.

La causa raíz del 2 y el 3 es que la división administrativa china tiene **tres**
niveles y nosotros documentábamos dos. Yiwu es ciudad de *nivel condado* bajo la
prefectura de Jinhua. La nota que teníamos —«en el selector aparece bajo 金华市»—
describía el hecho correcto y sacaba la conclusión equivocada.

## Lo medido

Pegando en «Rellenar automáticamente la dirección» la cadena
`林冠, 18606891419, 浙江省金华市义乌市义乌港二期直通仓2栋2号 货7-货11, 322000`,
Alibaba repartió así (captura en la sesión del 2026-08-14):

| Campo de Alibaba | Valor |
|---|---|
| Nombre y apellido | `林冠` |
| Número de teléfono (+86) | `18606891419` |
| Dirección o apartado postal | `义乌港二期直通仓2栋2号` |
| Apartamento, suite, unidad, edificio, piso | `货7-货11` |
| Estado/provincia | `浙江省` |
| Ciudad | `金华市` |
| Distrito | `义乌市` |
| Código postal | `322000` |

Tres cosas más, todas medidas:

1. **El rellenado automático funciona y es el camino rápido** — llena los ocho
   campos de una pegada. Pero necesita la jerarquía **completa**: con la cadena
   que publicábamos (sin `金华市`) metió `义乌市` en *Ciudad*, combinación que no
   corresponde.
2. 🔴 **El rellenado automático borra el Shipping Mark del nombre, sin avisar.**
   Pegando `林冠 DTD-1014, …` el campo «Nombre y apellido» quedó en `林冠` pelado.
   Un cliente que use el atajo y no revise manda la caja sin identificar — el
   daño exacto que el Shipping Mark existe para evitar.
3. **`林冠 DTD-1014` sí lo acepta el servidor.** Comprobado guardando la
   dirección: quedó en la libreta como
   `林冠 DTD-1014 / 浙江省金华市义乌市义乌港二期直通仓2栋2号, 货7-货11, 322000, 中国`.
   O sea: chino + código latino conviven en ese campo.

## Decisión

Reordenar la guía en **dos pasos** en vez de una lista de campos sueltos, porque
la intención del cliente es pegar rápido y el atajo tiene una trampa que hay que
nombrar en voz alta:

- **Paso 1 — la dirección de una pegada.** Botón que copia
  `浙江省金华市义乌市义乌港二期直通仓2栋2号 货7-货11, 322000` para el rellenado
  automático. El código postal va **dentro de la cadena y detrás de una coma**:
  medido vaciando el campo primero, sin él el rellenado no lo repone. (La primera
  medición no lo probaba: el formulario traía el código precargado de la
  dirección anterior, así que el campo lleno no era mérito del pegado.)
- **Paso 2 — el destinatario, a mano.** `林冠 ` + el Shipping Mark del cliente,
  con la advertencia de que el paso 1 lo borró.

La lista campo por campo se mantiene detrás de «Ver campo por campo», ya
corregida y con el Distrito incluido, para quien llene a mano o use otra web.

El nombre `林冠` lo eligió el founder (2026-08-14) sobre la razón social
`义乌市林冠进出口有限公司`: es el encargado de bodega que ya usamos en el packing
list y en el rótulo, y es lo que «DTD-Canopy» traducía (`ywlgcanopy.com`).

## Alcance

| Archivo | Cambio |
|---|---|
| `lib/design-tokens.ts` | `cityCjk` pasa a `金华市`; nuevos `districtCjk`, `addressLine1Cjk`, `addressLine2Cjk`, `addressAutofillCjk`; se elimina `cityParentCjk` (describía mal la jerarquía) |
| `components/AlibabaAddressGuide.tsx` | Reordenado en dos pasos; destinatario `林冠 + mark`; Distrito y segunda línea agregados |
| `lib/faqs.ts` | Respuesta en texto plano reescrita (es la que leen buscadores y el agente de IA del CRM) |
| `public/guias/comprar-en-alibaba.html` | Mismos valores + nota del atajo |
| `faq/FAQ-sitio-DTDCargo.md` | Tabla fuente al día; además corrige el teléfono, que decía `18006891419` |
| `docs/runbooks/academia-guia-alibaba-interactiva.md` | El ejemplo del destinatario |

El widget lo consumen cuatro superficies (`/faq`, `/shipping-mark`, el portal en
Proveedores y Dashboard, y una lección de Academia): un solo cambio las cubre.

## Fuera de alcance

- **`addressCjk`** (`浙江省义乌市义乌港二期直通仓2栋2号 货7-货11`) **no se toca.**
  Omite `金华市`, igual que antes. Alimenta rótulos, packing list y el clip de
  WeChat, donde `义乌市` es inequívoco para un transportista chino y donde un
  cambio sí modificaría documentos impresos. Queda anotado para decidir aparte.
- **`docs/design/studio/_norte/portal/app.jsx`** repite la ciudad vieja, pero
  `_norte/` es espejo read-only de Cloud Design: se reporta por NORTE-SYNC, no se
  edita acá.
- Los assets de `docs/specs/0099-guia-comprar-alibaba/` son registro histórico de
  aquella entrega; no se reescriben retroactivamente.
- El término «MARKBOX» sobrevive en `public/guias/comprar-en-alibaba.html`. Es
  trabajo de SDD-0258 y vive en otro worktree; tocarlo acá cruzaría ramas.

## Verificación

- `pnpm typecheck` y `pnpm lint` en verde (la frontera público↔ERP no se toca:
  el widget solo importa `@/lib/design-tokens`).
- Revisión visual de `/faq` con el widget desplegado.
- La medición de origen es reproducible: `logistics.alibaba.com/luyou/shipto`,
  «Agregar dirección» → «Ver más» → pegar la cadena → «Rellenar formulario».
