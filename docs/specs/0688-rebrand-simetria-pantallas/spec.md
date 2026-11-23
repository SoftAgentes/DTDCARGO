---
sdd: "0688"
title: "Simetría de pantallas: un encabezado, tres anchos de panel, una escala de texto y botones con las mismas reglas"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-20
updated: 2026-11-22
supersedes: null
superseded_by: null
related: ["0603", "0628", "0678", "0686", "0687"]
confidencialidad: interno
---

# SDD-0688 — Simetría de pantallas

> Cada módulo arma a mano su encabezado, su panel lateral, su tabla y sus espacios. Por eso el ERP no se ve igual de una sección a otra.
> Sin migraciones, sin datos de producción y sin PII. Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** sin verificar.

## Objetivos de Sam (2026-11-20)

Estos tres objetivos dicen qué se considera terminado. Cada decisión de esta spec se mide contra ellos. Sam los pidió en el chat de la sesión «Rebrand Design» y cerró con «Ok, avanzamos»:

1. **Homogéneo.** «Que el sistema se vea homogéneo, que todo lo que cargamos y lo que estamos construyendo salga igual.» Lo que ya existe y lo que se construya después usan el mismo encabezado, los mismos paneles, las mismas tablas y los mismos espacios.
2. **Botones con lógica y con feedback.** «Que los botones tengan lógica, que tengan feedback… que si un guardado me tiene que indicar que está guardando, no me deje oprimirlo cinco veces.» Cada botón muestra que está trabajando y no acepta un segundo clic mientras tanto (SDD-0678, BTN-01 v1.3).
3. **Simétrico y fácil de usar.** «Que sea simétrico… fácil para el usuario final (UI/UX).» Las secciones se ven iguales y la persona que lo usa no tiene que aprender cada pantalla por separado.

## Estado (2026-11-20)

Spec propuesta. **Nada implementado.** Número asignado por el Director General (reserva `codex/sdd-reserve-0688`, `0bf583338`). Va **al final**, después de SDD-0686 (color) y SDD-0687 (cifras), sobre tokens ya estabilizados.

## 1. Problema

**Pedido de Sam, 2026-11-20, literal, en el chat de la sesión «Rebrand Design»:**

- «hay cosas que en nuestro ERP (en nuestro ERP Studio) no se ven tan bien; no está como simétrico en todas las secciones.»
- «Me interesa mucho el tipo de botones, qué hacen los botones y el tema de las reglas. La separación entre títulos, cómo se diferencian los títulos de los mensajes, lo guardado y la experiencia del usuario.»
- Sobre qué pantallas: «Tú tienes que revisar con calma, tómate el tiempo necesario; todas las vamos a cambiar.»

**Lo medido** en `app/studio/(app)/` (55 módulos, 96 páginas, 606 archivos TSX; **M**):

| Qué | Lo medido |
|---|---|
| Título de página | 91 `<h1>` a mano en 87 archivos: 7 tamaños (30 px en 60), 20 combinaciones de margen, 10 clases. Solo una página tiene un componente de encabezado, y es local (`calendario/page.tsx:83`) |
| Panel lateral | 117 `DrawerShell` con 13 anchos (de 480 a 760 px). Uno usa el ancho por defecto y 116 reciben un número libre (`drawer/DrawerShell.tsx:39`) |
| Pie del panel | 45 archivos usan `DrawerShell` sin `DrawerFooter` |
| Tablas | 73 `<table>` crudas en 50 archivos; `TableFrame` se usa 10 veces en 8 archivos |
| Tamaños de letra | 22 tamaños escritos en línea, de 9 a 34 px |
| Espacios | 1.506 rellenos y 1.762 separaciones con número suelto, frente a 354 y 712 con token |
| Esquinas | 245 radios con número suelto en 15 valores |
| Rastro al guardar | `useToast` en 132 archivos; `useRowHighlight` en 14 |
| Botones | 244 de 1.044 fuera del sistema; 20 con alto fijo menor a 32 px; 23 de Noticias Web con el estilo de la web pública; 11 sin `type` |

El detalle por módulo y la lista de archivos están en `docs/design/rebrand-erp/` (evaluación, mejoras adaptables y borrador).

