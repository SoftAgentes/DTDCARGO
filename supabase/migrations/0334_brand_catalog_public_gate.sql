-- ============================================================================
-- 0334 · SDD-0238 — Catálogo de marca + acceso público con código
-- ============================================================================
-- HOY la marca vive en tres sitios desconectados y NINGUNO se le puede pasar a
-- un diseñador externo: `/marca/brand-book` y `/interno/marca` exigen sesión del
-- ERP, y `/studio/marketing/hub` tiene 4 PNG hardcodeados en el .tsx. El
-- catálogo descargable completo son 6 archivos, todos en git.
--
-- Esta migración mueve el catálogo a datos + Storage para que Marketing suba un
-- .AI de 80 MB sin un deploy, y abre `/marca` a externos detrás de un código.
--
-- CUATRO TABLAS Y UN BUCKET:
--   · brand_sections       — las secciones del brand book (datos, no un array
--                            en el código: agregar "Iconografía" no es un deploy)
--   · brand_assets         — cada archivo descargable, apuntando a Storage
--   · brand_access         — el código de acceso (HASH, nunca en claro)
--   · brand_access_attempts— intentos, para el bloqueo escalonado
--   · bucket `brand-assets`— privado; todo sale por signed URL de 60 s
--
-- EL BLOQUEO ESCALONADO (founder, 01-ago-2026): 3 intentos fallidos → 5 minutos
-- de espera. Si tras esos 5 minutos falla 3 veces más → 1 hora. De ahí en
-- adelante sigue en 1 hora. Un código de 4 dígitos son 10.000 combinaciones; sin
-- esto se agota en minutos. Con esto, 3 intentos por hora = ~380 años.
--
-- NO SE GUARDA LA IP. `attempt_key` es un SHA-256 del origen, igual que
-- `operario_pin_attempts` (SDD-0235, migr 0325): sirve para contar intentos del
-- mismo visitante sin acumular un registro de direcciones IP — que es dato
-- personal y nos obligaría a política de retención y aviso.
--
-- FAIL-CLOSED. A diferencia del throttle de `/verificar` (migr 0169, fail-open a
-- propósito para no romper el escaneo de un QR), acá un fallo del anti-abuso NO
-- puede abrir la puerta: la RPC es la única vía y decide dentro de la misma
-- transacción que compara el hash.
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ============================================================================

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ─────────────────────────────────────────────────────────────
-- 1. brand_sections — las secciones navegables del brand book
-- ─────────────────────────────────────────────────────────────

create table if not exists public.brand_sections (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  slug       text not null,                    -- ancla en la URL: /marca#logos
  title      text not null,                    -- "Logos"
  intro      text,                             -- párrafo que abre la sección
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_sections_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint brand_sections_title_nonempty check (length(trim(title)) > 0),
  constraint brand_sections_slug_uniq unique (tenant_id, slug),
  -- Habilita el FK compuesto de brand_assets: sin esto un asset podría colgar
  -- de una sección de OTRO tenant.
  constraint brand_sections_id_tenant_uniq unique (id, tenant_id)
);

comment on table public.brand_sections is
  'SDD-0238: secciones del brand book público (/marca). Son DATOS, no un array en el código, para que Marketing agregue una sección sin desplegar.';

create index if not exists brand_sections_tenant_order_idx
  on public.brand_sections (tenant_id, sort_order)
  where is_active;

-- ─────────────────────────────────────────────────────────────
-- 2. brand_assets — cada archivo descargable
-- ─────────────────────────────────────────────────────────────

