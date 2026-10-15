# Handoff · SDD-0529 · Editar operarios de Venezuela

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15 (Caracas) |
| Task ID | operarios-venezuela-editar |
| Owner | subagente Worker del Director (claim `worker-operarios-venezuela-editar`) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a55c4c7b96b52c361` |
| Rama | `codex/operarios-venezuela-editar` |
| Base | `origin/main` `a8d99acf`; reserva SDD `235f65cc` (fast-forward, local, sin push) |
| SDD | [0529](../../docs/specs/0529-operarios-venezuela-editar/spec.md) · `in-progress` |
| Migración | `0480_operarios_editar_por_region.sql` · **NO APLICADA** · MIGRATE-FIRST |
| PR | draft contra `main`, abierta desde esta rama después del commit que contiene este documento |
| Estado de tarea | lista-para-revision (PR draft) |

## OBJETIVO ORIGINAL

Sam eligió «Editar operarios de Venezuela (Recomendado)»: «Hoy no se puede
editar un operario de Venezuela desde el Studio, porque el formulario exige un
almacén de China y solo ofrece dos roles. Es un defecto real que encontramos con
los PIN.»

Alcance del Director:

- editar a uno de Venezuela: nombre, nombre en chino si aplica, rol de su región
  y lo demás que el cajón ya edita, sin almacén para «ve» y con almacén
  obligatorio para «cn»;
- roles por región derivados de la base, sin escribir la regla dos veces;
  guardar nunca cambia un rol en silencio;
- la action y la RPC aceptan los roles válidos y validan la región contra el
  almacén, y la base es la autoridad. Si hace falta, se reescribe la RPC en la
  0480 desde su última definición, con preflight, postflight, auditoría y
  pruebas;
- no tocar el PIN, «Ver PIN», «Restablecer PIN» ni «Reactivar», ni la primitiva
  de columnas de 0520.

## COMPLETADO

- **Diagnóstico verificado** con `archivo:línea` en la spec (§ Diagnóstico):
  - `EditOperarioDrawer.tsx:54`: exigía almacén;
  - `:156-157`: sólo dos roles;
  - `actions.ts:364`: `|| "operario"`, el cambio en silencio;
  - `actions.ts:370-372`: almacén obligatorio y dos roles;
  - `0351:190`: la RPC con dos roles;
  - `0351:178` y `0475:847`: candado escrito a mano;
  - además, el rol se cambiaba sin los modos (`roles[]`), que es lo que mira la
    app del teléfono (`operario-session.ts:141` y `:237`, `0328:33-34`).
- **¿La 0475 lo resolvió?** No. Editar entra aquí, con la matriz y auditoría
  atómica. Desactivar queda fuera, justificado en la decisión 4 de la spec.
- **Migración 0480:**
  - crea `operario_roles_por_region()`, la única fuente de la regla;
  - reescribe `admin_update_operario` desde 0351, con la misma firma y
    search_path vacío. Ahora:
    - autoriza con la matriz antes de buscar la fila;
    - lee la fila con FOR UPDATE;
    - toma el rol de la región de la fila, sin rol por defecto;
    - los modos siguen al rol;
    - China lleva un almacén activo (o el que ya tenía) y Venezuela ninguno;
    - si el nombre se repite en el almacén, P0013;
    - sin cambios, no escribe;
    - el evento `operario_updated` se escribe sin los nombres;
  - trae preflight y postflight.
- **App:**
  - `getOperarioRolesPorRegion` (página);
  - `lib/studio/operario-edicion.ts` (validación, opciones, campo de cada
    rechazo);
  - `updateOperarioAction`, sin lista ni rol por defecto, con el almacén vacío
    como NULL;
  - `EditOperarioDrawer`, para China y Venezuela, con avisos y un aviso al
    guardar;
  - `OperariosClient` sólo pasa la prop; la primitiva de 0520 queda intacta.
- **Pruebas:**
  - contrato SQL: 119 aserciones;
  - PGlite: 43 pruebas, entre ellas control rojo, 11 preflights, 20 mutantes, la
    propiedad de la matriz y el cajón contra la base;
  - action: 28 pruebas, con el gate real y un doble que filtra y devuelve
    copias;
  - cajón: 16 pruebas en jsdom;
  - unidad: 35 pruebas;
  - 25 mutantes de la app, todos muertos.
- **Espera** en `migrations-baseline.json` y declaración AMARILLO de
  `operario_roles_por_region`.

## VALIDACIÓN

Base observada: `235f65cc` más el diff de esta rama.

| Comprobación | Resultado | Detalle |
|---|---|---|
| `vitest run` del envoltorio PGlite `operarios-editar-por-region.migration.test.ts` | PASÓ | 43/43. «TEST 0480 GREEN: 119 aserciones». Control rojo: `TEST 0480: operations cambia el rol de un camionero de Venezuela a bodeguero, sin almacén (P0012: Rol inválido)` |
| Focalizadas: los dos envoltorios PGlite (0480 y 0475), `operario-pin`, `operario-pin.migration`, `operario-edicion`, `app/studio/(app)/operarios/**` y `rbac-actions-guard` | PASÓ | 13 archivos, 832/832 |
| Mutantes de la migración (PGlite) | PASÓ | 20/20 mueren en la aserción esperada, más el mutante del candado a mano: rompe la propiedad en exactamente 6 casos |
| Mutantes de la app (manuales) | PASÓ | 25/25 mueren: A1-A7 (action), D1-D10 (cajón), P1-P8 (puros, query y `isOperarioRol`). Control verde 79/79 antes y después; vitest sin shell, muerte sólo con «N failed» |
| `pnpm typecheck` | PASÓ | `tsc --noEmit` exit 0 |
| `pnpm lint` | PASÓ | 0 errores; 15 avisos previos, ninguno en archivos tocados |
| `docs:check` | PASÓ | índice sincronizado, 508 specs |
| `sdd:check` | PASÓ | sin números repetidos (los choques históricos de siempre) |
| `governance:check` | PASÓ | 28 políticas, cápsula vigente |
| `components:check` | PASÓ | CMP-01 válido |
| `check-pending-migration-symbols` | PASÓ | 0 ROJO · 1 AMARILLO declarado (`operario_roles_por_region`) |
| `/ui-check` (inline, advisory) | PASÓ con ajustes menores | ver abajo |
| `/revisar-datos-ve` (inline, advisory) | hecho | tabla en la spec |
| Contrato SQL en Docker (`run-sql-tests.mjs`) | NO EJECUTADO | turno de corrida pesada / Docker de otro Worker; PGlite corre el mismo archivo |
| `check-schema-rebuild` | NO EJECUTADO | Docker, mismo motivo |
| `pnpm verify` completo | NO EJECUTADO | el turno de corrida pesada es de otro Worker (indicación del Director) |
| `migrations-applied` | NO EJECUTADO | consulta producción; 0480 está declarada como espera |
| `knowledge:status` | NO DISPONIBLE en el worktree | `ok:false`: el worktree no tiene `graphify-out` (derivado ignorado). Graphify y Obsidian los publica el Director desde main |

### `/ui-check` · `EditOperarioDrawer.tsx`

1. ⭐ [media] El cajón dice «Almacén de China», mientras la tabla
   (`OperariosClient.tsx:67`) y el alta (`NewOperarioDrawer.tsx:132`) dicen
   «Warehouse». La terminología queda mezclada. Unificar a «Almacén» toca la
   columna de 0520 y el alta: va fuera de alcance.
2. [baja] Tamaños de letra en px crudos (11, 11,5, 12 y 13) y espaciado en px,
   igual que los cajones hermanos del módulo.
3. Lo que está bien:
   - sólo tokens `var(--*)`: se quitó el `rgba(168,50,62,0.08)` de respaldo que
     tenía el aviso de error;
   - tuteo en todo el copy, sin voseo (verificado con grep);
   - una sola primaria;
   - errores en su campo con `aria-invalid` y `aria-describedby`;
   - avisos con `role="note"` y `role="status"`;
   - aviso al guardar (trazabilidad).
4. Veredicto: OK con ajustes menores.

## COMMITS

| Commit | Propósito |
|---|---|
| `235f65cc` | reserva SDD-0529 (stub, generado por `sdd:next --reserve`) |
| `20e5f8af` | `feat(studio): SDD-0529 — 0480: los roles de cada región en la base y admin_update_operario con la matriz, auditado` |
| `8149a813` | `feat(studio): SDD-0529 — el cajón «Editar» sirve para los de Venezuela: roles de su región, sin almacén y nada en silencio` |
| commit que contiene este documento | spec, índice y handoff |

## PR / BRANCH

- PR draft contra `main` desde `codex/operarios-venezuela-editar`. La URL está en
  la respuesta del Worker al Director.
- Worktree: el de la tabla de arriba.

## PENDIENTES DE ESTA TAREA

1. **Aplicar 0480 a producción** con OK nominal de Sam
   (`docs/runbooks/aplicar-migraciones-prod.md`, `name` exacto
   `0480_operarios_editar_por_region`). Antes, el Director hace las lecturas de
   abajo.
   - MIGRATE-FIRST: se despliega después.
   - No se aplica en la ventana del corte al servidor propio (jueves 2026-10-15
     en la noche).
2. **Smoke de Sam** después del despliegue (guion abajo). Recién entonces la spec
   pasa a `done` y la espera sale del baseline.
3. Contrato SQL en Docker y `pnpm verify`, cuando el Director dé el turno.
4. Si el Director o Sam no confirman alguna decisión de la spec (roles de
   Venezuela; sin motivo al editar), se ajusta en esta misma rama.

## Lecturas de preflight para el Director (producción, READ ONLY, sin filas de negocio)

Si un valor no coincide, **no aplicar**: el preflight abortaría igual. Avisa con
el valor leído.

```sql
-- 1. Lo que se reemplaza y aquello en lo que se apoya.
select p.oid::regprocedure as firma,
       md5(replace(p.prosrc, E'\r\n', E'\n')) as md5,
       p.prosecdef, p.provolatile, p.proconfig, p.proowner::regrole as owner,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as exec_authenticated,
       has_function_privilege('anon', p.oid, 'EXECUTE') as exec_anon
from pg_proc p
where p.oid in (
  to_regprocedure('public.admin_update_operario(uuid,text,text,text,uuid)'),
  to_regprocedure('public.operarios_module_authorized(uuid,text)'),
  to_regprocedure('public.get_user_tenant_id()'),
  to_regprocedure('public.assert_tenant_match(uuid)'),
  to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'));
-- Esperado:
--   admin_update_operario        60bff5cc39274ac889d9cc05d9ebd344 · DEFINER · v · {search_path=public} · authenticated t · anon f
--   operarios_module_authorized  299f276babe7177556c5d2105d45b2c0 · DEFINER · s · {search_path=""}
--   get_user_tenant_id           5ff0c51c26a49419c34abc78f1d95c37 · DEFINER · s · {search_path=""}
--   assert_tenant_match          bf5e898bc3a6209c0a5dc75f89ba9333 · DEFINER · v · {search_path=public}
--   append_audit_event           DEFINER · owner postgres · {search_path=""} · authenticated f

-- 2. Sobrecargas: una sola admin_update_operario y ninguna operario_roles_por_region.
select proname, count(*) from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('admin_update_operario', 'operario_roles_por_region')
group by proname;

-- 3. Las constraints de las que sale la regla (texto exacto, sin "public.").
select conname, convalidated, replace(pg_get_constraintdef(oid), 'public.', '') as def
from pg_constraint
where conrelid = 'public.operario_pins'::regclass and contype = 'c'
order by conname;
-- Esperado: operario_pins_role_check, operario_pins_ve_role_requires_ve_region,
-- operario_pins_cn_requires_warehouse y operario_pins_roles_check, con el texto
-- del preflight de 0480.

-- 4. Región, entidad de auditoría y almacenes (catálogo, sin filas de operarios).
select array_agg(enumlabel order by enumsortorder) from pg_enum
where enumtypid = 'public.operario_region'::regtype;                -- {cn,ve}
select entity_type, status, domain_code, introduced_by_ref
from public.audit_entity_types where entity_type = 'operario';     -- active · access · migration:0475
select attname, atttypid::regtype from pg_attribute
where attrelid = 'public.warehouses_cn'::regclass and attname in ('id', 'active') and not attisdropped;
```

**Opcional, sólo con OK de Sam** porque lee filas de negocio (conteos, sin
nombres). Sirve para saber si algún operario va a necesitar elegir rol o va a
perder un almacén al guardar:

```sql
select region, role, cardinality(roles) > 1 as varios_modos,
       warehouse_id is not null as con_almacen, active, count(*)
from public.operario_pins group by 1, 2, 3, 4, 5 order by 1, 2;
```

## Smoke para Sam (después de aplicar 0480 y desplegar)

Como admin, en `https://dtdcargo.com/studio/operarios`:

1. **Luis Hernández (Venezuela, camionero).** Toca el lápiz de su fila. El cajón
   tiene que mostrar:
   - «Venezuela · despacho» y «Entra por dtdcargo.com/m/ve/login»;
   - **ningún selector de almacén**;
   - el rol «Camionero» elegido, con las opciones Bodeguero, Camionero y
     Supervisor;
   - «Guardar cambios» activo.
2. **Cambia sólo el nombre** (por ejemplo, agrega o corrige un apellido) y
   guarda. Tiene que pasar esto:
   - abajo a la derecha sale «Ficha de … guardada»;
   - el cajón se cierra;
   - la fila muestra el nombre nuevo y el rol sigue en «Camionero».

   Si quieres, vuelve a poner el nombre de antes de la misma forma.
3. **(Opcional, cuando Luis no esté en ruta)** Cambia el rol a Bodeguero. Antes
   de guardar, el cajón dice «Vas a cambiar su rol de Camionero a Bodeguero.».
   Guarda y comprueba:
   - la columna «Rol» dice «Bodeguero»;
   - Luis entra por `/m/ve/login` con su PIN de siempre y llega a la app de
     bodeguero.

   Después devuélvelo a Camionero y comprueba que entra a la de camionero.
   **Falla** si después de guardar sigue entrando como camionero: eso significaría
   que los modos no cambiaron.
4. **Un operario de China (por ejemplo, Wang Hua).** Abre el lápiz. Tiene que
   mostrar:
   - «China · almacén»;
   - su almacén elegido en «Almacén de China»;
   - las opciones Operario y Supervisor.

   Cierra con Cancelar sin guardar.
5. **(Director, con OK de Sam)** La auditoría tiene que tener, por cada guardado
   con cambios, un evento `operario_updated`:
   - en la entidad `operario`, con tu usuario;
   - con `cambios`, que dice qué campos cambiaron;
   - **sin los nombres**.

   Guardar sin cambios no deja evento.

**Es falla** si pasa cualquiera de estas cosas:

- el cajón de Luis pide un almacén;
- guardar sin tocar el rol se lo cambia;
- el selector de un operario de China ofrece Bodeguero o Camionero;
- el cajón dice «No se pudieron cargar los roles de cada región…». Eso
  significaría que la 0480 no está aplicada.

## FUERA DE ALCANCE DETECTADO

- **Desactivar sigue a mano y sin evento.**
  - `admin_set_operario_active` (`0475:847`) conserva `admin|operations` escrito
    a mano y no deja evento.
  - `setOperarioActiveAction` (`actions.ts`) ignora el error de la RPC en
    silencio.
  - Pedir motivo al desactivar exige elegir una lista y cambiar el interruptor
    de la fila. Necesita su propia SDD.
- **El alta repite la lista de roles de China a mano.**
  - `admin_create_operario` (`0475:709`) acepta `('operario', 'supervisor')`.
  - `NewOperarioDrawer` y `createOperarioAction` (`actions.ts:143`) tienen la
    misma lista.
  - Las tres podrían leer `operario_roles_por_region() -> 'cn'`.
  - El alta sigue creando sólo operarios de China.
- **Un operario de Venezuela con almacén lo admite la tabla.** No hay
  `CHECK (region <> 've' or warehouse_id is null)`. 0480 lo exige en la RPC, pero
  `service_role` puede escribirlo. Agregar la constraint exige saber si alguna
  fila la viola, lo que es una lectura de producción con OK.
- **Terminología mezclada.** «Warehouse» en la tabla (`OperariosClient.tsx:67`)
  y en el alta (`NewOperarioDrawer.tsx:132`); «Almacén de China» en el cajón de
  editar.
- **El cajón no lee `roles[]`.** Un operario con varios modos (sólo por SQL) ve
  todos los roles de su región, y la base rechaza los que no son suyos con su
  mensaje.
- **La fila editada no se resalta** (`useRowHighlight` no está en el módulo). El
  rastro es el aviso al guardar.
- `lib/studio/operario-types.ts:22` todavía dice que en Venezuela el almacén es
  «opcional».

## Impacto documental

- Documentos canónicos actualizados en esta rama:
  - la spec 0529;
  - el índice de specs (regenerado; los huecos 0522-0528 son reservas de otras
    sesiones que esta rama no ve);
  - este handoff;
  - el comentario de `app/studio/(app)/operarios/layout.tsx`.
- `app/studio/CLAUDE.md` no cambia: no hay primitiva nueva.
- `docs/architecture/module-sdd-map.md` (fila de Operarios) se actualiza al
  cerrar la SDD, como en 0513.
- Graphify, Archify y Obsidian: no se corrieron en el worktree (no hay
  `graphify-out`). Quedan como pendientes globales del Director, que publica
  desde main después de integrar.

## HANDOFF AL DIRECTOR

1. Revisar la PR draft.
2. Confirmar o devolver las decisiones 1 (roles de Venezuela) y 3 (sin motivo al
   editar), en § Decisiones de la spec.
3. Hacer las lecturas de preflight y pedir a Sam el OK nominal de
   `0480_operarios_editar_por_region`.
4. Aplicar la migración, desplegar enseguida (MIGRATE-FIRST) y pasar el smoke a
   Sam.
5. Dar el turno para `pnpm verify` y el contrato en Docker si se quieren antes de
   integrar.

Merges congelados hasta después del corte de Vercel al VPS. Ownership: el claim
se libera al terminar la escritura, después de publicar la rama.
