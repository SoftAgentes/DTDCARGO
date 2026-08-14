# Auditoría UI/UX y gobernanza — Studio › Clientes

| Control | Valor |
|---|---|
| Fecha | 2026-08-14 |
| Alcance | `app/studio/(app)/clientes/**` (7.270 líneas · 3 rutas) + `lib/studio/client-queries.ts` |
| Modo | **Advisory · read-only** — no se aplicó ninguna corrección |
| Rama | `audit/ui-pro-clientes-20260814` |
| Disparador | Founder: *"no me gusta cómo está actualmente el menú"* → confirmado: **la cabecera del módulo** |
| Confidencialidad | interno |

---

## 0. Lo primero: en este módulo NO hay ningún menú

Antes de auditar "el menú" fui a buscarlo. **No existe.** En todo
`app/studio/(app)/clientes/` hay **cero** `role="menu"`, cero dropdown, cero
popover. Y el kit de interfaz del Studio (`app/studio/_components/ui/`)
**tampoco tiene una primitiva de menú**: hay `ActionButton`,
`SplitActionButton`, `ConfirmDialog`, `DataTable`, `SegmentedControl`… pero
ningún menú de acciones.

Eso reencuadra el problema. Lo que molesta no es un menú mal hecho: es que
**dos tareas de mantenimiento no tienen dónde vivir**, así que se colgaron de la
cabecera como botones grises permanentes.

---

## 1. Hallazgos priorizados

---

### ⭐ 1 · La cabecera: dos acciones raras compitiendo con la primaria, sin menú donde meterlas

**Clasificación: `no conformidad`** — BTN-01 v1.1 §4 (**aprobada** → bloquea).

[`ClientsClient.tsx:112-130`](<../../../app/studio/(app)/clientes/_components/ClientsClient.tsx>):

```
[ Posibles duplicados ]  [ Códigos del legado ]  [ + Nuevo cliente ]
      ghost                    ghost                  primario
```

BTN-01 §4, fila **Header de página**, dice textual:

> Navegación/terciarias primero; secundarias después; primaria al extremo
> derecho. **Acciones raras pasan al menú.**

Las dos primeras son **exactamente** acciones raras: fusionar duplicados
(SDD-0246) y migrar códigos del legado (SDD-0258) son mantenimiento episódico,
no trabajo diario. Hoy ocupan permanentemente el mismo renglón que la única
acción que un comercial usa todos los días.

**Y no se pueden mandar al menú porque no hay menú.** Ésa es la causa real: la
cabecera no está mal diseñada por descuido, está mal diseñada porque el sistema
no ofrece el contenedor que la política presupone.

#### No es sólo la cabecera: los destinos son callejones sin salida

Medido en las dos sub-páginas:

| | `/clientes/duplicados` | `/clientes/migrar-legado` |
|---|---|---|
| Enlace de vuelta a Clientes | **ninguno** | **ninguno** |
| Entrada en la barra lateral | **ninguna** | **ninguna** |
| Eyebrow (migaja) | dice **"Comercial"** | dice **"Clientes"** |

*(El `←` de `DuplicadosClient.tsx:137` **no** es un volver: es una flecha
decorativa `aria-hidden` entre dos fichas.)*

Entonces el recorrido completo es: entras por un botón gris de la cabecera,
llegas a una página que no está en el menú lateral, y una vez ahí **no hay
manera de volver dentro de la página** — sólo el botón atrás del navegador o
reclicar Clientes en la barra. Y la migaja te dice dos cosas distintas según a
cuál entraste.

#### Componente involucrado

Ninguno `canonical`: es markup suelto. **Ninguna propuesta de este informe suma
consumidores a `LLMModeToggle`**, el único `deprecated` del registro.

#### 🔴 CORRECCIÓN (2026-08-14, al abrir el SDD-0263): acá dije que el patrón se repetía, y NO se repite

La versión original de esta sección traía un conteo de `studio-btn-ghost` por
archivo (Naviera 6, Nómina 5, Fiscal 5, Academia 4, Proveedores 4) y decía *"esto
no es exclusivo de Clientes"*. **Ese conteo era de ocurrencias en el archivo
entero, no de la cabecera** — lo advertí, pero la conclusión igual insinuaba una
amplitud que no existe.

Al abrirlos uno por uno:

