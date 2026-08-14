---
sdd: 0261
title: En el portal el vino de marca deja de significar "error"
status: draft
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0042, 0257, 0260]
confidencialidad: interna
---

# SDD-0261 · En el portal el vino de marca deja de significar "error"

> **Estado `draft` a propósito.** Media spec depende de una decisión de color que
> es del founder (§"La decisión que falta"). La otra media ya se puede cerrar.
> Pasa a `proposed` cuando esa decisión exista.

## Problema

En el Portal del Cliente **el vino de marca es el canal de error**. Los mensajes
que le dicen al cliente que algo salió mal —en el flujo de registrar una compra,
aceptar una factura, reportar un pago— se pintan con `text-wine`.

Eso rompe dos cosas a la vez.

### 1 · Semántica — y ésta es la que bloquea

[BTN-01 v1.1 §2](../../governance/policies/btn-01.md), política **aprobada**,
dice textual:

> el vino de marca no sustituye `danger`;

No hay margen de lectura. El vino es identidad; `danger` es estado. Cuando el
mismo color pinta el eyebrow de una sección, el enlace "Ver detalle" **y** el
mensaje "No pudimos guardar", el color deja de significar nada.

### 2 · Contraste — medido en vivo el 2026-08-14

`--color-wine` vale `#C24450` en el tema oscuro del portal (que es el default de
todos los clientes: `NORTE_PORTAL_LIVE = true`).

| Superficie | Medido | Umbral | Veredicto |
|---|---|---|---|
| Card `#16264A` (`bg-white` — donde viven los formularios) | **3,00:1** | 4,5:1 | **reprueba** |
| Paper `#0B1428` (fondo de página) | **3,70:1** | 4,5:1 | **reprueba** |

Es el **peor contraste de texto funcional del portal**, a 11–13 px. Peor que el
`--color-status-danger` que se auditó en paralelo (4,29:1).

Medición: banco con el shell real del portal, fondo resuelto subiendo al ancestro
con gradiente y tomando su parada más clara, transiciones desactivadas. Receta
completa en la [auditoría](../../design/portal/2026-08-14-auditoria-ui-pro-portal.md) §8.

## ⚠️ Corrección de la auditoría: eran 14, son ~118

La auditoría del 2026-08-14 reportó **"14 consumidores"**. **Ese número está
mal** — salió de un grep que sólo agarraba las líneas donde `{state.error}`
aparece en la MISMA línea que la clase. La mayoría de los mensajes tienen el
texto en la línea siguiente.

Conteo real, con un clasificador que mira una ventana de contexto:

| Uso de `text-wine` crudo | Cantidad | Archivos |
|---|---|---|
| Como **error / danger** | **≈42** | 17 |
| Como **acento / marca** (eyebrows, enlaces, íconos, pestañas) | **≈76** | 38 |
| **Total** | **118** | — |

Los `≈` son deliberados: la clasificación es **heurística** (busca `role="alert"`,
`state.error`, `fieldErrors` cerca). En un muestreo de 6, **5 estaban bien
clasificados y 1 mal**: `proveedores/SuppliersClient.tsx:264` pinta
`{supplier.nextCode}` —un código, no un error— y quedó del lado de errores
porque había un `deleteState.error` dos líneas abajo.

**Por eso el primer slice de esta spec es clasificar a mano los 118, no
reemplazar nada.** Un find-and-replace sobre una lista heurística cambiaría el
color de cosas que no son errores.

## El acento también reprueba — pero su arreglo es OTRO

Los ~76 usos de acento miden **el mismo 3,00:1**: también reprueban AA cuando son
texto. Pero **no son una no conformidad de BTN-01** (el vino ahí sí es vino), y
su arreglo ya existe y está medido:

| Token | Sobre card | Sobre paper |
|---|---|---|
| `--color-wine` (hoy) | 3,00:1 | 3,70:1 |
| **`--color-wine-text`** `#d89aa4` (clase `text-wine-text`) | **6,44:1** | **7,93:1** |

