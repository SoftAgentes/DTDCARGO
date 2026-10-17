# Handoff · SDD-0516 · Portal: el detalle de compra no promete avisos mientras el seguimiento está en construcción

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 (UTC 18:40 a 19:30 aprox.; Caracas 14:40 a 15:30) |
| Task ID / owner | `compra-texto-sin-promesa` / subagente Worker del Director |
| Claim del harness | `compra-texto-sin-promesa-worker` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a610cd1789a0693f7` |
| Rama | `codex/compra-texto-sin-promesa` |
| Base | `origin/main` `4c4c6c17` (trae la #211, SDD-0514) |
| SDD | [0516](../../docs/specs/0516-compra-texto-sin-promesa/spec.md), `in-progress` (la asignó el Director) |
| Estado de la tarea | lista para revisión (PR en draft) |
| Permisos | commits selectivos, push de la rama propia y PR en draft contra main. Sin merge, sin producción, sin VPS, sin base de datos. Nada se fusiona en la ventana del corte al VPS (jueves 2026-10-15 en la noche). |

## Objetivo

Mientras `TRACKING_EN_CONSTRUCCION` esté en `true`, el detalle de una compra del
Portal no promete avisos ni estados automáticos de bodega que hoy no van a
llegar, porque la bodega de China todavía registra en Excel. Con `false` vuelve
el texto de hoy. Mismo interruptor de la 0514.

Decisión de Sam (2026-10-14, AskUserQuestion), opción elegida: «Sí, en una tarea
aparte (Recomendado)».

## Qué se hizo

- `app/portal/(app)/compras/[code]/page.tsx`: lee `TRACKING_EN_CONSTRUCCION` y,
  sólo para la compra sin recepciones, cambia el título y el detalle del estado de
  llegada y el texto de la tarjeta «Recepción en bodega (China)». Los estados
  parcial, completo y excedente no cambian.
- `app/portal/(app)/page.tsx`: la tarjeta de notificaciones de la portada deja de
  nombrar la llegada a bodega; conserva zarpe y entrega.
- `lib/portal/tracking-en-construccion.ts` y
  `app/portal/_components/PortalTrackingEnConstruccion.tsx`: sólo comentarios. El
  segundo decía que el componente era el único lector del interruptor.
- `scripts/feature-constants.json`: el `significa` de `TRACKING_EN_CONSTRUCCION`
  nombra la 0516 y los textos que vuelven al apagarlo. Voseo: las líneas de la
  0514 no tenían («apágalo» es tuteo). El voseo del `$doc` no es de la 0514 y no
  se tocó.
- Pruebas: 3 casos nuevos y 2 ajustados en
  `app/portal/(app)/compras/[code]/page.test.tsx`; archivo nuevo
  `app/portal/(app)/page.test.tsx` (2 casos).
- Spec 0516 e índice regenerado.

### Texto que ve el cliente con el interruptor encendido

Compra con 4 cajas anunciadas y sin recepciones (el número sale de la compra; con
1 caja dice «1 caja»):

- Estado de llegada, título: «La llegada a bodega todavía no aparece aquí»
- Estado de llegada, detalle: «Anunciaste 4 cajas. Mientras activamos el
  seguimiento, nuestro equipo en China lleva el control de cada recepción. Para
  saber si ya llegó, escríbenos en Soporte.»
- Tarjeta «Recepción en bodega (China)»: «Las recepciones de esta compra todavía
  no aparecen aquí mientras activamos el seguimiento.»
- Portada, tarjeta de notificaciones: «Activa las notificaciones y tu navegador te
  avisa cuando tu carga zarpa y cuando está por entregarse — aunque no tengas el
  portal abierto.» (título «Entérate apenas se mueva tu carga» sin cambios).

Con el interruptor apagado vuelven, palabra por palabra: «Todavía no llegó a
nuestra bodega» · «Anunciaste 4 cajas. Te avisamos apenas el proveedor entregue en
Yiwu.» · «Todavía no registramos la llegada de esta compra a nuestra bodega en
Yiwu. Cuando el proveedor entregue, verás acá cada recepción con su fecha, sus
cajas y las medidas reales.» · «Activa las notificaciones y tu navegador te avisa
cuando tu mercancía llega a bodega, cuando zarpa y cuando está por entregarse —
aunque no tengas el portal abierto.»

Por qué no se usó el ejemplo del encargo («Nuestro equipo en China confirma la
recepción de tu mercancía»): en presente se puede leer como «tu mercancía ya se
recibió». Detalle de las razones en la spec.

## `/ui-check` (diff de SDD-0516)

```
UI-CHECK · diff SDD-0516 (compras/[code]/page.tsx, (app)/page.tsx)
Hallazgos (3):
1 ⭐ [media] app/portal/(app)/compras/[code]/page.tsx:486 — el detalle nombra
   «Soporte» como texto, sin enlace. El enlace «¿Dudas? Escríbenos en Soporte»
   está en el aviso de la 0514, justo encima (a 360 px el aviso termina en ese
   enlace y el bloque de llegada empieza debajo). Se deja así para no duplicar el
   enlace; si Sam lo quiere aquí también, es un ajuste chico.
