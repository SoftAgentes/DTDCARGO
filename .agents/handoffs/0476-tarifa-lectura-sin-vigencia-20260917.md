# Handoff 0476 — La tarifa pública se lee de la base, vencida o no

- Fecha: 2026-09-17. Estado: implementado y validado hasta donde este worktree permite medir.
  **La migración NO se aplicó a producción** y no se va a aplicar desde acá.
- Owner/sesión: `worker-tarifa-lectura-sin-vigencia-0476-opus5-20260917` (Claude Opus 5, Worker).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/tarifa-lectura-sin-vigencia`.
- Rama: `codex/tarifa-lectura-sin-vigencia`. Base `origin/main` = `4054e0a4`.
- SDD: [0476](../../docs/specs/0476-tarifa-lectura-sin-vigencia/spec.md), asignada por el Director.
  Migración `0458_tarifa_lectura_sin_vigencia.sql`, también asignada. **No se corrió `sdd:next`.**
- Aislamiento comprobado ANTES de editar: `git rev-parse --abbrev-ref HEAD` →
  `codex/tarifa-lectura-sin-vigencia`; `--show-toplevel` → la ruta de arriba; `HEAD` = `4054e0a4`;
  árbol limpio. `node scripts/harness-worktree.mjs guard` → `Guard OK`. Claim adquirido con el
  owner de arriba.
- Permisos del encargo: editar sólo en este worktree, commits selectivos, publicar la rama propia y
  abrir PR contra `main`. **No merge. No producción. No aplicar la migración.**

## OBJETIVO ORIGINAL

Que la lectura de la tarifa pública no dependa de la vigencia: que el sitio muestre siempre la
última tarifa que hay en la base, aunque esté vencida.

Criterio de Sam, textual: «Aunque la tarifa se venza o esté vencida, se mantiene el precio anterior.
Lo que vamos a leer aquí es la base de datos. Ya el tema de si se actualiza o no se actualiza es un
tema del back-end, no tuyo. Lo importante es que tú muestres en la base de datos la última
actualización o el precio actual de la tarifa.»

## COMPLETADO

### El diseño elegido: (a) — quitar el filtro de `valid_until`

`supabase/migrations/0458_tarifa_lectura_sin_vigencia.sql` reemplaza **sólo el cuerpo** de
`public.public_cbm_rate(text)`. Borra el predicado
`(valid_until is null or valid_until >= current_date)` y completa el desempate del `order by` con
`updated_at desc, id`. Nada más: ni tablas, ni el índice único, ni una fila, ni la firma, ni los
grants efectivos.

### Por qué descarté (b) «preferir la vigente y, si no, la última vencida»

**(b) presupone un conjunto de filas candidatas, y el esquema no lo permite.** No es una cuestión de
gusto: es que ese ramal sería código muerto.

1. `rates_one_public_cbm_per_tenant_modo` es
   `unique (tenant_id, public_calc_modo) where is_public and deleted_at is null and per_cbm is not null`.
   A lo sumo **UNA** fila pública con precio por modalidad. El `status` no entra en el predicado, así
   que ni siquiera puede haber una publicada y una borrador conviviendo.
2. El relevo programado de `0336` **despublica la anterior** (`is_public = false`) antes de insertar
   la nueva. La histórica deja de ser candidata: no hay a qué «caer».

Y (b) tiene un modo de falla que (a) no tiene: si algún día alguien dropeara el índice, el ramal de
respaldo elegiría una fila **distinta** de la que `/studio/tarifas` muestra como «la pública» y de la
que vigila el cron de vencimiento — el sitio y el ERP dirían precios distintos sin un solo error.
(a) sirve la única fila pública: la misma que el founder edita y la misma que el ERP marca.

### Las tres preguntas del encargo, respondidas

**1. ¿Firma nueva o señal de «vencida»? NO.** La RPC ya devuelve `valid_until` y
`vencida ⟺ valid_until != null && valid_until < hoy`. Cuatro razones para no agregar un booleano:
el sitio público no tiene qué hacer con esa señal (el criterio es mostrar el precio); quien la
necesita es el founder y ya la tiene (`rateExpiryBadge` en `lib/studio/rate-types.ts` + el cron
`app/api/cron/rate-expiry-alert/route.ts`); un booleano precalculado se congelaría hasta 15 minutos
en las cachés (`revalidate = 300` de `/tarifas`, `s-maxage=300` de la API) mientras una fecha no
caduca; y romper la firma obligaría a tocar el handler y su test de allowlist de claves.

**2. `valid_from` a futuro: sigue frenado.** El filtro queda verbatim y hay un caso de prueba que lo
comprueba en tres estados (programada con corte, programada con vigencia abierta, y el día que
arranca, donde sí entra). **Hueco residual NO introducido por este cambio:** por el índice único,
dejar una tarifa programada exige despublicar la vigente, y en esa ventana el sitio se queda sin
fila pública. Por eso `0336` hace el relevo con `pg_cron` en el instante del cambio. Cerrarlo
exigiría tocar el índice o el flujo de relevo → **fuera de alcance**.

**3. `CONFIG.tarifaBaseCBM` sigue teniendo sentido, con el significado estrechado.** Deja de ser la
red que atrapa el vencimiento y queda como respaldo de una caída real: Supabase inalcanzable, env
ausente, RPC ausente, fila en borrador, `is_public` sin marcar o `valid_from` a futuro. **No se
tocó** (es de `claude/respaldo-tarifa-850`).

### Lo que la RPC sigue filtrando (y el filtro que más importa)

`is_public` · `status = 'published'` · `deleted_at is null` · **`per_cbm is not null`** ·
`valid_from <= current_date` · `public_calc_modo`.

`per_cbm is not null` es el que evita servir una tarifa vacía: producción tiene **dos filas DDP
públicas con `per_cbm` en NULL** (`valid_from 2026-05-24`, `valid_until 2026-12-31`) que el índice
único tolera porque su predicado las excluye. Hay un caso de prueba dedicado a eso.

### La espera declarada

`supabase/migrations-baseline.json › pendingBelowCutoff` tiene ahora la entrada
`0458_tarifa_lectura_sin_vigencia`, con el porqué, qué sigue filtrando, el **preflight obligatorio**
(leer `prosrc` en producción y confirmar que es el cuerpo de 0255 antes de reemplazar: es un
`create or replace` y pisaría en silencio cualquier cuerpo distinto), el efecto medido, los locks
(ninguno sobre `public.rates`), la vuelta atrás (re-aplicar el bloque de 0255) y la regla de que
fusionar la PR **no** autoriza aplicarla. Es la salida nº 2 que manda el runbook para una migración
escrita y todavía no aplicable. **No se subió el `cutoff` 238** ni se tocaron las otras esperas.

### Efecto de aplicarla, medido contra el estado de producción del 2026-09-17

**Ninguno visible ese día:** la fila DDP pública está vigente (`per_cbm 850.00`, `min_charge 50.00`,
`valid_from 2026-09-04`, `valid_until 2026-11-29`, `published`) y la RPC ya la devuelve. El cambio
se nota **el 2026-11-30**: hoy el sitio caería a la constante del código; después de la 0458 sigue
cotizando 850 hasta que el founder decida otra cosa. `consolidado` (580, sin fechas) no cambia:
nunca vencía.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| **0458 contra PostgreSQL real (PGlite)**, `lib/public/public-cbm-rate.migration.test.ts` | **PASÓ** — 11 casos, incluido el **control rojo** que instala el cuerpo de 0255 y comprueba que ahí la tarifa vencida devuelve cero filas |
| **Mutación del `.sql`**: reponer `and (valid_until is null or valid_until >= current_date)` | **PASÓ (mata 4 de 11)** — el test no es un fixture feliz. Archivo restaurado byte a byte (md5 `43709f50…` antes y después) |
| Tests de `cbm-rate` y de la capa de tarifas, en aislamiento | **PASÓ** — 43 casos en 4 archivos: `public-cbm-rate.migration`, `app/api/public/cbm-rate/__tests__/route`, `lib/public/__tests__/combinar-destinos`, `lib/studio/document-import/estimate` |
| `pnpm verify` › `harness` | **PASÓ** — 178 pruebas |
| `pnpm verify` › `lint` | **PASÓ** |
| `pnpm verify` › `rsc-boundary` | **PASÓ** — 1623 módulos |
| `pnpm verify` › `typecheck` | **PASÓ** |
| `pnpm verify` › `edge-functions` | **PASÓ** — 4 funciones |
| `pnpm verify` › `test` (vitest completo) | **PASÓ** — 590 archivos / 7785 pruebas, 1 archivo omitido. **`app/p/[token]/PackingListProductsStep.test.tsx` NO cayó en esta corrida** (el flake de saturación que el encargo anticipaba no se manifestó) |
| `pnpm verify` › `docs:check` | **PASÓ** |
| `pnpm verify` › `numbering` | **PASÓ** — sin números repetidos; 463 specs · 455 migraciones |
| `pnpm verify` › `feature-constants` | **PASÓ** |
| `pnpm verify` › `components:check` | **PASÓ** |
| `pnpm verify` › `governance:check` | **PASÓ** |
| `pnpm verify` › `pending-migration-symbols` | **PASÓ** — 0 ROJO · 0 AMARILLO. La 0458 no crea símbolos nuevos: `public_cbm_rate` ya existe en producción desde 0255, así que no hizo falta declarar degradaciones |
| `pnpm verify` › `migrations-applied` | **NO EJECUTADO** — `[SKIP]`: faltan `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Este worktree no tiene `.env.local` y **no se copiaron credenciales de producción**, por AGENTS |
| `pnpm verify` › `sql-tests` | **NO DISPONIBLE** — `[SKIP]`: **Docker no disponible en esta máquina**. No es falta de credenciales |
| `pnpm verify` › `schema-rebuild` | **NO DISPONIBLE** — `[SKIP]`: **Docker no disponible en esta máquina** |
| `pnpm verify` › `e2e` | **PASÓ con cobertura PARCIAL** — sin fallos, pero **15 pruebas omitidas** por falta de `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El propio gate lo declara crítico con cobertura parcial |
| `pnpm verify` › `build` | **PASÓ** — build de producción completo, Norte horneado incluido |
| **`pnpm verify` (veredicto)** | **exit 0 · 14 de 17 pasos corrieron de verdad.** El gate cierra con «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied, sql-tests, schema-rebuild. CRÍTICOS CON COBERTURA PARCIAL: e2e». **Exit 0 no equivale a cierre verde completo** |
| Re-medición tras revertir `route.ts` | **PASÓ** — `lint`, `typecheck` y `test` corrieron **antes** de esa reversión (el `build` corrió después). Se re-midió sobre el árbol final: `eslint app/api/public/cbm-rate lib/public` exit 0, `pnpm typecheck` exit 0, y los 17 casos de `public-cbm-rate.migration` + `cbm-rate/route` en verde. La reversión devuelve un bloque de comentarios byte a byte igual al de `4054e0a4`, que ya estaba verde en main |
| `pnpm knowledge:status` | **EJECUTADO, estado INVALID/PENDING previo a esta tarea** — 1087 fuentes, 0 verificadas; estructural y semántico `INVALID` en todo el repo. Es el backlog global, no algo que abra esta tarea. El **piloto** (`canonical-16-2026-09-16`, 16 fuentes) **no tiene ninguna fuente tocada acá**: mis archivos son nuevos y quedan fuera de esa lista |
| `pnpm knowledge:visual` (Archify 2.16.0) | **NO DISPONIBLE** — `ARCHIFY_RUNTIME_MISSING`: falta `archify.zip` v2.16.0 extraído en `graphify-out/archify-package` de este worktree. Es entorno, no el cambio |
| Vista previa de Obsidian | **NO EJECUTADO** — `obsidian: PENDING` en `knowledge:status`; la publicación es del Director desde main integrado |
| **CI de la PR #134** sobre `180933d4` (check obligatorio `Calidad local sin secretos`, run 35290596205) | **PASÓ** — los 19 pasos en verde, incluidos `Unitarios`, `Documentacion SDD`, `Numeracion SDD y migraciones`, `Codigo contra migraciones pendientes`, `Build de produccion sin secretos` y `Confirmar arbol reproducible` |
| Reescritura condicional del comentario de `rates-queries.ts` (commit local, sin empujar) | **PASÓ** — `eslint` exit 0 y el JS emitido sigue **idéntico** al de la base (md5 `8342c770…`). Los gates completos corren en el push único |
| Aplicación de la migración a producción | **NO EJECUTADO** — prohibido por el encargo. Ni `apply_migration`, ni el conector, ni ninguna otra vía |
| Lectura de filas de negocio en producción | **NO EJECUTADO** — los datos de producción que cita el spec son los que el Director verificó y me pasó; no abrí conexión a producción |

`exit 0` de `verify` **no** equivale a cobertura completa: lo dice el propio gate y lo repito acá.
Tres pasos quedaron sin medir, y los tres por el entorno, no por el cambio.

## POR QUÉ NO HAY `supabase/tests/0458_*.test.sql`

Esa suite exige Docker —que esta máquina no tiene— **y el CI tampoco la corre**:
`.github/workflows/quality.yml` no invoca `run-sql-tests.mjs`. Un archivo ahí no lo ejecutaría
nadie. El test de PGlite, en cambio, entra en `pnpm test` y por lo tanto corre en cada push y en
cada `verify`. Es el mismo criterio que siguió la 0457 (SDD-0473), que tampoco tiene `.test.sql`.

## ARCHIVOS TOCADOS

| Archivo | Qué |
| --- | --- |
| `supabase/migrations/0458_tarifa_lectura_sin_vigencia.sql` | **nuevo** — la migración. Primera línea: «Prepared for review; NOT applied to production», modelo 0457 |
| `lib/public/public-cbm-rate.migration.test.ts` | **nuevo** — 11 casos sobre PGlite corriendo el `.sql` real |
| `docs/specs/0476-tarifa-lectura-sin-vigencia/spec.md` | **nuevo** — la spec |
| `supabase/migrations-baseline.json` | la espera `0458_…` en `pendingBelowCutoff`. Nada más: `cutoff` 238 intacto, las otras esperas intactas |
| `lib/public/rates-queries.ts` | **sólo comentarios**: el docblock decía «o todo vencido → null», que deja de ser cierto con la 0458. Explica los dos estados (antes y después de aplicar) |
| `docs/specs/README.md` | **regenerado con `node scripts/build-docs-index.mjs`**, no editado a mano |

**`app/api/public/cbm-rate/route.ts` NO se tocó**: quedó byte a byte igual que en `4054e0a4`
(`git diff 4054e0a4 -- <archivo>` vacío). Llegué a editar su cabecera y lo **revertí** cuando el
Director avisó que la SDD-0475 reescribe ese mismo bloque con la afirmación contraria. El código de
`route.ts` no necesita cambiar: la 0458 no altera la firma de la RPC ni la forma de la respuesta.

## SEGUNDA ASIGNACIÓN DEL DIRECTOR (2026-09-17, después de abrir la #134)

La PR #134 **no se integra todavía**: va segunda, y la 0475 aún no tiene PR (comprobado:
`gh pr list --head claude/respaldo-tarifa-850` vacío; `origin/main` = `504408a4`, sin 0475). El
Director me asignó formalmente, **en esta misma PR**, el pendiente que no tenía dueño:

1. Esperar a que la 0475 esté en main (**avisa el Director**).
2. Traer main sobre esta rama.
3. Regenerar `docs/specs/README.md` con el script: **464** specs, 0475 fuera de los huecos.
4. Corregir la cabecera de `app/api/public/cbm-rate/route.ts` encima del texto de 0475.
5. Empujar todo junto: **una sola corrida** del check.

**Estado: 1, 2, 3, 4 y 5 BLOQUEADOS por la 0475.** Re-comprobado después de la aprobación del
Director: `origin/main` sigue en `504408a4`, sin la spec 0475, y `claude/respaldo-tarifa-850` sigue
sin PR. Según el Director, la 0475 tiene `verify` corriendo en otra ventana (`dtdcargo-f3`). **No se
actúa por cuenta propia aunque la 0475 aparezca en main: el disparador es el aviso del Director.**
Lo que no dependía de ella ya está hecho y
commiteado **en local, sin empujar** (a propósito, para no gastar la corrida única):

- `lib/public/rates-queries.ts`: mi propio comentario tenía el defecto que el Director señaló para
  `route.ts`, pero al revés — decía «está ESCRITA PERO NO APLICADA» y «Hoy, con el cuerpo de la 0255
  corriendo en prod», dos frases que dejan de ser ciertas el día que se aplique. Reescrito en
  **condicional verificable** (ver abajo). JS emitido otra vez idéntico al de la base.
- La spec: sección nueva «Integrar no es aplicar» y el Seguimiento reasignado a esta PR.
- Este handoff.

**El claim NO se liberó**: la escritura de esta tarea no terminó. Owner
`worker-tarifa-lectura-sin-vigencia-0476-opus5-20260917`.

### ¿La PR funciona sin la 0458 aplicada? SÍ, y es inerte hasta que se aplique

Comprobado contra el diff, archivo por archivo:

| Archivo | ¿Cambia el comportamiento al fusionar? | Evidencia |
| --- | --- | --- |
| `lib/public/rates-queries.ts` | **No** | `ts.transpileModule` con `removeComments` sobre `4054e0a4` y sobre esta rama: **JS byte a byte igual**, md5 `8342c7706686fffe6158444edcb7506c`, 6957 bytes. **Control positivo**: cambiar `if (!row \|\| row.per_cbm == null)` por `if (!row)` sí cambia el JS emitido, así que la comparación mide algo |
| `app/api/public/cbm-rate/route.ts` | **No** | Sin cambios (`git diff 4054e0a4` vacío) |
| `lib/public/public-cbm-rate.migration.test.ts` | **No** | Es una prueba: `grep` no encuentra ningún módulo que la importe |
| `supabase/migrations-baseline.json` | **No** | Lo leen sólo scripts de gate (`check-migrations-applied`, `check-pending-migration-symbols`, `merge-generated-records`). Las dos menciones en `lib/` son comentarios |
| `supabase/migrations/0458_…sql` | **No al fusionar** | Nada la aplica sola: no hay `supabase/config.toml`, ningún workflow corre `db push`, `vercel.json` no tiene `buildCommand` y el runbook dice «Nunca es automático» |
| Spec, índice, handoff | No | Documentación |

O sea: **se puede integrar antes de que Sam autorice la migración.** El sitio se sigue comportando
como hoy hasta el día en que alguien aplique la 0458 con el runbook.

### El comentario de `route.ts`: redactado para que sea cierto en los dos momentos

**DECISIÓN DEL DIRECTOR (2026-09-17): APROBADO.** Se cambia en esta misma PR, como condicional
verificable, en el paso final posterior a la 0475. El Director retiró su indicación anterior de
dejarlo «para después». Lo que sigue es el razonamiento que se aprobó.

Recomendé **cambiarlo en esta PR con un condicional verificable**, no «recién al aplicar». Cambiarlo
al aplicar es exactamente el patrón que el Director describió: un pendiente atado a un evento futuro
y sin dueño en el código. El condicional no necesita seguimiento para ser cierto: nombra la señal
que dice en qué estado se está, y esa señal se actualiza sola en el acto de aplicar (el runbook
exige retirar la entrada de `pendingBelowCutoff` sólo tras aplicar, y el gate con credenciales se
pone rojo si se retira sin aplicar).

Texto propuesto (se ajusta al de 0475 cuando esté en main; **no copié nada de esa rama**):

```
 * Respuesta: `{ per_cbm, min_charge, valid_until }`, o `{ per_cbm: null }` si la
 * RPC no devolvió tarifa. NUNCA 500: la guía tiene su propio fallback y un
 * error acá no puede tumbarle la calculadora.
 *
 * Qué pasa cuando la tarifa VENCE depende de si la migración 0458 (SDD-0476) ya
 * se aplicó en producción. Mientras `0458_tarifa_lectura_sin_vigencia` figure en
 * `supabase/migrations-baseline.json › pendingBelowCutoff`, NO se aplicó:
 *
 *  · Sin la 0458: la RPC deja de devolver la fila vencida, este handler responde
 *    `{ per_cbm: null }` y las páginas Next caen a `CONFIG.tarifaBaseCBM`.
 *  · Con la 0458: la vigencia deja de ser filtro de lectura y la RPC sigue
 *    sirviendo el último precio de la base aunque `valid_until` ya haya pasado.
 *    `{ per_cbm: null }` queda para no tener tarifa de verdad: Supabase caído,
 *    borrador, `is_public` sin marcar o `valid_from` a futuro.
 *
 * Quien quiera distinguir vigente de vencida lo deriva de `valid_until`. El
 * handler no agrega señal propia: la calcularía al construir la respuesta y el
 * `s-maxage=300` la dejaría congelada, mientras que la fecha no caduca.
