-- ─────────────────────────────────────────────────────────────
-- Normaliza `clients.phone` al formato wa.me canónico: 58 + 10 dígitos.
--
-- EL SÍNTOMA. El teléfono es el canal de respaldo cuando a un cliente le
-- rebota el correo — el único caso donde reenviar NO sirve. Medido el
-- 2026-08-06 sobre 248 clientes activos con teléfono:
--
--     58 + 10 dígitos (correcto)   40
--     0 + 10 dígitos (local VE)    68
--     10 dígitos pelados           49
--     termina en `.0` (Excel)      51
--     otra forma (5 a 33 dígitos)  40
--
-- O sea: sólo 40 de 248 servían. Los demás producen un link de WhatsApp
-- equivocado.
--
-- ⚠️ LO QUE LO HACE PEOR QUE "UN DATO FEO". `toWhatsAppRaw`
-- (lib/portal/portal-types.ts) normaliza con `phone.replace(/\D/g,"")`, que
-- BORRA el punto y deja el cero: `4243745436.0` → `42437454360`. No falla, no
-- avisa: manda el WhatsApp a OTRO número. Un error silencioso que aterriza en
-- un tercero.
--
-- EL ORDEN IMPORTA. Primero se quita el `.0` del TEXTO y recién después se
-- extraen los dígitos. Al revés, el `0` del `.0` se vuelve un dígito más y se
-- arrastra el mismo bug que se está arreglando.
--
-- QUÉ NO TOCA. Las ~40 filas de forma irreconocible (5 dígitos, 33 dígitos,
-- dos números en una celda) quedan EXACTAMENTE como están. Inventarles un
-- número sería peor que dejarlas sucias: un teléfono plausible pero falso no
-- se distingue de uno bueno, y alguien terminaría llamando a un desconocido.
-- Salen listadas en la vista `clients_phone_no_normalizable` para revisión
-- humana.
--
-- Reversible: se guarda el valor previo en `clients.phone_legacy` antes de
-- tocar nada. Si algo sale mal, `update clients set phone = phone_legacy`.
-- ─────────────────────────────────────────────────────────────

-- ── a. Respaldo de lo que había ────────────────────────────────────────────
alter table public.clients
  add column if not exists phone_legacy text;

comment on column public.clients.phone_legacy is
  'Valor de phone ANTES de la normalización 0353. Sólo respaldo — no leer para operar.';

-- ── b. Helper puro: forma canónica, o NULL si no es reconocible ────────────
create or replace function public.normalize_ve_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base   text;
  v_digits text;
begin
  if p_phone is null or btrim(p_phone) = '' then
    return null;
  end if;

  -- 1) El `.0` de Excel se quita del TEXTO, antes de extraer dígitos.
  v_base := regexp_replace(btrim(p_phone), '\.0$', '');
  -- 2) Recién ahora, sólo dígitos.
  v_digits := regexp_replace(v_base, '\D', '', 'g');

  -- Ya canónico: 58 + 10.
  if length(v_digits) = 12 and v_digits like '58%' then
    return v_digits;
  end if;

  -- Local VE con 0 inicial: 0XXXXXXXXXX → 58 + los 10 de atrás.
  if length(v_digits) = 11 and v_digits like '0%'
     and substr(v_digits, 2, 1) in ('4', '2') then
    return '58' || substr(v_digits, 2);
  end if;

  -- Pelado: 10 dígitos que empiezan en 4 (móvil) o 2 (fijo).
  if length(v_digits) = 10 and substr(v_digits, 1, 1) in ('4', '2') then
    return '58' || v_digits;
  end if;

  -- Cualquier otra cosa: NO se adivina.
  return null;
end;
$$;

comment on function public.normalize_ve_phone(text) is
  'Teléfono VE → formato wa.me (58 + 10 dígitos), o NULL si la forma no es reconocible. Quita el sufijo .0 de Excel ANTES de extraer dígitos: al revés el 0 se cuela como dígito. No inventa números.';

revoke all on function public.normalize_ve_phone(text) from public, anon;
grant execute on function public.normalize_ve_phone(text) to authenticated, service_role;

-- ── c. Backfill, sólo sobre lo reconocible ─────────────────────────────────
update public.clients
   set phone_legacy = phone,
       phone        = public.normalize_ve_phone(phone)
 where phone is not null
   and btrim(phone) <> ''
   and public.normalize_ve_phone(phone) is not null
   and public.normalize_ve_phone(phone) is distinct from phone;

-- ── d. Lo que quedó fuera, a la vista, para que alguien lo mire ────────────
-- `security_invoker = true` NO es decorativo: sin él la vista corre con los
-- privilegios de su DUEÑO y se salta la RLS de `clients` — una puerta lateral a
-- PII de todos los tenants, servida por PostgREST. Con él, cada quien ve sólo
-- lo que ya podía ver.
create or replace view public.clients_phone_no_normalizable
  with (security_invoker = true) as
  select id, tenant_id, markbox, name, phone
    from public.clients
   where deleted_at is null
     and phone is not null
     and btrim(phone) <> ''
     and public.normalize_ve_phone(phone) is null;

comment on view public.clients_phone_no_normalizable is
  'Clientes cuyo teléfono NO se pudo normalizar (0353): hay que corregirlos a mano preguntándole al cliente. security_invoker=true → hereda la RLS de clients.';

revoke all on public.clients_phone_no_normalizable from public, anon;
grant select on public.clients_phone_no_normalizable to authenticated;
