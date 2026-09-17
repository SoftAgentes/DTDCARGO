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
desalineado, cualquier caída habría hecho cotizar al sitio **6,25% por debajo**,
sin error, sin log y sin que nadie se enterara.

**No era una decisión.** La migr 0336 subió la tarifa con `pg_cron` el 4-sep y su
cabecera (líneas 20-23) decía que ese mismo día había que subir la constante en
un deploy. No se hizo: 13 días.

**Ya había pasado antes**, con `pesoIncluidoKg` (ERP en 1.000 desde el
2026-07-06, código en 500; corregido el 2026-08-05). Dos constantes, el mismo
modo de fallo, en dos meses.

## Qué se añadió

[`__tests__/calculadora-respaldo-alineado.test.ts`](../../__tests__/calculadora-respaldo-alineado.test.ts)
ancla `tarifaBaseCBM`, `pesoIncluidoKg` y `minimoFacturable`.

No compara contra la DB —el CI corre sin credenciales— sino que **convierte un
cambio silencioso en uno deliberado**. Hasta ahora los demás tests usaban
`CONFIG.tarifaBaseCBM` como referencia, así que mover el número **no rompía
nada**: exactamente cómo se coló la desalineación las dos veces.

## Evidencia

| Comprobación | Resultado |
|---|---|
| Valor del ERP, verificado contra producción | `{ per_cbm: 850, min_charge: 50, valid_until: "2026-10-04" }` — leído vía el endpoint público de SDD-0474 en el preview del PR #132 |
| Cabecera de la migr 0336, líneas 20-23 | confirma la orden de subir la constante el 4-sep |
| `vitest` — calculadora + respaldo + mínimo en cajas | *(ver al cierre)* |
| `pnpm verify` | *(ver al cierre)* |

## FUERA DE ALCANCE DETECTADO

- 🔴 **El modo de fallo sigue vivo.** Esto corrige la instancia, no la causa. El
  arreglo de fondo es **SDD-0164** (una alerta en el ERP cuando una tarifa
  pública esté por vencer) y sigue pendiente — el propio comentario de
  `calculadora.ts` ya lo citaba antes de este cambio.
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
