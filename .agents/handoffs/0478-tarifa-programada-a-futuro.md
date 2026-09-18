# Handoff 0478 — Programar la próxima tarifa pública sin dejar el sitio sin tarifa

- Fecha: 2026-09-18. Estado de la tarea: **lista para integrar** (PR #137, draft). **La 0459 está
  APLICADA en producción** (ledger `20260918155832`) con el OK nominal de Sam (ver «APLICACIÓN DE
  LA 0459»). SDD `done`, con un seguimiento pendiente: el test automático de concurrencia del
  `for update`.
- Owner/sesión: `worker-tarifa-programada-0478-dtdcargo-2e-20260918` (Claude Opus 5, Worker,
  sesión `dtdcargo-2e`, «Tareas pendientes del worker»). Asignó el Director `dtdcargo-18`;
  supervisa `dtdcargo-53`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/tarifa-programada-a-futuro`.
- Rama: `codex/tarifa-programada-a-futuro`, desde `origin/main` = `78410913`.
- SDD: [0478](../../docs/specs/0478-tarifa-programada-a-futuro/spec.md), reservado por el Director
  (`codex/sdd-reserve-0478-tarifa-programada-a-futuro`, stub incorporado por cherry-pick).
  Migración asignada: `0459_tarifa_programada_a_futuro.sql`.
- Aislamiento comprobado antes de editar: rama y toplevel correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba.
- Permisos del encargo: commits en esta rama, push de la rama propia y PR **draft** contra `main`,
  reportando al Director antes de abrirla. **No merge.** La aplicación de la 0459 la autorizó
  después Sam, nombrándola, en el chat de esta sesión («autorizo aplicar la
  0459_tarifa_programada_a_futuro»). El Director confirmó ventana exclusiva y que la aplicara yo.
  No tocar `lib/calculadora.ts` ni `__tests__/calculadora-respaldo-alineado.test.ts` (los tiene
  `dtdcargo-c9`).

## OBJETIVO ORIGINAL

Cerrar la ventana en que el sitio queda sin tarifa al programar una a futuro (FUERA DE ALCANCE nº 1
del handoff de SDD-0476), con su propia SDD. La tarifa DDP vigente ($850) vale hasta el
2026-11-29 y la siguiente tiene que poder cargarse antes sin abrir el hueco.

## COMPLETADO

- **Diseño (B) elegido y documentado en la spec:** una ranura **programada** al lado de la pública
  (`rates.publica_programada`) y un relevo atómico en la base (`promover_tarifas_programadas()`),
  que corre `pg_cron` cada hora al minuto 5 y decide con el **día de Caracas**. Se descartó (A)
  indexar `valid_from` porque apagaba el aviso de segunda pública, dejaba relevadas públicas para
  siempre y relevaba a las 20:00 de Venezuela. **El índice singleton de 0255 no se tocó**, ni
  `public_cbm_rate` (0458, aplicada), ni `rates_guard_price_book` (0382).
- **Migración 0459** (sin aplicar): columna, check, índice «una programada por modalidad», guard
  (archivar/borrar suelta la programación; borrador y aliado se rechazan), función de relevo
  `security definer` sólo para `service_role`, y job `tarifas-programadas-relevo`. Espera declarada
  en `migrations-baseline.json` con preflight, locks y vuelta atrás.
- **Studio** (`/studio/tarifas`): casilla «Programada: reemplaza a la pública en su fecha»,
  excluyente con «Tarifa pública del calculador» al marcar; validación en el servidor (futura, por
  CBM, no pública a la vez, con fecha); badge en la lista («Programada · 30/11», «· hoy», «· no
  entró» en rojo); rechazos de la base traducidos; el aviso de segunda pública sigue y ahora propone
  programar (y pasa de voseo a tuteo).
- **Degradación migrate-first:** la ranura se lee en una consulta aparte; sin la 0459 la pantalla no
  se cae, la opción no aparece y el guardado no nombra la columna. Declarada para el gate de
  símbolos pendientes (0 ROJO · 1 AMARILLO).
- `/ui-check`: midió el badge en Nunito Sans 700 a 10,5 px; «Programada · entra el 30/11» ocupaba
  173 px en una columna de 170 → corregido a «Programada · 30/11» (131 px). Techo medido: 146 px.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| `lib/studio/tarifa-programada.migration.test.ts` (0459 real sobre PGlite, con el índice de 0255, el guard de 0382, la RPC de 0458 y los privilegios por defecto de Supabase) | **PASÓ** — 19 casos, incluido el **control rojo** sin la 0459 |
| Mutantes del `.sql` (23) | **21 muertos con PGlite.** Sobreviven: el `grant` a `service_role` (equivalente: los defaults de Supabase ya se lo dan; explícito como en 0336) y el `for update`. Este último **no se puede medir** con la única conexión de PGlite, y es **lo único** que impide que el relevo pise una cancelación del founder. Muere en la reproducción manual con dos sesiones sobre `postgres:17` (ver el ANEXO), pero **ningún test del repo lo cubre**: automatizarlo es la tarea de seguimiento. `.sql` restaurado: md5 igual antes y después |
| Mutantes del Studio (13) | **13 muertos**, archivos restaurados |
| Pruebas nuevas y afectadas del Studio (`tarifa-programada.test.ts`, `actions.programada.test.ts`, `RateDrawer.test.tsx`, `rate-types.test.ts`, `rate-import.test.ts`) | **PASÓ** |
| `pnpm verify` — lanzado sobre `cb9b30bc`; el ajuste de `/ui-check` (`46673236`) se escribió durante el paso `harness`, **antes** de `lint`, así que los pasos siguientes midieron el árbol final | ver filas siguientes |
| › harness | **PASÓ** |
| › lint | **PASÓ** |
| › rsc-boundary | **PASÓ** |
| › typecheck | **PASÓ** |
| › edge-functions | **PASÓ** (4) |
| › test | **FALLÓ por el flake de saturación conocido, no por aserciones**: 7837 pasaron, 1 cayó en intento y reintento: `app/p/[token]/PackingListProductsStep.test.tsx › adds another group…` (`Test timed out in 20000ms`, 22,6 s y 30,7 s). El Director lo anticipó; esta rama no toca `app/p/`. No se tocó ni se marcó skip |
| › docs:check / numbering | **PASÓ** (465 specs) |
| › migrations-applied | **NO EJECUTADO** — `[SKIP]` sin credenciales; no se copian credenciales de producción |
| › pending-migration-symbols | **PASÓ** — 0 ROJO · 1 AMARILLO declarado |
| › sql-tests | **PASÓ** — 197 contratos en `postgres:17` efímero (esta vez **sí** había Docker) |
| › schema-rebuild | **PASÓ** — 456 migraciones desde cero sobre `postgres:17`, **0459 incluida** (no está en `LEDGER_ONLY`; `pg_cron` con los stubs de plataforma); aislamiento multi-tenant verificado |
| › e2e | **PASÓ con cobertura PARCIAL** — 153 en verde, 0 caídas, 33 omitidas (15 por falta de Supabase público; el gate lo declara crítico con cobertura parcial) |
| › build | **PASÓ** — build de producción OK; el paso restauró `tsconfig.json` después de que Next le inyectara el `distDir` |
| **Veredicto de `verify`** | **exit 1**, con un solo fallo: `test`, por el flake de arriba. 16 de 17 pasos se midieron de verdad; `migrations-applied` quedó sin medir y `e2e` con cobertura parcial. **Exit 0 no habría equivalido a cierre completo, y exit 1 no es un fallo de esta rama** |
| El flake, aislado sobre esta rama | **PASÓ** — `vitest run app/p/[token]/PackingListProductsStep.test.tsx`: 9 de 9. `git diff origin/main...HEAD -- app/p/` vacío |
| **Merge de `origin/main`** (`56fa2ae0`, PR #136: 0458 aplicada y fuera del baseline) → `1f061f9d` | **PASÓ** — sin conflictos. El driver semántico resolvió `migrations-baseline.json`: queda la espera de la 0459 y ya no la de la 0458 |
| Después del merge: `docs:check` / `sdd:check` / `pending-migration-symbols` / `typecheck` | **PASÓ** — 465 specs, sin números repetidos, 0 ROJO · 1 AMARILLO, exit 0 |
| Después del merge: pruebas afectadas (0459 sobre PGlite, Studio de tarifas, `rate-types`, la 0458 sobre PGlite, el anclaje del respaldo que tocó la #136) | **PASÓ** — 8 archivos, 100 casos |
| `git diff --check` | **PASÓ** |
| CI alojado del primer head (`9c89d0d6`) | **PASÓ** — «Calidad local sin secretos» `success` sobre el head exacto (run 35315068666), Vercel en pass |
| Cierre: merge de `origin/main` (`b43a39a5`, PR #138) → `3b48a3c6` y salida de la 0459 de las esperas | **PASÓ** — sin conflictos (la #138 solo toca `docs/marketing/` y `public/interno/guia-peso.html`). Después: `docs:check` (465), `sdd:check`, `governance:check`, `pending-migration-symbols` (**0 ROJO · 0 AMARILLO**) y `diff --check`, todos en verde. Diff neto contra `main` de `migrations-baseline.json` y `pending-migration-symbol-declarations.json`: 0 líneas |
| CI alojado del push de cierre | Se reporta al Director por mensaje |
| Aplicación de la 0459 a producción | **EJECUTADO** con OK nominal de Sam: preflight, `apply_migration` y postflight **PASARON** (ver «APLICACIÓN DE LA 0459») |
| Lectura de filas de negocio en producción | **NO EJECUTADO**. Sí se leyó metadata: `list_migrations` (ledger: 0255 aplicada `20260720194914`, 0458 aplicada `20260918040814`) y la API pública `/api/public/cbm-rate` |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `882bdbcf` | stub de reserva de SDD-0478 (cherry-pick de `1da82c8f` del Director) |
| `101173c1` | `feat(db)`: migración 0459 y su espera en el baseline |
| `9c6a3d1c` | `test(db)`: la 0459 sobre PGlite, control rojo y mutantes; se quita `p.id <> v_row.id` (sobraba) |
| `559db511` | `feat(studio)`: programar desde `/studio/tarifas`, degradación declarada |
| `cb9b30bc` | `docs(SDD-0478)`: la spec y el índice (465) |
| `46673236` | `fix(studio)`: el badge cabe en su columna (hallazgo de `/ui-check`) |
| `1f061f9d` | merge de `origin/main` (`56fa2ae0`), sin rebase |
| `9c89d0d6` | `docs(handoff)`: cierre antes del primer push de la PR (head revisado por el CI) |
| `7332573b` | `docs(handoff)`: anexo con la carrera del `for update` reproducida |
| `3b48a3c6` | merge de `origin/main` (`b43a39a5`, PR #138), sin rebase |
| el commit que contiene este documento | `chore(db)`: 0459 aplicada; sale de las esperas y de las degradaciones; spec en `done`; este registro |

## PR / BRANCH

- PR [#137](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/137), draft, base `main`, rama
  `codex/tarifa-programada-a-futuro`, worktree de arriba. El primer head (`9c89d0d6`) pasó el check
  obligatorio (run 35315068666). Este cierre llega en **un solo push**, después de aplicar la 0459,
  con `main` al día: así lo pidió el Director.

## PENDIENTES DE ESTA TAREA

1. **Integrar la PR** — Director, cuando cierre el check del push de cierre.
2. **Test automático de concurrencia del `for update`** — seguimiento a nombre de este Worker,
   que formaliza el Director. Base: el ANEXO. Hoy está probado a mano; ningún test del repo lo
   cubre.
3. Cargar la tarifa que rija después del 2026-11-29 como programada antes de esa fecha, y verificar
   el primer relevo real en `/api/public/cbm-rate`. Lo hace Sam desde el Studio, una vez integrada
   la PR.

## APLICACIÓN DE LA 0459 (2026-09-18)

- **Autorización:** Sam, en el chat de esta sesión, textual: «autorizo aplicar la
  0459_tarifa_programada_a_futuro». El Director (`dtdcargo-18`) confirmó que no había otra
  aplicación en curso (el ledger terminaba en `20260918051801 · 0414_invoices_read_rbac`), que la
  aplicara yo y que la ventana era exclusiva.
- **Archivo aplicado:** `supabase/migrations/0459_tarifa_programada_a_futuro.sql`, blob
  `3508282bda5d38c63aead6dad85bf9a5e85dd3db` (igual en `9c6a3d1c`, `9c89d0d6` y `7332573b`), md5
  `ed65e8474baef35aaf93664647751231`, 13.483 bytes, sin CRLF.

| Paso | Resultado |
| --- | --- |
| Preflight (catálogo y ledger; ninguna fila de negocio) | **PASÓ** — 0459 ausente del ledger. Presentes: `rates`, `price_books`, `rates_one_public_cbm_per_tenant_modo`, `public_cbm_rate(text)`, `cron.schedule(text,text,text)`, `pg_cron` 1.6.4. No existía ningún objeto nuevo (columna, check, índice, las dos funciones, el trigger, el job). En `rates`: triggers `rates_guard_price_book_t` y `rates_touch` activos, unas 8 filas, 0 bloqueos. Servidor en UTC; día de Caracas 2026-09-18 |
| Foto previa | `public_cbm_rate('ddp')` = 850 / 50 / 2026-11-29; `consolidado` = 580; `/api/public/cbm-rate` igual. Advisors: 4 de seguridad y 6 de rendimiento |
| `apply_migration(name = "0459_tarifa_programada_a_futuro")` | **PASÓ** — `{"success":true}` |
| Identidad ledger ↔ blob | **PASÓ** — `20260918155832`, 1 sentencia; `md5(array_to_string(statements,''))` `ed65e8474baef35aaf93664647751231`, `octet_length` 13.483: iguales al blob |
| Catálogo | **PASÓ** — columna `boolean default false not null`; check, índice parcial y trigger (`BEFORE INSERT OR UPDATE OF publica_programada, price_book_id, tenant_id, status, deleted_at`) con la definición exacta; singleton de 0255 intacto; triggers de `rates`: `rates_guard_price_book_t`, `rates_guard_publica_programada_t`, `rates_touch`, todos activos. Las dos funciones: `security definer`, `search_path=""`, owner `postgres`. EXECUTE del relevo: `service_role` sí; `anon` y `authenticated`, no. El guard no lo ejecutan ni `anon` ni `authenticated`. Comentarios presentes |
| Job de `pg_cron` | **PASÓ** — `tarifas-programadas-relevo`, único con ese nombre, `5 * * * *`, `select public.promover_tarifas_programadas();`, activo |
| Primera corrida real del job | **PASÓ** — `cron.job_run_details`: run 3760, `succeeded`, 16:05:00.035 → 16:05:00.043 UTC (8 ms), comando `select public.promover_tarifas_programadas();`. `pg_cron` solo guarda `return_message = "1 row"`, no el JSON, así que el «promovidas []» se comprueba por el estado: 0 filas programadas antes y después, y `public_cbm_rate` sigue en 850 / 50 / 2026-11-29 y 580. La función no se llamó a mano en producción |
| Filas con `publica_programada = true` | **PASÓ** — 0 |
| Lo que ve el cliente | **PASÓ, sin cambios** — `public_cbm_rate('ddp')` = 850 / 50 / 2026-11-29, `consolidado` = 580. md5 del cuerpo de la RPC de 0458: `cc52f3571e354c6bc77c10d0ec287fd3`, el mismo que registró su postflight. `https://dtdcargo.com/tarifas` responde 200 y cotiza `per_cbm` 850; `/api/public/cbm-rate` igual |
| Advisors después | **PASÓ** — seguridad y rendimiento idénticos a la foto previa, comparados sin marcas de tiempo |
| Espera y degradación | La 0459 sale de `pendingBelowCutoff` y su degradación de `pending-migration-symbol-declarations.json`, juntas: si sale solo una, el gate falla. Gate después: 0 ROJO · 0 AMARILLO |
| Cabecera del `.sql` | Sigue diciendo «NO APLICADA» y **no se edita**: la aplicación se verifica por md5 del blob contra el ledger, y tocar un comentario rompería esa identidad (mismo criterio que la 0255 y la 0473) |

## FUERA DE ALCANCE DETECTADO

1. **AUD-01: `rates` no es entidad de auditoría.** Ni la edición del Studio ni el relevo de la 0336
   dejan evento; el relevo nuevo tampoco (deja su resumen en `cron.job_run_details`, que no es un
   evento AUD-01). Arreglarlo es dar de alta la entidad `rate` y auditar ediciones y relevos: tarea
   propia con su SDD.
2. **Nadie avisa fuera del Studio si un relevo no corre.** El cron `rate-expiry-alert` que ya
   existe podría sumar «programada que no entró»; hoy sólo la lista lo marca en rojo.
3. **El recargo de baterías no coincide: `CONFIG.recargoBateriaMult = 1.3`
   (`lib/calculadora.ts:142`) contra 1,5 en el ERP** (props públicas de `dtdcargo.com/tarifas`,
   2026-09-18). **No se sabe cuál es el correcto.** `535aa0ec` (Sam, 2026-08-05) dejó ×1,3 como
   lo que cobraba el ERP, y ninguna migración lo cambió después. O sea que el 1,5 se editó a mano, y
   puede ser una decisión o un error (en ese caso el sitio cobra las baterías un 15 % por encima).
   El Director se lo pregunta a Sam; `dtdcargo-c9`, dueño del archivo, espera esa decisión. No se
   tocó.
4. **El drawer no pone foco en el primer error** (FRM-01): preexistente, de todo el formulario.

## TAREA 3 (asignada aparte por el Director): la cabecera de la 0255 — NO APLICA

Hallazgo nº 2 del handoff de SDD-0476: la cabecera de `0255_rates_public_calc_modo.sql` dice
«⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en … pendingBelowCutoff», y es falso.

- **Aplicada:** ledger de producción `20260720194914 · 0255_rates_public_calc_modo`
  (`list_migrations`, 2026-09-18, sólo metadata). El Director lo verificó por su lado.
- **El baseline ya no la declara:** en `pendingBelowCutoff` la 0255 no es clave. Al comprobarlo, en
  `main 78410913`, las esperas eran 0415, 0414, 0422, 0423 y 0458, y la 0255 solo aparecía
  *citada* en el texto de la espera de la 0458. Hoy, con la #136 integrada, son 0415, 0414, 0422
  y 0423, más la 0459 que agrega esta rama.
  Salió del registro el 2026-07-20 con `1b394b63` («0255 y 0256 aplicadas a prod — fuera del
  registro de esperas»), el mismo día que la escribió `fa82d4cf`. `cutoff` es 238, así que con
  credenciales el gate `migrations-applied` la exige aplicada, y lo está.
- **El `.sql` NO se edita**, por orden del Director: una migración aplicada es inmutable
  (precedente de la 0473) y la aplicación se verifica comparando md5 y bytes del blob contra el
  ledger; tocar un comentario rompe esa identidad.
- **Resultado:** no aplica. No hay nada que corregir en el baseline. La cabecera sigue diciendo
  lo contrario de la verdad: quien lea la 0255 tiene que contrastarla con el ledger o con este
  registro.

## ANEXO — La carrera del `for update`, reproducida a mano (2026-09-18)

Agregado después de abrir la PR, a pedido del Director: el mutante «sin `for update`» sobrevivía
porque PGlite tiene una sola conexión. Esta es la reproducción con dos sesiones y el material para la
**tarea de seguimiento** (automatizarla), que queda a nombre del Worker de esta PR. **No es un test del
repo**: no la corre `pnpm test` ni `verify`.

**Por qué importa.** El segundo `UPDATE` del relevo
(`set is_public = true, publica_programada = false where id = v_row.id`) no vuelve a mirar
`publica_programada`. Sin el bloqueo, si el founder desprograma la tarifa (o le cambia la fecha)
mientras corre el job, el `UPDATE` solo revalida el `id` y la publica igual. **El `for update` es
lo único que lo impide.**

**Escenario.** `postgres:17` desechable, con las mismas piezas reales que la prueba de PGlite:
índice de 0255, guard de 0382, RPC de 0458 y el archivo 0459. Hay una pública de $850 y una
programada de $900 para hoy (día de Caracas). La sesión F (founder) abre una transacción, desprograma
la de $900 y tarda 4 s en confirmar. 1,5 s después, la sesión J corre
`promover_tarifas_programadas()`.

| Variante | Qué devuelve el relevo | Estado final | El sitio cotiza |
| --- | --- | --- | --- |
| **`.sql` de esta PR** (con `for update`) | `[]` después de esperar el bloqueo (3.321 ms) | $850 pública · $900 ni pública ni programada | **$850**: respetó la cancelación |
| **Mutante sin `for update`** (control rojo) | promovió la de $900 (`relevadas: 1`, 3.345 ms) | $850 despublicada · **$900 pública** | **$900**: publicó la tarifa cancelada |

**Cómo correrlo** (Git Bash, con Docker):

```
node carrera-0459-setup.cjs <worktree> <dir>/carrera-0459-original.sql <dir>/carrera-0459-mutante.sql
bash carrera-0459.sh <dir>
```

El primer script genera el SQL de las dos variantes a partir de los archivos reales de
`supabase/migrations/` del worktree. El segundo levanta un contenedor efímero (`--rm`), prepara una
base por variante, corre la carrera e imprime el resultado; al terminar borra el contenedor.

### `carrera-0459-setup.cjs`

```js
// Genera el SQL de preparación para la prueba de carrera de dos sesiones de la 0459.
// Uso: node carrera-0459-setup.cjs <worktree> <salida-original.sql> <salida-mutante.sql>
const fs = require('node:fs');
const [root, outOrig, outMut] = process.argv.slice(2);
const mig = (n) => fs.readFileSync(`${root}/supabase/migrations/${n}`, 'utf8');
function fn(sql, name) {
  const start = sql.indexOf('create or replace function public.' + name);
  if (start < 0) throw new Error('falta ' + name);
  const end = sql.indexOf('$;', sql.indexOf('as $', start));
  return sql.slice(start, end + 3);
}
const file0459 = mig('0459_tarifa_programada_a_futuro.sql');
const conLock = '     order by r.tenant_id, r.public_calc_modo\n     for update';
if (!file0459.includes(conLock)) throw new Error('no encuentro el for update');
const mutante = file0459.replace(conLock, '     order by r.tenant_id, r.public_calc_modo');

const base = `
do $roles$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $roles$;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create table public.tenants (id uuid primary key default gen_random_uuid(), slug text unique not null);
create table public.price_books (id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id), is_house boolean not null default false, deleted_at timestamptz);
create table public.rates (id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id), price_book_id uuid references public.price_books(id),
  per_cbm numeric(10,2), flat_rate numeric(10,2), min_charge numeric(10,2), valid_from date, valid_until date,
  is_public boolean not null default false, status text not null default 'published',
  public_calc_modo text not null default 'ddp', updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (per_cbm is not null or flat_rate is not null));
