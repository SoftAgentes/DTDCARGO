# Rebrand del ERP y del Portal · Checklist, extras de experiencia y opciones para el rojo

> Estado: **propuesta para decidir**. No cambia código ni marca, no instala nada y no reserva número de SDD (lo asigna el Director). Continúa [mejoras-ux-adaptables.md](mejoras-ux-adaptables.md).
> Fecha: 2026-11-20. Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** no verificado.

## 1. El rojo: lo que encontré

Sam: «el vino tinto, visualmente la gente lo ve como algo negativo o como borrar». **La medición le da la razón.**

| Hecho | Medición | Etiqueta |
|---|---|---|
| El vino y el rojo de peligro tienen **el mismo tono** | `--wine` `#7F0F1A` y `--danger` `#A8323E`: los dos a 354° en la rueda de color; entre sí contrastan solo **1,61:1** | M |
| En tema oscuro, **el botón principal usa el mismo color exacto que el rojo de peligro del tema claro** | `--wine` oscuro = `#A8323E` = `--danger` claro (`app/studio/tokens.css`, bloque `[data-theme="dark"]`) | C |
| El Studio abre **oscuro por defecto** (SDD-0603) | Es decir, la vista de todos los días es la del caso anterior | C |
| En oscuro, el botón principal casi no se separa de la tarjeta | `#A8323E` sobre `#16264A`: **2,26:1** (mínimo 3:1). Por eso SDD-0603 le añadió un aro | M |
| El vino también pinta **saldos, enlaces, pestañas y KPI** | `var(--wine-text` 433 usos; `var(--wine` 329; `--wine-tint` 112 en el Studio. En el Portal, unas 386 apariciones (`text-wine-text` 108, `var(--color-wine` 111, `text-wine` 51, `bg-wine` 34…) | M |
| Un saldo en vino se lee como **deuda o error** | BRAND §Estados ya dice que el vino no es estado; en la práctica comparte tono con el error | I |

**Conclusión:** hoy la persona ve tres cosas distintas en la misma familia de rojo: «acción principal», «marca» y «peligro / borrar».

### Opciones

Contraste calculado con la fórmula WCAG. «Forma» = el botón contra la tarjeta (mínimo 3:1). Los hex **nuevos** son propuestas: ninguno se usa sin BRAND-CHECK, aprobación de Sam y registro en `BRAND-DECISIONS.md`.

| Opción | Acción en claro | Acción en oscuro | Texto sobre el botón | Forma en oscuro | Colores nuevos | Lo bueno | Lo malo |
|---|---|---|---|---|---|---|---|
| **Hoy · Vino** | `#7F0F1A` | `#A8323E` | 10,58 / 6,58 | **2,26** ✗ | — | Es la marca | Se confunde con peligro; no se separa en oscuro |
| **1 · Tinta** (navy / crema) | `#0F1E3D` | `#F2F0EC` | 16,49 / 14,49 | 13,08 | **Ninguno** (`--ink`, `--ink-inv`) | Cero color nuevo; máximo contraste | Se confunde con la **selección** (pestañas y filtros ya van en tinta, BD-037) y con el botón `dark` |
| **2 · Azul DTD** ⭐ | `#1F4FA8` | `#7FAAF0` (texto navy) | 7,66 / 7,00 | 6,32 | 2 (misma familia de tono que el navy: 219° contra 220°) | Se lee como «acción», no como peligro; se distingue de la selección y del rojo; pasa todo AA | Color nuevo: BD, Cloud Design y NORTE-SYNC |
| **3 · Petróleo** | `#1F5F6B` (ya existe: `--cat-1`) | `#5FB6C4` (texto navy) | 7,22 / 7,05 | 6,36 | 1 | Sobrio, industrial | `--cat-1` ya significa «identidad de cliente» en Naviera; chocaría |
| **4 · Verde botella** | `#1E6B52` | `#5BCFA0` | 6,40 / 8,54 | 7,71 | 1 | Positivo | Es el color de **éxito**: confundiría «hecho» con «haz esto» |
| **5 · Vino + peligro distinto** | sin cambio | sin cambio | — | 2,26 ✗ | 0 | Cambio mínimo | El rojo alternativo (`#C2353F`, 356°) sigue en el mismo tono: **no resuelve** |

**Recomendación: opción 2, «Azul DTD».** El vino se queda **solo para la identidad** (logo, wordmark «DTD», sello, correos y documentos de marca). El rojo queda **solo para peligro y error**. La acción pasa a azul. Si no quieres ningún color nuevo, la alternativa es la opción 1, aceptando que la acción y la selección se parecen.

**Decisiones que acompañan al color (las tres son tuyas):**

1. **Saldos y cifras:** hoy van en `--wine-text`. Propongo **tinta** (neutro) y dejar el rojo solo para vencido.
2. **Web pública:** pediste ERP y Portal. La web seguiría con vino en sus botones. ¿Se acepta esa diferencia o entra después?
3. **Logo:** las 4 variantes del logo no se tocan. El wordmark «DTD» sigue en vino.

