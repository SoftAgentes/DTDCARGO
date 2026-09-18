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

## PENDIENTES DE ESTA TAREA

1. **Aplicar la 0458 a producción** — decisión de Sam, con
   `docs/runbooks/aplicar-migraciones-prod.md` y **nombrando el archivo**. Preflight obligatorio:
   leer `prosrc` de `public.public_cbm_rate(text)` en producción y confirmar que es el cuerpo de
   0255. Si difiere, **no aplicar y escalar**. Hasta que se aplique, el sitio se sigue comportando
   como hoy.
2. **`docs/specs/README.md` se regenera otra vez al integrar.** Lo regeneré con el script sobre un
   árbol donde la spec 0475 no existe (no está en `origin/main`: comprobado con `git ls-tree` el
   2026-09-17), así que el índice de esta rama dice **463 specs** y lista **0475 como hueco**.
   Con las dos specs dentro son **464** y 0475 deja de ser hueco. Quien integre segundo tiene que
   correr `node scripts/build-docs-index.mjs` sobre el árbol fusionado **antes** de empujar, o se
   paga una corrida de CI.
3. **Actualizar la cabecera de `app/api/public/cbm-rate/route.ts`** — dice «si no hay tarifa pública
   **vigente**», y la 0475 le agrega ahí el aviso de la caída a `CONFIG.tarifaBaseCBM`. Con la 0458
   aplicada las dos frases dejan de ser ciertas. **Después** de integrar 0475, en otra tarea.
4. **Revisar si la 0475 también toca `lib/public/rates-queries.ts`.** Mi cambio ahí es sólo prosa,
   pero si 0475 reescribe el mismo docblock, el conflicto sería semántico igual que el de
   `route.ts`. El Director auditó y sólo señaló `route.ts`; lo dejo anotado por si acaso.
5. **El comentario de `CONFIG.tarifaBaseCBM` en `lib/calculadora.ts`** explica la grieta del
   vencimiento como permanente. Queda obsoleto en esa parte cuando la 0458 esté aplicada. Es archivo
   de 0475: **no lo toqué** y no propongo tocarlo hasta que la migración esté en producción.

## FUERA DE ALCANCE DETECTADO

1. **La ventana ciega al programar una tarifa a futuro.** Por el índice único, dejar preparada una
   tarifa con `valid_from` futuro obliga a despublicar la vigente; entre las dos el sitio no tiene
   fila pública y cae al respaldo del código. Es el mismo tipo de agujero que cierra esta tarea,
   pero por el otro extremo, y **la 0458 no lo toca**. Hoy se esquiva con `pg_cron` (lo que hace la
   0336). Arreglarlo de raíz exige repensar el índice o el flujo de relevo de `/studio/tarifas` →
   tarea propia, con su SDD.
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
2. **Orden de integración con 0475.** 0475 entra primero. Al fusionar esta rama después: regenerar
   `docs/specs/README.md` con `node scripts/build-docs-index.mjs` sobre el árbol fusionado (deben
   quedar 464 specs y 0475 fuera de la lista de huecos).
3. **Nada de esto autoriza aplicar la 0458.** Es una decisión aparte, de Sam, con su runbook.