insert into public.tenants (slug) values ('dtd');
insert into public.price_books (tenant_id, is_house) select id, true from public.tenants;
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $cron$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $cron$;
create unique index rates_one_public_cbm_per_tenant_modo on public.rates (tenant_id, public_calc_modo)
  where is_public and deleted_at is null and per_cbm is not null;
${fn(mig('0382_price_books.sql'), 'rates_guard_price_book')}
create trigger rates_guard_price_book_t before insert or update of price_book_id, is_public, tenant_id
  on public.rates for each row execute function public.rates_guard_price_book();
${fn(mig('0458_tarifa_lectura_sin_vigencia.sql'), 'public_cbm_rate')}
`;
const datos = `
reset lock_timeout; reset statement_timeout;
insert into public.rates (tenant_id, price_book_id, per_cbm, min_charge, is_public, public_calc_modo, valid_from)
  select t.id, pb.id, 850, 50, true, 'ddp', (now() at time zone 'America/Caracas')::date - 14
  from public.tenants t join public.price_books pb on pb.tenant_id = t.id;
insert into public.rates (tenant_id, price_book_id, per_cbm, min_charge, publica_programada, public_calc_modo, valid_from)
  select t.id, pb.id, 900, 50, true, 'ddp', (now() at time zone 'America/Caracas')::date
  from public.tenants t join public.price_books pb on pb.tenant_id = t.id;