| Módulo | Cabecera real |
|---|---|
| Naviera | 1 ghost + 1 primario (`NavieraClient.tsx:152,159`) — **forma correcta** |
| Academia | 1 ghost + 1 primario (`AcademiaClient.tsx:109,116`) — **forma correcta** |
| Fiscal · Nómina · Proveedores · Reclamos | sus ghosts son **filtros** o **acciones de fila**, no cabecera |
| **Clientes** | **2 ghosts + 1 primario** |

**Clientes es el caso atípico, no la norma.** Retiro la afirmación.

Eso **no** debilita la recomendación de la primitiva, pero le cambia el
fundamento: no se justifica por cabeceras cargadas, se justifica por los **cinco
menús armados a mano** que sí existen y que el SDD-0263 documenta.

---

### 2 · Se borra una dirección de entrega del cliente SIN preguntar nada — ✅ CERRADO

> ✅ **Resuelto en `origin/main` por
> [SDD-0262](../../specs/0262-confirmar-borrado-de-direccion/spec.md)** (commit
> `c36966fb`). El botón abre un `ConfirmDialog` con el nombre de la dirección y
> su consecuencia, en `--danger`, con el error dentro del diálogo.
>
> ⚠️ **Se implementó DOS VECES.** Esta ventana lo implementó en paralelo, con el
> mismo número de SDD y el mismo análisis (P2/R2 por MP-01, sin camino de
> restauración → no califica R1). Al mergear se conservó **la versión publicada**
> —regla de AGENTS.md: la que se mueve es la que NO está en `main`— y se descartó
> la duplicada. La versión publicada además prueba el foco inicial en Cancelar y
> la guarda de doble clic, que la mía no cubría.
>
> Causa de la duplicación: se tomó el número con `pnpm sdd:next` pero **no se
> reservó** con `--reserve`, que es justo el riesgo que la spec descartada dejó
> escrito. Ver §"Lección" al final.

**Clasificación: `no conformidad`** — SGE-00.03 (aprobada) · MP-01 v1.1
(aprobada). **Es el hallazgo de mayor riesgo del informe**, aunque no sea el que
motivó la revisión.

[`DeliveryAddressesCard.tsx:233-260`](<../../../app/studio/(app)/clientes/_components/DeliveryAddressesCard.tsx>):

```tsx
<button
  type="button"
  className="studio-link-quiet"
  onClick={async () => {
    const res = await deleteClientAddressAction(markbox, a.id);   // ← directo
```

El `onClick` llama a la acción de borrado **de una**. Sin confirmación, sin
`ConfirmDialog`, sin deshacer.

Y visualmente **no se lee como destructivo**: es `studio-link-quiet`, con
`background: none`, `border: 0` y color `--ink-soft`. Un enlace apagado, del
mismo peso que "Predeterminar", que está justo al lado.

SGE-00.03 dice: *"El riesgo determina la fricción… una acción irreversible,
financiera o crítica debe exigir una decisión proporcional"*. Acá la fricción es
**cero** y el dato es la dirección de entrega de un cliente.

**El propio módulo ya sabe hacerlo bien:**
[`DuplicadosClient.tsx:195`](<../../../app/studio/(app)/clientes/_components/DuplicadosClient.tsx>)
usa `ConfirmDialog` — el componente **`canonical`** del registro CMP-01. La
pieza correcta existe, está aprobada, y está a dos carpetas de distancia.

---

### 3 · La lista trae 200 clientes y no lo dice en ninguna parte