`--color-wine-text` ya está definido para esto — `globals.css:139` lo describe
como *"wine legible como texto en oscuro"*. **No hace falta decidir nada** para
esta mitad: es cambiar `text-wine` → `text-wine-text` donde el vino sea texto.

⚠️ **Excepción dentro del acento:** donde el vino es **relleno** (`.btn-primary`,
`bg-wine/10`, íconos decorativos) **no se toca**. `--color-wine` como fondo con
`--color-on-accent` encima ya mide 4,96:1 y está correcto.

## La decisión que falta (y por qué no la tomo yo)

Los ~42 errores tienen que salir del vino. **A qué color van es decisión tuya**,
porque el candidato obvio tiene un problema que ningún medidor de contraste ve.

`--color-status-danger-on-dark` (`#f6929a`) ya existe y lo aprobaste el
2026-08-13. Pasa el contraste en las cuatro superficies del portal (peor caso
4,64:1). **Pero mide ΔE2000 = 7,1 contra `--color-wine-text` (`#d89aa4`)** — que
es justo el token al que va a ir el acento en el slice A.

Ese 7,1 es **exactamente el número que se rechazó** al derivar el token: el
comentario de `globals.css:38-44` descartó la receta `#e59fa4` porque quedaba a
*"ΔE 7,1 … a 11px son el MISMO color"*. El análisis original comparó contra
`--color-wine-on-dark` (token de la web **pública**); el portal tiene otro vecino.

Y en el portal **conviven de verdad**: si el slice A manda el acento a
`wine-text`, los enlaces y los errores quedarían a ΔE 7,1 a 12 px.

| Par (tema oscuro) | ΔE2000 | Lectura |
|---|---|---|
| `#f6929a` vs `#d89aa4` (wine-text) | **7,1** | 🔴 indistinguibles a 12 px |
| `#e0606b` (danger actual) vs `#d89aa4` | 15,5 | se distinguen |
| `#f6929a` vs `#c24450` (wine) | 22,0 | se distinguen |

Ironía útil: el `--color-status-danger` **actual** sí se distingue del wine-text.
Su problema es contraste (4,29:1), no identidad. Adoptar `#f6929a` **invierte** el
trade-off en vez de cerrarlo.

### Opciones — ninguna aplicada

| | Opción | Qué cierra | Qué deja abierto |
|---|---|---|---|
| ⭐ **A** | **Ícono + prefijo en los mensajes de error**, además del color | SGE-00.11 lo exige igual: *"Color, icono o animación nunca son el único portador del significado"*. Baja el riesgo del ΔE sea cual sea el hue. | No resuelve el contraste por sí solo — se combina con B o C. |
| B | Adoptar `#f6929a` y **mover los enlaces del portal fuera de `wine-text`** | Contraste y colisión | Toca los ~76 del acento: el slice A cambia de forma. |
| C | **Token de peligro propio del portal** | Ambos, limpio | Es token nuevo → decisión tuya, `BRAND-CHECK`, y hay que medirlo contra `#d89aa4` (ΔE ≥ 15 sería consistente con el criterio ya aplicado) y contra el peor caso `#26406F`. |

**No invento ningún token.** Las tres esperan tu decisión.

## Alcance por slices

### Slice A — el acento a `--color-wine-text` *(listo para ejecutar)*

No depende de ninguna decisión. Cambia `text-wine` → `text-wine-text` en los usos
de acento **que sean texto**, dejando intactos los rellenos y los `hover:`.
Cierra ~76 usos de la no conformidad WCAG 1.4.3.

**Precondición:** el paso de clasificación (abajo) tiene que estar hecho.

### Slice 0 — clasificar los 118 a mano *(primero, siempre)*

Recorrer los 118 usos y etiquetar cada uno: `error` · `acento-texto` ·
`acento-relleno` · `hover`. Sale una allowlist exacta por categoría. **Sin esto
no arranca ni A ni B.**

### Slice B — los errores salen del vino *(bloqueado por la decisión)*