create table if not exists public.brand_assets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  section_id   uuid not null,
  title        text not null,                  -- "Isólogo Primary"
  subtitle     text,                           -- "PNG · 741×764"
  kind         text not null default 'documento',

  -- Ruta dentro del bucket `brand-assets`: {tenant_id}/marca/{seccion}/{archivo}
  -- (convención de adjuntos de AGENTS.md).
  storage_path text not null,
  mime         text,
  bytes        bigint,

  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  deleted_at   timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint brand_assets_title_nonempty check (length(trim(title)) > 0),
  constraint brand_assets_path_nonempty check (length(trim(storage_path)) > 0),
  constraint brand_assets_kind_valid check (kind in (
    'logo', 'tipografia', 'fuente', 'plantilla', 'fondo',
    'icono', 'foto', 'documento', 'color'
  )),
  constraint brand_assets_section_fk
    foreign key (section_id, tenant_id)
    references public.brand_sections (id, tenant_id) on delete cascade
);

comment on table public.brand_assets is
  'SDD-0238: archivos descargables del brand book. El binario vive en el bucket privado `brand-assets`; acá sólo los metadatos. Nunca se sirve el objeto directo: siempre signed URL de 60 s por /api/marca/download.';

comment on column public.brand_assets.storage_path is
  'Clave exacta dentro del bucket brand-assets. NO es una URL: la firma se genera al vuelo por descarga.';

create index if not exists brand_assets_section_order_idx
  on public.brand_assets (tenant_id, section_id, sort_order)
  where is_active and deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- 3. brand_access — el código (hash) y la duración de la sesión
-- ─────────────────────────────────────────────────────────────

create table if not exists public.brand_access (
  tenant_id    uuid primary key references public.tenants(id) on delete cascade,
  -- bcrypt vía extensions.crypt(). NULL = acceso externo cerrado (sólo entra el
  -- equipo con sesión del ERP). Es el estado inicial a propósito: nadie hereda
  -- un código por default.
  code_hash    text,
  -- Días que dura la cookie del visitante que acertó el código.
  session_days integer not null default 30,
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now(),
  constraint brand_access_session_days_range check (session_days between 1 and 365)
);

comment on table public.brand_access is
  'SDD-0238: código de acceso a /marca. Sólo el HASH — el código en claro no se guarda ni se puede recuperar; si se olvida, se pone uno nuevo. code_hash NULL = cerrado a externos.';

-- ─────────────────────────────────────────────────────────────
-- 4. brand_access_attempts — el bloqueo escalonado
-- ─────────────────────────────────────────────────────────────

create table if not exists public.brand_access_attempts (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  -- SHA-256 hex del origen. NO es la IP: no guardamos direcciones.
  attempt_key text not null check (attempt_key ~ '^[0-9a-f]{64}$'),
  succeeded   boolean not null,
  created_at  timestamptz not null default now()
);

comment on table public.brand_access_attempts is
  'SDD-0238: intentos de código de /marca para el bloqueo escalonado (3 → 5 min → 3 → 1 h). attempt_key es un SHA-256 del origen, NO la IP: contar sin acumular datos personales. Privilegiada: RLS sin policy, sólo service_role.';

create index if not exists brand_access_attempts_window_idx
  on public.brand_access_attempts (tenant_id, attempt_key, created_at desc)
  where succeeded = false;

-- ─────────────────────────────────────────────────────────────
-- 5. GRANTs — antes que las policies (el GRANT es el portero real)
-- ─────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.brand_sections to authenticated;
grant all on public.brand_sections to service_role;

grant select, insert, update, delete on public.brand_assets to authenticated;
grant all on public.brand_assets to service_role;

-- brand_access: `authenticated` lee (para que el ERP muestre "hay código puesto"
-- y desde cuándo) pero NUNCA escribe por PostgREST — el código se cambia por
-- RPC, que valida rol admin. El hash igual es bcrypt, no reversible.
grant select on public.brand_access to authenticated;
grant all on public.brand_access to service_role;

-- Los intentos son privilegiados: ni leer.
revoke all on table public.brand_access_attempts from public, anon, authenticated;
grant select, insert, delete on table public.brand_access_attempts to service_role;
grant usage, select on sequence public.brand_access_attempts_id_seq to service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS — leer: cualquiera del tenant · escribir: sólo admin
-- ─────────────────────────────────────────────────────────────

