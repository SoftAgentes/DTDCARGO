# Handoff — SDD-0475 · El respaldo del calculador vuelve a espejar el ERP

- **Fecha:** 2026-09-17
- **Rama:** `claude/respaldo-tarifa-850`
- **Worktree:** `.claude/worktrees/respaldo-tarifa-850`
- **Base:** `88023508` (main, tras el PR #131)
- **Spec:** [`docs/specs/0475-respaldo-tarifa-alineado/spec.md`](../../docs/specs/0475-respaldo-tarifa-alineado/spec.md)
- **Origen:** hallazgo de SDD-0474, ampliado por el Director (`dtdcargo-18`) y
  autorizado por Sam.

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

Más un **test de vigencia** (autorizado por el founder) que se pone rojo cuando
la fecha de la tarifa ya pasó, con un mensaje que dice qué mirar en
`/studio/tarifas`. **Queda en `skip`**: ver *La fecha en disputa*, abajo.

### Una corrección a lo que se reportó primero

Se dijo que los demás tests usaban `CONFIG.tarifaBaseCBM` como referencia y que
por eso mover el número «no rompía nada». **Era falso.** Subir la constante puso
**20 aserciones en rojo** en `calculadora.test.ts` y
`calculadora-minimo-en-cajas.test.ts`, escritas con literales y su aritmética a
la vista (`// 0.3 × 850`). Esa red existía y funcionaba; se actualizaron literal
por literal, con cada comentario recalculado.

Lo que deja la corrección en pie es una pregunta mejor: **si había tests, ¿cómo
se coló?** Porque protegen contra un cambio accidental del código, no contra que
el ERP cambie y el código se quede quieto. Nadie tocó la constante — ése es el
modo de fallo, y ningún test del repo lo ve sin acceso a la DB.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Valor del ERP, verificado contra producción | `{ per_cbm: 850, min_charge: 50, valid_until: "2026-10-04" }` — leído vía el endpoint público de SDD-0474 en el preview del PR #132 |
| Cabecera de la migr 0336, líneas 20-23 | confirma la orden de subir la constante el 4-sep |
| `vitest` — calculadora + respaldo + mínimo en cajas | *(ver al cierre)* |
| `pnpm verify` | *(ver al cierre)* |

## La fecha en disputa (bloquea el test de vigencia)

Hay dos fechas para la misma tarifa y no coinciden:

| Fuente | Dice |
|---|---|
| **Producción** (`rates`, leído el 2026-09-17) | `valid_until = 2026-10-04` |
| **El founder** (2026-09-17) | «TARIFA HASTA EL 29 SEPT 2026 ES DE 850» |

Cinco días en los que producción seguiría cobrando $850 con una tarifa que,
según el founder, ya no rige — y no está dicho qué precio rige desde el 30.

Por eso el test de vigencia va con `.skip`: anclar una fecha mientras la otra la
contradice sería fijar en el CI un dato que no sabemos si es el bueno. **Cuando
se resuelva: poner la fecha, quitar el `.skip`.** El resto ya está escrito.

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
- 📅 **Hay una fecha en el calendario: el 2026-10-04 vence la vigencia de los
  $850.** Si nadie renueva desde `/studio/tarifas`, el 5-oct la RPC devuelve null
  y el sitio pasa a cotizar con el respaldo. Esta vez coincidirá; la próxima
  depende otra vez de que alguien mire.
- **`pesoIncluidoKg` queda en 1.000** porque es el valor vigente del ERP y este
  respaldo tiene que espejarlo. Pero Sam definió el 2026-09-17 que **los 1.000
  son una excepción temporal** y la regla de la casa son 500 kg/m³ (ver
  SDD-0474). Cuando la excepción se retire hay que bajar **los dos**: el ERP y
  esta constante. Si sólo se baja uno, vuelve el mismo bug.

## Pendientes

1. `pnpm verify` completo y su desglose.
2. PR y revisión del Director.
3. Merge — que en este repo es deploy a producción.
