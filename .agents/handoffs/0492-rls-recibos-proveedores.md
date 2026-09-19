# Handoff 0492 · escribir cobros y cuentas por pagar queda para accounting y admin

- Fecha: 2026-09-19. Estado de la tarea: **`verify` completo verde** (16 de 17; `migrations-applied`
  NO DISPONIBLE). Falta el push único y la PR en draft. **Migrate-first:** la 0470 no se aplica ni la
  PR se integra sin el OK nominal de Sam, y va **después de la 0468** (PR #169).
- Owner/sesión: `worker-rls-recibos-proveedores-0492-20260919` (Claude Opus 5, Worker, sesión
  «Automatizar la prueba de carrera del for update de 0459»). Director: la sesión «Director
  notificación a workers», que asignó la tarea y decidió los dos puntos de diseño de abajo.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/rls-recibos-proveedores-0492`,
  creado con `harness-worktree start` desde `main` `dd764c66`.
- Rama: `codex/rls-recibos-proveedores-0492`, sin upstream hasta el push.
- SDD: [0492](../../docs/specs/0492-rls-recibos-proveedores/spec.md). Reservada en local con
  `corepack pnpm sdd:next --reserve rls-recibos-proveedores`: lock `refs/dtd/reservations/0492` y
  rama `codex/sdd-reserve-0492-rls-recibos-proveedores` (`ed6a66db`), incorporada con cherry-pick.
  La migración 0470 se reservó con su archivo en la rama (`432d3f1d`). Antes comprobé que 0470 y
  0492 estuvieran libres en ramas remotas y locales, en las PR abiertas y en los worktrees.
- Aislamiento comprobado antes de editar: toplevel y rama correctos, `guard` → `Guard OK`, claim
  adquirido con el owner de arriba. Antes de cada commit se revalida con `guard --owner`.
- Permisos del encargo: commits en esta rama; el push único y la PR, con el aviso del Director.
  **No merge. No producción. No leer filas de producción.** El catálogo de producción lo leyó el
  Director y me lo pasó por mensaje; no se leyó ninguna fila de negocio.

## OBJETIVO ORIGINAL

Juntar el punto 1 del «Fuera de alcance» de la SDD-0488 y el de la SDD-0489: la RLS de
`payment_receipts`, `suppliers`, `supplier_bills` y `supplier_payments` sólo filtra por tenant, así
que cualquier miembro escribe por PostgREST, y las envolturas de anulación de la 0294 no exigen rol.
El encargo pedía, en este orden: inventario completo de escritores, diseño con el criterio de la
0422, contrato con matriz de roles, control rojo, mutantes, envoltorio PGlite, comprobar que la 0467
y la 0468 siguen funcionando encima, y una PR migrate-first en draft.

## COMPLETADO

- **Inventario** (va entero en la spec): todos los escritores de hoy son `accounting` o `admin`, con
  el cliente de sesión, salvo `rename_client_markbox`, que es DEFINER de postgres y no pasa por la
  RLS. Nadie borra filas y no hay escritores con el cliente admin. El módulo RBAC «suppliers» es
  `/studio/proveedores`, que escribe `suppliers_cn`, no `suppliers`.
- **`supabase/migrations/0470_rls_escritura_cobros_proveedores.sql`**, con el molde de la 0407
  (aplicada) para invoices:
  - por tabla, `<tabla>_team_select` (lectura tenant-wide, igual que hoy),
    `<tabla>_accounting_insert` y `<tabla>_accounting_update`, que exigen
    `current_studio_role() in ('accounting','admin')`;
  - `revoke delete` de `authenticated` en las cuatro; `service_role` conserva el suyo;
  - `assert_studio_role(array['accounting','admin'])` en las tres envolturas de la 0294, con el
    mismo cuerpo, INVOKER, owner y ACL;
  - preflight con las huellas de las policies de producción, la ACL y los md5 de los cuerpos de
    `get_user_tenant_id` (0453), `current_studio_role` (0200), `assert_studio_role` (0351) y las tres
    envolturas (0294); postflight con la matriz final.
- **Espera** de la 0470 en `supabase/migrations-baseline.json`, con el orden 0468 → 0470 y la huella
  que tendría que actualizar la #169 si se invierte.
- **Pruebas:** el contrato SQL (168 aserciones), su envoltorio PGlite (12 casos) y la compatibilidad
  con la 0468 fuera del repo.
- **Spec 0492** con el inventario, las decisiones del Director, el molde, la aceptación, la
  gobernanza y el orden de release.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| Catálogo de producción (Q1-Q6, leído por el Director el 2026-09-19 ~21:35Z) | **Confirmado**: una sola policy FOR ALL por tabla, huella `f118dd90556c13981e880287a2b28599`; ACL `{authenticated=arwd, service_role=arwdDxtm}`, anon sin nada; RLS activa y FORCE apagado; 0294, 0351, 0453, 0465 y 0467 aplicadas; 0422 y 0468 no |
| Contrato `0470_rls_escritura_cobros_proveedores.test.sql`, solo | **PASÓ**: `TEST 0470 GREEN: 168 aserciones`, 553 ms, sin residuo |
| Control rojo del contrato (`-v apply_fix=false`) | **FALLÓ, como tenía que fallar**: «commercial-A pudo dar de alta en payment_receipts (sin error)» |
| Envoltorio PGlite `rls-escritura-cobros-proveedores.migration.test.ts` | **PASÓ**: 12 de 12 en 21 s (verde con las 168 aserciones, control rojo, 9 mutantes y el postflight) |
| Mutantes de la 0470, fuera del repo y por el runner real | **Los 9 caen**: ver la tabla de abajo. Sin mutación: verde |
| Los mismos 9 **sin el postflight de la migración** | **Los 9 caen igual, en una aserción del contrato**: así se ve que la matriz de roles prueba algo y no la está tapando el autochequeo |
| Compatibilidad con la 0468 (#169), orden 0468 → 0470 | **PASÓ**: `COMPAT 0468+0470 GREEN: 7 aserciones`. Pagar y anular con sus RPC siguen funcionando para accounting; el comercial sigue rebotando |
| Compatibilidad, orden inverso (0470 → 0468) | **Aborta la 0468, como estaba previsto**: «0468 abortado: void_supplier_payment_with_audit_reason tiene otro cuerpo (md5 b1d007101562c1b727fcf921a746f635, sin espacios 52727f731062ed77ce19749830f60d09)». No cambia nada |
| Gate de símbolos pendientes | **PASÓ**: 0 ROJO · 0 AMARILLO. La 0470 no agrega símbolos que TypeScript nombre |
| `verify` completo sobre `f7bbd27c`, turno del Director, 21:53-22:06 UTC | **16 de 17 PASARON y ninguno FALLÓ.** harness, lint (0 errores; 15 avisos en archivos ajenos), rsc-boundary, typecheck, edge-functions, test (8117 ✓ y 1 omitido en 621 archivos), docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests (219 contratos, con el de la 0470), schema-rebuild, e2e (166 ✓; 2 flaky ajenos, el selector de la calculadora pública, que pasó al reintento) y build. **`migrations-applied`: NO DISPONIBLE**, sin credenciales en el worktree |
| CI alojado | **NO EJECUTADO**: GitHub Actions está bloqueado por facturación desde las 21:18Z |

**Qué aserción mata a cada mutante de la 0470** (la columna de la derecha es sin el postflight):

| Mutante | Lo que cambia | Cae en |
| --- | --- | --- |
| M1 | la escritura sin el rol, sólo el tenant | el comercial da de alta un cobro |
| M2 | `commercial` en la lista de roles | el comercial da de alta un cobro |
| M3 | sólo `payment_receipts` sin el rol | el comercial da de alta un cobro |
| M4 | sin revocar el DELETE | accounting borra un cobro |
| M5 | envolturas sin el assert | el comercial llama a `void_payment_receipt_with_audit_reason` |
| M6 | la lectura también pide rol | el comercial deja de leer |
| M7 | el USING de UPDATE sin el rol | el comercial recibe 42501 al editar, en vez de 0 filas |
| M8 | sólo `supplier_bills` sin el rol | el comercial da de alta una CxP |
| M9 | sin soltar la policy FOR ALL heredada | el comercial da de alta un cobro |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `4c8c054b` | `chore(sdd)`: la reserva de SDD-0492 (cherry-pick del stub) |
| `432d3f1d` | `chore(db)`: la reserva de la migración 0470 |
| `7f8ef0c6` | `feat(db)`: la 0470 y su espera migrate-first |
| `20403327` | `test(db)`: el contrato con la matriz de roles y su envoltorio PGlite |
| `510f3181` | `docs(SDD-0492)`: spec, índice y handoff |
| `f7bbd27c` | `docs(SDD-0492)`: por qué el molde de la 0407 y no el de la 0422 |
| este commit | `docs(SDD-0492)`: la evidencia del `verify`, antes del push único |

## PR / BRANCH

- Rama `codex/rls-recibos-proveedores-0492`, base `main`, worktree de arriba. No está publicada.
- **La PR sale en DRAFT**, con «NO FUSIONAR hasta aplicar 0470» en la primera línea del cuerpo y el
  orden de release. La pasa a ready el Director, después del OK de Sam y de aplicar la migración.

## PENDIENTES DE ESTA TAREA

1. El push único y la PR en draft, con el número y el SHA por mensaje al Director, y liberar el
   claim. El worktree y la rama se conservan.
3. **El release, en este orden:** OK nominal de Sam nombrando la 0470 → aplicar la 0468 si Sam la
   aprueba → aplicar la 0470 → pasar la PR a ready e integrarla → retirar la espera.
4. El CI no va a correr hasta que Sam arregle la facturación de GitHub Actions.

## FUERA DE ALCANCE DETECTADO

1. **La lectura sigue tenant-wide** en las cuatro tablas, igual que en `invoices` desde la 0407.
   Cerrarla pide RPC minimizadas para los módulos que consumen agregados.
2. **`next_bill_code` y `next_supplier_code` (0088) calculan `max+1` sin lock** y truncan pasado
   9999. Son los puntos 2 y 3 del «Fuera de alcance» de la SDD-0489.
3. **`suppliers_cn`** conserva escritura para el equipo del tenant (0105, 0229). Es el catálogo
   comercial del cliente y no mueve plata.
4. **Las envolturas con el cliente admin.** Después de la 0470, llamarlas con `service_role` falla
   con 42501, porque `auth.uid()` es null. Hoy no hay ningún llamador así.

## IMPACTO DOCUMENTAL

- **Canónico:** la spec 0492 y el índice regenerado.
- **Documentación en código:** la cabecera de la migración, la del contrato, la del envoltorio
  PGlite, los comentarios de las cuatro tablas y la espera del baseline.
- **No aplica:** `BRAND.md` y `docs/design/**` (no hay UI); `docs/marketing/**`; `revisar-datos-ve`
  (no se mueven datos personales y no se leyó ninguna fila de producción).
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.** Quedan para la publicación del
  Director desde `main`.

## Control rojo reproducible (fuera del repo)

Los mutantes y la compatibilidad no viven en el repo.

- `rojo-0470.cjs` arma, en una carpeta nueva, una copia de `supabase/migrations` y del contrato de
  la 0470, con la 0470 mutada, y la pasa por el runner real. Con el sufijo `-sp` le quita a la copia
  el postflight de la propia migración, para que el mutante lo tenga que cazar el contrato.
- `compat-0468.cjs` arma otra carpeta con la 0468 leída de la rama de la #169 y dos contratos
  derivados del suyo: uno en el orden bueno (0468 → 0470) y otro en el inverso. No toca ninguna de
  las dos ramas.

```bash
node rojo-0470.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>" <M1..M9|verde>[-sp]
```

```bash
node compat-0468.cjs "<worktree>" "<carpeta-nueva-fuera-del-repo>"
```

```js
// Mutantes de la 0470 (SDD-0492), fuera del repo. Arma una copia de supabase/
// (migraciones + el contrato 0470) con las mutaciones de la variante y la pasa
// por el runner real (scripts/run-sql-tests.mjs).
//
//   node rojo-0470.cjs <worktree> <carpeta-nueva> <variante>
//
//   M1  la escritura sin el rol: sólo el tenant, como antes
//   M2  el rol comercial en la lista de los que escriben
//   M3  sólo payment_receipts se queda sin el rol (aplicación parcial)
//   M4  sin revocar el DELETE de authenticated
//   M5  las envolturas de la 0294 sin el assert de rol
//   M6  la lectura también pide rol (rompe al equipo)
//   M7  el USING de UPDATE sin el rol: la fila se ve, y el WITH CHECK rebota
//   verde  sin mutación                                                   → ✓
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MIG = "0470_rls_escritura_cobros_proveedores.sql";
const ROL = "\n    and (select public.current_studio_role()) in ('accounting', 'admin')";
const TABLAS = ["payment_receipts", "suppliers", "supplier_bills", "supplier_payments"];

// Cada entrada es [texto, reemplazo, veces] — `veces` fija cuántas apariciones
// se esperan, así una mutación que no encuentra su texto falla en vez de pasar.
const CAMBIOS = {
  M1: [[ROL, "", 12]],
  M2: [["in ('accounting', 'admin')", "in ('accounting', 'admin', 'commercial')", 12]],
  M3: [[`on public.payment_receipts for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())${ROL}
  );`, `on public.payment_receipts for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
  );`, 1]],
  M4: TABLAS.map((t) => [`revoke delete on public.${t} from authenticated;\n`, "", 1]),
  M5: [["  perform public.assert_studio_role(array['accounting', 'admin']);\n\n", "", 3]],
  M6: TABLAS.map((t) => [`on public.${t} for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );`, `on public.${t} for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())${ROL}
  );`, 1]),
  M7: [[`for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())${ROL}
  )`, `for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  )`, 4]],
  M8: [[`on public.supplier_bills for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())${ROL}
  );`, `on public.supplier_bills for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
  );`, 1]],
  M9: [['drop policy "payment_receipts by tenant" on public.payment_receipts;\n', "", 1]],
};

// Con el sufijo «-sp» se le quita a la copia el postflight de la propia
// migración: así el mutante tiene que caer en una aserción del contrato, no en
// el autochequeo. Es la única forma de ver si la matriz de roles prueba algo.
const [W, D, Varg] = process.argv.slice(2);
if (!W || !D || !Varg) throw new Error("uso: node rojo-0470.cjs <worktree> <carpeta-nueva> <variante[-sp]>");
const sinPostflight = Varg.endsWith("-sp");
const V = sinPostflight ? Varg.slice(0, -3) : Varg;
if (!(V in CAMBIOS) && V !== "verde") throw new Error("variante desconocida: " + V);
fs.mkdirSync(D); // falla si ya existe: nunca se reutiliza ni se borra nada
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
fs.copyFileSync(path.join(W, "supabase", "tests", "0470_rls_escritura_cobros_proveedores.test.sql"),
  path.join(D, "supabase", "tests", "0470_rls_escritura_cobros_proveedores.test.sql"));
const destino = path.join(D, "supabase", "migrations", MIG);
if (V in CAMBIOS || sinPostflight) {
  let s = fs.readFileSync(destino, "utf8");
  for (const [a, b, veces] of CAMBIOS[V] || []) {
    const n = s.split(a).length - 1;
    if (n !== veces) throw new Error(`${V}: «${a.slice(0, 50).replace(/\n/g, "⏎")}» aparece ${n} veces, no ${veces}`);
    s = s.split(a).join(b);
  }
  if (sinPostflight) {
    const ini = s.indexOf("do $postflight$");
    const fin = s.indexOf("$postflight$;", ini + 1);
    if (ini < 0 || fin < 0) throw new Error("no encuentro el postflight");
    s = s.slice(0, ini) + s.slice(fin + "$postflight$;".length);
  }
  fs.writeFileSync(destino, s);
}
const diff = spawnSync("git", ["diff", "--no-index", "--unified=0", "--no-color",
  path.join(W, "supabase", "migrations", MIG), destino], { encoding: "utf8" });
console.log(`== diff (${V}):`);
console.log(diff.stdout.split("\n").filter((l) => /^[-+][^-+]/.test(l) || /^@@/.test(l)).join("\n") || "(sin cambios)");
const t0 = Date.now();
const run = spawnSync(process.execPath, [path.join(W, "scripts", "run-sql-tests.mjs")], { cwd: D, encoding: "utf8" });
process.stdout.write((run.stdout || "") + (run.stderr || ""));
console.log(`== runner exit ${run.status} en ${Date.now() - t0} ms`);
process.exitCode = run.status;
```

```js
// Compatibilidad 0468 ↔ 0470 (SDD-0489 y SDD-0492), fuera del repo y sin tocar
// ninguna de las dos ramas. Arma una carpeta con:
//   · supabase/migrations del worktree 0492 + la 0468 leída de la rama de la #169;
//   · dos contratos derivados del contrato 0468 de esa rama:
//       orden-bueno.test.sql   → 0468 y después 0470: las RPC de la 0468 siguen
//                                funcionando y el comercial sigue afuera;
//       orden-malo.test.sql    → 0470 antes que la 0468: su preflight aborta.
//
//   node compat-0468.cjs <worktree-0492> <carpeta-nueva>
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const [W, D] = process.argv.slice(2);
if (!W || !D) throw new Error("uso: node compat-0468.cjs <worktree-0492> <carpeta-nueva>");
const RAMA = "origin/codex/carrera-pago-proveedor";
const git = (...args) => {
  const r = spawnSync("git", args, { cwd: W, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
};

fs.mkdirSync(D); // falla si ya existe
fs.mkdirSync(path.join(D, "supabase", "tests"), { recursive: true });
fs.cpSync(path.join(W, "supabase", "migrations"), path.join(D, "supabase", "migrations"), { recursive: true });
fs.writeFileSync(path.join(D, "supabase", "migrations", "0468_pago_proveedor_atomico.sql"),
  git("show", `${RAMA}:supabase/migrations/0468_pago_proveedor_atomico.sql`));

const contrato = git("show", `${RAMA}:supabase/tests/0468_pago_proveedor_atomico.test.sql`);
const corte = contrato.indexOf("create temporary table baseline_policies");
if (corte < 0) throw new Error("no encuentro el corte del contrato 0468");
let fixture = contrato.slice(0, corte); // prelude + \ir de migraciones + seeds

// La fixture de la 0468 no necesitaba fidelidad en los helpers de rol: su
// current_studio_role tiene otro cuerpo y no trae assert_studio_role. El
// preflight de la 0470 fija los dos por md5 contra producción (0200 y 0351),
// así que acá se ponen los cuerpos reales. Es de la copia, no de ninguna rama.
const SUYA = `create function public.current_studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select ut.role from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;`;
const PRODUCCION = `create or replace function public.current_studio_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_tenants
  where user_id = (select auth.uid())
    and disabled_at is null
  limit 1
$$;
create or replace function public.assert_studio_role(p_roles text[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.current_studio_role();
begin
  -- current_studio_role() ya filtra \`disabled_at is null\` (migr 0200): un
  -- usuario desactivado llega acá como NULL y rebota.
  if v_role is null or not (v_role = any(p_roles)) then
    raise exception 'No tienes permiso para realizar esta acción'
      using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.assert_studio_role(text[]) from public, anon;
grant execute on function public.assert_studio_role(text[]) to authenticated, service_role;`;
if (fixture.split(SUYA).length !== 2) throw new Error("no encuentro current_studio_role en la fixture 0468");
fixture = fixture.replace(SUYA, () => PRODUCCION);
// service_role, igual que en producción, para que la 0470 vea su ACL.
fixture += "\ngrant all on all tables in schema public to service_role;\n";

const IR_0468 = "\\ir ../migrations/0468_pago_proveedor_atomico.sql\n";
const IR_0470 = "\\ir ../migrations/0470_rls_escritura_cobros_proveedores.sql\n";

// Las aserciones usan la fixture de la 0468: pg_temp.fixture_id y sus etiquetas.
const ASERCIONES = `
-- ── Aserciones de compatibilidad ────────────────────────────
create temporary sequence aserciones;
create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'COMPAT 0468+0470: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;
create function pg_temp.intenta(p_actor text, p_sql text) returns jsonb language plpgsql as $$
declare v_state text; v_msg text;
begin
  perform set_config('request.jwt.claim.sub', pg_temp.fixture_id(p_actor)::text, true);
  begin
    set local role authenticated;
    execute p_sql;
    reset role;
    return jsonb_build_object('ok', true);
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    reset role;
    return jsonb_build_object('ok', false, 'sqlstate', v_state, 'mensaje', v_msg);
  end;
end;
$$;

do $compat$
declare v_r jsonb; v_pago uuid;
begin
  -- 1. Pagar con la RPC de la 0468, como accounting, encima de la 0470.
  v_r := pg_temp.intenta('accounting-A', format(
    'select public.register_supplier_payment_order(%L, 200, %L, %L, current_date, null, null)',
    pg_temp.fixture_id('bill-open'), pg_temp.fixture_id('cash-A'), 'transferencia'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean,
    'accounting no pudo pagar con la 0468: ' || coalesce(v_r ->> 'mensaje', ''));
  perform pg_temp.afirmar((select paid_amount from public.supplier_bills
    where id = pg_temp.fixture_id('bill-open')) = 200, 'el pago de la 0468 no llegó a la CxP');

  -- 2. El comercial sigue afuera: lo frena la propia 0468.
  v_r := pg_temp.intenta('commercial-A', format(
    'select public.register_supplier_payment_order(%L, 100, %L, %L, current_date, null, null)',
    pg_temp.fixture_id('bill-open'), pg_temp.fixture_id('cash-A'), 'transferencia'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean is false, 'el comercial pudo pagar con la 0468');

  -- 3. Anular con la 0468, que por dentro llama a la envoltura con assert.
  select id into v_pago from public.supplier_payments
   where bill_id = pg_temp.fixture_id('bill-open') and deleted_at is null
   order by created_at desc limit 1;
  v_r := pg_temp.intenta('accounting-A', format('select public.void_supplier_payment_order(%L, %L)',
    v_pago, 'Orden cargada por error'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean,
    'accounting no pudo anular con la 0468: ' || coalesce(v_r ->> 'mensaje', ''));
  perform pg_temp.afirmar((select paid_amount from public.supplier_bills
    where id = pg_temp.fixture_id('bill-open')) = 0, 'la anulación de la 0468 no bajó el pagado');
  perform pg_temp.afirmar((select deleted_at is not null from public.supplier_payments where id = v_pago),
    'la orden no quedó anulada');

  -- 4. Y el comercial tampoco anula.
  v_r := pg_temp.intenta('commercial-A', format('select public.void_supplier_payment_order(%L, %L)',
    pg_temp.fixture_id('pay-reapply'), 'Orden cargada por error'));
  perform pg_temp.afirmar((v_r ->> 'ok')::boolean is false, 'el comercial pudo anular con la 0468');
end;
$compat$;

select 'COMPAT 0468+0470 GREEN: ' || currval('pg_temp.aserciones') || ' aserciones' as resultado;
rollback;
`;

fs.writeFileSync(path.join(D, "supabase", "tests", "orden-bueno.test.sql"),
  fixture + IR_0468 + IR_0470 + ASERCIONES);
fs.writeFileSync(path.join(D, "supabase", "tests", "orden-malo.test.sql"),
  fixture + IR_0470 + IR_0468 + "\nselect 'COMPAT orden malo: la 0468 no abortó' as resultado;\nrollback;\n");
console.log("carpeta lista:", D);
```

## HANDOFF AL DIRECTOR

- **Siguiente acción:** el OK de Sam para aplicar, con la 0468 antes si él la aprueba. La PR queda
  en draft y sin CI hasta que se destrabe la facturación de GitHub Actions.
- **Cambios compartidos:** una migración nueva (0470) con su espera, un `.test.sql` que el runner
  descubre solo, su envoltorio PGlite y la spec. Sin TypeScript de producto.
- **Dependencias:** migrate-first, y después de la 0468 (#169). La app no cambia, así que no hay
  ventana de incompatibilidad.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR; el worktree y la rama se
  conservan.