## 2. Qué ya está decidido y esta spec solo adopta

No se inventan reglas donde ya hay política aprobada. Esta spec **las lleva al código**:

| Política aprobada | Qué exige | Estado hoy |
|---|---|---|
| **VIS-02 §3** | Once roles de texto (display, título de pantalla, de sección, de tarjeta, cuerpo, cuerpo compacto, label, eyebrow, caption, dato, feedback); un título principal por pantalla; encabezados en orden lógico | Los roles no existen como estilos con nombre: 22 tamaños sueltos |
| **TBL-01** («adopción pendiente») | Tabla semántica, orden que comunica dirección, vacío que distingue «sin datos» de «sin coincidencias», selección con cantidad, acciones por fila en posición fija | `TableFrame` en 8 archivos; `aria-sort` en 1 |
| **BTN-01 §2, §4, §5 y §7** | Una primaria por contexto, orden por contexto, estados obligatorios, 32 px mínimo, `type` declarado | 244 botones fuera del sistema |
| **BD-037 / SDD-0603** | Qué se oprime, qué avisa y qué solo se lee | Adoptado; quedan los pendientes listados en la SDD-0603 |
| **LOD-01** | Carga, espera y feedback | SDD-0678 trabaja «Guardando…»; no hay esqueletos ni `loading.tsx` |
| **ERR-01** | El error aparece cerca de su causa; no se depende de un toast que expira | Sin lugar fijo para el aviso del formulario |
| **FRM-01** | Obligatorio y opcional se comunican igual; cambios sin guardar se conservan o se advierten | Ayudantes de campo solo en un módulo (`tms/_components/TruckDrawer.tsx:187-311`); no hay aviso de cambios sin guardar |
| **AVS-01** | Avisos y confirmaciones (registro: «verificada») | Su texto canónico es la spec SDD-0165 (no hay `policies/avs-01.md`); la enmienda v1.1 va en su §17 (fase 1) |
| **CMP-01** | Toda pieza nueva entra como `proposed` y se promueve con evidencia | Aplica a cada pieza de §4 |

## 3. Reglas nuevas (cambian políticas; aprobadas por Sam el 2026-11-20, §11)

> **Salvedad · regla 4.** Sam aprobó las seis reglas de botones, pero no se le mostró que la 4 contradice `BRAND.md:360`. La regla 4 estuvo **pendiente de BRAND-CHECK**. **Cerrado el 2026-11-22:** Sam eligió la opción A dibujada («regla a») y la excepción consta en BD-077 (`BRAND-DECISIONS.md`). Las seis reglas están vigentes.

Tomadas de la guía de botones y de notificaciones de Carbon, verificadas en su código y en su documentación pública (ver `docs/design/rebrand-erp/evaluacion-carbon.md` §4). **No se instala ninguna librería.**

**Para BTN-01 (pasaría a v1.3; la v1.2 la tomó SDD-0686 para el color de `primary`):**

1. Etiqueta de **verbo + sustantivo** («Guardar cambios», «Crear embarque»), salvo los comunes («Guardar», «Cancelar», «Cerrar», «Eliminar»). El verbo sale siempre del vocabulario de BTN-01 §3. La regla no lo cambia: le agrega el objeto cuando sin él la acción queda ambigua. «Guardar» a secas sigue siendo válido en el pie de un formulario de un solo objeto (**I**: así se concilia con `btn-01.md:60`). Lo que Sam vio como «así no» fueron «OK» y «Aceptar».
2. **Máximo tres acciones visibles por grupo de botones** (encabezado, pie de panel, barra de herramientas); la cuarta va al menú de acciones. **No relaja la fila de tabla:** ahí sigue el máximo de dos acciones de bajo énfasis de BTN-01 §4 (`btn-01.md:92`).
3. **Un solo tamaño dentro de un grupo** de botones.
4. **Destructivo en tres énfasis** (relleno, contorno, texto) según el riesgo; nunca icono solo. **Vigente** desde el 2026-11-22: el BRAND-CHECK (abajo) se cerró con BD-077.
5. **Posición fija del icono** respecto del texto. Hoy va a la izquierda (`ActionButton.tsx:213-214`); se fija así.
6. **La etiqueta no se corta**: si no cabe, baja de línea.

