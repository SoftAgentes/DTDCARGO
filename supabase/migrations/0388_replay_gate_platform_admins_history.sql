-- ─────────────────────────────────────────────────────────────
-- 0388 · SDD-0277 · el replay de un branch efímero deja de morir en la 0355
--
-- SÓLO TOCA `supabase_migrations.schema_migrations`. Cero DDL y cero DML de
-- negocio: no crea, no borra ni modifica ninguna tabla, función o policy del
-- producto. El paso `check-schema-rebuild` lo verifica por HUELLA del schema,
-- no leyendo este texto (ver LEDGER_ONLY en scripts/check-schema-rebuild.mjs).
--
-- QUÉ ESTABA ROTO — medido el 2026-08-21 sobre un branch real
-- (project_ref fmltjdwwsyxavswsgcut, ya destruido): el replay aplicaba hasta
-- `0354_studio_access_tokens` (version 20260807163407) y moría en la 0355, con
-- 30 de 384 migraciones sin aplicar y status=MIGRATIONS_FAILED. Ojo con el
-- campo que se mira: `preview_project_status` decía ACTIVE_HEALTHY igual.
-- Consecuencia: los 18 tests e2e Tier 3 salen `skipped` en cada corrida del
-- gate — cobertura apagada del Studio, no cobertura ausente.
--
-- POR QUÉ MORÍA
--
--   · La 0058 (`platform_admins`) siembra un platform admin con un uuid fijo.
--   · La 0273 —reparada a su vez por la 0282— BORRÓ ese bootstrap del PAYLOAD
--     DEL LEDGER para que el replay no reventara con 23503 contra un
--     `auth.users` vacío. Su reemplazo lo dice con todas las letras: "el
--     bootstrap de datos se omite intencionalmente".
--   · Un branch replaya el LEDGER, no los archivos del repo. Así que en un
--     branch `platform_admins` queda VACÍA — que es justo lo que se buscaba.
--   · Pero la 0355 abre con un preflight que EXIGE que no esté vacía y aborta.
--     La 0356 trae el mismo gate: arreglar sólo la 0355 movería la muerte una
--     migración más adelante.
--
-- POR QUÉ EL GATE DE RECONSTRUCCIÓN NO PODÍA CAZARLO
--   `check-schema-rebuild` corre los ARCHIVOS del repo sobre un Postgres limpio,
--   y ahí `supabase/tests/_supabase-platform-stubs.sql` siembra el uuid
--   `83c98d22-…` en `auth.users`: el bootstrap de la 0058 entra, la tabla NO
--   queda vacía y el preflight de la 0355 pasa. Los dos caminos ejecutan SQL
--   DISTINTO para la misma migración. Por eso el arreglo va en el ledger y no
--   en los archivos: cambiar la 0355 en el repo no cambiaría lo que replaya un
--   branch, y encima reescribiría una migración ya aplicada.
--
-- QUÉ HACE: en esas dos entradas del ledger baja el `raise exception` del gate
-- a `raise notice`. Nada más del payload se toca. El resto de ambas migraciones
-- es portable con la tabla vacía — lo único que asumía filas era ese preflight
-- (el bloque del segundo juego de llaves de la 0355 ya sale por `return` con un
-- notice cuando el correo no existe en el entorno).
--
-- QUÉ NO HACE, A PROPÓSITO: no siembra un platform admin. En un branch no hay a
-- quién dárselas (`auth.users` nace vacío) y `platform_admins` sólo la escribe
-- `service_role`. La consecuencia es acotada y conocida: en un entorno efímero
-- nadie es superadmin, así que feature flags, Legal y Rendiciones quedan sin
-- escritor mientras el seed no lo provea. Ninguno de los 4 specs Tier 3
-- (comments-lifecycle, gastos-expense-void, global-search,
-- nomina-settlement-void) toca esas superficies — verificado por grep.
--
-- 🔴 EL ANCLA ES CORTA Y ASCII PORQUE EL ARCHIVO DEL REPO **NO** ES LO QUE HAY
-- EN PROD. Medido el 2026-08-21 contra el ledger real: la entrada
-- `20260807192547 · 0355_superadmin_llaves_del_sistema` guarda el mensaje
-- recortado —`'0355 abortado: platform_admins está VACÍA.'`, 8275 caracteres en
-- total— mientras el archivo del repo trae la versión larga ("Aplicarla dejaría
-- las llaves sin dueño…"). Anclar en la frase completa del archivo habría hecho
-- abortar esta migración por "0 entradas": el repo dice qué DEBERÍA estar
-- aplicado, no qué HAY. Por eso el ancla es el prefijo que sobrevive a las dos
-- redacciones —`raise exception '0355 abortado:`— y encima es ASCII puro, así
-- que ningún acento ni em-dash puede desalinearla. Verificado sobre las 395
-- entradas del ledger: cada ancla aparece en EXACTAMENTE 1.
--
-- POR QUÉ NO USA ANCLAS md5 COMO LAS 0271-0288: esas anclas obligaron a reparar
-- cada reparación (0273→0282, 0280-0286→0287→0288), porque el payload de la
-- propia reparación es lo que un replay vuelve a ejecutar. Ésta se autolocaliza
-- y es idempotente por construcción: acepta las dos formas —sin parchear y ya
-- parcheada—, el UPDATE queda no-op en la segunda y la postcondición se cumple
-- igual. Un replay futuro la corre de nuevo sin drama y sin necesitar una 0389
-- que la repare. El anti-drift no se pierde: se prueba por IDA Y VUELTA
-- (`replace(después, nuevo, viejo) = antes`) que nada fuera del gate cambió.
-- ─────────────────────────────────────────────────────────────

do $m0388$
declare
  -- Marca de esta migración. Su propio payload la contiene, así que sirve para
  -- excluirse a sí misma de las búsquedas por contenido: sin esto, los dos
  -- literales de abajo harían que 0388 se encontrara a sí misma en el ledger.
  v_marca   constant text := '0388-ledger-gate-marca';
  r         record;
  v_sin     int;
  v_con     int;
  v_filas   int;
  v_id      text;
  v_antes   text[];
  v_despues text[];
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception '0388 requiere supabase_migrations.schema_migrations — ledger ausente';
  end if;

  for r in
    select *
    from (values
      ('0355', $viejo355$raise exception '0355 abortado:$viejo355$,
                $nuevo355$raise notice '0355 abortado:$nuevo355$),
      ('0356', $viejo356$raise exception '0356 abortado:$viejo356$,
                $nuevo356$raise notice '0356 abortado:$nuevo356$)
    ) as t(mig, viejo, nuevo)
  loop
    -- ── Preflight: exactamente UNA entrada, en una de las dos formas ──
    select count(*) into v_sin
    from supabase_migrations.schema_migrations m
    where not exists (select 1 from unnest(m.statements) s where strpos(s, v_marca) > 0)
      and exists (select 1 from unnest(m.statements) s where strpos(s, r.viejo) > 0);

    select count(*) into v_con
    from supabase_migrations.schema_migrations m
    where not exists (select 1 from unnest(m.statements) s where strpos(s, v_marca) > 0)
      and exists (select 1 from unnest(m.statements) s where strpos(s, r.nuevo) > 0);

    if v_sin + v_con <> 1 then
      raise exception
        '0388 abortada: en supabase_migrations se esperaba EXACTAMENTE 1 entrada con el gate de la % (sin parchear=%, ya parcheadas=%)',
        r.mig, v_sin, v_con;
    end if;

    if v_sin = 1 then
      select m.version, m.statements into v_id, v_antes
      from supabase_migrations.schema_migrations m
      where not exists (select 1 from unnest(m.statements) s where strpos(s, v_marca) > 0)
        and exists (select 1 from unnest(m.statements) s where strpos(s, r.viejo) > 0);

      update supabase_migrations.schema_migrations m
      set statements = (
        select array_agg(replace(s, r.viejo, r.nuevo) order by ord)
        from unnest(m.statements) with ordinality as u(s, ord)
      )
      where m.version = v_id;

      get diagnostics v_filas = row_count;
      if v_filas <> 1 then
        raise exception
          '0388 abortada: el UPDATE de la % tocó % filas de supabase_migrations (se esperaba 1)',
          r.mig, v_filas;
      end if;

      select m.statements into v_despues
      from supabase_migrations.schema_migrations m
      where m.version = v_id;

      -- Ida y vuelta: deshacer el reemplazo tiene que reconstruir el original
      -- byte a byte. Si algo más se movió, esto no cierra.
      if (
        select array_agg(replace(s, r.nuevo, r.viejo) order by ord)
        from unnest(v_despues) with ordinality as u(s, ord)
      ) is distinct from v_antes then
        raise exception
          '0388 abortada: el payload de la % cambió FUERA del gate (la ida y vuelta no reconstruye el original)',
          r.mig;
      end if;

      raise notice '0388: gate de la % bajado a notice en el ledger (version %)', r.mig, v_id;
    else
      raise notice '0388: el gate de la % ya estaba en notice — no-op (replay)', r.mig;
    end if;

    -- ── Postcondición ──
    select count(*) into v_sin
    from supabase_migrations.schema_migrations m
    where not exists (select 1 from unnest(m.statements) s where strpos(s, v_marca) > 0)
      and exists (select 1 from unnest(m.statements) s where strpos(s, r.viejo) > 0);

    select count(*) into v_con
    from supabase_migrations.schema_migrations m
    where not exists (select 1 from unnest(m.statements) s where strpos(s, v_marca) > 0)
      and exists (select 1 from unnest(m.statements) s where strpos(s, r.nuevo) > 0);

    if v_sin <> 0 or v_con <> 1 then
      raise exception
        '0388: postcondición fallida para la % en supabase_migrations (sin parchear=%, ya parcheadas=%)',
        r.mig, v_sin, v_con;
    end if;
  end loop;
end
$m0388$;