### BRAND-CHECK

```
Lo que pediste:          cambiar por completo el rojo/vino como color de acción en ERP y Portal
Regla que rompe:         BRAND §Sistema de color (--wine = «Acento primario · CTAs · links») y
                         regla 1 («solo tokens, cero hex inventados»)
Por qué no va tal cual:  es la fuente de verdad de la marca (Norte); un hex nuevo exige decisión registrada
Alternativa dentro del sistema: opción 1 (tinta), sin colores nuevos
¿Lo aplicamos igual?     Si eliges la opción 2 queda como decisión de marca: BD nuevo en BRAND-DECISIONS.md,
                         BRAND.md actualizado y NORTE-SYNC con Cloud Design
```

### Cómo se cambiaría (sin tocar pantalla por pantalla)

- **Studio:** el color vive en `app/studio/tokens.css`. Se crean tokens de **acción** (`--accion`, `--accion-hover`, `--accion-text`, `--accion-tint`) y `.studio-btn-primary` deja de leer `--studio-wine`. Los usos de `--wine-text` y `--wine-tint` se reparten en tres destinos: acción (enlaces, pestañas), tinta (saldos, KPI) e identidad (Shipping Mark, logo). Son ~920 usos, pero se resuelven por **token**, no a mano.
- **Portal:** usa las variables de la web (`--color-wine`…) bajo `.portal-sys` (`app/globals.css:314`). Se redefinen **dentro de `.portal-sys`** para que el Portal cambie sin tocar la web pública. **I**: hay que comprobarlo en pantalla.
- **Lo que no cambia solo:** 67 archivos con `#7F0F1A` escrito a mano en `app/`, `lib/` y `components/` (web, correos, PDF, login). Se revisan uno por uno: los de marca se quedan.
- **Pruebas:** los contratos que miden contraste (`claridad-controles-contract.test.ts`, `dark-theme-contrast-contract.test.ts`) se actualizan con los valores nuevos y sus mutantes.

## 2. Checklist: qué vamos a hacer y cómo

Un solo SDD paraguas con tramos, como la SDD-0603: cada tramo con su allowlist, su PR y su prueba. **Sin barrido masivo** (AGENT-BRIEF).

### Fase 0 · Decidir (Sam)

- [ ] Elegir la opción de color (1 a 5) y contestar las tres decisiones de arriba.
- [ ] Nombrar 3 a 5 pantallas que más te molestan.
- [ ] Confirmar formato de cifras: `$1,234.50` (decisión del 2026-08-11) o `1.234,50`.
- [ ] Aprobar las reglas nuevas de botones y de mensajes (fase 2), que cambian políticas tuyas.

### Fase 1 · Preparar (sin tocar producto)

- [ ] El Director asigna el número de SDD y abre la rama de reserva.
- [ ] Escribir `docs/specs/NNNN-…/spec.md`: alcance (ERP y Portal), tramos, allowlist por tramo, aceptación y gate VIS-01.
- [ ] Registrar la decisión de color como BD nuevo en `BRAND-DECISIONS.md` y en `BRAND.md` (si no es la opción 5).
- [ ] Imagen de prueba (rama que no se fusiona) con el color nuevo en 3 pantallas, claro y oscuro, para que lo veas **antes** de adoptarlo. Necesita turno de PC del Director.

### Fase 2 · Reglas (documentos + contratos)

- [ ] **BTN-01 v1.2:** verbo + sustantivo; máximo tres acciones visibles por grupo; un tamaño por grupo; destructivo en tres énfasis; posición fija del icono; la etiqueta no se corta; dos ejes tono × forma.
- [ ] **Política de mensajes:** cuatro tipos (en línea, toast, accionable, llamada), cuánto dura cada uno y dónde va el aviso de formulario.
- [ ] **Escala de texto:** 7 u 8 estilos con nombre; **anchos de drawer:** 3.
- [ ] Un contrato de prueba por regla, con mutante («no des por buena una aserción sin matarla»).

### Fase 3 · Piezas compartidas (una por tramo, entran por CMP-01 como `proposed`)

- [ ] `EncabezadoPagina` (título, subtítulo, acciones).
- [ ] `DrawerShell` con `tamano` y `DrawerFooter` obligatorio con orden automático.
- [ ] `Pila` (espacios por token) y estilos de texto con nombre.
- [ ] `Titulo`/`Seccion` (nivel calculado), `Ficha` (solo lectura), `Campo` (formulario).
- [ ] `ActionButton`: error visible en el botón y duración única de la confirmación (coordinar con SDD-0678).
- [ ] Tokens de **acción** en `tokens.css` y en `.portal-sys`.