```

El párrafo «Por qué no cablear el número en la guía» todavía dice que el 2026-10-05 la tarifa «cae
sola a $800»; en producción la vigencia ya va hasta el 2026-11-29. Se corrige en el mismo paso,
según cómo lo deje 0475.

## PENDIENTES DE ESTA TAREA

1. **Aplicar la 0458 a producción** — decisión de Sam, con
   `docs/runbooks/aplicar-migraciones-prod.md` y **nombrando el archivo**. Preflight obligatorio:
   leer `prosrc` de `public.public_cbm_rate(text)` en producción y confirmar que es el cuerpo de
   0255. Si difiere, **no aplicar y escalar**. Hasta que se aplique, el sitio se sigue comportando
   como hoy.
2. **Cuando la 0475 esté en main (aviso del Director):** `git fetch` + `git merge origin/main` en
   esta rama; `node scripts/build-docs-index.mjs` (deben quedar **464** specs y 0475 fuera de la
   lista de huecos; hoy el índice de esta rama dice 463 y declara hueca la 0475 porque se regeneró
   sin ella); reemplazar la cabecera de `route.ts` con el texto de arriba ajustado al de 0475;
   re-correr `lint`, `typecheck`, los tests de `cbm-rate` y `docs:check`; **un solo push**.
3. **Soltar el claim** recién después de ese push.
4. **Al traer main, mirar si la 0475 también tocó `lib/public/rates-queries.ts`.** Mi cambio ahí
   es sólo prosa, pero si 0475 reescribió el mismo docblock el conflicto es semántico, igual que el
   de `route.ts`: se resuelve conservando el condicional verificable. El Director auditó y sólo
   señaló `route.ts`; lo dejo anotado por si acaso.
5. **El comentario de `CONFIG.tarifaBaseCBM` en `lib/calculadora.ts`** explica la grieta del
   vencimiento como permanente. Queda obsoleto en esa parte cuando la 0458 esté aplicada. Es archivo
   de 0475: **no lo toqué** y no propongo tocarlo hasta que la migración esté en producción.

## FUERA DE ALCANCE DETECTADO

1. **La ventana ciega al programar una tarifa a futuro.** Por el índice único, dejar preparada una
   tarifa con `valid_from` futuro obliga a despublicar la vigente; entre las dos el sitio no tiene
   fila pública y cae al respaldo del código. Es el mismo tipo de agujero que cierra esta tarea,
   pero por el otro extremo, y **la 0458 no lo toca**. Hoy se esquiva con `pg_cron` (lo que hace la
   0336). Arreglarlo de raíz exige repensar el índice o el flujo de relevo de `/studio/tarifas` →
   tarea propia, con su SDD. **Escalado:** el Director se lo lleva a Sam (2026-09-17), como la misma
   familia de problema en otro momento del ciclo. Sin SDD ni dueño asignado todavía.
2. **La cabecera de la migración 0255 miente sobre su estado.** Dice «⚠️ NO APLICADA A PRODUCCIÓN.
   Declarada como espera en `pendingBelowCutoff`», pero ya **no** figura en ese archivo y el índice
   `rates_one_public_cbm_per_tenant_modo` que crea **existe en producción** (verificado por el
   Director). O sea que se aplicó y nadie actualizó su cabecera. No lo corregí: es evidencia
   histórica de otra tarea y editarla desde acá mezclaría alcances. Vale la pena que el Director
   decida si se corrige, porque un lector que confíe en esa cabecera saca la conclusión contraria.
3. **`CONFIG.tarifaBaseCBM` y la tarifa del ERP siguen acopladas por acuerdo humano.** Aun con la
   0458 aplicada, si Supabase se cae con la constante desalineada el sitio cotiza mal. Eso lo está
   atacando la 0475; lo anoto para que no se lea esta tarea como si cerrara ese frente.

## IMPACTO DOCUMENTAL

- **Canónicos actualizados:** `docs/specs/0476-…/spec.md` (nuevo) y `docs/specs/README.md`
  (regenerado por script).
- **No aplica:** `BRAND.md`, `docs/design/**` y `/ui-check` — no hay cambio visual. `docs/marketing/**`
  — no hay cambio de marketing. `docs/governance/**` — no hay cambio de comportamiento de Studio:
  la 0458 sólo toca una RPC del sitio público y no altera permisos, roles ni RLS.
- **Handoffs históricos:** ninguno editado. Los de 0164, 0473 y 0474 son evidencia fechada.
- **Graphify:** estructural y semántico quedan **INVALID** en todo el repo (1087 fuentes, 0
  verificadas), igual que antes de esta tarea. **Ninguna fuente del piloto `canonical-16-2026-09-16`
  fue tocada acá**, así que no hay extracción semántica pendiente *de esta tarea*; los recibos
  faltantes son el pendiente global ya conocido y no bloquean el piloto.
- **Archify:** **NO DISPONIBLE** en este worktree (`ARCHIFY_RUNTIME_MISSING`, falta
  `graphify-out/archify-package` con la 2.16.0). No hay mapa nuevo ni JSON que adjuntar.
- **Obsidian:** `PENDING`. La publicación compartida la hace el Director desde main integrado
  comprobado; no se tocó la bóveda ni las notas personales.

## PARA EL DIRECTOR

1. **Revisar la decisión de diseño antes que el código.** Si no compartís el argumento de que el
   índice único vuelve inejecutable la alternativa (b), el resto de la revisión cambia.
2. **Orden de integración con 0475.** 0475 entra primero. La regeneración del índice y la cabecera
   de `route.ts` las hago yo en esta PR cuando me avises que 0475 está en main (ver «Segunda
   asignación»). Hasta entonces la #134 tiene commits locales **sin empujar**: el SHA revisable
   publicado sigue siendo `180933d4`.
3. **Nada de esto autoriza aplicar la 0458.** Es una decisión aparte, de Sam, con su runbook. Y
   la PR es inerte sin ella: se puede integrar antes.