2  [baja] app/portal/(app)/compras/[code]/page.tsx:180,486 — «mientras activamos
   el seguimiento» aparece en el detalle y en la tarjeta de recepción, y el aviso
   dice «Estamos activando…». Repetición aceptable: en móvil la tarjeta de
   recepción queda lejos del aviso y se lee sola.
3  [baja] app/portal/(app)/compras/[code]/page.tsx:486 — el detalle pasa de ~70 a
   ~170 caracteres: una o dos líneas más a 360 px dentro de max-w-[62ch]. Sin
   ancho fijo que medir.
Lo que está bien: sin cambios de clases, colores, tamaños ni estructura; cero hex;
tono información (punto gris) como antes; ningún elemento interactivo nuevo;
tuteo («escríbenos», «Activa»), sin voseo; sin fecha prometida; alineado a la
izquierda.
Veredicto: OK para commit.
```

Contraste: no cambia ningún par texto/fondo (mismos `text-ink` y `text-grey-700`
sobre los mismos fondos que en main; la 0514 midió grey-700 sobre la card en
12.63:1 claro y 7.33:1 oscuro). Capturas: no se tomaron, porque el cambio es sólo
de texto dentro de los mismos bloques.

## Guion de smoke para Sam

Después de que la PR esté desplegada, con un cliente real que tenga al menos una
compra **sin** recepción en el sistema y, si existe, una **con** recepción. En el
teléfono y en la computadora. Sólo mirar.

| # | Pantalla | Qué tienes que ver | Es falla si… |
|---|---|---|---|
| 1 | Detalle de una compra sin recepción (`/portal/compras` → toca la compra) | Arriba, el aviso «Seguimiento en construcción». Debajo, «La llegada a bodega todavía no aparece aquí» y «Anunciaste N cajas. Mientras activamos el seguimiento, nuestro equipo en China lleva el control de cada recepción. Para saber si ya llegó, escríbenos en Soporte.» | Aparece «Te avisamos apenas el proveedor entregue en Yiwu» o «Todavía no llegó a nuestra bodega». |
| 2 | La misma compra, tarjeta «Recepción en bodega (China)» | «Las recepciones de esta compra todavía no aparecen aquí mientras activamos el seguimiento.» | Aparece «verás acá cada recepción». |
| 3 | La misma compra, resto de la pantalla | «Lo que registraste», «Ver etiquetas» y el bloque del packing list como siempre. | Falta algo que antes estaba. |
| 4 | Detalle de una compra con recepción registrada (si existe) | «Llegaron …» con sus cajas, la recepción con su código, fecha y medidas, y sus fotos si las tiene. | Sale el texto de espera en vez de la recepción, o la recepción no se ve. |
| 5 | `/portal` (Inicio), en un navegador donde **no** hayas activado las notificaciones (por ejemplo, una ventana privada o otro navegador) | Tarjeta «Entérate apenas se mueva tu carga» con «…te avisa cuando tu carga zarpa y cuando está por entregarse — aunque no tengas el portal abierto.» | El texto dice «cuando tu mercancía llega a bodega». |
| 6 | Tema oscuro en el detalle de compra | Los textos nuevos se leen igual de bien que antes. | Texto gris tenue difícil de leer. |

Si en el paso 5 la tarjeta no sale en ningún navegador: sólo se pinta cuando el
navegador soporta notificaciones y el build tiene la clave pública de push
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`); con las notificaciones ya activadas sale
«Notificaciones activadas», que no cambia. No lo causa este cambio, pero conviene
revisarlo en el VPS después del corte.

## Validación

Sobre el árbol de trabajo encima de `origin/main` `4c4c6c17`.

