-- 0294 · SDD-0184 · Catálogo de contenedores: activos y capacidad ÚTIL
--
-- TRES COSAS, UNA SOLA INTENCIÓN: dejar el catálogo diciendo la verdad.
--
-- 1. CAPACIDAD ÚTIL, NO GEOMÉTRICA. El seed de 0096 sembró los tres tipos con su
--    volumen GEOMÉTRICO interno (largo × ancho × alto de pared a pared), no con lo
--    que de verdad se puede cargar. Nadie llena un contenedor hasta el techo y las
--    esquinas.
--
--      tipo    geométrico   sembrado   útil
--      20GP        33,2 m³      33  →   30
--      40GP        67,7 m³      67  →   60
--      40HC        76,2 m³      76  →   68
--
--    El 68 del 40'HC lo fijó el founder (2026-07-30) y es el mismo número que usa
--    a mano en `build_consolidado.py` ("% llenado (de 68)"). De ahí sale el factor
--    práctico 68 / 76,2 = 0,8923, que aplicado a los otros dos da 30 y 60.
--    Si el founder mide otro número para el 20', se cambia acá y en
--    `lib/studio/naviera/types.ts` — van juntos, ver punto 4.
--
-- 2. TECHO REAL MEDIDO (`cbm_alert_ceiling`). Distinto de la capacidad: es lo que
--    de verdad entró en un contenedor propio. Para el 40'HC son 66,4 CBM. Pasarlo
--    AVISA, no bloquea (mismo criterio advisory que `evaluateCapacity`). Los otros
--    tipos quedan en null: no hay medición propia y no se inventa.
--
-- 3. SOLO 20' Y 40'HC ACTIVOS (`active`). Decisión del founder: son los dos que se
--    usan. El resto queda apagado pero configurable — no se borra, para no perder
--    el catálogo ni romper consolidaciones históricas que lo referencien.
--
-- 4. `zone_layout` SIN ALTURA. SDD-0155 dejó el modelo por lotes en una sola capa
--    (el operario solo elige izquierda/centro/derecha), pero 0241 había sembrado
--    ny=2. Planificar sobre niveles que la interfaz no muestra es ruido. Queda:
--      40' → {nx:3, ny:1, nz:3} = 9 áreas   (Fondo/Medio/Puerta × Izq/Centro/Der)
--      20' → {nx:2, ny:1, nz:3} = 6 áreas   (Fondo/Puerta × Izq/Centro/Der)
--    El CHECK de 0241 ya admite ny=1, no hace falta tocarlo.
--
-- ⚠️ ACOPLE OBLIGATORIO CON EL CÓDIGO: `containerStats` y `evaluateCapacity`
--    (lib/studio/naviera/types.ts) leen la constante `CONTAINER_TYPES` en TS,
--    NUNCA la base. El único que sí lee la base es `containerCapacityCbm`
--    (lib/studio/inventory/queries.ts) del WMS. Si esta migración se aplica sin el
--    cambio de la constante, el WMS diría 68 y Naviera 76 en la misma sesión —
--    peor que la contradicción que se está arreglando. Migración y constante van
--    en EL MISMO COMMIT.
--
-- ⚠️ CAMBIO DE LECTURA ESPERADO EN PANTALLAS VIVAS: al aplicar esto, un contenedor
--    con 70 CBM pasa de leer 92% a leer 103% y dispara el aviso de sobre-capacidad.
--    No es un bug: es que antes mentía hacia abajo.
--
-- Aditiva. Sin RLS nueva (container_types ya la tiene de 0096). Sin funciones.
--
-- ⚠️ NO aplicar a prod desde acá (lo hace el founder, runbook
--    docs/runbooks/aplicar-migraciones-prod.md).

-- ── 1. Columnas nuevas ───────────────────────────────────────

-- `active` arranca en false para TODOS y se prende explícitamente abajo: si mañana
-- alguien agrega un tipo nuevo al catálogo, nace apagado y hay que decidirlo.
alter table public.container_types
  add column if not exists active boolean not null default false;

alter table public.container_types
  add column if not exists cbm_alert_ceiling numeric(10,3);

alter table public.container_types
  drop constraint if exists container_types_alert_ceiling_range;
alter table public.container_types
  add constraint container_types_alert_ceiling_range check (
    cbm_alert_ceiling is null
    or (cbm_alert_ceiling > 0 and cbm_alert_ceiling <= cbm_capacity)
  );

comment on column public.container_types.active is
  'SDD-0184: si el tipo se ofrece al operar. Default false: un tipo nuevo nace apagado. Hoy solo 20GP y 40HC en true (decisión del founder 2026-07-30).';
comment on column public.container_types.cbm_alert_ceiling is
  'SDD-0184: techo REAL medido en un contenedor propio, en CBM. Pasarlo AVISA, no bloquea. Distinto de cbm_capacity (que es la capacidad útil de planificación). null = sin medición propia.';
comment on column public.container_types.cbm_capacity is
  'SDD-0184: capacidad ÚTIL en CBM — lo que de verdad se carga, NO el volumen geométrico interno. Para el 40HC son 68 (el geométrico es 76,2). Espejo de CONTAINER_TYPES en lib/studio/naviera/types.ts: los dos se cambian juntos.';

-- ── 2. Capacidad útil + techo real ───────────────────────────
-- Se corrige solo si el valor sigue siendo el geométrico sembrado por 0096; si
-- alguien ya lo ajustó a mano, se respeta (idempotente y no destructivo).

update public.container_types
   set cbm_capacity = 68,
       cbm_alert_ceiling = 66.4
 where code = '40HC' and cbm_capacity = 76;

update public.container_types
   set cbm_capacity = 60
 where code = '40GP' and cbm_capacity = 67;

update public.container_types
   set cbm_capacity = 30
 where code = '20GP' and cbm_capacity = 33;

-- ── 3. Activos ───────────────────────────────────────────────

update public.container_types
   set active = true
 where code in ('20GP', '40HC');

-- ── 4. Áreas sin altura (SDD-0155) ───────────────────────────

update public.container_types
   set zone_layout = '{"nx": 3, "ny": 1, "nz": 3}'::jsonb
 where code in ('40GP', '40HC');

update public.container_types
   set zone_layout = '{"nx": 2, "ny": 1, "nz": 3}'::jsonb
 where code = '20GP';

comment on column public.container_types.zone_layout is
  'SDD-0152 → SDD-0184: grilla de áreas {nx,ny,nz}. nx=largo (fondo→puerta), nz=ancho (izq→der), ny=altura. Desde SDD-0155 el modelo por lotes NO usa altura: ny=1. 40'' → 3×1×3 = 9 áreas · 20'' → 2×1×3 = 6 áreas.';

-- ── 5. Índice para el filtro de activos ──────────────────────
-- El listado del operario y los selects filtran por (tenant_id, active).

create index if not exists container_types_tenant_active_idx
  on public.container_types (tenant_id, active, display_order);

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0297_container_types_activos_y_capacidad_util.sql
