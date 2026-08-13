# Handoff · Gate de Edge Functions + poda de SeaRates — cierre 2026-08-13

> Todo lo de abajo está **medido**, no inferido: contra producción (endpoint
> público y tabla `ocean_rates`), contra el repo, o corriendo el gate.
> Verifica antes de cambiar, pero no vuelvas a descubrirlo desde cero.

## Lo que quedó EN PRODUCCIÓN (no rehacer)

| Commit | Qué |
|---|---|
| `35edae0a` | Paso **`edge-functions`** en `verify.mjs` — `deno check` sobre las 4 entradas de `supabase/functions/*/index.ts` |
| `4f26aa57` | El e2e ya **no se pone rojo** porque falte un navegador |
| `5cfc344b` | **Fuera Qingdao** del cotizador de fletes; cap semanal 23 → 20 |
| `6e18c7a8` | AGENTS.md: hay **DOS** MCP de Supabase y sólo uno es read-only |

## 1. Gate `edge-functions` — el hueco que cerró

`supabase/functions/**` no lo miraba **nadie**: está en el `exclude` de
`tsconfig.json` y Vitest sólo ejecuta los módulos puros de `_shared/`
transpilando sin chequear tipos. O sea que `kommo-writeback` (PATCH a Kommo,
LIVE) y `kommo-sync` (que **poda embudos y etapas** del espejo) llegaban a prod
sin una sola verificación estática.

**Dos banderas que no son opcionales** (`scripts/check-edge-functions.mjs`):

- `--no-lock` — si no, deja un `deno.lock` en la raíz del repo.
- `--node-modules-dir=none` — ⚠️ **`auto` DESTRUYE el `node_modules` de pnpm**:
  borra `.pnpm` y reinstala desde los *rangos* de `package.json` en vez del
  lockfile. Me driftó Playwright a 1.62.1 (pide `webkit-2336`) donde el lockfile
  pinea 1.60.0 → 20 tests de `mobile-safari` en rojo que parecían un problema
  del repo y eran míos. Cura: `pnpm install`.

Sin poder obtener Deno → **SKIP, nunca rojo**. `VERIFY_SKIP_EDGE=1` lo omite.
La perilla de binario es `VERIFY_DENO_BIN` (el prefijo `VERIFY_` **no es
cosmético**: el contrato `env-example-contract` exime ese prefijo).

🔴 **Hueco que NO cubre:** `_shared/__tests__/*.test.ts`. Sus imports van sin
extensión (ilegal en Deno) y no los alcanza ninguna entrada; tsc los excluye y
Vitest no les chequea tipos.

## 2. El e2e ya no miente por un navegador ausente

El preflight `chromiumInstalled()` sólo mira si existe una carpeta `chromium*`:
es ciego a los otros motores (`mobile-safari` = WebKit) y a la **versión**. Se
resolvió en el `absolver`, no en el preflight — para saber qué motor necesita
cada proyecto habría que hardcodear el mapa nombre→navegador, y ese mapa se
desincroniza del `playwright.config.ts` en silencio.

Si **todos** los fallos son `Executable doesn't exist` → `[AVISO]` nombrando el
proyecto que no corrió + `[OK] (con aviso)`. **Con un solo fallo de aserción
mezclado sigue ROJO** (probado con las dos ramas).

## 3. SeaRates — la decisión, y por qué

⭐ **No migrar de proveedor ni firmar plan anual.** Las 2 rondas de research
salieron en blanco porque **el cuello no es la API, es Venezuela**: ningún
candidato tiene cobertura China→VE confirmada, y ahora sabemos que **ni SeaRates
la tiene completa**.

**Qingdao era peso muerto.** Medido en prod: de sus 5 rutas, 2 las recortaba el
cap y `qingdao→la-guaira` y `qingdao→puerto-cabello` volvían con `valid_to` de
hacía **dos meses**. Sólo servía `qingdao→guanta`. El cap se había subido de 20 a
23 *para que entrara*, empujando el consumo a ~115/mes en meses de 5 lunes,
sobre las 100 gratis.

Ahora: **4 orígenes × 5 destinos = 20 rutas = cap**, ≈87 llamadas/mes, sin rutas
mudas. Se limpiaron **21 filas muertas** de `ocean_rates` (18 huérfanas con la
clave vieja `P_` + 3 de Qingdao); quedan 20, exactamente la matriz.

También: `displayCarrier()` oculta el `Carrier TBN` de SeaRates (placeholder de
co-load). Se normaliza en la **lectura**, no al cachear, para cubrir las filas ya
guardadas sin esperar al cron.

⏰ **Agendado:** rutina `trig_01SZkiMHXV1trSVT4xbVn4wj` verifica el **lunes 17-ago
13:00 UTC** que el cron repobló las 20 en verde. Exige **dos** cosas: todas
`available` **y** `fetchedAt` de ese día — si no, sirve caché vieja y todo
parecería sano.

## 🔴 Lo que hay que saber antes de tocar nada

**El conector de Supabase de claude.ai ESCRIBE.** `AGENTS.md` decía
`read_only=true` a secas; un `DELETE` corrió sin rechazo ni confirmación. El MCP
**local** sí es read-only. El runbook de migraciones ya lo tenía bien desde el
30-jul. **No asumas cuál tienes.**

**El código de SDD-0091 (motor de flujo) se perdió.** 3 slices con el gate verde
en `feat/motor-flujo`, nunca pusheados; la rama, los commits y el worktree no
existen en ninguno de los dos checkouts. Sobrevive la **spec en main**. Si se
retoma, se reimplementa desde ahí. *Una rama sin pushear con el gate verde no es
trabajo guardado.*

## Pendientes que quedan vivos

- 🟡 Confirmar el resultado de la rutina del lunes 17.
- 🟡 Si sale verde, conviene volverla **semanal** (`0 13 * * 1`): la suscripción
  de SeaRates se reactiva **a mano cada mes**, y el día que venza el cotizador
  seguirá mostrando precios viejos sin avisar.
- 🟡 `verify.mjs` sigue con `chromiumInstalled()` ciego a la versión — el
  absolver cubre el síntoma, no la causa.

## Verificación

`node scripts/verify.mjs` → **TODO VERDE** en cada commit de código (el de
AGENTS.md, doc-only, corrió `lint` + `docs:check` + `governance:check`).
Las tres ramas del paso nuevo (verde / rojo / skip) y el absolver del e2e se
validaron **con mutación**, no sólo observando el verde.

## Residuos de esta ventana

- `.env.local` copiado del repo principal → **borrado al cerrar** (apuntaba a PROD).
- `node_modules` reinstalado desde el lockfile tras el estropicio de `--node-modules-dir=auto`.
- Worktree `upbeat-jones-74849f` **conservado**: un worker no se elimina a sí
  mismo desde su propio `cwd`.