> 🛑 **BRAND-CHECK · regla 4**
>
> - **Lo que se pide:** un botón destructivo en tres énfasis (relleno, contorno, texto).
> - **Regla que toca:** `BRAND.md:360` («6 variantes oficiales… No inventes») y la regla de `BRAND.md:11` de avisar antes de una variante nueva. Hoy existe un solo `danger`, con relleno.
> - **Estado: cerrado el 2026-11-22 (BD-077, «regla a»). Texto original:** Sam aprobó la regla viéndola dibujada («Reglas de botones: aprobadas las seis»), pero no se le mostró como excepción de marca.
> - **Cómo se cierra:** Sam confirma la excepción con sus palabras. Se lo pregunta el Director General. Si la confirma, se registra en `BRAND-DECISIONS.md`. Si no, la regla 4 se retira o se reduce a variantes que ya existen.
> - **Resultado:** cerrado con BD-077; la pieza de §4 y la parte de la fase 4 ya pueden implementarse. (Texto previo: en BTN-01 v1.3 se escribe como «pendiente de BRAND-CHECK», no como vigente. La pieza de §4 y su parte de la fase 4 no se implementan.)

**Para los mensajes (enmienda de AVS-01; no contradice ERR-01, que ya pide el error cerca de su causa):**

7. **Cuatro tipos con nombre:** en línea, toast, accionable y llamada.
8. **Persistencia escrita:** en línea, hasta cerrarla o resolver · toast, breve y con la información disponible en otro lado · accionable, se queda · llamada, no se cierra y no es para éxito ni error.
9. **Lugar fijo del aviso de formulario:** encima de la fila de botones del pie.

**Medidas (aprobadas por Sam, §11.2):**

10. **Tres anchos de panel lateral** en vez de 13: `sm` 520, `md` 640 y `lg` 760 px. Es la opción A que eligió Sam (§11.2). Hoy hay 520 en 19 paneles, 560 en 37, 640 en 12 y 720/760 en 8 (**M**, sobre `main` `2daee8546`). Se leyó la etiqueta `<DrawerShell …>` completa de los TSX de producción: 117 paneles, de los cuales 116 tienen `width` numérico. La primera versión de esta spec decía 560 en 36 y 720/760 en 7, porque contaba con una búsqueda por líneas que perdía las etiquetas largas. Corregido aquí.
11. **Un solo tamaño y un solo margen para el título de página.**

## 4. Piezas compartidas

Cada una entra por CMP-01 como `proposed`, con su ficha en `docs/governance/components/` y sus pruebas, y se promueve a `canonical` con al menos un consumidor verificado.

| Pieza | Qué resuelve | Base que ya existe |
|---|---|---|
| `EncabezadoPagina` | Eyebrow, título, subtítulo y acciones, con una medida | `.studio-display`, `.studio-eyebrow` |
| `DrawerShell` con `tamano` | De un número libre a `sm \| md \| lg` | `drawer/DrawerShell.tsx` |
| `DrawerFooter` obligatorio con orden | Secundario a la izquierda, principal a la derecha, destructivo aparte (BTN-01 §4) | `DrawerFooter` |
| Estilos de texto con nombre | Los once roles de VIS-02 §3 como clases de `studio.css` | `tokens.css` |
| `Titulo` y `Seccion` | Nivel de encabezado calculado por anidación | — |
| `Pila` | Separación solo con tokens `--s-*` | — |
| `Ficha` | Pares etiqueta y valor para lo que solo se lee | — |
| `Campo` | Etiqueta, ayuda, error y marca de obligatorio iguales (FRM-01) | Ayudantes en `tms/_components/TruckDrawer.tsx` (deuda anotada en `app/studio/CLAUDE.md`, «Deuda técnica conocida») |
| `TableFrame` extendido | Densidad, cifras a la derecha, encabezado fijo, orden anunciado | `ui/DataTable.tsx` |
| Variante destructiva en tres énfasis (BRAND-CHECK de la regla 4 cerrado el 2026-11-22: BD-077) | Regla 4 | `.studio-btn-danger` |