alter table public.brand_sections        enable row level security;
alter table public.brand_assets          enable row level security;
alter table public.brand_access          enable row level security;
alter table public.brand_access_attempts enable row level security;
-- brand_access_attempts queda SIN policy a propósito → cero acceso para
-- anon/authenticated. Sólo service_role (que bypassa RLS) la toca, y sólo
-- desde la RPC de abajo.

create policy "brand_sections read by tenant"
  on public.brand_sections for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "brand_sections write by admin"
  on public.brand_sections for all
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = brand_sections.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = brand_sections.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "brand_sections service_role all"
  on public.brand_sections for all
  to service_role
  using (true) with check (true);

create policy "brand_assets read by tenant"
  on public.brand_assets for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "brand_assets write by admin"
  on public.brand_assets for all
  to authenticated
  using (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = brand_assets.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  )
  with check (
    tenant_id = public.get_user_tenant_id()
    and exists (
      select 1 from public.user_tenants ut
      where ut.user_id = (select auth.uid())
        and ut.tenant_id = brand_assets.tenant_id
        and ut.role = 'admin'
        and ut.disabled_at is null
    )
  );

create policy "brand_assets service_role all"
  on public.brand_assets for all
  to service_role
  using (true) with check (true);

-- brand_access: lectura de metadatos por el tenant (nunca hay dato secreto útil
-- acá — code_hash es bcrypt). Escritura SOLO por RPC/service_role.
create policy "brand_access read by tenant"
  on public.brand_access for select
  to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "brand_access service_role all"
  on public.brand_access for all
  to service_role
  using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- 7. touch updated_at
-- ─────────────────────────────────────────────────────────────

drop trigger if exists brand_sections_touch on public.brand_sections;
create trigger brand_sections_touch
  before update on public.brand_sections
  for each row execute function public.touch_updated_at();

drop trigger if exists brand_assets_touch on public.brand_assets;
create trigger brand_assets_touch
  before update on public.brand_assets
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 8. Bucket privado `brand-assets`
-- ─────────────────────────────────────────────────────────────
-- 200 MB: un .AI o un .fig de marca pesa de sobra más que los 25 MB del bucket
-- de adjuntos del ERP. La lista de MIME es amplia a propósito — el objetivo del
-- founder es que el diseñador NO tenga que pedir nada, sea cual sea su
-- herramienta. `application/octet-stream` cubre .ai/.fig/.sketch, que no tienen
-- MIME propio registrado.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  false,
  200 * 1024 * 1024,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
    'image/vnd.adobe.photoshop',
    'application/pdf', 'application/postscript',
    'application/zip', 'application/x-zip-compressed',
    'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
    'text/html', 'text/plain', 'text/csv',
    'video/mp4',
    'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Sin políticas para `authenticated`: el navegador nunca habla con Storage
-- directo. Sube y baja pasan por route handlers que firman una clave exacta.
create policy "brand-assets service role all"
  on storage.objects for all to service_role
  using (bucket_id = 'brand-assets')
  with check (bucket_id = 'brand-assets');

-- ─────────────────────────────────────────────────────────────
-- 9. RPC de verificación del código + bloqueo escalonado
-- ─────────────────────────────────────────────────────────────
-- Devuelve SIEMPRE la misma forma; nunca lanza excepción por código errado (un
-- error distinguible sería un oráculo). `ok=false` con `locked_until` no nulo
-- significa "estás bloqueado", y el llamador muestra cuánto falta.

create or replace function public.verify_brand_access_code(
  p_tenant_id   uuid,
  p_code        text,
  p_attempt_key text
)
returns table (
  ok            boolean,
  locked_until  timestamptz,
  attempts_left integer,
  session_days  integer
)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_hash        text;
  v_days        integer;
  v_fails       integer;
  v_last_fail   timestamptz;
  v_tier        integer;
  v_lock        interval;
  v_locked_until timestamptz;
  v_match       boolean;