| Comprobación | Resultado |
|---|---|
| `corepack pnpm install --frozen-lockfile --prefer-offline` | PASÓ (exit 0, 33,5 s) |
| Pruebas de la tarea (2 archivos, 8 casos) | PASÓ, 8/8: `compras/[code]/page.test.tsx` 6, `(app)/page.test.tsx` 2 |
| Control rojo: pruebas nuevas con el código de `origin/main` `4c4c6c17` | PASÓ como control: 4 failed / 4 passed. Caen los 4 casos «prendido»: «expected … not to match /bodega/i» (portada), «expected … not to match /te avisamos\|…/i» y «Unable to find an element with the text: La llegada a bodega todavía no aparece aquí» (compra, 3 casos). Pasan los 2 «apagado» de la 0516, el «apagado» y el de recepción real de la 0514. |
| Mutantes (6) | PASÓ: 6/6 muertos, control 8/8 antes y después, archivos restaurados. M1 el estado de llegada ignora el interruptor → 3 casos. M2 la tarjeta de recepción lo ignora → 2. M3 interruptor invertido en la compra → 5 (incluye el «apagado» de la 0514). M4 la frase neutra vuelve a prometer el aviso → 2. M5 la portada ignora el interruptor → 1. M6 interruptor invertido en la portada → 2. |
| `vitest related --run` de los 4 archivos de código y las 2 pruebas | PASÓ: 4 archivos, 21 pruebas (`compras/[code]/page.test.tsx` 6, `(app)/page.test.tsx` 2, `PortalTrackingEnConstruccion.test.tsx` 10, `PortalAlertasHub.test.tsx` 3) |
| `corepack pnpm exec tsc --noEmit` (sin tubería) | PASÓ (exit 0, sin salida) |
| eslint de los 6 archivos `.ts`/`.tsx` tocados | PASÓ (exit 0) |
| `node scripts/check-feature-constants.mjs` | PASÓ: 6 banderas coinciden |
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ: índice sincronizado con 501 specs |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: sin números repetidos |
| `git diff --check` (y `--cached` antes de cada commit) | PASÓ |
| `/ui-check` | PASÓ: OK para commit (bloque de arriba) |
| `pnpm verify` completo | NO EJECUTADO: el encargo pide validación liviana; el Director reserva el turno de corridas pesadas |
| vitest completo, e2e, Docker, build | NO EJECUTADO: mismo motivo. No hay e2e sobre las pantallas autenticadas del Portal (lo revisó la 0514 en `e2e/`). |
| `pnpm governance:check`, `pnpm components:check` | NO EJECUTADO: no hay componentes ni patrones nuevos; los incluye `pnpm verify` |
| Smoke en el Portal con un cliente | NO EJECUTADO: requiere sesión real de cliente; queda el guion para Sam |
| `pnpm knowledge:status` | Ejecutado (exit 0, `ok: false`): estructura `INVALID` y semántica `INVALID` porque este worktree no tiene `graphify-out`; Archify `PENDING` (runtime ausente); Obsidian `PENDING`. Es el estado de cualquier worktree sin derivados; no lo causa este cambio. |
| `graphify update`, `knowledge:visual`, `knowledge:publish --preview` | NO EJECUTADO: el worktree no tiene derivados de Graphify ni el runtime de Archify; la publicación la hace el Director desde main integrado |

## Impacto documental

- Documento canónico nuevo: la spec 0516. No cambian `BRAND.md`, el Norte ni los
  runbooks.
- `scripts/feature-constants.json`: el `significa` de la bandera dice ahora qué
  más cambia al apagarla.
- La spec 0514 dice en su Decisión «Sólo lo lee el componente». Desde la 0516 el
  componente es el único que **pinta** el aviso, pero el detalle de compra y la
  portada leen el mismo valor para su texto. No se editó la spec de otra tarea; lo
  dice la 0516 y los comentarios del código. Queda para el Director decidir si la
  0514 lleva una nota.
- Graphify: entra 1 prueba nueva y 2 aristas de import nuevas
  (`compras/[code]/page.tsx` y `(app)/page.tsx` → `lib/portal/tracking-en-construccion.ts`).
  Sin extracción semántica propia pendiente: la spec no es fuente del piloto
  semántico. Pendiente global: actualización estructural desde main integrado, a
  cargo del Director.
- Obsidian: nada que revisar fuera de la publicación habitual desde main.

## Cierre