## 5. Fases

Una fase, una rama, una PR. **Las 55 pantallas no entran juntas.** Cada fase fija su allowlist archivo por archivo al abrirse y la añade aquí.

| Fase | Qué | Tamaño |
|---|---|---|
| **1** | **Reglas:** BTN-01 v1.3, política de mensajes, medidas (§3), con Sam. La regla 4 entró pendiente de BRAND-CHECK y quedó vigente el 2026-11-22 (BD-077) | S |
| **2** | **Estilos de texto con nombre** y `EncabezadoPagina`; se adopta en lo que se ve siempre y en tres módulos de muestra. Incluye las **tres vistas** (§11.5): Normal, Compacta y Súper compacta, montadas sobre esos estilos | M |
| **3** | **Paneles:** `tamano` y `DrawerFooter` obligatorio; migración de los 117 paneles por grupos | M-L |
| **4** | **Botones fuera del sistema:** Noticias Web (23), los 20 bajo 32 px y los 11 sin `type`. La variante destructiva en tres énfasis entra: el BRAND-CHECK de la regla 4 se cerró el 2026-11-22 (BD-077) | M |
| **5** | **Encabezados:** los 91 títulos, por grupos de módulos | L, varias PR |
| **6** | **Rastro de fila** (`useRowHighlight`) en todos los listados con acciones | M |
| **7** | **Tablas:** `TableFrame` extendido y adopción de TBL-01 por módulo | L, varias PR |
| **8** | **`Ficha`, `Campo` y `Pila`**, por módulo | L, varias PR |
| **9** | **Higiene con contrato:** radios, espacios y tamaños sueltos | M, continuo |
| **10** | **Portal · reglas 1 a 9 en el código** (§11.3, opción 2): botones y mensajes del Portal con las mismas reglas que el Studio. Las medidas (anchos, encabezado, escala de texto) **no** entran aquí: esperan al rediseño del Portal. Allowlist al abrirla | M |
| **11 a 18** | **Extras aprobados (§9, §11.4):** una fase por extra, en este orden (**I**): aviso de cambios sin guardar, esqueleto de carga, explicación del botón deshabilitado, barra de acciones por lote, páginas de error y «no encontrado», migas de pan, botón único de «Copiar» y paginación en servidor (TBL-01). Propuesta, fase aparte: cada una fija su allowlist al abrirse y va después de las piezas compartidas de §4 | S-M cada una |

**Portal en la fase 1 (I):** las reglas 1 a 9 se escriben en las políticas con alcance Studio y Portal. En la fase 1 es solo política, sin código; el código del Portal llega en la fase 10.

**Orden de los grupos de módulos** (el mismo en las fases 3, 5, 7 y 8):

1. Lo que se ve siempre: menú lateral, barra superior, inicio de sesión.
2. Operación diaria (**I**): `dashboard`, `embarques`, `tracking`, `clientes`, `cn`, `cobranzas`, `facturacion`, `crm`.
3. Los más inconsistentes por medición: `admin`, `marketing`, `academia`, `mailing`, `inspecciones`, `usuarios`, `bitacora`.
4. Dinero: `contabilidad`, `financiero-china`, `seniat`, `fiscal`, `cotizador`, `nomina`, `proveedores`, `tesoreria`, `gastos`.
5. El resto, en grupos de 5 a 8.

### Fase 1 · allowlist

- `docs/specs/0688-rebrand-simetria-pantallas/spec.md`, `docs/specs/README.md`
- `docs/governance/policies/btn-01.md`, el documento de AVS-01 (localizado: `docs/specs/0165-sistema-gobernanza-experiencia-erp-studio/spec.md`, §17), `docs/governance/README.md`, `docs/governance/generated/` y las fichas de `docs/governance/components/` que citan la versión de BTN-01 (`action-menu`, `confirm-dialog`, `segmented-control`)
- `app/studio/CLAUDE.md` (secciones «Estándar de botones» y «Drawers»), `docs/design/studio/_norte/BRAND-DECISIONS.md` (BD-077), `BRAND.md` (solo el puntero a BD-077 en la línea de botones)
- `.agents/handoffs/0688-rebrand-simetria-pantallas.md`