begin
  -- Forma de entrada inválida → negativo silencioso, sin tocar el contador.
  if p_tenant_id is null
     or p_attempt_key is null
     or p_attempt_key !~ '^[0-9a-f]{64}$' then
    return query select false, null::timestamptz, 0, 0;
    return;
  end if;

  select ba.code_hash, ba.session_days
    into v_hash, v_days
  from public.brand_access ba
  where ba.tenant_id = p_tenant_id;

  v_days := coalesce(v_days, 30);

  -- ¿Está bloqueado? Se cuentan los fallos POSTERIORES al último acierto: al
  -- acertar se borran los intentos de esa huella, así que basta contar filas.
  select count(*), max(a.created_at)
    into v_fails, v_last_fail
  from public.brand_access_attempts a
  where a.tenant_id = p_tenant_id
    and a.attempt_key = p_attempt_key
    and a.succeeded = false;

  -- El bloqueo se dispara SÓLO cuando el último fallo cerró un tramo de 3
  -- (3, 6, 9…). Si se evaluara con `v_fails >= 3` a secas, del 3er fallo en
  -- adelante CADA intento posterior volvería a bloquear 5 minutos y el visitante
  -- tendría un intento por ventana, no tres — que no es lo que se pidió.
  -- Vencida la espera, el siguiente fallo (4) ya no es múltiplo de 3 y el tramo
  -- nuevo corre hasta el 6, que escala a 1 hora.
  if v_fails > 0 and v_fails % 3 = 0 then
    v_tier := v_fails / 3;   -- 3 → 1 (5 min) · 6, 9, … → 2+ (1 hora)
    v_lock := case when v_tier = 1 then interval '5 minutes' else interval '1 hour' end;
    if v_last_fail + v_lock > now() then
      -- Bloqueado: ni siquiera se compara el hash (no gasta bcrypt ni deja
      -- que el reloj filtre información).
      return query select false, (v_last_fail + v_lock)::timestamptz, 0, v_days;
      return;
    end if;
  end if;

  -- Acceso externo cerrado (nadie puso código todavía).
  if v_hash is null then
    return query select false, null::timestamptz, 0, v_days;
    return;
  end if;

  v_match := (p_code is not null and length(p_code) > 0
              and v_hash = extensions.crypt(p_code, v_hash));

  if v_match then
    -- Acierto: se limpia el historial de esa huella (vuelve a 3 intentos).
    delete from public.brand_access_attempts a
     where a.tenant_id = p_tenant_id and a.attempt_key = p_attempt_key;
    return query select true, null::timestamptz, 3, v_days;
    return;
  end if;

  insert into public.brand_access_attempts (tenant_id, attempt_key, succeeded)
  values (p_tenant_id, p_attempt_key, false);
  v_fails := v_fails + 1;

  -- ¿Este fallo cierra un tramo de 3? Sólo entonces empieza a correr la espera.
  v_tier := v_fails / 3;
  if v_fails % 3 = 0 then
    v_lock := case when v_tier = 1 then interval '5 minutes' else interval '1 hour' end;
    v_locked_until := now() + v_lock;
  end if;

  return query select
    false,
    v_locked_until,
    (3 - (v_fails % 3))::integer,
    v_days;
end;
$function$;

