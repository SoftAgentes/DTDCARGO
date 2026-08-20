---
sdd: 0275
title: Los tres pendientes del rediseño de Usuarios, y un cuarto que salió al verificar
status: in-progress
author: Claude (ventana 2026-08-19)
created: 2026-08-19
updated: 2026-08-19
supersedes: null
superseded_by: null
related: [0274, 0273, 0263, 0252]
confidencialidad: interna
---

# SDD-0275 · Los tres pendientes, y un cuarto que salió al verificar

SDD-0273 y SDD-0274 salieron a producción con tres hallazgos abiertos, **todos
preexistentes** y ninguno introducido por ese trabajo. Se cierran acá.

El **cuarto** (§4) no estaba en la lista: apareció al comprobar un número que el
founder pidió verificar. Es el más grave de los cuatro, y es el que ninguna
herramienta iba a encontrar — la señal era plausible y estaba mal.

Los cuatro se **midieron**, no se calcularon.

## 1 · El badge `danger` daba 4,19:1 en tema oscuro

`Badge` tenía cinco tonos con el texto en `--ink` y el color semántico en el
punto (BD-018, 2026-07-12) y **uno solo con el texto en el color crudo**:
`danger`. En claro pasa (5,63:1); en oscuro daba **4,19:1**, bajo el 4,5 de AA.

**No se resolvió como los otros cinco.** Mandar el texto a `--ink` habría
quitado el rojo de un badge que significa *alarma*: contraste correcto y
significado perdido. Se resolvió con un token de texto por tema, siguiendo el
patrón que ya existía para el wine (`--wine-text`):

```css
/* claro */ --danger-text: var(--danger);                              /* 5,63 */
/* oscuro */ --danger-text: var(--color-status-danger-on-dark, #F6929A); /* 5,57 */
```

`#F6929A` no es un color inventado: es el que el founder aprobó el 2026-08-13
justo para esto, elegido además por estar a **ΔE 19,3 del wine-on-dark** —
contraste suficiente con un color indistinguible del vecino sigue siendo un bug,
y ningún medidor de contraste lo ve.

⚠️ El token vive en `:root` de `app/globals.css`, mientras que su alias
`--danger-on-dark` está dentro de `.pa-surface` y **el Studio no lo ve**. Se
verificó en el navegador que `--color-status-danger-on-dark` sí resuelve en el
scope del Studio (`#f6929a`), así que no se está cayendo al fallback. El
fallback queda por si Tailwind poda el token el día que nadie lo referencie.

**El fill de los botones sigue en `--danger`.** Sólo cambia el texto.

**Medido, los 6 tonos en los 2 temas:** cero por debajo de AA. `danger` pasó de
4,19 → **5,57** en oscuro.

## 2 · A 375 px el chevrón quedaba fuera de la caja visible

Con la fila muda (SDD-0274), el chevrón es el **único** indicio de que la fila
abre algo. A 375 px la tabla mide 410 px y scrollea dentro de su tarjeta: el
chevrón quedaba fuera hasta que alguien scrolleara de lado. La fila entera
seguía siendo tappable, así que no se perdía la función — se perdía la pista.

La columna de 40 px pasa a `position: sticky; right: 0`, con fondo propio (sin
él se transparenta lo que pasa por debajo) y su encabezado anclado igual, para
que no se despegue al scrollear.

⚠️ **No es el `sticky` que SDD-0274 quitó.** Aquél anclaba un racimo de botones
y existía por el ancho que ocupaban; al desaparecer los botones, desapareció su
motivo. Éste ancla 40 px por una razón distinta y documentada: que el único
indicio de la fila no se esconda.

## 3 · `ActionMenu` se recortaba dentro de cualquier contenedor con scroll

El panel era `position:absolute` dentro del envoltorio y confiaba en
`zIndex: 60`. **Un ancestro con `overflow:auto` recorta a su hijo absoluto sin
importar el z-index**, así que dentro de una tabla con scroll —o de un drawer—
el menú de las últimas filas se cortaba.

