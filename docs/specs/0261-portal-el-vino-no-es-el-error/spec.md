---
sdd: 0261
title: En el portal el vino de marca deja de significar "error"
status: proposed
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0042, 0257, 0260]
confidencialidad: interna
---

# SDD-0261 · En el portal el vino de marca deja de significar "error"

> **Estado `proposed`.** Las dos decisiones del founder están tomadas
> (2026-08-14): **opción A** (ícono + prefijo) y el **color
> `--color-status-danger-on-dark` `#f6929a`**. La spec queda ejecutable de punta
> a punta. Trae una **excepción formal documentada** por el ΔE 7,1 (§"Excepción
> EXC-0261-01").

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

Y hay una **segunda política aprobada** que el portal tampoco cumple.
[ERR-01 v1.0](../../governance/policies/err-01.md) (aprobada 2026-07-29,
REV-SGE-003), sección Reglas, dice:

> Color danger se acompaña con texto/icono **y contraste**.

Las dos mitades de esa frase están incumplidas hoy: el error del portal viaja
**sólo en el color**, y ese color mide 3,00:1. Ver §"La decisión tomada".

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

## La decisión tomada — opción A (founder, 2026-08-14)

**El error deja de viajar sólo en el color: suma ícono y prefijo.**

Resulta que esto no era una preferencia. Es lo que **ERR-01 v1.0 ya obliga**
(*"Color danger se acompaña con texto/icono y contraste"*) y lo que **SGE-00.11**
pone como ley constitucional (*"Color, icono o animación nunca son el único
portador del significado"*). O sea: la opción A no agrega una capa opcional —
cierra una no conformidad que estaba abierta y que la auditoría no había nombrado.

### Contrato de presentación del error

Todo mensaje de error del portal, en los tres niveles que aplican del
[taxonómico de ERR-01](../../governance/policies/err-01.md):

| Elemento | Regla | Origen |
|---|---|---|
| Ícono | Ícono de alerta a la izquierda, `aria-hidden` (no se lee dos veces) | ERR-01 · SGE-00.11 |
| Prefijo | El texto empieza nombrando el problema, no el color | ERR-01 |
| Rol | `role="alert"` en errores de campo y de formulario | A11Y-01 |
| Ubicación | Pegado a su causa; el toast no reemplaza | ERR-01 |
| Contenido | Qué pasó, qué se conservó y qué puede hacer la persona | ERR-01 |
| Contraste | ≥ 4,5:1 sobre card **y** sobre paper | ERR-01 · WCAG 1.4.3 |

**Hallazgo nuevo que sale de aplicar esto:**
[`perfil/AvatarEditor.tsx:82`](<../../../app/portal/(app)/perfil/AvatarEditor.tsx>)
anuncia un error con `role="status"` en vez de `role="alert"`. `status` es para
lo no urgente: el lector no lo interrumpe. Entra al slice B.

### ⚠️ La A no cierra el contraste — y ERR-01 lo dice en la misma frase

*"…se acompaña con texto/icono **y contraste**"*. Si los ~42 errores se quedan en
`text-wine` con un ícono al lado, siguen midiendo **3,00:1** y siguen violando
BTN-01 §2. **Falta elegir el color.**

### Pero elegir A cambia la evaluación de la opción B

Éste es el efecto útil de tu decisión. La objeción contra
`--color-status-danger-on-dark` (`#f6929a`) era que a ΔE 7,1 de
`--color-wine-text` **el color sería el único diferenciador** entre un enlace y un
error, y a 12 px no alcanzaría.

**Con ícono y prefijo, el color deja de ser el único diferenciador.** La objeción
no desaparece, pero deja de ser bloqueante: el canal que distingue error de
enlace pasa a ser el ícono, y el color queda como refuerzo.

| Candidato bajo A | Contraste (peor caso) | ΔE vs `wine-text` | Veredicto |
|---|---|---|---|
| Quedarse en `--color-wine` `#c24450` | 3,00:1 | — | ❌ viola BTN-01 §2 y AA |
| `--color-status-danger` `#e0606b` (hoy) | 4,29:1 card | 15,5 | ❌ AA por 0,21 |
| ⭐ **`--color-status-danger-on-dark` `#f6929a`** | **4,64:1** nav · **6,73:1** card | 7,1 | ✅ mitigado por el ícono |
| Token propio del portal (opción C) | a medir | a medir | requiere `BRAND-CHECK` |

**Recomendación: A + B.** Es la única combinación que pasa AA en las cuatro
superficies **sin token nuevo** y sin `BRAND-CHECK`. Y trae un bonus: bajo A, el
slice del acento **ya no necesita mover los enlaces fuera de `wine-text`** —el
requisito que hacía cara a la opción B— porque el ícono hace el trabajo.

## El color decidido — `#f6929a` (founder, 2026-08-14)

Aprobado **A + B**. El color de error del portal pasa a
`--color-status-danger-on-dark` (`#f6929a`), token que **ya existe** y que el
founder aprobó el 2026-08-13. **Cero tokens nuevos. Sin `BRAND-CHECK`.**

### 🎁 Se aplica en UNA línea, y cierra dos hallazgos más

El portal ya redefine el token de peligro por tema. La implementación **no es
tocar 42 archivos con una clase nueva**: es cambiar el valor en
[`app/globals.css:142`](../../../app/globals.css), dentro de
`[data-portal-theme="dark"]`:

```diff
- --color-status-danger: #e0606b;
+ --color-status-danger: #f6929a;
```

El tema claro no se toca: `:root` conserva `#c2353f` (globals.css:68), que ya
pasa AA sobre papel.

Y como todo el portal oscuro lee ese mismo token, la línea **cierra de paso dos
hallazgos de la auditoría que tenían SDD pendiente**:

| Hallazgo de la auditoría | Antes | Después | |
|---|---|---|---|
| #3 · `--color-status-danger` como texto sobre card | 4,29:1 | **6,73:1** | ✅ |
| #8 · punto de aviso del sidebar sobre `#26406F` | 2,96:1 | **4,64:1** | ✅ |
| Bordes de error (`AcceptanceForm`, `PaymentReportForm`) | 4,29:1 | **6,73:1** | ✅ |

⚠️ **Eso NO significa que la causa fuera una sola.** El `text-wine` de los ~42
errores sigue siendo un problema **distinto** —semántico, BTN-01 §2— y esta línea
no lo toca: los errores tienen que dejar de usar `text-wine` igual. Que un cambio
haga desaparecer tres síntomas no convierte a los tres en el mismo bug.

### Contraste medido del token elegido

Medido en vivo el 2026-08-14, tema oscuro:

| Superficie | `#f6929a` | Umbral |
|---|---|---|
| Paper `#0B1428` | **8,29:1** | 4,5:1 ✔ |
| Card `#16264A` | **6,73:1** | 4,5:1 ✔ |
| Grey-100 `#1F3055` | **5,89:1** | 4,5:1 ✔ |
| Nav, parada clara `#26406F` *(peor caso)* | **4,64:1** | 4,5:1 ✔ |

Tema claro (`#c2353f`, sin cambios): **medido** como conforme en la auditoría —
no apareció entre las fallas del barrido del tema claro. *(El valor puntual sobre
blanco, ~5,4:1, es **calculado**, no medido: se confirma en el criterio 5.)*

## Excepción EXC-0261-01 — ΔE 7,1 entre el error y el enlace

Registrada según [gobernanza §5](../../governance/README.md): motivo, alcance,
responsable, fecha de revisión, política afectada y mitigación.

| Campo | Valor |
|---|---|
| **Qué se excepciona** | El criterio de derivación de los tokens `on-dark`, que en `globals.css:38-44` descartó un candidato por quedar a **ΔE 7,1** de un vecino ("a 11px son el MISMO color"). `#f6929a` queda a ese mismo ΔE 7,1 de `--color-wine-text` (`#d89aa4`), el color de los enlaces del portal. |
| **Motivo** | Ese criterio se escribió para un caso donde **el color era el único diferenciador**. Bajo la opción A —ya obligatoria por ERR-01— el error lleva ícono y prefijo, así que la distinción error/enlace deja de descansar en el tono. |
| **Alcance** | Sólo el tema oscuro del Portal del Cliente. No aplica a la web pública, donde `--color-wine-on-dark` y `--color-status-danger-on-dark` conviven **sin** ícono obligatorio. |
| **Responsable** | Sam (founder) — decisión del 2026-08-14 |
| **Fecha de revisión** | Al cerrar el slice B, con la evidencia del criterio 7 |
| **Política afectada** | Ninguna política numerada: es el criterio del token, no una regla del registro. Por eso **no requiere `BRAND-CHECK`** (el token ya está aprobado) pero sí queda registrada acá. |
| **Mitigación y prueba** | Criterio 7: captura real de un formulario con un enlace y un error visibles a la vez, a tamaño real. **Si no se distinguen, la excepción se revoca** y vuelve el umbral ΔE ≥ 15 (opción C). |

**Esto no se cierra por decreto.** La excepción vive mientras la captura la
sostenga.

---

<details>
<summary>Análisis original de las 3 opciones (previo a la decisión)</summary>

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

</details>

## Alcance por slices

### Slice 0 — clasificar los 118 a mano *(primero, siempre)*

Recorrer los 118 usos y etiquetar cada uno con el nivel de ERR-01 cuando aplique:
`error-campo` · `error-formulario` · `error-transacción` · `acento-texto` ·
`acento-relleno` · `hover`. Sale una allowlist exacta por categoría. **Sin esto
no arranca ningún otro slice.**

### Slice A — el acento a `--color-wine-text` *(listo para ejecutar)*

No depende del color de error. Cambia `text-wine` → `text-wine-text` en los usos
de acento **que sean texto**, dejando intactos los rellenos y los `hover:`.
Cierra ~76 usos de la no conformidad WCAG 1.4.3 (3,00:1 → 6,44:1).

✅ **Bajo la opción A ya elegida, este slice NO tiene que mover los enlaces fuera
de `wine-text`.** Ése era el costo de la opción B y el ícono lo vuelve
innecesario. El slice queda como estaba pensado.

**Precondición:** slice 0.

### Slice B — presentación del error *(ejecutable en su mitad)*

Dos mitades con distinta disponibilidad:

| Mitad | Qué hace | Estado |
|---|---|---|
| **B.1 — estructura** | Ícono + prefijo + `role="alert"` + copy según ERR-01 en los ~42. Incluye corregir el `role="status"` de `AvatarEditor.tsx:82`. | ✅ **Destrabado por la decisión A.** No depende del color. |
| **B.2 — color** | Una línea en `globals.css:142` (`#e0606b` → `#f6929a`) **más** sacar los ~42 errores de `text-wine` y ponerlos en `text-status-danger`. | ✅ **Destrabado.** Color aprobado el 2026-08-14. |

**B.1 cierra ERR-01 y SGE-00.11. B.2 cierra BTN-01 §2 y WCAG 1.4.3.** Son la misma
no conformidad vista desde dos políticas: hasta que las dos estén, la spec no
cierra.

⚠️ **B.1 sola no basta y no se reporta como cierre.** Un error con ícono pero a
3,00:1 sigue siendo ilegible; ERR-01 pide texto/icono **y** contraste.

### Slice C — que no vuelva a pasar *(opcional, al final)*

Un chequeo estilo `scripts/check-portal-aria-busy.mjs` que grite si aparece
`text-wine` en un nodo con `role="alert"` o que renderice `state.error`. Se
promueve al gate **después** de que B esté adentro, no antes.

## Criterios de aceptación

1. Los 118 usos están clasificados, con la lista versionada en esta carpeta.
2. Cero usos de `text-wine` crudo en un nodo que renderice error.
3. Ningún uso de acento **textual** se queda en `--color-wine`; los rellenos sí.
4. **Todo mensaje de error lleva ícono `aria-hidden` + prefijo que nombra el
   problema**, y `role="alert"` donde ERR-01 lo pide. `AvatarEditor.tsx:82` deja
   de usar `role="status"` para un error.
5. Medición en vivo posterior, con el mismo banco, **en LOS DOS TEMAS**: todo
   texto de error y de acento ≥ 4,5:1 sobre card, paper y grey-100. En oscuro
   card = `#16264A` / paper = `#0B1428`; en claro card = `#FFFFFF` / paper =
   `#FBFAF7`. Incluye confirmar el `#c2353f` del tema claro, que hoy sólo está
   **calculado** (~5,4:1), no medido punto por punto.
6. **ΔE2000 entre el color de error final y el de enlace final:** ≥ 15 lo cierra
   sin más. **Entre 7 y 15 se acepta SÓLO si el criterio 4 está cumplido** —el
   ícono es el que carga la distinción— y se documenta como excepción con motivo,
   responsable y fecha de revisión. Nunca en silencio.
   → Con `#f6929a` el valor es **7,1**: cae en la banda de excepción, registrada
   como **EXC-0261-01**.
6b. **Los hallazgos #3 y #8 de la auditoría se vuelven a medir** después del
   cambio de `globals.css:142` y se cierran en el informe, o se explica por qué
   no. No se dan por cerrados de arrastre.
7. **Prueba de la mitigación, no supuesto:** verificar con una captura de un
   formulario que tenga un enlace y un error visibles a la vez, a tamaño real,
   que se distinguen. Si no se distinguen, el criterio 6 vuelve a ≥ 15.
8. `pnpm typecheck`, `pnpm lint`, `pnpm test`; `node scripts/verify.mjs` de cierre.

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
| **SGE-00.11 Decir qué pasó** | **`no cumple` → lo corrige el slice B.1** | *"Color … nunca es el único portador del significado"* — hoy el color es el único canal de "esto es un error", y encima es el mismo color de la marca. El ícono + prefijo de la opción A es exactamente el remedio. |
| SGE-00.12 IA propone | `no aplica` | — |

## Gobernanza

| Control | Valor |
|---|---|
| Políticas que obligan | **BTN-01 v1.1 §2** (aprobada) · **ERR-01 v1.0** *"color danger se acompaña con texto/icono y contraste"* (aprobada) · A11Y-01 v1.1 (aprobada) · SGE-00.10 y .11 → **las cuatro bloquean** |
| Clasificación | **no conformidad** — la de mayor severidad de la auditoría |
| Componente `canonical` involucrado | ninguno (el portal no consume ninguno de los 4 del registro) |
| ¿Suma consumidores a un `deprecated`? | **No.** |
| Decisiones del founder ya tomadas | **opción A** (ícono + prefijo) y **color `#f6929a`** — ambas 2026-08-14. Sin decisiones pendientes. |
| Excepción registrada | **EXC-0261-01** (ΔE 7,1) — con motivo, alcance, responsable, revisión y prueba de mitigación |
| ¿Requiere `BRAND-CHECK`? | **No.** El token ya estaba aprobado el 2026-08-13; no se inventa ninguno. |
| Recomendación mía, **no** bloqueante | el umbral ΔE ≥ 15 del criterio 6 como estado ideal al que volver si la excepción se revoca |

⚠️ **La opción A resultó no ser una recomendación mía.** Al abrir ERR-01 para
redactar el contrato apareció que *"color danger se acompaña con texto/icono y
contraste"* ya es regla **aprobada**. O sea que el ícono y el prefijo pasan de
"buena idea" a **obligación incumplida** — una no conformidad que la auditoría
del 2026-08-14 no había levantado porque no abrió ERR-01. Se corrige acá.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Reemplazo masivo sobre una lista heurística cambia colores que no son errores | Slice 0 obligatorio: clasificación a mano antes de tocar nada. Ya hay 1 falso positivo confirmado. |
| Se arreglan los 5 hallazgos de contraste juntos y desaparece el síntoma sin saber la causa | Esta spec toca **sólo** el vino. El `--color-status-danger` (4,29:1) y el `--color-status-success` van por separado — comparten síntoma, **no** causa. |
| Se elige un color que pasa contraste pero se confunde con el enlace | Criterios 6 y 7: el ΔE se mide, y si queda entre 7 y 15 hay que **probar** que el ícono distingue con una captura real — no basta con afirmar que mitiga. |
| Se cierra B.1 (ícono) y se reporta la spec como cumplida sin B.2 | ERR-01 pide texto/icono **y** contraste en la misma regla. La spec no cierra con media. |
| Otro worktree numera 0261 | Número de `pnpm sdd:next` (23 refs, locales y remotas), **sin reservar** — no se pushea sin OK. El paso `numbering` de `verify.mjs` lo agarra al mergear. |