- **OBJETIVO ORIGINAL:** que el detalle de una compra o prealerta del Portal no
  prometa avisos que hoy no van a llegar mientras el aviso «Seguimiento en
  construcción» esté encendido, con el mismo interruptor de la 0514, y revisar con
  el mismo criterio la tarjeta de notificaciones de la portada.
- **COMPLETADO:** textos neutros en el estado de llegada y en la tarjeta de
  recepción del detalle de compra sin recepciones, y en la tarjeta de
  notificaciones de la portada; texto de hoy con el interruptor apagado;
  comentarios y declaración de la bandera al día; 8 pruebas, control rojo,
  6 mutantes muertos; spec con allowlist e índice. Criterios 1 a 5 de la spec
  cumplidos con evidencia local. La spec queda `in-progress`: falta el smoke de
  Sam.
- **VALIDACIÓN:** tabla de arriba.
- **COMMITS:** en `codex/compra-texto-sin-promesa`:
  1. `0d1c56cc` `docs(sdd): SDD-0516 — spec e índice del texto sin promesa en el detalle de compra`.
  2. `feat(portal): SDD-0516 — el detalle de compra y la portada no prometen el aviso de bodega`: código, pruebas, declaración y este documento (commit que contiene este documento). Toca código, así que el `ignoreCommand` de Vercel, que mira sólo el último commit, no cancela el build de Preview.
- **PR / BRANCH:** en draft contra `main` desde `codex/compra-texto-sin-promesa` (URL en el reporte al Director y en la propia PR). Worktree arriba.
- **PENDIENTES DE ESTA TAREA:**
  - Smoke de Sam con el guion de arriba, después del despliegue.
  - `pnpm verify` completo cuando el Director dé el turno.
  - Pasar la spec a `done` cuando el smoke pase.
- **FUERA DE ALCANCE DETECTADO:**
  - `app/registro/RegisterForm.tsx:787` (registro público): «El WhatsApp es por
    donde te avisamos de tu carga: cuando llega a bodega en…». Mismo problema de
    promesa con la bodega en Excel, fuera del Portal.
  - `app/portal/(app)/compras/page.tsx:70-71` (lista de compras): «Acá ves el
    estado de todas». Con la bodega en Excel, el estado se queda en «anunciada»;
    no promete un aviso, pero es el mismo «estado automático de bodega».
  - `scripts/feature-constants.json` (`$doc`: «cambiá») y el mensaje de
    `scripts/check-feature-constants.mjs` («actualizá», «decí») siguen con voseo.
    Ya lo anotó la 0514.
  - Índice de specs: 0515 figura como hueco porque su spec vive en otra rama.
    Se cierra solo cuando esa PR entre (el driver de main resuelve el índice).
- **HANDOFF AL DIRECTOR:**
  - Siguiente acción: revisar la PR draft; si está bien, pasarla a lista, pedir
    el turno de `pnpm verify` y fusionar con la autorización de Sam, fuera de la
    ventana del corte al VPS. El merge despliega a producción.
  - Decisión tomada dentro del encargo, a revisar: además de «Te avisamos…» y
    «verás acá cada recepción», también cambió el título «Todavía no llegó a
    nuestra bodega», porque con el registro en Excel puede ser falso. Si se
    prefiere conservarlo, es una línea y su prueba.
  - Archivos compartidos con la 0514 (ya integrada): `compras/[code]/page.tsx`,
    su prueba, `PortalTrackingEnConstruccion.tsx` (comentario),
    `lib/portal/tracking-en-construccion.ts` (comentario) y
    `scripts/feature-constants.json`. Ninguno con la PR #114: la prueba de la
    portada sólo simula `lib/portal/shipment-events-queries.ts`.
  - Ownership: claim liberado al terminar la escritura (`release --owner
    compra-texto-sin-promesa-worker`). No hay sesiones consumidoras de este
    worktree. No borrar worktree ni rama hasta que la PR se integre.

## CIERRE DE INTEGRACIÓN (Director, 2026-10-14)

- **Merge:** PR #213, merge `d28fa515` a las 19:55:06Z, con `--match-head-commit 7400be53`, con OK de Sam («ok, fusiona la #213 cuando esté en verde») y el CI como evidencia.
- **Deploy:** «Deployment has completed» a las 19:56:36Z.
- **Smoke en producción: PASÓ.** Sam, literal: «ya hice el smoke del Portal, funciona todo».
- Fuera de alcance que queda abierto: `app/registro/RegisterForm.tsx:787` también promete un aviso por WhatsApp «cuando llega a bodega». Estado de la tarea: **integrada**.