Nunca se había visto porque el único consumidor verificado (`ClientsClient`) lo
usa en la **cabecera** de su módulo, fuera de la caja con scroll. Se descubrió
al evaluar si convenía usarlo en la fila de Usuarios; se evitó entonces eligiendo
chevrón, y se arregla ahora.

**Arreglo:** el panel se renderiza con `createPortal` en `document.body`, con
`position: fixed` y coordenadas calculadas desde el trigger. Se conserva el
volteo hacia arriba cuando abajo no cabe, y se agrega un clamp horizontal para
que no se salga de la ventana por ningún lado.

Tres cosas que el portal obliga y que son donde esto se rompe:

1. 🔴 **El guard de «clic afuera» dejó de contener al panel.** Preguntaba sólo
   por el envoltorio; con el panel en un portal, **cualquier clic dentro del
   menú lo cerraba**. Ahora pregunta por los dos. Hay prueba.
2. **La posición se recalcula en `scroll` y `resize`**, con `capture: true`
   porque el scroll de una caja interna no burbujea. Con posición fija, sin
   esto el panel se queda flotando donde estaba.
3. **`createPortal` necesita `document`**, que no existe en el render del
   servidor: se monta tras el primer efecto.

## 4 · La banda contaba a alguien que sí entra (encontrado al verificar)

El founder pidió confirmar que, tras entrar Alejandro, la banda bajara de 4 a 3
pendientes. **No bajaba: seguía en 4**, y el cuarto era un falso positivo.

`accessStage` lee `user_tenants.last_login_at`, que escribe un trigger sobre
`auth.sessions` (migr 0019). Medido en producción el 2026-08-20: **dos de nueve
cuentas la tienen en `null` habiendo iniciado sesión de verdad** — una de ellas
el 2026-06-20, y es la segunda cuenta admin del founder.

Mientras esa columna sólo pintaba un «Nunca» en una celda de fecha, el falso
negativo era cosmético. Con la banda de SDD-0274 deja de serlo: cuenta la
cuenta como pendiente y **ofrece mandarle un correo de acceso a quien ya
entra**. Una función construida sobre una señal que nadie había auditado.

**Arreglo:** la página toma la **más reciente** entre `user_tenants.last_login_at`
y `auth.users.last_sign_in_at` — la segunda es la fuente de verdad de Auth y la
página **ya la estaba trayendo** para resolver los correos; sólo estaba sin usar.
Cubre tanto el `null` como una columna que se haya quedado atrás.

No se pierde fidelidad por tenant: el propio trigger actualiza todos los tenants
del user a la vez, así que la columna nunca fue per-tenant de verdad.

⚠️ **No se arregla el trigger ni se hace backfill.** No se midió *por qué*
falla —los dos casos son de mayo y junio, y una cuenta del mismo día sí la
tiene—, y una migración de datos sobre una señal que no se entiende es peor que
leer la fuente correcta. Queda anotado como deuda con su evidencia.

## Verificación

- `node scripts/verify.mjs` en verde.
- Contraste medido **en navegador** sobre el `Badge` real, en los dos temas.
- Los **21 tests del contrato de teclado** de `ActionMenu` (BTN-01 §7) siguen
  pasando sin cambios: el portal no tocó el comportamiento, sólo dónde vive el
  nodo.
- 6 pruebas de la regla de «último acceso», incluida la del caso real que la
  motivó (columna en `null`, Auth con fecha).
- 3 pruebas nuevas y 2 mutaciones rojas:
  - quitar el guard del panel en el clic-afuera → 2 pruebas en rojo;
  - volver a renderizar dentro del envoltorio (sin portal) → 1 en rojo.

## Lo que NO se hace

| No se hace | Por qué |
|---|---|
| Mandar el texto de `danger` a `--ink` como los otros cinco | Perdería el rojo de alarma. El problema era el contraste, no el color. |
| Migrar los 17 consumidores de `tone="danger"` | No hace falta: el cambio es del token, no de la API. Ninguno se entera. |
| Poner `ActionMenu` en la fila de Usuarios | El founder pidió las acciones dentro del perfil. El portal arregla la primitiva; no cambia esa decisión. |