`;
fs.writeFileSync(outOrig, base + file0459 + datos);
fs.writeFileSync(outMut, base + mutante + datos);
console.log('ok', outOrig, outMut);
```

### `carrera-0459.sh`

```bash
#!/usr/bin/env bash
# Prueba de carrera de dos sesiones de la 0459 en un postgres:17 desechable.
# Escenario: el founder cancela la programada (sesión F, transacción abierta) mientras corre el relevo (sesión J).
set -u
S="$1"            # scratchpad (ruta Windows con /)
C=carrera-0459-$
docker run -d --rm --name "$C" -e POSTGRES_PASSWORD=x postgres:17 >/dev/null
trap 'docker rm -f "$C" >/dev/null 2>&1' EXIT
for i in $(seq 1 60); do docker exec "$C" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
q() { docker exec -i "$C" psql -U postgres -d "$1" -v ON_ERROR_STOP=1 -At "${@:2}"; }

for variante in original mutante; do
  db="carrera_$variante"
  docker exec "$C" createdb -U postgres "$db"
  q "$db" -q < "$S/carrera-0459-$variante.sql" >/dev/null || { echo "$variante: FALLÓ la preparación"; continue; }

  echo "== $variante: el founder cancela mientras corre el relevo"
  # F toma la fila de la programada y la desprograma, pero tarda 4 s en confirmar.
  ( q "$db" -c "begin; update public.rates set publica_programada = false where per_cbm = 900; select pg_sleep(4); commit;" >/dev/null ) &
  sleep 1.5
  t0=$(date +%s%3N)
  q "$db" -c "select public.promover_tarifas_programadas() ->> 'promovidas';" | sed 's/^/   relevo devuelve: /'
  t1=$(date +%s%3N)
  wait
  echo "   el relevo tardó $((t1 - t0)) ms"
  q "$db" -c "select '   ' || per_cbm || ' · pública=' || is_public || ' · programada=' || publica_programada from public.rates order by per_cbm;"
  q "$db" -c "select '   el sitio cotiza: ' || coalesce((select per_cbm::text from public.public_cbm_rate('ddp')), 'NADA');"
done
```

