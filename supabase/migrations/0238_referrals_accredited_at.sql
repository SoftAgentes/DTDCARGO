-- ─────────────────────────────────────────────────────────────
-- 0238 · SDD-0137 · referrals.accredited_at — CUÁNDO quedó disponible el crédito
--
-- Regla del founder (2026-07-15): el crédito de referido ($80) es un DESCUENTO
-- sobre la PRÓXIMA compra del referidor — "no se aplica para abono a cuenta, sino
-- solamente para una nueva compra que le vaya a llegar en camino". Para poder
-- exigir "compra POSTERIOR al crédito" hace falta saber CUÁNDO nació el crédito.
--
-- Hoy no se sabe. `referrals` tiene:
--   · created_at  → cuándo se REGISTRÓ el referido (puede ser meses antes).
--   · updated_at  → lo pisa cualquier UPDATE posterior (aplicar el crédito, notas…).
-- Anclar la regla en created_at deja pasar deuda vieja: referido registrado en
-- enero, acreditado en julio → una factura de marzo (deuda de 4 meses) pasaría el
-- guard. Eso es exactamente lo que la regla prohíbe.
--
-- SELLADO EN LA DB, no en el código: hay DOS caminos de acreditación
--   1. trigger accredit_referral_on_first_invoice (0197) — 1ª factura del referido.
--   2. action accreditReferral(id) — manual desde el Studio.
-- Cablear cada uno por separado es frágil (el próximo camino se olvida). El
-- trigger de abajo sella la fecha en cualquier transición a 'acreditado', venga de
-- donde venga. Mismo patrón que el sellado de resolved_at en supplier_claims (0236).
--
-- Aditiva, idempotente, sin DDL destructivo.
-- ─────────────────────────────────────────────────────────────

alter table public.referrals
  add column if not exists accredited_at timestamptz;

comment on column public.referrals.accredited_at is
  'SDD-0137: cuándo el crédito quedó DISPONIBLE (transición a status=acreditado). Sellado por trigger, cubre la acreditación automática (0197) y la manual. Es el ancla de la regla "el crédito solo se aplica a una compra POSTERIOR al crédito" — NO usar created_at (cuándo se registró el referido) ni updated_at (lo pisa cualquier UPDATE).';

-- Sella accredited_at en la PRIMERA transición a 'acreditado'. Idempotente: si ya
-- tiene fecha no se pisa (re-acreditar no reinicia el reloj ni habilita facturas
-- viejas). No se limpia al pasar a 'aplicado': el crédito se acreditó una vez y esa
-- fecha es historia.
-- El enum se compara con ::text (convención del repo: el literal crudo contra un
-- enum rompe si el valor no existe todavía en el tipo).
create or replace function public.referrals_seal_accredited_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text = 'acreditado' and new.accredited_at is null then
    new.accredited_at := now();
  end if;
  return new;
end;
$$;

comment on function public.referrals_seal_accredited_at is
  'SDD-0137: sella referrals.accredited_at = now() en la primera transición a acreditado (cualquier camino: trigger 0197 o action manual). Idempotente — no pisa una fecha ya puesta.';

-- Trigger de tabla: NO se expone a la API.
revoke execute on function public.referrals_seal_accredited_at() from public, anon;

drop trigger if exists referrals_seal_accredited_at_trg on public.referrals;
create trigger referrals_seal_accredited_at_trg
  before insert or update on public.referrals
  for each row execute function public.referrals_seal_accredited_at();

-- Backfill defensivo. En prod es NO-OP (referrals está vacía al 2026-07-15,
-- verificado), pero deja la migración correcta en cualquier entorno con filas.
-- updated_at es el mejor proxy disponible para créditos ya acreditados; para los
-- 'aplicado' queda tirando a tarde (updated_at refleja la aplicación, no la
-- acreditación) — aceptable: un ancla tardía es CONSERVADORA (rechaza de más,
-- nunca deja pasar deuda vieja), que es el lado seguro para dinero.
update public.referrals
   set accredited_at = updated_at
 where accredited_at is null
   and status::text in ('acreditado', 'aplicado');
