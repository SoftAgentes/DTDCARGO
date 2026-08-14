# Auditoría UI/UX del Portal del Cliente — `/ui-pro app/portal`

| Control | Valor |
|---|---|
| Fecha | 2026-08-14 |
| Alcance | `app/portal/**` (30 rutas · 2 temas) |
| Modo | **Advisory · read-only** — no se aplicó ninguna corrección |
| Rama | `audit/ui-pro-portal-20260814` |
| Commit base | `e7e0c81e` (= `origin/main`) |
| Confidencialidad | interno |

---

## 0. Lo primero: el gate, confirmado contra el código

`NORTE_PORTAL_LIVE = true` en [`lib/portal/demo.ts:45`](../../../lib/portal/demo.ts).
`showNortePortal()` devuelve `true` para **todo** cliente, y
[`app/portal/(app)/layout.tsx:46-48`](<../../../app/portal/(app)/layout.tsx>)
arranca el tema en `"dark"` salvo que la cookie `portal-theme` diga `"light"`.

**El portal es oscuro por defecto para todos los clientes reales.** No es una
cuenta demo. Todo lo que sigue se midió con eso como caso base.

---

## 1. Cómo se midió (y qué NO se pudo medir)

### Lo que sí se midió en vivo

El login del portal es magic link, así que **no hay forma de autenticarse sin
mintear una sesión de producción** — y eso no se hace sin tu OK. En lugar de
calcular a mano (que es lo que dejó el hallazgo abierto sin confirmar), monté un
**banco de medición temporal** en el worktree:

- ruta bajo `app/portal/` → hereda el wrapper real `.portal-sys`;
- un `<div id="portal-shell" data-portal-theme="dark" class="min-h-screen bg-paper">`
  **copiado literal** de `app/portal/(app)/layout.tsx:72-76`;
- adentro, el componente **real** `PortalShell` (sidebar navy + topbar + pie);
- y probes cuyo `className`/`style` se copió **verbatim** del `archivo:línea` que
  cada uno declara.

Sobre eso corrió un medidor en el navegador que respeta las dos trampas conocidas:

1. **Fondo por gradiente.** No se apila `backgroundColor`. Se sube hasta el
   ancestro cuyo `backgroundImage` contiene `gradient`, se toma su parada **más
   clara** (el peor caso) y se apilan encima las capas `rgba` intermedias.
2. **Bordes con transición.** Antes de medir se inyecta
   `*{transition:none!important;animation:none!important}`, porque con el panel
   oculto no se componen frames y `transition-colors` congela el color viejo.

El script completo está en el §8 para que se pueda repetir.

### Lo que quedó **no verificable**

- **Las páginas reales nunca se vieron renderizadas** (sin sesión). Lo medido es
  la cascada CSS real sobre la geometría real del shell, con contenido copiado
  del código fuente. Los pares token↔superficie son sólidos; el **layout real de
  cada pantalla no lo es**.
- **Captura de pantalla: no verificable.** El panel del navegador no estaba
  visible y `screenshot` expiró. No hay evidencia visual adjunta.
- **Spacing, densidad y ritmo vertical por pantalla:** no verificable sin las
  páginas reales. No se puntúa como bueno ni como malo.
- **Recorrido de teclado real (orden de foco, trampas de foco en el cajón
  móvil):** no verificable sin sesión.

### Un error propio, para que quede el rastro

En la primera pasada leí `--portal-nav-ink-soft` desde `.portal-sys` en vez del
elemento que lleva `[data-portal-theme="dark"]`, y me dio **4,32:1** (valor del
tema claro, `#ffffff8c`). El valor correcto en oscuro es `#ffffff80` →
**3,88:1**, y coincide con lo medido directamente sobre el elemento del sidebar
(3,87:1). Las dos vías concuerdan; el número que vale es **3,88:1**.

---

## 2. Hallazgos priorizados

Umbrales: texto normal **4,5:1** · texto grande (≥24 px, o ≥18,66 px bold)
**3:1** · elementos no textuales que transmiten estado **3:1** (WCAG 2.1 §1.4.11).

---

### ⭐ 1 · Los errores de formulario se pintan con `text-wine` — 3,00:1 y además lo prohíbe BTN-01

**Clasificación de gobernanza: `no conformidad`** (BTN-01 v1.1 · **aprobada** →
bloquea) · **`no conformidad`** WCAG 1.4.3.

Medido en vivo, tema oscuro:

| Par | Medido | Umbral | Veredicto |
|---|---|---|---|
| `--color-wine` `#C24450` sobre card `#16264A` | **3,00:1** | 4,5:1 | reprueba |
| `--color-wine` `#C24450` sobre paper `#0B1428` | **3,70:1** | 4,5:1 | reprueba |

