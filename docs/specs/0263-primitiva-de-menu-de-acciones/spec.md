---
sdd: 0263
title: El Studio tiene una primitiva de menú de acciones, y deja de haber cinco
status: in-progress
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0262, 0183]
confidencialidad: interna
---

# SDD-0263 · El Studio tiene una primitiva de menú de acciones, y deja de haber cinco

## Problema

**BTN-01 v1.1 §7 dedica once reglas al comportamiento de un menú de acciones. Ese
componente no existe en el Studio.**

El kit `app/studio/_components/ui/` tiene `ActionButton`, `SplitActionButton`,
`ConfirmDialog`, `DataTable`, `SegmentedControl`, `NumericInput`,
`ClientCombobox`… y **ninguna primitiva de menú**. El registro CMP-01 tiene
cuatro componentes; ninguno es un menú.

Así que cada módulo que necesitó uno lo armó por su cuenta.

### Los cinco menús a mano, medidos

Búsqueda de `aria-haspopup` en `app/studio/**` (excluyendo `SplitActionButton`,
que es `canonical` y tiene su propio popup por contrato):

| Implementación | `role="menu"` | ArrowDown/Up | Home/End | Escape |
|---|:---:|:---:|:---:|:---:|
| [`gastos/_components/ExpenseRowActions.tsx`](<../../../app/studio/(app)/gastos/_components/ExpenseRowActions.tsx>) | ✅ | ✅ | ✅ | ✅ |
| [`cn/_components/ReceiptRowActions.tsx`](<../../../app/studio/(app)/cn/_components/ReceiptRowActions.tsx>) | ✅ | ✅ | ✅ | ✅ |
| [`bitacora/_components/ExportMenu.tsx`](<../../../app/studio/(app)/bitacora/_components/ExportMenu.tsx>) | ✅ | ❌ | ❌ | ✅ |
| [`ve/_components/VeRowActions.tsx`](<../../../app/studio/(app)/ve/_components/VeRowActions.tsx>) | ✅ | ❌ | ❌ | ✅ |
| [`ui/columns/ColumnConfig.tsx`](../../../app/studio/_components/ui/columns/ColumnConfig.tsx) | ❌ | ❌ | ❌ | ✅ |

**Dos de cinco** implementan el contrato de teclado de BTN-01 §7. Los otros tres
abren un popup que **no se puede recorrer con flechas**: quien no usa ratón queda
fuera de acciones de fila en Almacén VE, exportación de Bitácora y configuración
de columnas.

Tres de los cinco se llaman literalmente `*RowActions`: es **la misma necesidad**,
resuelta cinco veces, con tres resultados distintos. Eso es exactamente lo que
**SGE-00.09** prohíbe: *"La misma necesidad debe reutilizar el mismo patrón"*.

### Y el sexto caso: Clientes, que ni siquiera lo intentó

La [auditoría del módulo Clientes](../../design/studio/2026-08-14-auditoria-ui-pro-clientes.md)
encontró la cabecera con **dos acciones raras** —"Posibles duplicados" y "Códigos
del legado"— como botones grises permanentes al lado de "+ Nuevo cliente".
BTN-01 §4 dice *"acciones raras pasan al menú"*, y ahí no hay menú al que
pasarlas.

## ⚠️ Corrección al fundamento que traía la auditoría

La auditoría insinuó que las cabeceras cargadas eran un patrón extendido, con un
conteo de `studio-btn-ghost` por archivo. **Al abrir los módulos uno por uno, no
se sostiene:** Naviera y Academia tienen la forma correcta (1 ghost + 1 primario)
y en Fiscal, Nómina, Proveedores y Reclamos esos ghosts son filtros o acciones de
fila. **Clientes es el caso atípico.**

Este SDD **no se justifica por la cabecera**, entonces. Se justifica por los cinco
menús a mano de arriba, que sí están medidos. La cabecera de Clientes es el
primer consumidor, no la razón.

## Solución

Un componente **`ActionMenu`** en `app/studio/_components/ui/ActionMenu.tsx`, que
implemente el contrato de BTN-01 §7 **una vez**.

**Nace `proposed`, no `canonical`.** CMP-01 es explícito: *"Crear un componente no
lo hace canónico automáticamente"*, y la promoción a `canonical` exige *"revisión
de diseño, teclado/lector, mobile/dark, tests y al menos un consumidor
verificado"*. Ese consumidor llega en el SDD siguiente (la cabecera de Clientes).

### Contrato — BTN-01 §7 traducido a requisitos verificables