**Clasificación: `no conformidad`** — SGE-00.07 (*"El estado del sistema siempre
debe ser visible y verdadero"*).

[`lib/studio/client-queries.ts:32`](../../../lib/studio/client-queries.ts):

```ts
.order("created_at", { ascending: false })
.limit(200);
```

Sin paginación, sin "ver más", sin contador. Busqué en `ClientsClient.tsx` y en
`page.tsx` cualquier mención del tope: **no hay ninguna**.

Para el usuario, el catálogo del tenant **es** lo que ve. Si hay más de 200
clientes, los que faltan no existen — y como el orden es `created_at DESC`, lo
que desaparece son los **más viejos**, que son justamente los clientes de más
recorrido.

El buscador mitiga en parte (filtra en servidor), pero sólo si sabes a quién
buscas. Navegar el catálogo no es posible más allá de 200.

🔴 **No verificable acá:** cuántos clientes hay realmente en producción. Leer
filas de negocio requiere tu autorización explícita, así que no consulté. **Tú
sabes el número de memoria** — si pasa de 200, esto sube a bloqueante inmediato;
si no, es deuda a plazo.

---

### 4 · La tabla no es una tabla

**Clasificación: `no conformidad`** — A11Y-01 v1.1 (aprobada) · WCAG 1.3.1 ·
TBL-01 v1.0.

[`ClientsClient.tsx:268-310`](<../../../app/studio/(app)/clientes/_components/ClientsClient.tsx>)
arma el listado con `display: grid` sobre `<div>`, y cada fila es un `<Link>`.
No hay `<table>`, `<thead>`, `<th>` ni `<tr>`.

Los seis encabezados —Shipping Mark · Cédula/RIF · Nombre · Tier · Contacto ·
Creado— son `<span>` dentro de un `<div>`. **No están asociados a sus celdas**,
así que un lector de pantalla anuncia una lista de enlaces con seis textos
sueltos por fila, sin decir qué es cada uno. Con una cédula y un Shipping Mark
—dos códigos alfanuméricos seguidos— eso es indescifrable de oído.

Tampoco usa `DataTable` ni `ColumnManager`, que existen en el kit
(`app/studio/_components/ui/`). TBL-01 ya registra que *"`ColumnManager` tiene
adopción limitada"*; Clientes es uno de los que no lo adoptó.

---

### 5 · `aria-busy` no existe en el módulo — y el CSS lo está esperando

**Clasificación: `no conformidad`** — BTN-01 v1.1 §5 (aprobada). Misma no
conformidad que se corrigió en el Portal con
[SDD-0260](../../specs/0260-portal-aria-busy-acciones-en-curso/spec.md).

| Medida | Clientes | Studio completo |
|---|---|---|
| Archivos con etiqueta de carga (`"…"`) | **9** | 154 |
| De ésos, con `aria-busy` | **0** | 11 |

Trece verbos en progreso distintos en el módulo —"Guardando…", "Verificando…",
"Aprobando…", "Revocando…", "Eliminando…"…— y ninguno se anuncia.

**El detalle que lo vuelve concreto:**
[`app/studio/studio.css:288-292`](../../../app/studio/studio.css) ya tiene la
regla escrita:

```css
.studio-btn[aria-busy="true"],
.studio-btn[aria-busy="true"]:disabled {
  cursor: progress;
  opacity: 0.9;
}
```

Con un comentario que explica el porqué: *"No es 'prohibido' sino 'en progreso'"*.
El sistema de diseño ya distinguió los dos estados. **Nadie en Clientes dispara
el atributo, así que ese `cursor: progress` está muerto en el módulo** y todos
los botones ocupados se ven como si estuvieran prohibidos (`cursor: not-allowed`,
`opacity: 0.5`).

⚠️ Justo es decirlo: el Studio entero va 11 de 154. Clientes está atrás, pero la
deuda es de la casa, no de este módulo en particular.

---

### 6 · El drawer se armó a mano, contra la corriente del Studio

**Clasificación: `no conformidad`** — SGE-00.09 (*"La misma necesidad debe
reutilizar el mismo patrón"*) · CMP-01 v1.1.

[`ClientDrawer.tsx:267-268`](<../../../app/studio/(app)/clientes/_components/ClientDrawer.tsx>)
declara `role="dialog"` y `aria-modal="true"` a mano, en vez de usar
`DrawerShell` —el patrón documentado en `AGENTS.md`—.

Medido en todo `app/studio/(app)`:

| | archivos |
|---|---|
| Usan `DrawerShell` | **104** |
| Arman `role="dialog"` a mano | **19** ← `ClientDrawer` es uno |

O sea que la casa ya decidió, por goleada, y Clientes quedó en el 18 %.

Y adentro pasa lo mismo con la confirmación: el "Eliminar" del drawer
([`ClientDrawer.tsx:872-878`](<../../../app/studio/(app)/clientes/_components/ClientDrawer.tsx>))
arma un "¿Seguro? / No" **inline a mano**, mientras su vecino `DuplicadosClient`
usa el `ConfirmDialog` canónico. Dos confirmaciones destructivas en el mismo
módulo, resueltas de dos formas distintas.

---

## 2. Lo que SÍ cumple

Vale decirlo, porque cambia dónde conviene invertir:

| Punto | Evidencia | Clasificación |
|---|---|---|
| Gate RBAC en `layout.tsx`, no en `page.tsx` | [`clientes/layout.tsx`](<../../../app/studio/(app)/clientes/layout.tsx>) — con el comentario que explica por qué: un `page.tsx` no envuelve sus sub-rutas | `cumplimiento` ejemplar |
| `ConfirmDialog` canónico en Duplicados | `DuplicadosClient.tsx:195` | `cumplimiento` |
| `SplitActionButton` canónico en el drawer | `ClientDrawer.tsx:894` | `cumplimiento` |
| `EmptyState` con acción primaria y copy distinto según haya filtros o no | `ClientsClient.tsx:207-240` | `cumplimiento` |
| Cero consumidores nuevos de `deprecated` | grep de `LLMModeToggle`: ninguno | `cumplimiento` |
| Búsqueda server-side con cédula primero | `client-queries.ts:43-45` (SDD-0106) | `cumplimiento` |
| Insignias de aliado con tono distinto a VIP/Premium, y comentado | `ClientsClient.tsx:349-360` (SDD-0255) | `cumplimiento` |

---

## 3. Scores por dimensión

| # | Dimensión | Score | Base |
|---|---|---|---|
| 1 | **Navegación y arquitectura** | **4,0** | Es el problema que motivó la revisión: 2 rutas huérfanas del nav, sin vuelta, con migaja inconsistente. |
| 2 | **Estados (BTN-01 §5)** | **3,0** | `aria-busy` 0/9, con el CSS ya escrito esperándolo. |
| 3 | **Fricción proporcional al riesgo** | **3,0** | Un borrado de PII sin confirmación tira la nota sola. |
| 4 | Accesibilidad WCAG 2.2 AA | 4,5 | La tabla sin semántica es lo más grave; el resto (labels, focus) se ve correcto en código. |
| 5 | Reutilización de patrones | 5,0 | Usa 2 canónicos y se salta 2. Mezcla dentro del mismo módulo. |
| 6 | Jerarquía visual | 6,0 | La cabecera compite consigo misma; el resto está ordenado. |
| 7 | Copy | 8,5 | Español venezolano preciso, comentarios que explican decisiones. Los verbos siguen el vocabulario de BTN-01 §3. |
| 8 | Contraste | **no verificable** | No lo medí en vivo: requiere sesión autenticada del Studio. No se puntúa. |
| 9 | Spacing y densidad | **no verificable** | Ídem. |
| 10 | AI slop | 9,0 | Cero. Tokens `var(--*)`, sin gradientes decorativos, sin emoji. |

**Score compuesto de lo medible: 5,4 / 10.**
Sin promediar las dos dimensiones no verificables.

---

## 4. La recomendación de fondo (y por qué NO es arreglar la cabecera)

La tentación es mover los dos botones grises a algún lado y listo. **Eso sería
tapar el síntoma.** Los hallazgos 1 y 6 comparten una causa comprobada: el
Studio no tiene primitiva de menú, y donde no hay pieza canónica cada módulo
improvisa (104 usan `DrawerShell`, 19 no; 2 confirmaciones distintas en el mismo
módulo).

Camino sugerido, en tres piezas separadas — **son recomendaciones mías, no
reglas aprobadas, y no bloquean nada por sí solas**:

| | Pieza | Por qué separada |
|---|---|---|
| ⭐ **A** | **Cerrar el borrado sin confirmar** (hallazgo 2) con el `ConfirmDialog` que ya existe | Riesgo real sobre datos de cliente. **No depende de nada** y es el arreglo más barato del informe. |
| **B** | **Primitiva de menú de acciones** en `app/studio/_components/ui/`, con el contrato completo de **BTN-01 §7** (roving focus, ArrowDown/Up, Home/End, Escape devuelve el foco al trigger, sin clipping, sin destructiva memorizada) | Es un componente nuevo → **CMP-01**: necesita registro, evidencia y su propio SDD. No se cuela dentro de un arreglo de UX. |
| **C** | **Rediseño de la navegación de Clientes** usando B: primaria sola en la cabecera, las dos tareas de mantenimiento al menú, vuelta atrás en las sub-páginas y migaja consistente | Depende de B. Sería el **primer consumidor** de la primitiva — buen slice de adopción. |

Los hallazgos 3, 4 y 5 son independientes de todo esto y pueden ir por su cuenta.

⚠️ **No afirmo que los seis hallazgos tengan una sola causa.** El borrado sin
confirmar (2), el tope de 200 (3) y la tabla sin semántica (4) no tienen nada
que ver con la falta de menú. Si se arreglan todos juntos y la cabecera "se
siente mejor", eso no prueba que el menú fuera la causa de nada más.

---

## 5. Gobernanza

### Clasificación de cada hallazgo

| # | Hallazgo | Política | Clasificación | ¿Bloquea? |
|---|---|---|---|---|
| ⭐1 | Cabecera con 2 acciones raras, sin menú | **BTN-01 v1.1 §4** (aprobada) | **no conformidad** | **sí** |
| 1b | Sub-páginas sin vuelta ni entrada en el nav | SGE-00.08 | **no conformidad** | **sí** |
| 1c | Migaja inconsistente ("Comercial" vs "Clientes") | VIS-01 | **no conformidad** menor | no |
| 2 | Borrado de dirección sin confirmar | **SGE-00.03 · MP-01 v1.1** (aprobadas) | **no conformidad** | **sí** |
| 3 | Tope de 200 invisible | **SGE-00.07** (aprobada) | **no conformidad** | **sí** |
| 4 | Tabla sin semántica | **A11Y-01 v1.1** (aprobada) · WCAG 1.3.1 | **no conformidad** | **sí** |
| 5 | `aria-busy` ausente | **BTN-01 v1.1 §5** (aprobada) | **no conformidad** | **sí** |
| 6 | Drawer y confirmación a mano | **SGE-00.09 · CMP-01 v1.1** (aprobadas) | **no conformidad** | **sí** |
| — | Falta primitiva de menú en el kit | CMP-01 | **`no aplica` hoy · deuda declarada** | no |
| — | Camino A/B/C del §4 | — | *recomendación mía* | **no** |

**Explícito:** las 6 filas marcadas "sí" incumplen políticas **aprobadas**. Todo
lo demás —incluido el plan de tres piezas— son **recomendaciones mías y no se
elevan solas a bloqueantes**. Qué entra a un SDD lo decides tú.

### Componentes

- `canonical` usados correctamente: `ConfirmDialog`, `SplitActionButton`.
- `canonical` disponibles y **no** usados: `ConfirmDialog` (en el drawer y en
  `DeliveryAddressesCard`), `DataTable`, `ColumnManager`.
- `deprecated`: **cero consumidores nuevos**. `LLMModeToggle` no aparece.
- Primitiva faltante: **menú de acciones** — no existe en el registro ni en el kit.

### Checks

`pnpm governance:check` y `pnpm components:check` — pendientes de correr en esta
rama; en la rama del portal, sobre el mismo `origin/main`, salieron:

```
Gobernanza: 27 política(s) aprobada(s) · cápsula vigente
CMP-01 válido: 4 fuente(s), agregado reproducible y cero rutas rotas
```

---

## 6. No verificable

- **Contraste y spacing en vivo:** el Studio necesita sesión autenticada; no la
  monté. No se da por bueno ni por malo.
- **Cuántos clientes hay en producción** (hallazgo 3): no consulté datos de
  negocio sin tu autorización.
- **Recorrido de teclado real** en el drawer y en la tabla: no verificable sin
  sesión.
- **Lector de pantalla** sobre la tabla: el diagnóstico del hallazgo 4 es
  estructural (falta `<table>`/`<th>`), no una medición con NVDA.

---

## 7. Entrega

| | |
|---|---|
| **Rama** | `audit/ui-pro-clientes-20260814` |
| **Worktree** | `DTD-worktrees/audit-clientes` |
| **Push** | **no** |
| **Archivos de producto tocados** | **ninguno** |
| **Archivo creado** | este informe |

---

## 8. Lección de esta ronda: el número no se toma, se reserva

El hallazgo 2 se implementó **dos veces en paralelo**, con el mismo número de
SDD (0262), sobre el mismo archivo, con el mismo análisis de MP-01. Una de las
dos se tiró a la basura.

`pnpm sdd:next` hace `fetch` y mira todas las refs, locales y remotas — y aun así
devolvió 0262 a las dos ventanas, porque **entre pedir el número y publicar
pasaron horas**. AGENTS.md ya lo dice con todas las letras:

> **Resérvalo si el trabajo va a durar:** `pnpm sdd:next --reserve <slug>`.

Acá no se reservó, con el argumento de que reservar exige pushear y no había OK
para pushear. Ese argumento **es real pero no alcanza**: el costo de no reservar
fue una implementación completa duplicada.

Lo que sí funcionó: el paso `numbering` de `verify.mjs` habría cazado las dos
carpetas `0262-*` al mergear. La colisión se detectó antes, al traer
`origin/main`, pero la red de seguridad estaba puesta.