### Fase 2 · allowlist

Aprobada por el Director el 2026-11-23. Sin paneles, tablas, botones, Portal ni migraciones.

- **Base:** `app/studio/studio.css`, `app/studio/tokens.css`, `app/studio/layout.tsx` (script anti-FOUC), `app/studio/_components/appearance-prefs.ts`
- **Piezas nuevas:** `app/studio/_components/ui/EncabezadoPagina.tsx` (+ prueba), `docs/governance/components/encabezado-pagina.json` (CMP-01, `proposed`), `app/studio/_components/__tests__/estilos-texto-contract.test.ts`
- **Tres vistas:** `app/studio/(app)/_components/DensityToggle.tsx` (selector «Vista», con su prueba), `admin/_components/AppearanceSection.tsx` y `apariencia-predeterminada.test.ts`
- **Lo que se ve siempre:** el título del inicio de sesión (`app/studio/(auth)/login/LoginForm.tsx`). El menú lateral y la barra superior quedan sin migrar a los estilos nombrados: sus tamaños en píxeles (10 a 14) pasarían a seguir la vista y cambiarían la vista por defecto; eso lo decide Sam con los valores a la vista.
- **Muestras:** `calendario/page.tsx`, `tracking/page.tsx` y `dashboard/page.tsx`
- **Pruebas ajustadas por consecuencia, fuera de la allowlist aprobada** (la clase `.studio-densidad` ya no existe): `StudioSidebar-tooltip.test.tsx` y `claridad-controles-contract.test.ts`
- **Documentos:** esta spec y `.agents/handoffs/0688-rebrand-simetria-pantallas.md`

**Cómo quedó la vista (§11.5):** `data-density` vale `normal` (sin atributo; los valores de `:root`), `compact` (por defecto) o `ultra`. «Amplia» (`spacious`) se retira y lo guardado como `spacious` se lee como Normal. Los once tamaños de texto son variables `--t-*` en `tokens.css`, con los valores que Sam aprobó el 2026-11-23.

**Decisiones cerradas por Sam el 2026-11-23** (cita textual, que relayó el Director): «0688: la vista Compacta queda por defecto y apruebo los tamaños propuestos». Cubre cuatro puntos:
- **A · tamaños** de los once roles: los de `tokens.css` (Normal, Compacta y Súper compacta).
- **B · piso de 12 px**: eyebrow y caption a 12 px en las tres vistas.
- **C · «Normal» nueva**: 14 px y filas de 44 px, distinta de la «normal» anterior.
- **D · Súper compacta** comprime espacios y títulos, no el cuerpo; con **Compacta por defecto**.

## 6. Aceptación

Cada regla se vigila con un contrato que mide comportamiento o estructura, con piso y con mutante (`docs/engineering/project-rules.md`, «Contratos que miden el comportamiento»).

- **Encabezado:** toda `page.tsx` de módulo usa `EncabezadoPagina`; lista congelada de pendientes que solo baja. Un solo `<h1>` por pantalla.
- **Paneles:** ningún `DrawerShell` recibe `width` numérico; todo panel con formulario usa `DrawerFooter`. En el pie, el principal es el último en el orden del documento y el destructivo no es adyacente al principal.
- **Texto:** lista congelada de archivos con `fontSize` numérico en línea, que solo baja.
- **Botones:** ningún `<button>` declara alto menor a 32 px; todo `<button>` declara `type`; ningún archivo del Studio usa clases de la web pública para pintar un botón.
- **Rastro:** todo listado con acciones que mutan usa `useRowHighlight`.
- **Tablas:** las tablas adoptadas anuncian el orden (`aria-sort`) y distinguen «sin datos» de «sin coincidencias».
- **Sin regresión:** siguen pasando los contratos de SDD-0603, SDD-0628 y SDD-0678.
- Ningún texto visible cambia salvo las etiquetas de botón que la regla 1 obligue a completar; esas se listan en la PR, una por una, para aprobación.
- **Portal (fase 10):** los contratos de botones (alto mínimo, `type`, etiqueta con verbo del vocabulario, un tamaño por grupo, a lo sumo tres a la vista) y de mensajes (tipo con nombre, persistencia, aviso del formulario encima del pie) corren también sobre `app/portal/`, con su propia lista congelada que solo baja. Las medidas del Portal no se miden en esta fase.
- **Extras (fases 11 a 18):** cada uno trae su contrato con piso y mutante antes de cerrar su fase. Por ejemplo:
  - cerrar un panel con cambios pregunta antes de perderlos;
  - toda ruta del grupo 2 tiene `loading.tsx`;
  - un botón deshabilitado expone su motivo con `aria-describedby`;
  - la barra por lote solo aparece con selección y dice cuántas filas;
  - las páginas de error y «no encontrado» ofrecen cómo volver;
  - las migas de pan reflejan la ruta;
  - hay un solo componente de «Copiar»;
  - la lista paginada no carga más de una página (TBL-01).

  El criterio exacto se fija al abrir cada fase (**I**).