| # | Regla (BTN-01 §7) | Verificable como |
|---|---|---|
| 1 | `role="menu"` con roving focus | Un solo `tabindex="0"` entre las opciones |
| 2 | ArrowDown/ArrowUp recorren las opciones | Test de teclado |
| 3 | Home/End saltan a los extremos | Test de teclado |
| 4 | Enter/Space activan | Test de teclado |
| 5 | Escape cierra **y devuelve el foco al trigger** | Test: `document.activeElement === trigger` |
| 6 | ArrowDown en el trigger abre y enfoca la **primera**; ArrowUp abre y enfoca la **última** | Test de teclado |
| 7 | Tab cierra sin secuestrar el recorrido natural | Test de teclado |
| 8 | Click externo cierra **sin ejecutar** ninguna opción | Test |
| 9 | El popup elige arriba/abajo según el espacio (sin clipping) | Prueba de posicionamiento |
| 10 | **No** ejecuta al seleccionar con hover | Test |
| 11 | **No** memoriza una opción destructiva como default | Contrato de API: no hay `memoryKey` para destructivas |
| 12 | Icon-only exige `aria-label` **y** tooltip | Tipo de TS: `aria-label` obligatorio cuando no hay texto |
| 13 | Objetivo mínimo 32×32 px escritorio · 44×44 px touch | Tokens de tamaño + revisión responsive |

La regla 11 merece una nota: `SplitActionButton` **sí** recuerda la última opción
(`memoryKey`), y BTN-01 §10 ya deja registrado que *"falta verificar por uso que
ninguna opción destructiva quede memorizada"*. `ActionMenu` **no** llevará
memoria — es un menú de acciones dispares, no una familia de resultados
equivalentes. Los dos componentes se reparten así:

| | `SplitActionButton` | `ActionMenu` |
|---|---|---|
| Para | 2–4 resultados de la **misma familia** | acciones **dispares** o poco frecuentes |
| Acción principal | visible en el botón | **no hay**: todas viven en el menú |
| Memoria de la última | sí (`memoryKey`) | **no** |
| Estado CMP-01 | `canonical` | `proposed` (este SDD) |

**No duplica un canónico** — requisito de CMP-01 para pasar a `proposed`.

### API propuesta

```ts
type ActionMenuItem = {
  key: string;
  label: string;
  icon?: IconName;
  /** BTN-01 §2: rol semántico, no color. */
  role?: "default" | "destructive";
  disabled?: boolean;
  /** Motivo visible cuando está deshabilitado (BTN-01 §6). */
  disabledReason?: string;
  onSelect: () => void | Promise<void>;
} | { key: string; separator: true };

type ActionMenuProps = {
  items: ActionMenuItem[];
  /** Texto del trigger. Si se omite, es icon-only y `ariaLabel` pasa a obligatorio. */
  label?: string;
  ariaLabel?: string;
  align?: "start" | "end";
  size?: "sm" | "default";
  disabled?: boolean;
};
```

## Alcance

**Este SDD entrega el componente y su registro. No cambia ninguna pantalla.**

| Entrega | Ruta | Estado |
|---|---|---|
| Componente | `app/studio/_components/ui/ActionMenu.tsx` | ✅ hecho |
| Pruebas de teclado y foco | `app/studio/_components/ui/ActionMenu.test.tsx` | ✅ 17 pruebas, 8 mutaciones muertas |
| Entrada del registro CMP-01 | `docs/governance/components/action-menu.json` | ✅ **registrado `proposed`** — se midió el contraste |

### ✅ Desbloqueado: se midió el contraste, y encontró un defecto

El bloqueo de abajo se resolvió **midiendo**, no extendiendo el schema. Banco de
medición en el navegador el 2026-08-14, con el wrapper real `.studio-sys` y los
dos temas del Studio.

**Y la medición encontró un defecto del propio componente.** La primera versión
pintaba la opción deshabilitada y su motivo en `--ink-mute`:

| | claro | oscuro | umbral |
|---|---|---|---|
| `--ink-mute` (versión inicial) | **2,78:1** | **3,40:1** | 4,5:1 ❌ |
| `--ink-soft` (corregido) | **5,33:1** | **6,86:1** | 4,5:1 ✅ |

Eso importaba más de lo que parece: el texto que fallaba era el
`disabledReason`, o sea **justo la explicación que BTN-01 §6 exige que se pueda
leer**. Un motivo ilegible no cumple la regla aunque el atributo esté.

`--ink-soft` conserva la señal de "no disponible" —la opción activa va en `--ink`
a 16,49:1, así que la diferencia se sigue viendo— sin caer bajo AA.

#### Medición final, los dos temas