revoke all on function public.verify_brand_access_code(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.verify_brand_access_code(uuid, text, text)
  to service_role;

comment on function public.verify_brand_access_code(uuid, text, text) is
  'SDD-0238: valida el código de /marca con bloqueo escalonado (3 fallos → 5 min · 3 más → 1 h). Server-only: sólo service_role. La huella del origen es SHA-256, nunca la IP.';

-- ─────────────────────────────────────────────────────────────
-- 10. RPC para PONER el código desde el ERP (admin del tenant)
-- ─────────────────────────────────────────────────────────────
-- Existe como RPC y no como UPDATE por PostgREST para que el hash se calcule
-- SIEMPRE en el servidor: el código en claro no viaja a la DB en un update que
-- alguien pueda replicar mal desde otro sitio, y nunca se persiste sin hashear.

create or replace function public.set_brand_access_code(
  p_code         text,
  p_session_days integer default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_tenant uuid;
begin
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null then
    raise exception 'sin tenant';
  end if;

  if not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = (select auth.uid())
      and ut.tenant_id = v_tenant
      and ut.role = 'admin'
      and ut.disabled_at is null
  ) then
    raise exception 'solo admin';
  end if;

  -- NULL o vacío = cerrar el acceso externo (deja de entrar cualquiera con el
  -- código viejo). 4 a 6 dígitos, nada más.
  if p_code is not null and length(trim(p_code)) > 0 and trim(p_code) !~ '^\d{4,6}$' then
    raise exception 'codigo invalido';
  end if;

  insert into public.brand_access (tenant_id, code_hash, session_days, updated_by, updated_at)
  values (
    v_tenant,
    case
      when p_code is null or length(trim(p_code)) = 0 then null
      else extensions.crypt(trim(p_code), extensions.gen_salt('bf'))
    end,
    coalesce(p_session_days, 30),
    (select auth.uid()),
    now()
  )
  on conflict (tenant_id) do update set
    code_hash    = excluded.code_hash,
    session_days = excluded.session_days,
    updated_by   = excluded.updated_by,
    updated_at   = now();

  -- Código nuevo = borrón y cuenta nueva: nadie arrastra un bloqueo del anterior.
  delete from public.brand_access_attempts a where a.tenant_id = v_tenant;
end;
$function$;

revoke all on function public.set_brand_access_code(text, integer)
  from public, anon;
grant execute on function public.set_brand_access_code(text, integer) to authenticated;

comment on function public.set_brand_access_code(text, integer) is
  'SDD-0238: pone (o quita, con NULL) el código de acceso a /marca. Sólo admin del tenant. Hashea con bcrypt en el servidor y limpia los bloqueos vigentes.';

-- ─────────────────────────────────────────────────────────────
-- 11. Seed — las secciones y la fila de acceso, por tenant
-- ─────────────────────────────────────────────────────────────
-- Sin código puesto (code_hash NULL): el acceso externo nace CERRADO y sólo lo
-- abre el founder desde el ERP. Que un código por default llegara a producción
-- sería peor que no tener ninguno.

insert into public.brand_access (tenant_id, code_hash, session_days)
select t.id, null, 30 from public.tenants t
on conflict (tenant_id) do nothing;

insert into public.brand_sections (tenant_id, slug, title, intro, sort_order)
select t.id, s.slug, s.title, s.intro, s.sort_order
from public.tenants t
cross join (values
  ('brand-book', 'Brand Book',  'El documento maestro de la identidad. Se lee acá o se descarga completo.', 10),
  ('logos',      'Logos',       'Las variantes oficiales del isólogo. Elige la que corresponde al fondo — nunca recolorees.', 20),
  ('color',      'Color',       'La paleta con sus tokens y sus usos. Toca un color para copiar el hex.', 30),
  ('tipografia', 'Tipografía',  'Las familias de la marca y los archivos de fuente para instalar.', 40),
  ('plantillas', 'Plantillas',  'Piezas listas para editar: redes, presentaciones, papelería.', 50),
  ('fondos',     'Fondos y portadas', 'Portadas y fondos por red social, en sus medidas correctas.', 60),
  ('iconos',     'Iconografía', 'El set de íconos de la marca.', 70),
  ('fotos',      'Fotografía',  'Banco de imágenes propias, con su criterio de uso.', 80)
) as s(slug, title, intro, sort_order)
on conflict (tenant_id, slug) do nothing;