## 7. Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: se retiran primarios repetidos (Noticias Web) |
| Acción dominante | Cumple: una por contexto; se vigila en el pie de los paneles |
| Semántica de color | No cambia aquí: la fija SDD-0686 |
| Contraste | Hereda de los contratos existentes |
| Tokens | Sin colores nuevos. Tokens de medida para los tres anchos de panel y, si hace falta, de tiempo para la confirmación |
| Estados sin color | Cumple |
| Light/dark | Recorrido en pantalla pendiente por fase |
| Móvil | **No conformidad previa sin resolver** (SDD-0603: a 375 px el menú lateral ocupa casi toda la pantalla). Esta spec no la empeora; un panel `lg` se limita a `96vw` como hoy |
| Movimiento reducido | No aplica |

## 8. Verificación y publicación

- `/ui-check` por PR; `/ui-pro` en las pantallas del grupo 2 al cierre.
- Recorrido en la imagen de prueba por fase, en claro, oscuro y compacto, con datos tapados.
- `pnpm verify` con turno del Director; CI verde; revisión independiente que lanza el Director General.
- Fusionar y publicar piden cada uno su autorización.

## 9. Extras (los ocho aprobados por Sam el 2026-11-20, §11 punto 4)

Faltan hoy y mejoran la experiencia. Cada uno es una fase propia (fases 11 a 18 de §5): aviso de cambios sin guardar, esqueleto de carga y `loading.tsx`, explicación accesible del botón deshabilitado, páginas de error y de «no encontrado», migas de pan, botón único de «Copiar», barra de acciones por lote, paginación en servidor (TBL-01). Detalle en `docs/design/rebrand-erp/checklist-y-color.md` §3.

## 10. Lo que esta spec no cubre

Color (SDD-0686), formato de cifras (SDD-0687), las **medidas** en el Portal (anchos, encabezado y escala de texto esperan a su rediseño; las reglas 1 a 9 sí entran, en la fase 10, por la decisión de Sam en §11.3), la web pública, los siete archivos detenidos por la PR #318 (SDD-0603) y cualquier cambio de datos.

## 11. Pendientes de decisión (Sam)

1. ~~Reglas de botones 1 a 6 de §3.~~ **Aprobadas el 2026-11-20.** Sam vio las seis dibujadas, cada una con su «así no» y su «así sí», y respondió: «Reglas de botones: aprobadas las seis». Entran en BTN-01 v1.3.
   Las reglas 7 a 9 (mensajes) quedaron **aprobadas el 2026-11-20**. Sam vio dibujados los cuatro tipos (en línea, toast, accionable y llamada), cada uno con su persistencia, y el lugar fijo del aviso del formulario encima de la fila de botones del pie. Respondió: «Reglas de mensajes: aprobadas las tres». Se escriben como enmienda de AVS-01.