Los ~42 usos de error pasan al color que decidas, y —si eliges la opción A— suman
ícono y prefijo. Cierra la no conformidad de **BTN-01 §2**, que es la que bloquea.

### Slice C — que no vuelva a pasar *(opcional, al final)*

Un chequeo estilo `scripts/check-portal-aria-busy.mjs` que grite si aparece
`text-wine` en un nodo con `role="alert"` o que renderice `state.error`. Se
promueve al gate **después** de que B esté adentro, no antes.

## Criterios de aceptación

1. Los 118 usos están clasificados, con la lista versionada en esta carpeta.
2. Cero usos de `text-wine` crudo en un nodo que renderice error.
3. Ningún uso de acento **textual** se queda en `--color-wine`; los rellenos sí.
4. Medición en vivo posterior, con el mismo banco: todo texto de error y de
   acento ≥ 4,5:1 sobre **card** (`#16264A`) y sobre **paper** (`#0B1428`).
5. **ΔE2000 ≥ 15** entre el color de error final y el color de enlace final. Si
   la opción elegida no lo alcanza, se documenta como excepción con motivo —
   no se deja pasar en silencio.
6. `pnpm typecheck`, `pnpm lint`, `pnpm test`; `node scripts/verify.mjs` de cierre.

## Matriz SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.01 Acción predecible | `no aplica` | No cambia ningún verbo. |
| SGE-00.02 No perder trabajo | `no aplica` | — |
| SGE-00.03 Riesgo ↔ fricción | `no aplica` | — |
| SGE-00.04 Auditabilidad | `no aplica` | — |
| SGE-00.05 Permisos y tenant | `no aplica` | — |
| SGE-00.06 Prevenir antes de informar | `cumple` | La validación ya existe; esto es cómo se presenta. |
| SGE-00.07 Estado visible y verdadero | `cumple` parcial | El error se muestra; el problema es que no se lee y no se distingue. |
| SGE-00.09 Reutilizar el patrón | **`no cumple`** | 118 usos sueltos del mismo color con 4 significados distintos. El portal no tiene primitiva de error (ver SDD-0260, misma raíz). |
| **SGE-00.10 Accesible y equivalente** | **`no cumple` → lo corrige esta spec** | 3,00:1 medido, umbral 4,5:1. |
| **SGE-00.11 Decir qué pasó** | **`no cumple`** | *"Color … nunca es el único portador del significado"* — hoy el color es el único canal de "esto es un error", y encima es el mismo color de la marca. |
| SGE-00.12 IA propone | `no aplica` | — |

## Gobernanza

| Control | Valor |
|---|---|
| Política que obliga | **BTN-01 v1.1 §2** (aprobada) → **bloquea** · A11Y-01 v1.1 (aprobada) |
| Clasificación | **no conformidad** — la de mayor severidad de la auditoría |
| Componente `canonical` involucrado | ninguno (el portal no consume ninguno de los 4 del registro) |
| ¿Suma consumidores a un `deprecated`? | **No.** |
| Decisión pendiente del founder | color de error del portal (§"La decisión que falta") + `BRAND-CHECK` si sale la opción C |
| Recomendación mía, **no** bloqueante | la opción A (ícono + prefijo) y el umbral ΔE ≥ 15 del criterio 5 |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Reemplazo masivo sobre una lista heurística cambia colores que no son errores | Slice 0 obligatorio: clasificación a mano antes de tocar nada. Ya hay 1 falso positivo confirmado. |
| Se arreglan los 5 hallazgos de contraste juntos y desaparece el síntoma sin saber la causa | Esta spec toca **sólo** el vino. El `--color-status-danger` (4,29:1) y el `--color-status-success` van por separado — comparten síntoma, **no** causa. |
| Se elige un color que pasa contraste pero se confunde con el enlace | Criterio 5: ΔE ≥ 15 medido, no supuesto. |
| Otro worktree numera 0261 | Número de `pnpm sdd:next` (23 refs, locales y remotas), **sin reservar** — no se pushea sin OK. El paso `numbering` de `verify.mjs` lo agarra al mergear. |