### Fase 4 · Adopción por tramos (cada tramo: allowlist, PR, CI, revisión independiente)

- [ ] Tramo color: Studio (botones, enlaces, pestañas, saldos) y Portal.
- [ ] Tramo encabezados: los 91 títulos, por grupos de módulos.
- [ ] Tramo drawers: 13 anchos → 3; los 45 pies a mano.
- [ ] Tramo botones fuera del sistema: Noticias Web (23), los 20 bajo 32 px y los 11 sin `type`.
- [ ] Tramo rastro de fila: `useRowHighlight` en todos los listados con acciones.
- [ ] Tramo cifras: los 47 archivos a `lib/money.ts` y los 50 usos de `es-VE`.
- [ ] Tramo tablas, fichas y campos: por módulo, empezando por las pantallas que nombraste.
- [ ] Tramo higiene: respaldos de color desfasados, `rgba` en línea, login.

### Fase 5 · Verificar y cerrar

- [ ] Recorrido en la imagen de prueba: claro, oscuro y compacto; Studio y Portal; con datos tapados.
- [ ] `/ui-check` por tramo y `/ui-pro` en las pantallas principales.
- [ ] `pnpm verify` con turno del Director; CI verde; revisión independiente que lanza el DG.
- [ ] Tu visto bueno por tramo antes de fusionar; producción con OK aparte.
- [ ] Handoff por tramo y, al final, NORTE-SYNC del color y de las reglas hacia Cloud Design.

## 3. Extras que mejorarían la experiencia (nice to have)

Lo que **no** está hoy en el Studio, contado por archivos (**M**; algunos pueden existir con otro nombre: **NV**).

| # | Extra | Hoy | De dónde sale | Para qué |
|---|---|---|---|---|
| 1 | **Carga con esqueleto** al entrar a un módulo | 0 `loading.tsx`, 0 esqueletos | Carbon `DataTableSkeleton`, `SkeletonText` | La pantalla no queda en blanco mientras carga |
| 2 | **Aviso de cambios sin guardar** al cerrar un drawer o salir | 0 | Patrón común; Carbon lo trata en sus modales | No se pierde lo escrito por un clic afuera |
| 3 | **Página de error y de «no encontrado» propias** | 1 `error.tsx`, 0 `not-found.tsx` | Carbon `FullPageError`, `ErrorBoundary` | El error dice qué pasó y cómo volver |
| 4 | **Paginación o carga progresiva** en listados largos | 0 | Carbon `Pagination`; Ant Design `Table` | Listados grandes más rápidos (**NV**: puede haber límite en el servidor) |
| 5 | **Ayuda al pasar el cursor accesible** (tooltip), sobre todo para explicar un botón deshabilitado | 0 componente; 91 textos cortados dependen de `title` | Carbon `Tooltip`/`Toggletip`; BTN-01 §6 ya lo pide | Se entiende por qué no puedo oprimir |
| 6 | **Migas de pan** en pantallas de detalle | 1 | Carbon `Breadcrumb` | Saber dónde estoy y volver |
| 7 | **Botón «Copiar»** único para códigos (Shipping Mark, contenedor, factura) | 17 archivos, cada uno a su manera | Carbon `CopyButton` | Mismo gesto y misma confirmación en todo el ERP |
| 8 | **Barra de acciones sobre varias filas** uniforme | 10 archivos distintos | Carbon `DataTable` (su barra de acciones sobre varias filas) | Seleccionar varias filas se ve igual en todos los módulos |
| 9 | **Orden de columnas anunciado y visible** | `aria-sort` en 1 archivo | A11Y-01; Carbon y Ant Design lo traen | Se ve por qué columna está ordenado |
| 10 | **Encabezado y primera columna fijos** en tablas anchas | 9 archivos | Ant Design `Table` (`fixed`); tokens `--shadow-sticky-*` ya existen | No perder de vista el cliente al desplazarse |
| 11 | **Indicador de pasos** en asistentes | por módulo | Carbon `ProgressIndicator`; WIZ-01 | Saber cuánto falta |
| 12 | **Edición en el sitio** para un dato suelto | — | Carbon `EditInPlace` | Corregir sin abrir un drawer |
| 13 | **Recorrido guiado** para quien entra por primera vez a un módulo | — | Ant Design `Tour`, Carbon `Coachmark` | Menos preguntas por WhatsApp |
| 14 | **Atajos de teclado a la vista** | 4 archivos | Ya existe ⌘K | Operar más rápido |

**Los tres que más rinden:** 2 (cambios sin guardar), 1 (esqueleto de carga) y 5 (explicar el botón deshabilitado).

## 4. Límites

No abrí el Studio ni el Portal: la percepción del rojo está respaldada por cifras de tono y contraste, no por una prueba con usuarios. Los hex nuevos son propuestas calculadas, no probadas en pantalla. Los conteos de extras son por texto en el código.