| Elemento | claro | oscuro | umbral | |
|---|---|---|---|---|
| Opción normal | 16,49:1 | 13,08:1 | 4,5:1 | ✅ |
| Opción deshabilitada | 5,33:1 | 6,86:1 | 4,5:1 | ✅ |
| Motivo del deshabilitado (11 px) | 5,33:1 | 6,86:1 | 4,5:1 | ✅ |
| Opción destructiva | 6,58:1 | 5,07:1 | 4,5:1 | ✅ |
| Trigger sobre card | 4,68:1 | 6,00:1 | 4,5:1 | ✅ |

**Todo el texto pasa AA en los dos temas.**

#### ⚠️ Lo único que no se reduce a un número: el borde del panel

El panel usa `--bg-surface`, **el mismo relleno que la card sobre la que flota**
(#FFFFFF sobre #FFFFFF en claro; #16264A sobre #16264A en oscuro). Su separación
la dan el borde (1,25:1) y `--shadow-pop`.

Una sombra **no se mide como razón de contraste**, así que esto queda como
**no verificable por contraste**, no como aprobado ni reprobado. No es una
regresión que introduzca este componente: los cinco menús a mano usan los mismos
tokens. Si se decide que el panel necesita un borde a 3:1, es un cambio de
token y por tanto decisión del founder.

<details>
<summary>El bloqueo original, conservado como registro del problema del schema</summary>

### 🔴 El registro CMP-01 no puede representar un `proposed` a medio verificar

Al escribir la entrada apareció un hueco del schema. `component-registry.schema.json`
define:

```json
"evidenceState": { "enum": ["verified", "not-applicable"] }
```

**No hay un valor para "aplica, pero todavía no está verificado".** Y el bloque
`accessibility` exige los cinco ejes (`keyboard`, `focus`, `screenReader`,
`contrast`, `reducedMotion`).

Para `ActionMenu` hoy:

| Eje | Evidencia real | Valor honesto |
|---|---|---|
| `keyboard` | 17 pruebas + 8 mutaciones muertas | `verified` |
| `focus` | ídem (retorno al trigger probado y mutado) | `verified` |
| `screenReader` | roles, `aria-haspopup`, `aria-expanded`, `aria-disabled` y nombres accesibles bajo prueba — mismo criterio con el que `ConfirmDialog` figura `verified` | `verified` |
| `reducedMotion` | el componente no anima nada | `not-applicable` |
| **`contrast`** | **no medido** — el Studio exige sesión autenticada | **no existe el valor** |

Poner `verified` en `contrast` sería falso; poner `not-applicable` también, porque
el contraste sí aplica a un menú. **Así que la entrada no se crea todavía**, y el
componente queda implementado pero **fuera del registro**.

Esto es coherente con CMP-01 —*"crear un componente no lo hace canónico"*— pero
deja ver que el schema asume que todo componente registrado ya tiene evidencia
completa, cuando `proposed` existe justamente para lo contrario.

**Dos salidas, las dos son decisión del founder:**

| | Salida | Costo |
|---|---|---|
| ⭐ **1** | **Medir el contraste** con el banco de medición y registrar con los cinco ejes honestos | Requiere parchear `proxy.ts` localmente en desarrollo (corta todo `/studio/**` sin sesión, sin bypass), medir y revertir |
| **2** | **Extender el enum** de `evidenceState` con un tercer valor (`pending`) | Toca el schema de gobernanza → es un cambio normativo, con su propia revisión |

Mientras tanto: **el componente existe y está probado, pero no está en el
registro**, y eso queda dicho acá en vez de resolverse con un valor falso.

**Se resolvió midiendo** (ver arriba). Pero el hueco del schema **sigue ahí**
para el próximo componente `proposed` que no pueda medir todo: `evidenceState`
sigue sin un valor para "aplica, aún no verificado". Queda registrado como deuda
de CMP-01, no cerrado.

</details>

### Fuera de alcance, a propósito

| | Por qué |
|---|---|
| Migrar los 5 menús a mano | Cada uno es un consumidor con su propio riesgo. **AGENT-BRIEF: "la adopción avanza por slices con SDD propio"**. Se migran de a uno, después de que `ActionMenu` sea `canonical`. |
| La cabecera de Clientes | Es el **SDD siguiente** y el primer consumidor verificado — el que habilita la promoción a `canonical`. |
| Promover a `canonical` | Requiere el consumidor verificado. Este SDD lo deja en `proposed`. |
| Menú del sidebar / navegación | `ActionMenu` es para **acciones**, no para navegar. Un menú de navegación es otro problema. |

## Criterios de aceptación

1. Las 13 reglas del contrato tienen prueba o evidencia. Las que no se puedan
   probar en jsdom (regla 9, posicionamiento; regla 13, objetivo táctil) se
   verifican en el navegador y se declaran como tales — **no se dan por buenas**.
2. `ActionMenu.test.tsx` cubre al menos: roving focus, ArrowDown/Up, Home/End,
   Enter/Space, Escape **con retorno de foco al trigger**, Tab, click externo sin
   ejecutar, y hover que **no** ejecuta.
3. Las pruebas se validan **con mutación**: romper cada comportamiento hace
   fallar su prueba. Una prueba que pasa con el comportamiento roto no cuenta.
4. `docs/governance/components/action-menu.json` valida contra el schema y
   `pnpm components:check` pasa. Estado `proposed`, `consumers: []`.
5. **Cero consumidores nuevos** en este SDD: ninguna pantalla cambia.
6. Contraste del trigger y de las opciones medido en los dos temas del Studio
   (claro y oscuro), o declarado **no verificable** si no hay sesión.
7. `pnpm typecheck`, `pnpm lint`, `pnpm test`; `node scripts/verify.mjs` de cierre.

## Matriz SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.01 Acción predecible | `cumple` | El menú no cambia el significado de ningún verbo; los toma de BTN-01 §3. |
| SGE-00.02 No perder trabajo | `no aplica` | No persiste nada. |
| SGE-00.03 Riesgo ↔ fricción | `cumple` | Una opción `destructive` no ejecuta desde el menú lo que MP-01 clasifique R2/R3: el menú **abre** la confirmación, no la reemplaza. |
| SGE-00.04 Auditabilidad | `no aplica` | Es presentación; la auditoría la decide cada acción. |
| SGE-00.05 Permisos | `cumple` | El consumidor decide qué ítems pasa. Ocultar en el menú **no** sustituye el gate del servidor. |
| SGE-00.06 Prevenir antes de informar | `cumple` | `disabled` + `disabledReason` visible (BTN-01 §6). |
| SGE-00.07 Estado visible | `no aplica` | El estado de la acción lo lleva su propio botón/diálogo. |
| SGE-00.08 Frecuencia reduce pasos | `cumple` | Justamente: saca lo raro del camino de lo frecuente. |
| **SGE-00.09 Reutilizar el patrón** | **`no cumple` hoy → lo corrige este SDD** | Cinco implementaciones de la misma necesidad, tres sin teclado. |
| **SGE-00.10 Accesible y equivalente** | **`no cumple` hoy → lo corrige este SDD** | Tres de cinco menús no se recorren con flechas. |
| SGE-00.11 Decir qué pasó | `cumple` | Etiquetas con verbo de BTN-01 §3; el rol destructivo no depende sólo del color. |
| SGE-00.12 IA | `no aplica` | — |

## Gobernanza

| Control | Valor |
|---|---|
| Políticas que obligan | **BTN-01 v1.1 §7 y §4** · **A11Y-01 v1.1** · **CMP-01 v1.1** · SGE-00.09 y .10 — todas **aprobadas** |
| Clasificación del hallazgo | **no conformidad** (SGE-00.09 y .10) + **`no aplica` con deuda** para CMP-01, que no obliga a crear un componente que no existía |
| Estado CMP-01 del componente nuevo | **`proposed`** — nunca `canonical` en este SDD |
| ¿Duplica un canónico? | **No.** Ver la tabla de reparto con `SplitActionButton`. |
| ¿Suma consumidores a un `deprecated`? | **No.** |
| Decisiones pendientes del founder | **aprobar que se cree el componente.** CMP-01 dice que el registro no aprueba promociones por script: la promoción a `canonical` será tuya, en el SDD del primer consumidor. |
| Recomendación mía, **no** bloqueante | el orden de migración de los 5 menús existentes, empezando por los 3 sin teclado |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Nace un sexto menú en vez de reemplazar a los cinco | Este SDD **no migra nada** a propósito, pero deja el plan por slices y el componente registrado. Si al cabo de los slices siguen los cinco, la deuda quedó peor, no mejor — hay que ejecutarlos. |
| Se promueve a `canonical` sin consumidor verificado | Criterio 4 fija `proposed` y `consumers: []`. `components:check` valida el registro. |
| Las pruebas de teclado pasan sin probar nada | Criterio 3: validación **con mutación**, no basta con que estén verdes. |
| El posicionamiento (regla 9) se da por bueno sin medir | Criterio 1: si no se puede probar en jsdom, se verifica en el navegador **o se declara no verificable**. |
