# Handoff — SDD-0475 · El respaldo del calculador vuelve a espejar el ERP

- **Fecha:** 2026-09-17
- **Rama:** `claude/respaldo-tarifa-850`
- **Worktree:** `.claude/worktrees/respaldo-tarifa-850`
- **Base:** `88023508` (main, tras el PR #131). Al cerrar se trajo `origin/main`
  = `504408a4` (merge `3b38ade9`), porque el ruleset de main exige la rama al día
  (`strict_required_status_checks_policy: true`).
- **Spec:** [`docs/specs/0475-respaldo-tarifa-alineado/spec.md`](../../docs/specs/0475-respaldo-tarifa-alineado/spec.md)
- **PR:** [#135](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/135) contra `main`
- **Origen:** hallazgo de SDD-0474, ampliado por el Director (`dtdcargo-18`) y
  autorizado por Sam.
- **Cierre:** sesión Worker `claude-09294354`, coordinada con el Director
  `dtdcargo-18`, que integra.

## Qué se arregló

`CONFIG.tarifaBaseCBM` en [`lib/calculadora.ts`](../../lib/calculadora.ts) pasa
de **800 a 850**, que es lo que el ERP cobra desde el 2026-09-04.

El respaldo se usa cuando la RPC `public_cbm_rate()` no responde —Supabase
caído, o la vigencia vencida, que pasa **cada mes**—. Mientras estuvo
desalineado, cualquier caída habría hecho cotizar al sitio **5,88% por debajo**,
sin error, sin log y sin que nadie se enterara.

**No era una decisión.** La migr 0336 subió la tarifa con `pg_cron` el 4-sep y su
cabecera (líneas 20-23) decía que ese mismo día había que subir la constante en
un deploy. No se hizo: 13 días.

**Ya había pasado antes**, con `pesoIncluidoKg` (ERP en 1.000 desde el
2026-07-06, código en 500; corregido el 2026-08-05). Dos constantes, el mismo
modo de fallo, en dos meses.

## Qué se añadió

[`__tests__/calculadora-respaldo-alineado.test.ts`](../../__tests__/calculadora-respaldo-alineado.test.ts)
ancla los **cuatro** espejos: `tarifaBaseCBM`, `pesoIncluidoKg`,
`minimoFacturable` y `CONSOLIDADO_CBM_RATE`. Todos verificados contra producción
el 2026-09-17.

**No** hay test de vigencia: se escribió uno y el founder lo descartó. Ver
*Por qué NO hay test de vigencia*, abajo.

### Una corrección a lo que se reportó primero

Se dijo que los demás tests usaban `CONFIG.tarifaBaseCBM` como referencia y que
por eso mover el número «no rompía nada». **Era falso.** Subir la constante puso
**20 aserciones en rojo** en `calculadora.test.ts` y
`calculadora-minimo-en-cajas.test.ts`, escritas con literales y su aritmética a
la vista (`// 0.3 × 850`). Esa red existía y funcionaba; se actualizaron literal
por literal, con cada comentario recalculado.

**Y faltaban 5 en e2e**, que se vieron recién al cerrar: `pnpm verify` dio 12
fallos (4 pruebas × 3 navegadores) que afirmaban `9,600` = 12 m³ × $800. Sin
Supabase el e2e cotiza con el respaldo, así que esos números se mueven con la
constante. Se pasaron a `10,200` (12 × 850) en el commit `73c9695e`. **El CI no
los iba a ver**: `quality.yml` no corre Playwright, así que el check obligatorio
habría salido verde y el rojo aparecía después en el `verify` local de cada
Worker.

Lo que deja la corrección en pie es una pregunta mejor: **si había tests, ¿cómo
se coló?** Porque protegen contra un cambio accidental del código, no contra que
el ERP cambie y el código se quede quieto. Nadie tocó la constante — ése es el
modo de fallo, y ningún test del repo lo ve sin acceso a la DB.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Valor del ERP, verificado contra producción | `per_cbm: 850, min_charge: 50`. El `valid_until` se leyó primero como `2026-10-04` y hoy es `2026-11-29`, tras la corrección de la fila |
| Cabecera de la migr 0336, líneas 20-23 | confirma la orden de subir la constante el 4-sep |
| `vitest` — suite completa | 7780 en verde, 1 omitida, en `3b38ade9` (incluye calculadora, respaldo y mínimo en cajas) |
| e2e de la calculadora, aislado | 21/21 en verde en chromium, mobile-chrome y mobile-safari, tras el arreglo |
| `pnpm verify` | ver *Validación*, abajo: dos corridas completas |

## La fecha, y el susto que se cerró

Había dos fechas para la misma tarifa y la de la base estaba **mal cargada**:

| Fuente | Decía |
|---|---|
| Producción (`rates`, leído el 2026-09-17) | `valid_until = 2026-10-04` |
| El founder | la tarifa vale hasta el **2026-11-29** |

La fila cortaba casi **dos meses antes de tiempo**. Como la RPC filtra por
vigencia, el 5 de octubre habría dejado de responder con la tarifa plenamente
vigente y el sitio habría cotizado con el respaldo: sin este PR, $800 — **5,88%
por debajo durante dos meses**.

**Se corrigió en el dato el 2026-09-17.** El Director actualizó `valid_until` a
`2026-11-29` en producción, con autorización del founder, preflight y postflight
(una sola fila, un solo campo). Comprobado de forma independiente contra
`dtdcargo.com/api/public/cbm-rate`: devuelve `valid_until: "2026-11-29"`.

> **El argumento de este PR se movió, y conviene no venderlo mal:** ya no es la
> red que evita cobrar de menos en octubre, porque esa grieta está cerrada. Lo
> que lo justifica es lo de siempre — **si Supabase se cae hoy, el sitio cotiza
> 5,88% por debajo** — y que el respaldo tiene que espejar al ERP.

## Por qué NO hay test de vigencia

Se escribió uno y el founder lo descartó (2026-09-17):

> «Aunque la tarifa se venza o esté vencida, se mantiene el precio anterior. Lo
> que vamos a leer aquí es la base de datos. Ya el tema de si se actualiza o no
> se actualiza es un tema del back-end, no tuyo.»

El vencimiento no debe romper nada, así que un test que bloquea el CI por una
fecha va en contra. La decisión queda escrita en el propio archivo de test, con
su cita, para que nadie lo reescriba sin saber que ya se descartó.

🔴 **Pero esa frase describe algo que hoy el sistema no hace.** Al vencer, la RPC
devuelve null y el sitio no cae «al precio anterior de la base» sino a
`CONFIG.tarifaBaseCBM`. Que hoy salga bien lo produce este PR (respaldo y tarifa
valen igual), no el diseño. Cerrarlo de verdad exige que la lectura no dependa de
la vigencia — **backend**, fuera de este alcance.

## Lo que la revisión del Director corrigió o aportó

- **La cifra era otra.** No es «6,25% por debajo» sino **5,88%** (50/850). El
  6,25% es 50/800, o sea cuánto hay que *subir*. En una decisión de precios no
  son intercambiables.
- **La alerta de vencimiento NO está pendiente: existe y está activa.**
  `app/api/cron/rate-expiry-alert` (SDD-0164, migr 0257) avisa por Telegram y
  email, y está programada en `vercel.json`. El comentario de `CONFIG` la
  llamaba «pendiente» — corregido. Pero cubre **la tarifa**, no **el respaldo**:
  el 4-sep no hubo vencimiento, hubo un cambio de precio, y de eso no avisa
  nadie. Ésa es la grieta que quedaba.
- **El cuarto espejo, `CONSOLIDADO_CBM_RATE = 580`.** Se había quedado fuera.
  Producción lo confirma en 580, y su fila tiene `valid_until` en NULL — la RPC
  filtra con `valid_until is null or …`, así que **no vence**: es espejo, pero
  sin bomba de vencimiento. Además hoy ningún código lo lee de la DB
  (`rates-queries.ts` nunca pasa `p_modo`), así que la constante es la única
  fuente hasta que se cablee. Anclado igual.
- **`minimoFacturable: 50` está alineado**, confirmado contra producción. La
  sospecha de que estuviera 7,6× desalineado (por el `380` de los tests) queda
  cerrada: el 380 es de otro contexto.

### Comentarios que la subida dejó mintiendo, y se corrigieron

| Dónde | Decía |
|---|---|
| `app/api/public/cbm-rate/route.ts` | que el 5-oct «cae sola a $800» — ya no, con el respaldo en 850 |
| `lib/calculadora.ts` (JSDoc de `tarifaCBMOverride`) | «default $800» |
| `__tests__/guia-alibaba-html.test.ts` | «vuelve a 800 el 5-oct» |
| `lib/calculadora.ts` (CONFIG) | que SDD-0164 estaba «pendiente» |

## FUERA DE ALCANCE DETECTADO

- 🔴 **El modo de fallo sigue vivo.** Esto corrige la instancia, no la causa:
  nada compara el respaldo contra el ERP, porque haría falta acceso a la DB y el
  CI no lo tiene.
- 🔴 **Se corrigió una afirmación falsa que llevaba tres semanas propagándose:**
  la migración **0393 SÍ está aplicada** en producción (2026-08-26, ledger
  `20260826040007`). Este handoff y el spec de SDD-0474 decían lo contrario,
  tomándolo de `docs/runbooks/academia-guia-alibaba-interactiva.md`. Corregido
  en los tres sitios, incluida la fuente. **La guía se puede embeber en una
  lección de Academia ya mismo.**
  > El hallazgo de proceso: `migrations-applied` da **SKIP sin credenciales**, o
  > sea en todos los worktrees. Una afirmación sobre si algo está aplicado puede
  > vivir semanas sin que nada la contradiga. Regla: declarar que una migración
  > **no** está aplicada exige comprobarlo contra producción, o escribirlo como
  > **NO VERIFICADO**.
- **`public/interno/guia-peso.html` y `docs/marketing/`** tienen la tarifa vieja.
  Ya tienen pendiente abierto y fechado en `docs/marketing/README.md:224-228`,
  con dueño documental propio. No se tocan desde acá.
- 📅 **La vigencia de los $850 llega hasta el 2026-11-29** (corregida en
  producción el 2026-09-17). Al vencer, la RPC devuelve null y el sitio pasa a
  cotizar con el respaldo. Esta vez coincidirá; la próxima depende otra vez de
  que alguien mire — salvo que SDD-0476 (lectura sin vigencia) llegue antes.
- **`pesoIncluidoKg` queda en 1.000** porque es el valor vigente del ERP y este
  respaldo tiene que espejarlo. Pero Sam definió el 2026-09-17 que **los 1.000
  son una excepción temporal** y la regla de la casa son 500 kg/m³ (ver
  SDD-0474). Cuando la excepción se retire hay que bajar **los dos**: el ERP y
  esta constante. Si sólo se baja uno, vuelve el mismo bug.
- 🔴 **El CI no corre e2e.** `.github/workflows/quality.yml`, el único workflow
  del repo, corre lint, typecheck, `pnpm test`, build y los checks de
  gobernanza, pero ni un paso de Playwright. Esta tarea rompía 12 pruebas e2e y
  el check obligatorio habría salido verde. Hoy el `verify` local es la única red
  del repo para e2e. Esto no se arregla acá: es del harness y del CI.
- **`components/CalculadoraForm.tsx:1478`** usa `"12 CBM × $800"` como ejemplo del
  formato del subtexto, en un comentario sobre contraste. No afirma nada, y el
  archivo no está en el diff de esta rama, así que no se tocó. La próxima
  edición de ese archivo puede pasar el ejemplo a $850.
- **Frontera con SDD-0476 (PR #134).** Esa PR no toca `route.ts` ni
  `lib/calculadora.ts` y da por hecho que esta entra primero. Cuando se aplique
  su migración 0458, la prosa de esta rama que dice «al vencer, la RPC devuelve
  null» (en `route.ts`, `lib/calculadora.ts`, el test del respaldo y esta spec)
  queda desactualizada. Su corrección es de SDD-0476, después de integrar las dos.

## Cierre — 2026-09-17, sesión `claude-09294354`

### OBJETIVO ORIGINAL

Cerrar SDD-0475: subir los 2 commits locales (`d46724b1`, `9e60ad89`), correr
`pnpm verify` completo y abrir la PR contra `main`. Autorización de Sam: subir la
rama propia y abrir la PR; no mergear; no tocar producción. Alcance: lo que ya
estaba en la rama, sin `rates-queries.ts` ni la migración 0458 (son de #134).

### COMPLETADO

- Se trajo `origin/main` (`504408a4`) con el driver de registros de main,
  porque el ruleset exige la rama al día. Sin conflictos: 3 archivos ajenos
  (dos handoffs y `vercel.json`). `docs:index` regenerado da 463 specs y el
  árbol quedó limpio.
- **Regresión encontrada y corregida:** 5 literales e2e seguían en $800 (ver
  *Una corrección…*, arriba). Es la única ampliación del alcance, y la causaba el
  propio cambio de esta rama. El Director (`dtdcargo-18`) la aprobó antes del
  push.
- Se revisó que no quedaran más con `git grep` sobre `e2e/`, `scripts/e2e` y
  todo el código: 800, 9,600, 9600, $800, × 800 y múltiplos de 800 hasta 40.000.
  Se revisaron también las **33 pruebas e2e omitidas** (11 × 3 navegadores, en
  auth, comentarios, gastos, buscador y nómina): ninguna afirma un precio.
- Dos referencias a 800 se dejaron **a propósito**, porque no derivan del
  respaldo:
  - `app/api/public/cbm-rate/__tests__/route.test.ts:75` simula una fila de la
    base con `per_cbm: 800` para probar que `min_charge` null viaja como null.
  - `components/CalculadoraForm.tsx:1478` es un comentario de ejemplo. Queda en
    *FUERA DE ALCANCE*.
- La spec decía que el test ancla «tres» valores y son cuatro: corregido, con los
  5 literales de e2e añadidos a su registro.

### VALIDACIÓN

Dos corridas completas de `corepack pnpm verify` (Windows, sin `.env.local`, sin
Docker):

| Paso | 1ª · `3b38ade9` | 2ª · `73c9695e` (código final) |
|---|---|---|
| harness | PASÓ | PASÓ |
| lint | PASÓ | PASÓ |
| rsc-boundary | PASÓ (1623 módulos) | PASÓ |
| typecheck | PASÓ | PASÓ |
| edge-functions | PASÓ (4 funciones) | PASÓ |
| test | PASÓ — 7780 en verde / 1 omitida, a la primera | FALLÓ — 7779 en verde / **1 caída** en intento y reintento: `app/p/[token]/PackingListProductsStep.test.tsx` › «adds another group and isolates its measurements and totals», timeout a los 20 s (tardó 23,6 s). **Flake conocido de saturación** (ver abajo) |
| docs:check | PASÓ | PASÓ |
| numbering | PASÓ | PASÓ |
| feature-constants | PASÓ | PASÓ |
| components:check | PASÓ | PASÓ |
| governance:check | PASÓ | PASÓ |
| migrations-applied | NO EJECUTADO — sin `.env.local`; no se copian credenciales de producción | NO EJECUTADO — ídem |
| pending-migration-symbols | PASÓ (0 ROJO, 0 AMARILLO) | PASÓ |
| sql-tests | NO DISPONIBLE — sin Docker en esta máquina | NO DISPONIBLE — ídem |
| schema-rebuild | NO DISPONIBLE — sin Docker | NO DISPONIBLE — ídem |
| e2e | **FALLÓ** — 141 en verde / **12 caídas** / 33 omitidas, igual en el reintento: la regresión de los 5 literales | PASÓ **con cobertura PARCIAL** — 153 en verde / 0 caídas / 33 omitidas (15 por falta de Supabase público). Exit ≠0 solo porque el worker de WebKit no cierra en Windows; el gate lo marca `[OK] e2e (con aviso)` |
| build | PASÓ | PASÓ |
| **Resultado** | EXIT 1 · 14 de 17 pasos medidos | EXIT 1 · 14 de 17 pasos medidos · 22 m 24 s |

**Por qué la caída de `test` en la 2ª corrida no es de esta tarea:**

- Entre `3b38ade9` y `73c9695e` solo cambian 3 archivos de `e2e/`, que vitest no
  carga. En la 1ª corrida esa misma prueba pasó.
- Aislada sobre `73c9695e` da **9/9 en verde en 16 s** (`vitest run
  "app/p/[token]/PackingListProductsStep.test.tsx"`).
- El Director la tiene medida como flake de saturación: 4 caídas en la suite
  completa de otro Worker, 9/9 aislada en main limpio, y verde en el CI de
  GitHub. Pidió no tocarla, no marcarla `skip` y no relanzar `verify` para
  buscar exit 0.

**Otras comprobaciones:**

- e2e de la calculadora, aislado sobre el arreglo: `calc-event`,
  `calculadora-hidratacion` y `calculadora-sin-peso` dan **21/21 en verde** en
  chromium, mobile-chrome y mobile-safari. Exit ≠0 solo por el worker de WebKit.
- Sobre el árbol con el commit de docs: `git diff --check` limpio,
  `docs:check` PASÓ (463 specs), `sdd:check` PASÓ, `governance:check` PASÓ (28
  políticas, cápsula vigente). El commit de docs no toca código, así que la 2ª
  corrida de `verify` cubre el código final.
- **El CI alojado (`Calidad local sin secretos`) todavía no corrió:** se reporta
  al Director por mensaje, no con otro push.

### COMMITS

| Commit | Propósito |
|---|---|
| `adaf4166` | `fix(web)`: el respaldo vuelve a espejar el ERP (800 → 850) y los 20 literales de vitest |
| `125db399` | `fix(web)`: los cuatro espejos anclados, y tres afirmaciones corregidas |
| `d46724b1` | `docs`: fuera el test de vigencia, y el argumento del PR corregido |
| `9e60ad89` | `docs`: fuera las fechas muertas que quedaron tras corregir la vigencia |
| `3b38ade9` | merge de `origin/main` (`504408a4`) |
| `73c9695e` | `fix(web)`: los cinco literales de e2e que seguían en $800 |
| el commit que contiene este documento | `docs`: handoff de cierre y la spec corregida (cuatro valores anclados, más los 5 de e2e) |

### PR / BRANCH

- PR [#135](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/135), base
  `main`, rama `claude/respaldo-tarifa-850`, worktree
  `.claude/worktrees/respaldo-tarifa-850`.

### PENDIENTES DE ESTA TAREA

1. Resultado del check alojado `Calidad local sin secretos` sobre el head de la
   PR. Se le avisa al Director por mensaje.
2. Revisión e integración por el Director. **El merge a main es deploy a
   producción** y lo hace el Director. Esta sesión no mergea.

### HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR #135 y, con el check verde, integrarla.
  Entra **antes** que la #134, como la #134 ya da por hecho.
- **Cambios compartidos:** `docs/specs/README.md` (la fila de 0475, 463 specs).
  Al integrar la #134 después, su índice se regenera sobre el árbol fusionado y
  quedan 464. Eso ya está asignado.
- **Conocimiento** (estado de las capas en el worktree, a la revisión `73c9695e`):
  - Impacto documental: la spec 0475 (corregida) y este handoff. Ninguna de las
    16 fuentes del piloto semántico está en el diff, así que no hace falta recibo
    semántico.
  - Graphify 0.9.61, estructural: `graphify update .` construyó el grafo del
    worktree desde cero (34.772 nodos, 65.125 aristas, 2.293 comunidades, 1 m
    34 s). `knowledge:status` da estructural PENDING con 0 pendientes y 0
    faltantes; los 2 `deleted` son nodos de módulos externos (`react` y
    `@testing-library/react`), no archivos.
  - Semántica: PENDING, 0 de 1088 global y 0 de 16 en el piloto. Es el mismo
    estado global de antes; esta tarea no lo mueve.
  - Archify: no aplica. El mapa `knowledge-lifecycle` sale de fuentes que esta
    rama no toca, y el runtime (`ARCHIFY_RUNTIME_MISSING`) no está en el worktree.
  - Obsidian: `knowledge:publish --preview` dio `ok: true`, estado PREVIEW en
    `73c9695e`, en `graphify-out/obsidian-preview` del worktree: 0 conflictos y 39
    avisos de enlaces (37 destinos faltantes y 2 fuera del repo), ninguno en
    archivos de esta rama. La bóveda compartida no se tocó: la publica el
    Director desde main integrado.
- **Sesiones consumidoras:** ninguna, fuera de esta. El claim
  `claude-09294354` se libera al terminar la escritura. El worktree y la rama se
  conservan.