Es el **peor contraste de texto funcional de todo el portal** — peor que el
hallazgo que estaba abierto. Y los consumidores no son decorativos: son los
mensajes de error del flujo de compra, a 12–12,5 px, dentro de cards.

> ⚠️ **CORRECCIÓN (2026-08-14, al abrir el SDD-0261): acá decía "14
> consumidores" y el número estaba MAL.** Salió de un grep que sólo agarraba las
> líneas donde `{state.error}` aparece en la MISMA línea que la clase, y la
> mayoría de los mensajes tienen el texto en la línea siguiente. Conteo real con
> un clasificador que mira contexto: **≈42 usos como error en 17 archivos**, más
> **≈76 usos como acento** (eyebrows, enlaces, íconos) que miden el mismo 3,00:1
> pero cuyo arreglo es otro (`--color-wine-text`, 6,44:1). **118 en total.**
> El detalle, la advertencia de que la clasificación es heurística (1 falso
> positivo ya confirmado) y el plan por slices están en
> [SDD-0261](../../specs/0261-portal-el-vino-no-es-el-error/spec.md).

Consumidores (muestra — la lista completa y clasificada es el slice 0 del SDD-0261):

- [`compras/nueva/NewPurchaseForm.tsx:109`](<../../../app/portal/(app)/compras/nueva/NewPurchaseForm.tsx>) · `:131` · `:148` · `:206` · `:208`
- [`compras/nueva/NewPurchaseWizard.tsx:263`](<../../../app/portal/(app)/compras/nueva/NewPurchaseWizard.tsx>) · `:268`
- [`compras/nueva/PurchaseStepDetalle.tsx:119`](<../../../app/portal/(app)/compras/nueva/PurchaseStepDetalle.tsx>) · `:146` · `:171` · `:231`
- [`compras/nueva/SupplierPicker.tsx:442`](<../../../app/portal/(app)/compras/nueva/SupplierPicker.tsx>)
- [`compras/[code]/etiquetas/ServiceSection.tsx:250`](<../../../app/portal/(app)/compras/[code]/etiquetas/ServiceSection.tsx>)
- [`facturas/[code]/reportar/PaymentReportForm.tsx:97`](<../../../app/portal/(app)/facturas/[code]/reportar/PaymentReportForm.tsx>) · `:127` · `:149` · `:174` · `:196` — los 5 con `role="alert"`
- `perfil/DataChangeEditor.tsx:121` · `:201` · `:262` · `reclamos/PortalClaims.tsx:131` · `:149` · `:188` · y 20 más

**La parte de gobernanza es la más dura.** BTN-01 v1.1 §2 dice, textual:
*"el vino de marca no sustituye `danger`"*. Acá el vino **es** el canal de error.
No es sólo contraste: es semántica de estado rota en una política aprobada.

⚠️ El equipo ya sabe la mitad: `SupplierPicker.tsx:430` trae el comentario
*"`text-wine` crudo mide 3.70:1 en el portal oscuro (medido)"* y ahí se corrigió.
El arreglo **no se propagó** a los otros 13 consumidores.

**Componente:** ninguno registrado en CMP-01 — es markup suelto por pantalla.

---

### 2 · `aria-busy` no existe en NINGÚN botón del portal

**Clasificación: `no conformidad`** (BTN-01 v1.1 §5 · **aprobada** → bloquea).

Conteo sobre `app/portal/**`:

| Señal | Cantidad |
|---|---|
| `aria-busy` | **0** |
| Botones con etiqueta de carga (`Guardando…`, `Enviando…`, …) | 23 |
| Archivos con `useActionState` | 19 |
| `role="alert"` | 12 |
| `aria-live` | 2 |

BTN-01 §5, fila **Loading**: *"Bloquea repetición, conserva ancho, muestra verbo
en progreso y `aria-busy`"*. Las tres primeras se cumplen (`disabled={pending}` +
label activo). **La cuarta no se cumple en ningún caso.** Un lector de pantalla
no se entera de que la operación está en curso.

Ejemplo canónico del patrón, que hace todo bien salvo esto:
[`academia/_components/MarkLessonButton.tsx:42-58`](<../../../app/portal/(app)/academia/_components/MarkLessonButton.tsx>).

Es la no conformidad **más barata de cerrar** del informe: un atributo por botón.

---

### 3 · `--color-status-danger` sobre card: 4,29:1 — **el hallazgo abierto se CONFIRMA**

**Clasificación: `no conformidad`** WCAG 1.4.3 · gobernanza: **`no conformidad`**
(A11Y-01 v1.1 aprobada).

Medido en vivo, no calculado:

| Superficie (tema oscuro) | Color compuesto | Medido | Veredicto |
|---|---|---|---|
| Card `#16264A` (`bg-white`) | `#E0606B` | **4,29:1** | **reprueba** 4,5:1 |
| Paper `#0B1428` (fondo de página) | `#E0606B` | 5,29:1 | pasa |
| Sidebar, parada clara `#26406F` | `#E0606B` | 2,96:1 | reprueba 3:1 (ver #8) |

El número calculado (~4,29:1) era exacto. **Y falla sólo sobre cards** — que es
justo donde viven los formularios. Sobre el fondo de página pasa; por eso podía
"verse bien" en una revisión rápida.

Barrido de consumidores del token en oscuro (más allá del que ya estaba citado):

- [`academia/_components/MarkLessonButton.tsx:60`](<../../../app/portal/(app)/academia/_components/MarkLessonButton.tsx>) — 13 px, `role="alert"` ✔ (el citado)
- [`cotizaciones/CotizacionRequestForm.tsx:16`](<../../../app/portal/(app)/cotizaciones/CotizacionRequestForm.tsx>) — 12 px, error de campo
- [`_components/AdvanceToCotizacionButton.tsx:35`](../../../app/portal/_components/AdvanceToCotizacionButton.tsx) — 12 px
- [`facturas/[code]/aceptar/AcceptanceForm.tsx:164-166`](<../../../app/portal/(app)/facturas/[code]/aceptar/AcceptanceForm.tsx>) — texto **y** borde
- [`facturas/[code]/reportar/PaymentReportForm.tsx:206-208`](<../../../app/portal/(app)/facturas/[code]/reportar/PaymentReportForm.tsx>) — texto **y** borde

**En tema claro este token pasa.** La falla es exclusiva del oscuro, que es el
default. Ver §5 para por qué el arreglo obvio no es tan obvio.

---

### 4 · `--color-status-success` reprueba en LOS DOS temas

**Clasificación: `no conformidad`** WCAG 1.4.3.

| Par | Tema | Medido | Umbral |
|---|---|---|---|
| `#1F8A5B` sobre card `#FFFFFF` | claro | **4,33:1** | 4,5:1 |
| `#1F8A5B` sobre paper `#FBFAF7` | claro | **4,15:1** | 4,5:1 |
| `#1F8A5B` sobre grey-100 `#F2F0EC` | claro | **3,81:1** | 4,5:1 |
| `#2EA36E` sobre grey-100 `#1F3055` | oscuro | **4,08:1** | 4,5:1 |
| `#2EA36E` sobre card `#16264A` | oscuro | 4,67:1 | pasa (apenas) |

Consumidores como texto:
[`academia/page.tsx:106`](<../../../app/portal/(app)/academia/page.tsx>) (11 px bold) ·
[`academia/[courseId]/page.tsx:136`](<../../../app/portal/(app)/academia/[courseId]/page.tsx>) (10 px bold sobre `bg-grey-100` — el peor: 3,81:1 claro / 4,08:1 oscuro) ·
[`club/page.tsx:108`](<../../../app/portal/(app)/club/page.tsx>) ·
[`reclamos/_components/PortalClaims.tsx:207`](<../../../app/portal/(app)/reclamos/_components/PortalClaims.tsx>).

Existe `--color-status-success-on-dark` (`#6ee7a8`), pero **no resuelve el tema
claro**, que es donde peor está. Nótese que
[`facturas/_components/StatementLedgerTable.tsx:50`](<../../../app/portal/(app)/facturas/_components/StatementLedgerTable.tsx>)
ya documenta el 4,33:1 — el dato estaba, la corrección no se propagó.

---

### 5 · Sub-etiquetas del sidebar: 3,88:1 a 8,5–9,5 px

**Clasificación: `no conformidad`** WCAG 1.4.3 · recomendación adicional sobre el
tamaño (**esto último es recomendación mía, NO regla aprobada — no bloquea**).

`--portal-nav-ink-soft` en oscuro es `#ffffff80` → compuesto **`#93A0B7`** sobre
`#26406F` (parada más clara de `--portal-nav-bg`) = **3,88:1**.

Consumidores como **texto** (reprueban 4,5:1):

- [`PortalSidebar.tsx:350-351`](../../../app/portal/_components/PortalSidebar.tsx) — 9 px
- `PortalSidebar.tsx:512-513` — 9,5 px (encabezados de sección: "MI CARGA", "ALERTAS", "ADJUNTOS")
- `PortalSidebar.tsx:559-560` — 9 px
- `PortalSidebar.tsx:683-688` — **8,5 px** (sub-etiqueta mono del ítem de nav)

El mismo token usado como **ícono** (`PortalSidebar.tsx:645`) pasa: 3,88:1 ≥ 3:1
para no-texto → eso es **`cumplimiento`**.

La etiqueta principal del nav usa `--portal-nav-ink` = 8,34:1 → **`cumplimiento`**.

*Recomendación no bloqueante:* 8,5 px es más chico que cualquier mínimo razonable
de cuerpo, incluso para una etiqueta secundaria en mono.

---

### 6 · El marco del video se INVIERTE en oscuro (queda crema en una interfaz oscura)

**Clasificación: `no conformidad`** de VIS-01 (aprobada) · **contraste: pasa**.

[`academia/[courseId]/[lessonId]/page.tsx:44`](<../../../app/portal/(app)/academia/[courseId]/[lessonId]/page.tsx>):
`<div className="... bg-ink aspect-video ...">` con
`<p className="text-[13px] text-white/85">` en la línea 54.

En oscuro los dos tokens voltean:

| | Claro | Oscuro (medido) |
|---|---|---|
| `bg-ink` | `#0F1E3D` navy | **`#F2F0EC` crema** |
| `text-white/85` | blanco 85 % | navy 85 % → compuesto `#374462` |
| Contraste | 12,18:1 | 8,51:1 |

**El contraste pasa en ambos.** El problema es otro: en modo oscuro el marco 16:9
del reproductor es un **bloque crema a pantalla casi completa** en medio de una
interfaz navy. Es el patrón conocido de `--ink` usado como fondo.

Este archivo es el único consumidor de `bg-ink` en todo `app/portal`.

---

### 7 · `BrandMark variant="reverse"`: la mitad "DTD" del logo desaparece en el pie oscuro

**Clasificación: `excepción` candidata** — requiere `BRAND-CHECK`, **no** es no
conformidad WCAG (los logotipos están exentos de 1.4.3).

[`components/BrandMark.tsx:30-34`](../../../components/BrandMark.tsx) fija para
`reverse`: `dtd: "#7F0F1A"` (con el comentario *"wine sólido (NO wine-soft, regla
del brand book)"*) y `cargo: "#FBFAF7"`.

[`PortalFooter.tsx`](../../../app/portal/_components/PortalFooter.tsx) monta
`variant="reverse"` sobre un pie con `background: var(--color-white)` =
**`#16264A`** en oscuro.

| Mitad | Color | Sobre `#16264A` |
|---|---|---|
| "DTD" | `#7F0F1A` | **1,41:1** |
| "Cargo" | `#FBFAF7` | 14,27:1 |

En el pie del portal oscuro el lockup se lee **"Cargo"**. Incluso sobre el navy
para el que `reverse` fue pensado (`--color-ink` `#0F1E3D`) da ~1,57:1, así que
**no es un problema del portal: es de la variante**.

Como el comentario invoca una regla del brand book, **no propongo cambiarlo**:
va a `BRAND-CHECK` para que decidas.

---

### 8 · Punto de aviso rojo del sidebar: 2,96:1 (no-texto, umbral 3:1)

**Clasificación: `no conformidad`** WCAG 1.4.11 — **marginal**.

[`PortalSidebar.tsx:653`](../../../app/portal/_components/PortalSidebar.tsx):
`background: var(--color-status-danger)` sobre la parada clara del nav `#26406F`
= **2,96:1**. Falla por 0,04.

Es el **único** indicador de "hay respuesta nueva en Soporte" cuando el sidebar
está colapsado. Lleva un `border: 2px solid var(--portal-nav-solid)` que lo
recorta, así que la forma ayuda; pero el color del relleno es el portador del
estado y queda a un pelo del umbral.

La insignia ámbar del candado, en cambio, mide **4,42:1** → **`cumplimiento`**.

---

### 9 · Los bordes de campo son casi invisibles en oscuro

**Clasificación: `no conformidad`** WCAG 1.4.11 (input) · el borde de card es
decorativo → **`no aplica`**.

| Elemento | Tema | Borde vs fondo | Umbral |
|---|---|---|---|
| Input en reposo `border-grey-200` sobre card | oscuro | **1,30:1** | 3:1 |
| Input en reposo `border-grey-200` sobre card | claro | **1,25:1** | 3:1 |
| Botón `.btn-ghost` `border-grey-300` sobre card | oscuro | **1,77:1** | 3:1 |

El agravante en oscuro: el input usa `bg-white` y la card también, o sea
**`#16264A` sobre `#16264A`**. El campo no tiene relleno propio que lo separe —
su único límite es un borde a 1,30:1. Referencia:
[`cotizaciones/CotizacionRequestForm.tsx:14`](<../../../app/portal/(app)/cotizaciones/CotizacionRequestForm.tsx>).

**El foco sí está impecable** (§3 de lo que cumple).

---

### 10 · Comentarios desactualizados: `globals.css` sigue diciendo "SOLO para cuentas demo"

**Clasificación: `no conformidad`** documental (AGENT-BRIEF: el repo es la fuente
normativa). Riesgo real: **manda a leer mal el gate**.

Cuatro bloques de [`app/globals.css`](../../../app/globals.css) describen el
portal oscuro como si siguiera gateado al demo, cuando
`NORTE_PORTAL_LIVE = true` desde hace tiempo:

| Línea | Texto | Estado |
|---|---|---|
| 97-98 | *"gateados al demo. Sólo existen cuando el shell tiene `[data-portal-theme]` (lo pone el layout **SOLO para cuentas demo**)"* | **falso** |
| 117-119 | *"DARK MODE del PORTAL — **gateado al demo**… **SOLO para cuentas demo**"* | **falso** |
| 122 | *"**Cuando se prenda para todos**, este bloque se mantiene"* | ya se prendió |
| 168 | *"tema del portal **demo**"* | **falso** |
| 284 | *"para que existan también en las cuentas **sin tema** (portal claro)"* | ya no hay cuentas sin tema |

Y en [`lib/portal/demo.ts:1-22`](../../../lib/portal/demo.ts) el bloque de
cabecera sigue describiendo el diseño gateado ("solo las cuentas DEMO lo ven; los
clientes reales siguen con el portal actual") — sólo el comentario de
`NORTE_PORTAL_LIVE` (líneas 36-44) está al día. Un agente que lea de arriba hacia
abajo se lleva la versión vieja.

---

### 11 · El portal no consume ningún componente `canonical` de CMP-01

**Clasificación: `no aplica` hoy, con deuda declarada** — CMP-01 v1.1 exige *"usar
componentes `canonical`; no crear consumidores nuevos de un `deprecated`"*, pero
**los cuatro componentes registrados viven en `app/studio/_components/ui/`** y el
portal no importa de ahí.

Salida de `pnpm components:check` (registro completo):

| Estado | Componente | Consumidores |
|---|---|---|
| `canonical` | `ConfirmDialog` | 4 |
| `canonical` | `NumericInput` | 1 |
| `canonical` | `SegmentedControl` | 3 |
| `deprecated` | `LLMModeToggle` | 1 |

Consumidores desde `app/portal`: **cero**, en los cuatro. Verificado con grep.

✅ **No hay ningún consumidor nuevo de `LLMModeToggle` (deprecated) en el portal.**
Nada de lo que propongo suma consumidores a un deprecated.

Consecuencia práctica: el portal reimplementa por pantalla lo que el Studio ya
tiene canonizado (diálogos, campos numéricos, controles segmentados). Eso choca
con **SGE-00.09** (*"La misma necesidad debe reutilizar el mismo patrón"*). Para
cerrarlo hay que **promover los componentes a un lugar compartido**
(`components/` o `lib/shared/`), y eso es un SDD propio, no un arreglo de UI.

---

### 12 · Dos detalles de disciplina de tokens

**Clasificación: `no conformidad`** de BRAND.md regla 1 (sólo tokens `var(--*)`).
Impacto visual: **nulo** — pero el token existe justamente para que nadie tenga
que acordarse.

- [`proveedores/SuppliersClient.tsx:112`](<../../../app/portal/(app)/proveedores/SuppliersClient.tsx>)
  — `color: "#fff"` hardcodeado sobre un relleno verde. El token correcto es
  `--color-on-accent` (que vale `#ffffff` y **no** voltea por tema, a diferencia
  de `--color-white`).
- [`app/portal/(app)/layout.tsx`](<../../../app/portal/(app)/layout.tsx>) y
  `globals.css:322-324` usan `220ms` local para la transición del sidebar, fuera
  de los tokens 120/180/260 ms de **MOT-01**. Desviación menor, ya registrada
  como brecha genérica en el índice de gobernanza.

---

## 3. Lo que SÍ cumple (medido, no supuesto)

Vale decirlo porque cambia dónde conviene invertir:

| Punto | Medida | Clasificación |
|---|---|---|
| Aro de foco `.btn:focus-visible` (3 px `--color-ink`) | **13,08:1** sobre card · **16,12:1** sobre paper | `cumplimiento` — BTN-01 §5 pide 3:1 |
| `<button>` con `type` explícito | **94 de 94** | `cumplimiento` — BTN-01 §2 |
| `bg-white` / `text-white` como tokens que voltean | usado a propósito, con comentarios que lo explican en 6 archivos | `cumplimiento` |
| `.btn-primary` usa `--color-on-accent`, no `--color-white` | evita el navy-sobre-wine (3,00:1) | `cumplimiento` |
| Texto principal `--color-ink` sobre card | **13,08:1** oscuro · 16,49:1 claro | `cumplimiento` |
| `--color-grey-500` (cuerpo secundario) | 4,85:1 card · 5,97:1 paper (oscuro) | `cumplimiento` |
| `--color-wine-text` (`#d89aa4`) para enlaces | 6,44:1 card · 7,93:1 paper | `cumplimiento` |
| `--portal-info` (`#5b9bd5`) KPI | 5,03:1 card · 6,20:1 paper | `cumplimiento` |
| `--color-status-warning` como texto grande (26 px Archivo Black) | 3,14:1 claro / 6,41:1 oscuro — umbral 3:1 | `cumplimiento` |
| `PortalVerifyGate` | el ámbar va al **ícono y al aro**, el texto va en `--color-ink`/`grey-700`; documentado en su cabecera | `cumplimiento` ejemplar |
| `PendingAcceptanceCard`, `CedulaPhotoRow` | mismo criterio: ámbar al borde, texto en `grey-700` | `cumplimiento` |
| `prefers-reduced-motion` | 12 bloques en `globals.css`, cubren `.glass-pop` y `.portal-main` | `cumplimiento` — MOT-01 |

Corrección a algo que yo mismo había marcado a media auditoría: **el ámbar como
texto NO es un hallazgo**. Sus consumidores reales
([`facturas/page.tsx:269`](<../../../app/portal/(app)/facturas/page.tsx>),
[`finanzas/page.tsx:220`](<../../../app/portal/(app)/finanzas/page.tsx>)) lo usan
a **26 px con Archivo Black**, o sea texto grande → umbral 3:1 → pasa con 3,14:1.
Mi probe inicial lo midió a 13 px, que no es como se usa.

---

## 4. Scores por dimensión

| # | Dimensión | Score | Base de la nota |
|---|---|---|---|
| 1 | **Contraste WCAG** | **5,0** | 9 pares reprueban, 4 de ellos en texto funcional. Pero el foco y el cuerpo están impecables. |
| 2 | Jerarquía visual | 7,0 | Sólida en el shell real. **Parcial:** sin páginas reales no se juzgó cada pantalla. |
| 3 | Tipografía | 6,0 | Sistema limpio (Sora/Nunito por wrapper). Lo que baja la nota es 8,5 px en el nav. |
| 4 | Spacing y densidad | **no verificable** | Sin las pantallas renderizadas. No se puntúa. |
| 5 | Estados (BTN-01 §5) | **4,0** | `aria-busy` 0/23. `disabled` y label de carga sí están. |
| 6 | Heurísticas (Nielsen/Krug/Norman) | 7,0 | Buen "visibilidad del estado" en lo visual; falla en lo asistivo. |
| 7 | Accesibilidad WCAG 2.2 AA | **5,5** | Foco excelente, `type` al 100 %, `role="alert"` en 12 puntos; contra eso, 1.4.3 y 1.4.11 con fallas reales. Teclado **no verificable**. |
| 8 | Motion | 8,0 | `prefers-reduced-motion` bien cubierto; una duración local fuera de token. |
| 9 | AI slop | **9,0** | Cero gradiente colorido, cero glassmorphism fuera del alcance aprobado (BD-031), cero emoji decorativo. Disciplina de tokens alta y comentada. |
| 10 | Copy | 8,0 | Español venezolano consistente, verbos directos. **Parcial:** leído en código, no en pantalla. |

**Score compuesto de lo medible: 6,4 / 10.**
Sin las dos dimensiones no verificables, y sin promediar lo que no se midió.

---

## 5. Marca: por qué el arreglo "obvio" del rojo no es obvio

`--color-status-danger-on-dark` (`#f6929a`) **ya existe** en `globals.css:49`,
aprobado por vos el 2026-08-13. **No propongo inventar ningún token.** Pero antes
de mudarlo al portal hay un dato que el análisis original no midió.

### Contraste del candidato en las superficies del portal (medido)

| Superficie | Medido | Umbral |
|---|---|---|
| Card `#16264A` | **6,73:1** | 4,5:1 ✔ |
| Paper `#0B1428` | **8,29:1** | 4,5:1 ✔ |
| Grey-100 `#1F3055` | **5,89:1** | 4,5:1 ✔ |
| Sidebar, parada clara `#26406F` (peor caso) | **4,64:1** | 4,5:1 ✔ |

Pasa en las cuatro, incluido el peor caso.

### 🔴 Pero la distancia perceptual, contra el vecino DEL PORTAL, es la que se rechazó

ΔE2000 medido:

| Par | ΔE2000 | Lectura |
|---|---|---|
| `#f6929a` vs **`--color-wine-text` `#d89aa4`** (el del portal) | **7,1** | 🔴 |
| `#f6929a` vs `--color-wine-on-dark` `#d59fa7` (web pública) | 8,4 | límite |
| `#f6929a` vs `--color-wine` `#c24450` | 22,0 | se distinguen |
| `#f6929a` vs `--color-status-success-on-dark` `#6ee7a8` | 61,8 | se distinguen |
| **`--color-status-danger` actual `#e0606b` vs `#d89aa4`** | **15,5** | se distinguen |

**ΔE 7,1 es exactamente el número que el propio `globals.css:38-44` rechazó** al
descartar la receta `#e59fa4` — ahí se escribió *"a 11px son el MISMO color"*. El
token aprobado reproduce ese mismo defecto en el portal, sólo que contra otro
vecino: `--color-wine-text`, que el análisis original no evaluó porque comparó
contra el token de la web pública.

Y en el portal **los dos conviven de verdad**: `text-wine-text` pinta los enlaces
(el pie usa "Términos" y "Privacidad" así) mientras el rojo pintaría los errores.
A 12–13 px quedarían indistinguibles.

Nótese la ironía: el token **actual** (`#e0606b`) sí se distingue del wine-text
(ΔE 15,5). Su problema es de contraste, no de identidad. El candidato invierte
exactamente el trade-off.

### Tres caminos — **la decisión es tuya, ninguno se aplicó**

1. ⭐ **Quitarle al color el peso de ser el único portador.** SGE-00.11 lo exige
   igual: *"Color, icono o animación nunca son el único portador del
   significado"*. Un ícono + prefijo ("Error: …") en los mensajes arregla la
   semántica **sea cual sea el hue**, y baja el riesgo de la colisión ΔE. Es lo
   único que no depende de una decisión de marca.
2. **Adoptar `#f6929a` y mover los enlaces del portal fuera de `wine-text`,** para
   que los dos tonos dejen de convivir.
3. **Un token de peligro propio del portal.** Es decisión tuya y no lo invento:
   habría que medirlo contra `#d89aa4` (ΔE ≥ 15 sería lo consistente con el
   criterio ya aplicado) y contra el peor caso `#26406F`.

---

## 6. Gobernanza

### Salida de los checks, tal cual

`pnpm governance:check` — corrido en el checkout principal, commit `e7e0c81e`
(idéntico al de la rama):

```
$ node scripts/build-governance-capsule.mjs --check
Gobernanza: 27 política(s) aprobada(s) · cápsula vigente
```

`pnpm components:check`:

```
$ node scripts/validate-component-registry.mjs
CMP-01 válido: 4 fuente(s), agregado reproducible y cero rutas rotas
```

**Los dos pasan.** Ninguno de los hallazgos de este informe los rompe: `governance:check`
valida que la cápsula sea reproducible, y `components:check` valida el registro
CMP-01 — ninguno mide adopción en pantallas.

### El portal SÍ está en alcance

Lo verifiqué antes de clasificar, porque el índice se titula "ERP_Studio".
[SGE-00 §2](../../governance/policies/sge-00.md) dice, textual, que aplica a
*"**portal**, correos, facturas, estados de cuenta y PDF originados por el ERP"*.
Queda descartado clasificar el portal como `no aplica` por superficie.

### Clasificación de cada hallazgo

| # | Hallazgo | Política | Clasificación | ¿Bloquea? |
|---|---|---|---|---|
| ⭐1 | Errores en `text-wine` | **BTN-01 v1.1 §2** (aprobada) + WCAG 1.4.3 | **no conformidad** | **sí** |
| 2 | `aria-busy` ausente | **BTN-01 v1.1 §5** (aprobada) | **no conformidad** | **sí** |
| 3 | `danger` 4,29:1 sobre card | **A11Y-01 v1.1** (aprobada) + WCAG 1.4.3 | **no conformidad** | **sí** |
| 4 | `success` en los 2 temas | A11Y-01 + WCAG 1.4.3 | **no conformidad** | **sí** |
| 5 | Sub-etiquetas nav 3,88:1 | A11Y-01 + WCAG 1.4.3 | **no conformidad** | **sí** |
| 5b | 8,5 px es muy chico | — | *recomendación mía* | **no** |
| 6 | `bg-ink` se invierte | **VIS-01** (aprobada) | **no conformidad** | **sí** |
| 7 | BrandMark `reverse` | `BRAND.md` | **excepción** a decidir (`BRAND-CHECK`) | **no** |
| 8 | Punto de aviso 2,96:1 | A11Y-01 + WCAG 1.4.11 | **no conformidad** (marginal) | **sí** |
| 9 | Bordes de input 1,30:1 | A11Y-01 + WCAG 1.4.11 | **no conformidad** | **sí** |
| 9b | Borde de card 1,25–1,30:1 | — | **no aplica** (decorativo) | **no** |
| 10 | Comentarios "demo" | AGENT-BRIEF | **no conformidad** documental | **no** |
| 11 | Cero componentes canonical | **CMP-01 v1.1** + SGE-00.09 | **no aplica** hoy · deuda declarada | **no** |
| 12 | `#fff` + `220ms` | `BRAND.md` r.1 · MOT-01 | **no conformidad** menor | **no** |

**Lo que bloquea y lo que no, explícito:** las filas marcadas "sí" incumplen
políticas **aprobadas** (BTN-01 v1.1, A11Y-01 v1.1, VIS-01 v1.0) o WCAG AA. Todo
lo demás —incluyendo mis tres propuestas del §5 y el comentario sobre 8,5 px— son
**recomendaciones mías y no se elevan solas a bloqueantes**. La decisión de qué
entra a un SDD es tuya.

### Estado de componentes

Ningún hallazgo involucra un componente `canonical`: el portal no consume
ninguno (§11). Ninguna propuesta de este informe **suma consumidores a
`LLMModeToggle`**, el único `deprecated` del registro.

---

## 7. Sobre la causa

Hay una tentación de decir "la causa es que los tokens de estado no tienen
hermano on-dark en el portal". **No lo afirmo.** Los hallazgos 1, 3, 4, 5 y 8
comparten síntoma (contraste insuficiente en oscuro) pero **no comparten causa
comprobada**: el #1 es semántico antes que cromático (vino usado como danger), el
#4 falla también en claro, y el #5 nace de un `rgba(255,255,255,0.5)` del nav que
no tiene nada que ver con los tokens de estado.

Arreglar los cinco de una pasada haría desaparecer el síntoma sin que sepamos
cuál era la causa de cada uno. Si se van a tocar, conviene tocarlos por separado
y medir después de cada uno.

Lo que sí está comprobado como patrón —porque tiene dos casos con evidencia
documental— es que **la corrección se descubre y no se propaga**:
`SupplierPicker.tsx:430` documenta el 3,70:1 del wine y arregla sólo ahí;
`StatementLedgerTable.tsx:50` documenta el 4,33:1 del verde y arregla sólo ahí.
En los dos casos el resto de los consumidores quedó como estaba.

---

## 8. Cómo repetir la medición

El banco de medición **se borró** (era una ruta dentro de `app/portal/`, no podía
quedar en el árbol). Para reconstruirlo:

1. Crear `app/portal/probe-audit/page.tsx` con un
   `<div id="portal-shell" data-portal-theme="dark" className="min-h-screen bg-paper">`
   copiado de `app/portal/(app)/layout.tsx:72-76`, adentro `<PortalShell …>` real
   y los probes con `className` copiado verbatim del `archivo:línea`.
2. `node node_modules/next/dist/bin/next dev --port 3200`
3. En la consola del navegador, **primero** matar transiciones:
   `document.head.insertAdjacentHTML('beforeend','<style>*{transition:none!important;animation:none!important}</style>')`
4. Resolver el fondo **subiendo hasta el ancestro con `backgroundImage` que
   contenga `gradient`** y tomando su parada más clara; apilar encima las capas
   `rgba`. Nunca apilar `backgroundColor` sin más.
5. Resolver colores en formatos modernos (`oklab`, `color()`) pintándolos en un
   `<canvas>` de 1×1 y leyendo el píxel — `getComputedStyle` devuelve `oklab(…)`
   para `text-white/85` y no se parsea con un regex de `rgb()`.
6. Leer tokens **desde el elemento que lleva `[data-portal-theme]`**, no desde
   `.portal-sys` (ahí viven los valores del tema claro — es el error que cometí).
7. Para el tema claro: `document.getElementById('portal-shell').setAttribute('data-portal-theme','light')`.

---

## 9. Entrega

| | |
|---|---|
| **Rama** | `audit/ui-pro-portal-20260814` |
| **Worktree** | `C:/Users/Trabajo/Desktop/Developer/software/DTD-worktrees/audit-portal` |
| **Push** | **no** — sin OK del founder |
| **Archivos de producto tocados** | **ninguno** (advisory read-only, sin `--fix`) |
| **Archivo creado** | este informe |
| **Archivo temporal creado y borrado** | `app/portal/probe-audit/page.tsx` (banco de medición) |
| **Servidores de desarrollo** | levantados en 3100 y 3200, **ambos detenidos** al cerrar |

### Pendientes que quedan para vos

1. **Decidir** cuáles de las 9 no conformidades bloqueantes entran a un SDD y en
   qué orden. Sugerencia de arranque: #2 (`aria-busy`) por ser la más barata, y
   #1 (`text-wine`) por ser la más grave.
2. **`BRAND-CHECK` del hallazgo 7** (BrandMark `reverse`) — toca una regla del
   brand book, no la toco.
3. **Decidir el camino del rojo** entre las 3 opciones del §5. Ninguna se aplicó.
4. **No verificable pendiente:** el recorrido de teclado real, el spacing por
   pantalla y la evidencia visual necesitan una sesión autenticada. Si autorizas
   mintear una sesión de la cuenta demo `DTD-1004` con service-role, se cierra
   esa parte; **no lo hice porque toca auth de producción**.