## IMPACTO DOCUMENTAL

- Canónicos: la spec 0478 (nueva) y `docs/specs/README.md` (regenerado por script, 465 specs).
  Documentación en código: cabecera de la 0459 y comentarios de `rate-queries.ts`/`rate-types.ts`.
- No aplica: `BRAND.md`/`docs/design/**` (sin tokens ni componentes nuevos; `/ui-check` corrido),
  `docs/marketing/**`, `docs/governance/**` (clasificación en la spec, sin política nueva).
- Handoffs históricos: ninguno editado.
- **Graphify 0.9.61, estructural:** `graphify update .` sobre `1f061f9d` (34.900 nodos, 65.280
  aristas). En
  `knowledge:status` queda 0 pendientes y 0 faltantes, pero el estado es PENDING por dos nodos
  virtuales de módulos externos (`react`, `@testing-library/react`) que aparecen en
  `structural.deleted`. Es el mismo estado que registró la 0475 y el que muestra hoy el checkout
  principal. No se «reparó»: el runbook prohíbe descartar rutas externas sin investigarlas.
- **Semántica:** ninguna de las 16 fuentes del piloto está en el diff, así que esta tarea no debe
  recibo. La cobertura global sigue PENDING (1.093), que es el backlog de siempre.
- **Archify:** NO DISPONIBLE (`ARCHIFY_RUNTIME_MISSING` en el worktree). El mapa
  `knowledge-lifecycle` no depende de estas fuentes.
- **Obsidian:** `knowledge:publish --preview` dio `ok: true` en `1f061f9d`, con 0 conflictos y 39
  avisos de enlaces, todos ajenos a esta rama. El primer intento lo cortó un `timeout` de 400 s
  que puse yo (exit 124) con la máquina saturada; el segundo, sin límite, terminó bien. La bóveda
  compartida no se tocó: la publica el Director desde `main` integrado.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** la 0459 ya está aplicada y verificada; falta integrar la #137 cuando cierre
  el check del push de cierre. Al desplegarse, `/studio/tarifas` empieza a ofrecer «Programada»:
  la consulta aislada ya encuentra la columna.
- **Cambios compartidos:** `supabase/migrations-baseline.json` (la espera 0459; la de la 0458 ya
  la retiró la #136, y el merge `1f061f9d` lo resolvió con el driver semántico),
  `supabase/pending-migration-symbol-declarations.json` y `docs/specs/README.md`.
- **Sesiones consumidoras:** ninguna fuera de esta. El claim se libera al terminar la escritura;
  worktree y rama se conservan.
