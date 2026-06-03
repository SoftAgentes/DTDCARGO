-- ─────────────────────────────────────────────────────────────
-- SDD-0046 · Slice A (foundation): Verificación de identidad de clientes.
--
-- Desde el registro self-service (SDD-0042 Fase 6) los clientes se dan de alta
-- solos y quedan activos al instante con foto de cédula/RIF. El equipo necesita
-- poder VERIFICAR la identidad —documento ↔ nombre contra el registro oficial
-- (CNE para cédula de persona, SENIAT para RIF de empresa)— SIN bloquear el
-- acceso. El resultado es ADVISORY: un badge "corresponde / no corresponde" que
-- nunca auto-rechaza al cliente.
--
-- Esta migración (Slice A) solo agrega COLUMNAS a public.clients. Es:
--   · ADITIVA y NULLABLE (salvo registration_channel, que tiene default 'admin'),
--   · SIN tabla nueva (los campos doc_verify_* en clients alcanzan para V1),
--   · SIN tocar la RLS existente — las columnas nuevas heredan la RLS de `clients`
--     (multi-tenant por tenant_id ya vigente; nada que policy-ar de nuevo).
--
-- Campos genéricos `doc_verify_*` (fuente 'cne' | 'seniat' | 'manual'), NO `cne_*`:
-- el modelo aguanta ambas fuentes y el piso manual del asesor.
--
-- La lógica de verificación (adapter + providers CNE/SENIAT + server action + UI)
-- es Slice B/C — NO entra acá.
--
-- Sin DDL destructivo. NO aplicar a prod (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

-- 1. Canal de origen del alta del cliente.
--    'admin'  = lo cargó un asesor desde el Studio (default histórico).
--    'portal' = self-registro en /portal/registro (SDD-0042 Fase 6).
alter table public.clients
  add column if not exists registration_channel text not null default 'admin';

comment on column public.clients.registration_channel is
  'SDD-0046: origen del alta del cliente · admin (cargado por asesor) | portal (self-registro /portal/registro). Filtra "pendientes de revisar" en la lista.';

-- Backfill: los clientes con foto de cédula/RIF vinieron del registro self-service.
update public.clients
  set registration_channel = 'portal'
  where cedula_photo_path is not null
    and registration_channel = 'admin';

-- 2. Tipo de documento (persona/empresa) — hoy no se persistía; el registro lo
--    conoce (input.kind) pero no lo guardaba. Necesario para rutear la verificación
--    (CNE = persona / SENIAT = empresa).
alter table public.clients
  add column if not exists doc_kind text;

comment on column public.clients.doc_kind is
  'SDD-0046: tipo de documento del cliente · persona (cédula) | empresa (RIF). Rutea la verificación: persona→CNE, empresa→SENIAT.';

-- Backfill defensivo por prefijo del RIF guardado (clients.rif = cédula o RIF):
--   J / G → empresa (RIF jurídico / gubernamental).
--   rif no-null y no-J/G → persona (cédula venezolana / extranjera).
--   rif null → se deja null (indeterminado).
update public.clients
  set doc_kind = case
    when upper(left(regexp_replace(coalesce(rif, ''), '[^A-Za-z0-9]', '', 'g'), 1)) in ('J', 'G')
      then 'empresa'
    else 'persona'
  end
  where rif is not null
    and length(regexp_replace(rif, '[^A-Za-z0-9]', '', 'g')) > 0
    and doc_kind is null;

-- 3. Resultado de la verificación (advisory).
--    null = sin verificar · 'ok' = corresponde · 'mismatch' = no corresponde ·
--    'unavailable' = el registro no respondió / no se pudo consultar.
alter table public.clients
  add column if not exists doc_verify_status text;

comment on column public.clients.doc_verify_status is
  'SDD-0046: resultado advisory de la verificación de identidad · null (sin verificar) | ok | mismatch | unavailable. Nunca bloquea al cliente.';

-- 4. Fuente que produjo el resultado.
--    'cne' = padrón electoral (persona) · 'seniat' = consulta RIF (empresa) ·
--    'manual' = el asesor lo marcó a ojo (piso manual).
alter table public.clients
  add column if not exists doc_verify_source text;

comment on column public.clients.doc_verify_source is
  'SDD-0046: fuente del resultado de verificación · cne (cédula/persona) | seniat (RIF/empresa) | manual (asesor).';

-- 5. Nombre / razón social que devolvió el registro oficial (se muestra al asesor
--    para cotejar a ojo aunque el match automático falle).
alter table public.clients
  add column if not exists doc_registry_name text;

comment on column public.clients.doc_registry_name is
  'SDD-0046: nombre / razón social devuelto por el registro oficial (CNE/SENIAT). Se muestra para cotejo manual; el badge no es la autoridad.';

-- 6. Cuándo se verificó (cache: si ya hay valor y no es re-check forzado, no se
--    vuelve a pegarle al registro).
alter table public.clients
  add column if not exists doc_verified_at timestamptz;

comment on column public.clients.doc_verified_at is
  'SDD-0046: timestamp de la última verificación. Sirve de cache (evita re-consultar el registro en cada click).';

-- 7. Quién disparó la verificación / marca manual (auditoría liviana).
alter table public.clients
  add column if not exists doc_verified_by uuid references auth.users(id);

comment on column public.clients.doc_verified_by is
  'SDD-0046: usuario (auth.users) que ejecutó la verificación o la marca manual.';
