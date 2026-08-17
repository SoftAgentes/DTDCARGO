---
sdd: 0267
title: Clientes cierra sus tres huecos de accesibilidad — tabla, carga y drawer
status: in-progress
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0010, 0260, 0262, 0265, 0266]
confidencialidad: interna
---

# SDD-0267 · Clientes cierra sus tres huecos de accesibilidad

Cierra los hallazgos **4, 5 y 6** de la
[auditoría del módulo](../../design/studio/2026-08-14-auditoria-ui-pro-clientes.md).
Los tres son de accesibilidad y **no comparten causa** — van en slices separados
por eso, no por comodidad.

Re-medidos contra `origin/main` antes de empezar (el módulo recibió tres SDD
desde la auditoría y el informe podía estar desfasado): los tres seguían abiertos.

---

## Slice 5 · `aria-busy` en el módulo

**BTN-01 v1.1 §5** (aprobada) pide `aria-busy` al botón que trabaja. Medido:
**10 archivos** con etiqueta de carga, **1** con `aria-busy`.

Al abrirlos, **5 de los 9 que faltaban ya estaban bien**: usan `ActionButton`,
el componente `canonical` que lo trae adentro. Los reales eran **6 botones
crudos** en 4 archivos, más 1 que el script se perdió.

| Archivo | |
|---|---|
| `AliadoCard.tsx` · `ShippingMarkChip.tsx` · `MigrarLegadoClient.tsx` | 1 cada uno |
| `ClientDrawer.tsx` | 3 |
| `DeliveryAddressesCard.tsx` | 1 — **a mano** |

### Dos cosas que el script hizo mal y agarró el typecheck

1. **Ventana corta.** El botón "Predeterminar" de `DeliveryAddressesCard` está en
   la línea 231 y su etiqueta `"Guardando…"` en la 257 — **26 líneas**, fuera de
   la ventana de 12 del extractor. Se hizo a mano.
2. 🔴 **Agarró un literal de cadena por variable.** En
   `disabled={isGeocoding || geoStatus === "loading"}` el regex tomó el
   `"loading"` **de adentro del string** y escribió `aria-busy={loading}` — una
   variable que no existe. Dos botones. `tsc` lo cazó con `TS2304`.

Corregidos con la condición real de cada uno: `aria-busy={isGeocoding}` y
`aria-busy={geoStatus === "loading" && !isGeocoding}`.

⭐ **Y de ahí sale el criterio que se aplicó en todos:** `aria-busy` lleva la
condición del **botón que ejecuta**, no la de `disabled`. `disabled` suele ser
más ancho —bloquea toda la fila, o el botón de al lado— y anunciar "ocupado" un
control que no está haciendo nada es mentir.

---

## Slice 4 · La tabla no era una tabla

**A11Y-01 v1.1** · WCAG 1.3.1. `ClientsClient.tsx` arma el listado con
`display: grid` sobre `<div>`, y los seis encabezados eran `<span>` sueltos
**sin asociar** a sus celdas.

Un lector de pantalla anunciaba seis cadenas por fila sin decir cuál es la cédula
y cuál el Shipping Mark. Con dos códigos alfanuméricos seguidos, eso es
indescifrable de oído.

**Arreglo: roles ARIA de tabla, cero cambio visual.** El layout sigue siendo el
mismo grid; lo que cambia es la relación que expone.

```
role="table" (aria-label="Clientes")
  role="row"  → 6 × role="columnheader"
  role="row"  → 6 × role="cell"   (por cliente)
```

### ⚠️ Saldo declarado, no escondido

`role="row"` sobre el `<a>` **sustituye** el rol de enlace: el lector deja de
decir "enlace". Se compensa con `aria-label` que nombra a quién lleva la fila
(`"{nombre} · Shipping Mark {markbox}"`).

**El arreglo completo es otro**, y lo prescribe **BTN-01 §4**: *"La navegación
principal suele ser enlace en la identidad de la fila"* — o sea mover el `<a>` a
la celda del Shipping Mark y dejar el clic de fila como afordancia de ratón.
Eso cambia cómo se opera el listado todos los días y **necesita su propio
slice**; no se cuela acá.

Se evaluó el patrón de superposición (enlace en una celda + `::after` que cubre
la fila): **el Studio no lo tiene**, y construirlo es un patrón nuevo con su
propio cuidado. Ver "Fuera de alcance".

---

## Slice 6 · El drawer no era un diálogo

Esto resultó **más grave de lo que decía la auditoría**. El informe lo puso como
inconsistencia de patrón —"105 archivos usan `DrawerShell`, 20 no"—. Al medirlo:

```
grep -c "useDialogA11y|Escape|focus()" ClientDrawer.tsx  →  0
```

**Cero.** El drawer no tenía:

- **foco inicial** — al abrirlo el foco se quedaba detrás, en la página;
- **trampa de foco** — con Tab se salía del drawer hacia el listado de atrás,
  que está tapado por el velo y no se puede ver;
- **Escape** — no había forma de cerrarlo sin ratón.

Además `role="dialog"` estaba sobre el **scrim**, no sobre el panel, y el velo
era un hex a mano (`rgba(15, 30, 61, 0.55)`) en vez de `var(--scrim)` —
BRAND.md regla 1.

**No es consistencia cosmética: es un defecto funcional de accesibilidad.**

Se reemplaza por `DrawerShell`, que trae `useDialogA11y` (foco inicial,
restauración al cerrar, trampa y Escape) y ya lo usan 105 archivos. El header a
mano se retira: `DrawerShell` pinta título, subtítulo (el Shipping Mark) y el
botón cerrar.

---

## Criterios de aceptación

1. Los botones crudos con estado de carga del módulo declaran `aria-busy` con la
   condición **del botón**, no la de `disabled`.
2. Los que van por `ActionButton` **no** se tocan: ya lo traen.
3. El listado expone `role="table"` con 6 `columnheader` y 6 `cell` por fila, y
   **ninguna captura cambia**.
4. Cada fila tiene nombre accesible que incluye nombre y Shipping Mark.
5. El drawer cierra con **Escape**, atrapa el foco y lo restaura al cerrar.
6. El scrim usa `var(--scrim)`.
7. `pnpm typecheck`, `pnpm lint`, `pnpm test`; `node scripts/verify.mjs`.
8. **Verificación con lector de pantalla real: PENDIENTE.** Los tres slices
   mejoran lo que un lector recibe, y **ninguno se probó con uno**. Queda como
   `no verificable`, igual que en el SDD-0260 — no se da por bueno.

## Matriz SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.02 No perder trabajo | `cumple` | El drawer conserva su lógica de cierre (SDD-0032: con warning no cierra solo). |
| SGE-00.07 Estado visible y verdadero | **`no cumple` → lo corrige el slice 5** | El estado "trabajando" viajaba sólo en el canal visual. |
| **SGE-00.09 Reutilizar el patrón** | **`no cumple` → lo corrige el slice 6** | 105 usan `DrawerShell`; éste era de los 20 que no. |
| **SGE-00.10 Accesible y equivalente** | **`no cumple` → lo corrigen los tres** | Tabla sin relaciones, drawer sin teclado, carga sin anuncio. |
| SGE-00.11 Decir qué pasó | `cumple` parcial | Slice 4 nombra las filas; el rol de enlace queda como saldo declarado. |

## Gobernanza

| Control | Valor |
|---|---|
| Políticas | **A11Y-01 v1.1** · **BTN-01 v1.1 §5 y §4** · **CMP-01 v1.1** · SGE-00.09 y .10 — aprobadas |
| Clasificación | **no conformidad** ×3 |
| Componentes `canonical` usados | `DrawerShell` *(no registrado en CMP-01, pero es el patrón documentado en AGENTS.md)* · `ActionButton` |
| ¿Suma consumidores a un `deprecated`? | **No** |
| Saldo declarado | el rol de enlace de la fila (slice 4) |

## Fuera de alcance

| | Por qué |
|---|---|
| Enlace en la celda de identidad (BTN-01 §4) | Cambia cómo se opera el listado a diario. Slice propio. |
| Patrón de superposición para filas clicables | **No existe en el Studio.** Es un patrón nuevo → CMP-01. |
| Los otros 19 archivos con `role="dialog"` a mano | Cada uno es un consumidor con su riesgo. AGENT-BRIEF: adopción por slices. |
| `aria-busy` en el resto del Studio | Va 11 de 154 archivos. Deuda de la casa, no del módulo. |
| Registrar `DrawerShell` en CMP-01 | Lo usan 105 archivos y no está en el registro. Es un hueco del registro, no de este módulo. |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El swap del drawer rompe el formulario | `DrawerShell` sólo aporta el marco; el `<form>` y el footer quedan intactos. typecheck + lint + 5286 pruebas en verde. |
| `role="row"` sobre el `<a>` empeora algo | Se gana la relación de 6 columnas y se pierde la palabra "enlace". El saldo va escrito, y el criterio 8 lo pone a prueba con lector real. |
| Se cree que esto cierra la accesibilidad del módulo | No: falta el lector de pantalla (criterio 8) y el enlace en la identidad de la fila. |
