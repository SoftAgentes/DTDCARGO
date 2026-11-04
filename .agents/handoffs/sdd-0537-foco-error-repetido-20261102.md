# SDD-0537 · un error repetido devuelve el foco al aviso

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`, misma sesión de la PR #347.
- **Ruta:** `DTD-worktrees/foco-error-repetido`. **Rama:** `codex/foco-error-repetido`. **Base:** `1c2286f1f`.
- **SDD:** 0537, con la sección «Corrección del 2026-11-02». El Director ya la había señalado como la spec aplicable para un arreglo de foco en estos paneles.
- **Permisos:** PR en borrador. Sin merge, sin deploy, sin producción. Corridas pesadas con turno del Director.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Devolver el foco al aviso con un error repetido"». El encargo era medir en navegador real si un segundo error idéntico deja sin aviso a una persona y, si es así, corregirlo. Si no había defecto, cerrarlo con esa evidencia sin tocar código.

## Resultado: el defecto es real

Medido en Chrome 152 (panel de Claude Desktop) con ratón y teclado reales. Una página mínima, fuera del repo, monta los componentes reales con React de producción. Las acciones son simuladas: responden el mismo texto en un objeto nuevo a los 400 ms, como una server action.

| Tras el segundo error idéntico | Antes | Con el arreglo |
|---|---|---|
| Foco | `body`, fuera del panel | `p[alert]` |
| Tab | «Abrir CityDrawer», un botón detrás del modal; otro Tab sigue por la página | «Cancelar» o «Eliminar», dentro del panel |
| Mutaciones del aviso | 0 | 0 |

| Panel | Ratón, antes | Teclado, antes | Ratón, después | Teclado, después |
|---|---|---|---|---|
| `BulkPriceDrawer` | defecto | defecto | corregido, también en el tercer intento | corregido |
| `TariffDrawer` | defecto | sin medir | corregido | sin medir |
| `CityDrawer` | defecto | sin medir | corregido | sin medir |

Comprobado también con el arreglo, en el lote: escribir después del error deja el foco en el campo. El primer error ya funcionaba antes.

**Causa:** el botón pulsado se deshabilita durante el envío y el navegador suelta el foco a `body`. El efecto que lo llevaba al aviso dependía de `[state.error]`, que no cambia si el texto se repite.

**Clasificación:** no conformidad con ERR-01 (`err-01.md:28`) y A11Y-01 punto 9 (`a11y-01.md:24`), corregida en este caso.

**Límites de la medición:**

- No se probó con un lector de pantalla. Que el aviso reciba 0 mutaciones sí está medido; que el lector calle antes del arreglo y lea el aviso al recibir el foco es inferencia.
- No se probó dentro del Studio con sesión y server actions reales, ni en otro navegador.

## Variantes del patrón

| Archivo | Veredicto |
|---|---|
| `BulkPriceDrawer.tsx`, `TariffDrawer.tsx`, `CityDrawer.tsx` | Defecto medido, corregido aquí |
| `PaymentReportForm.tsx:76-82` | Sin defecto: `[state, pending]` |
| `PortalAddresses.tsx:282-284` | Sin defecto: `[state, pending]`; es el precedente que se siguió |
| `PinViewDialog.tsx` | Sin defecto: `[pending, failure]` |
| `PackingListGuidedForm.tsx:72` | Sin defecto por lectura: `PackingListFormSection.tsx:552` pasa por `sending` entre intentos, así que `submitError` vuelve a cambiar |

**Corrección a la PR #347:** su handoff dice que `PaymentReportForm` tiene el mismo patrón. Es un error mío, de un grep que miró la condición y no las dependencias. Lo corregí en la descripción de #347; su archivo no se reescribe para no relanzar el CI.

## COMPLETADO

- **Arreglo:** en los tres paneles, `if (!isPending && state.error) errorRef.current?.focus()` con dependencias `[state, isPending]`. No cambia texto, apariencia ni acción.
- **Pruebas:** un caso nuevo por panel. Cada uno comprueba que el segundo error devuelve el foco al aviso y que escribir después no se lo quita a la persona.
- **Spec:** SDD-0537 anota la corrección, su clasificación y la allowlist.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `TransportistasPanel.test.tsx` y `CityDrawer.test.tsx`, `--pool=threads` | PASÓ, 30 de 30 |
| Mutantes | PASÓ, 9 de 9 mueren: por panel, sin el arreglo, sin dependencias y sin enfocar. El de `CityDrawer` sin dependencias sobrevivió la primera vez porque el campo «Orden» no es controlado y no provocaba render; la prueba usa ahora «Nombre» |
| Combinación con la PR #347 (`merge-tree` sobre el commit, con su retraso del Scheduler) | PASÓ: sin conflictos, 23 de 23 en `TransportistasPanel.test.tsx` |
| ESLint de los cinco archivos | PASÓ |
| `tsc` acotado a las pruebas y sus importaciones (configuración temporal; incluye los tres paneles) | PASÓ, 0 errores |
| `governance:check`, `components:check`, `docs:check`, `sdd:check` | PASÓ |
| `knowledge:status` en este worktree | Sale con exit 0, pero reporta capas en INVALID y PENDING. No lo investigué ni comparé con main; Graphify lo publica el Director |
| Tras traer `main` en `5a70ffc4f`, sobre `f2795afc5`, `--maxWorkers=1`: `TransportistasPanel.test.tsx` y `CityDrawer.test.tsx` | PASÓ, 31 de 31 |
| Mutantes, sobre `f2795afc5` | PASÓ, 9 de 9 mueren, con control verde antes y después |
| ESLint de los cinco archivos, sobre `f2795afc5` | PASÓ |
| Combinación con #350 y #353: `f2795afc5` sobre `cb6a99f5c`, con un merge sin commit | PASÓ: sin conflictos, 76 de 76 en 6 archivos |
| «Calidad local sin secretos» sobre `419b56bd2`, antes de traer `main` | PASÓ. Sobre la cabeza nueva, NO EJECUTADO: la rama no se publicó todavía |
| `pnpm verify` | NO EJECUTADO, y propongo no correrlo: el diff son tres paneles del Studio y sus pruebas. Lo único que `verify` suma al CI es `sql-tests`, `schema-rebuild`, `migrations-applied` y `e2e`: no hay SQL, y ningún e2e abre estos paneles. Lo decide el Director General |
| Graphify, Archify, Obsidian | NO EJECUTADO: los publica el Director desde main |

## COMMITS

- `e26020ec8` — `fix(studio): SDD-0537 — un error repetido devuelve el foco al aviso`.
- El commit que contiene este handoff y la nota de la spec no se autorreferencia.

## PR / BRANCH

Rama `codex/foco-error-repetido`, en PR en borrador contra `main`. El número queda en la propia PR, para no reescribir este archivo después del push.

## PENDIENTES DE ESTA TAREA

1. Publicar la rama cuando el Director General lo indique, y ver «Calidad local sin secretos» en verde sobre esa cabeza.
2. Smoke en el Studio con sesión real: fallar dos veces seguidas con el mismo error y pulsar Tab. Hoy sólo hay medición con acciones simuladas.

## FUERA DE ALCANCE DETECTADO

1. **Con sólo errores por campo, el foco también se sale del modal, ya desde el primer intento.** Medido antes del arreglo en `TariffDrawer` y `CityDrawer`: foco en `body` y Tab a un botón detrás del modal. El arreglo no lo cubre, porque ahí no hay aviso general que enfocar. Dos causas leídas en el código: `DrawerFooter` deshabilita el botón (`DrawerShell.tsx:198`) y la trampa de `useDialogA11y.ts:91-110` sólo actúa con el foco en el primer o último control, no fuera del panel. **Podría afectar a otros paneles con `DrawerShell`: es inferencia, no está medido.** Es un componente compartido, por eso va en tarea aparte.
2. `CityDrawer` no marca `aria-invalid` en sus campos (`TariffDrawer` y `BulkPriceDrawer` sí). Haría falta para enfocar el primer campo inválido como hace `PaymentReportForm`.
3. Enter en los campos numéricos del lote no envió el formulario en la página de medición. No lo investigué: puede ser a propósito.

## HANDOFF AL DIRECTOR

- El defecto es real y se corrige con el mismo patrón que ya usan dos pantallas del portal.
- Combina con #347 sin conflictos; pueden integrarse en cualquier orden.
- Sigue abierto el punto 1 de fuera de alcance, el más serio: quedó propuesto como tarea.

### Impacto documental

Se actualiza `docs/specs/0537-transportistas-tarifas-editables/spec.md`. No cambian políticas ni otros documentos canónicos.