2. ~~Los tres anchos de panel (regla 10).~~ **Decidido el 2026-11-20: opción A, `sm` 520, `md` 640 y `lg` 760 px.** Sam comparó dos opciones dibujadas sobre una pantalla de 1.400 px:
   - **A** (520 · 640 · 760): no cambian 32 de los 116 paneles con ancho numérico y se achican unos 49, sobre todo los 37 que hoy miden 560 y pasan a 520.
   - **B** (560 · 640 · 720, la recomendada): no cambian 56 y se achica 1.

   Respondió: «Anchos de panel: opción A, 520, 640 y 760». **Cómo se aplica (M, conteo de `width={N}` en `<DrawerShell>`):**
   - Cada panel va al ancho más cercano (**I**).
   - Todo panel que se achica se revisa en pantalla. Si un campo, una tabla o el pie no caben en el ancho nuevo, sube al siguiente (520 → 640), nunca a un cuarto ancho (**I**: Sam solo eligió «opción A»; esto es cómo se aplica sin cortar contenido).
   - Esa revisión es parte de la aceptación de la fase que toque cada módulo (**I**).
3. ~~Si la simetría se extiende al Portal.~~ **Decidido el 2026-11-20, opción 2 de tres** (Sam: «la 2»):
   - **Entran ahora al Portal:** las reglas de botones (1 a 6) y las de mensajes (7 a 9). Son reglas de comportamiento, así que el cliente las ve igual que la oficina (**I**: el motivo es el de la propuesta que Sam eligió, no palabras suyas). Se hacen en la fase 10.
   - **Esperan al rediseño del Portal:** las medidas (anchos de panel, encabezado y escala de texto), para no rehacerlas cuando llegue el portal nuevo.
4. ~~Cuáles extras de §9 entran.~~ **Decidido el 2026-11-20: entran los ocho.** Sam marcó en una lista con casillas: «Aviso de cambios sin guardar, Esqueleto de carga, Explicación del botón deshabilitado, Barra de acciones por lote, Páginas de error y no encontrado, Migas de pan, Botón único de Copiar, Paginación en servidor». Cada uno va en su propia fase (fases 11 a 18 de §5). Que vayan después de las piezas compartidas (§4) y que la paginación siga TBL-01 es **I**, no palabras de Sam.
5. **Tres vistas para compactar el Studio (pedido de Sam del 2026-11-21).**
   - **El pedido:** «una opción de tres vistas de zoom, o más bien de compactar»: la original, «Compactar» y «Súper compactar». Sirve para que nadie oprima Control Menos en Chrome, «que lo hace ver mal». Sam quiere que la opción venga incorporada.
   - **La propuesta que vio dibujada:**
     - un selector «Vista» de tres opciones en la barra superior, que reemplaza el botón «Compacto»; también en Administración › Apariencia, donde «Amplio» sale;
     - por defecto, «Compacta», como hoy.
     - Las tres vistas:
       - **Normal:** texto de 14 px y filas de 44 px;
       - **Compacta:** la densidad actual, filas de 36 px;
       - **Súper compacta:** texto un 10 % más chico y filas de 32 px.
     - Piso en todas: texto de 12 px y nada que se oprima bajo 32 px (SDD-0603). El zoom del navegador no se bloquea. El color y el contraste no cambian.
   - **Opciones de construcción:**
     - bien hecha: medidas propias del Studio, montada sobre los estilos de texto con nombre de la fase 2;
     - rápida: `zoom` de CSS. Rompe el piso de 32 px y obliga a revisar arrastres y posiciones calculadas.
   - **Decisión de Sam del 2026-11-21: «Bien hecha, con la 0688».** Entra en la fase 2.
   - **Dónde se guarda la preferencia: decidido el 2026-11-21, «Por navegador».** Sam eligió esa opción sabiendo que la otra guardaba la última elección en el perfil de cada usuario. Se guarda en el navegador, como hoy el tema y la densidad, y no lleva migración. En el chat de la sesión «Rebrand Design», el mismo día, Sam respondió además «Navegador, luego perfil». La fase 2 la guarda en el navegador. Pasarla después al perfil de cada usuario es un paso aparte, con su migración y su OK nominal, que no entra en esta spec.

Con esto, todos los pendientes de decisión de esta spec quedan cerrados.

## 12. Límites

Las cifras son conteos de código; no se abrió ninguna pantalla. Un número suelto puede coincidir con el token y verse bien. El orden por «operación diaria» es inferencia: no se midió el uso real de cada módulo.
