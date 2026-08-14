-- SDD-0259 · registrar lo que el cliente calcula en la calculadora pública.
--
-- La calculadora de /tarifas es el único sitio donde un desconocido declara
-- gratis cuánto volumen y peso trae de China, y hasta hoy no se guardaba nada:
-- `/tarifas` va directo a wa.me (`directWhatsApp`) y el único componente que
-- posteaba (EstimadoModal) sólo se monta cuando NO es directWhatsApp, así que
-- era inalcanzable. Resultado: 12 filas con CBM+peso en `quotes` en 7 días, y
-- ~41 mediciones de carga en toda la base — por eso los presets de peso de
-- SDD-0257 se descartaron (no había con qué calibrarlos).
--
-- ⚠️ ESTA TABLA ES TELEMETRÍA ANÓNIMA, NO UN LEAD.
--
-- No lleva —y no puede llevar— nombre, teléfono, correo, IP, cookie, ni
-- identificador de sesión o de usuario. Eso NO es un detalle de implementación:
-- es lo que la mantiene fuera del régimen de datos personales (CRBV arts. 28 y
-- 60, Ley Especial contra los Delitos Informáticos; PIPL si lo mira el equipo
-- de Yiwu). El día que alguien le cuelgue un identificador, deja de ser anónima
-- y el cambio pasa obligatoriamente por `/revisar-datos-ve`.
--
-- El anti-abuso por IP NO vive acá: reusa `portal_registro_throttle` con
-- namespace propio (`calc:`), igual que /api/public/estimacion. La IP queda en
-- ese bucket compartido, nunca en esta tabla.
--
-- Va aparte de `quotes` a propósito: `quotes` es una entidad de negocio con
-- código EST- y dueño. Mezclar telemetría ahí ensucia el CRM con filas que no
-- son de nadie.

set lock_timeout = '5s';
set statement_timeout = '30s';

create table if not exists public.public_calc_events (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,

  -- Qué modalidad estaba mirando. Espeja `CalcModo` de lib/calculadora.ts.
  modo         text not null check (modo in ('ddp', 'consolidado')),

  -- Lo que el cliente declaró. `cbm` siempre existe (sin él no hay cálculo);
  -- `weight_kg` es NULLABLE **a propósito** y es la métrica más importante de
  -- la tabla: mide cada cuánto el cliente no sabe el peso, que es lo único que
  -- puede decir si SDD-0257 valió la pena.
  cbm          numeric(10,3) not null check (cbm > 0),
  weight_kg    numeric(10,2) check (weight_kg is null or weight_kg > 0),

  -- Contexto del cálculo. `ciudad_id` es el slug del destino (no es un dato
  -- personal: es a dónde va la carga, no dónde vive nadie).
  ciudad_id       text,
  embalaje        text check (embalaje is null or embalaje in ('estandar', 'especial')),
  bateria         boolean not null default false,
  carga_especial  boolean not null default false,

  -- Resultado. `total_usd` es null cuando la calculadora NO cotizó, y entonces
  -- `alerta` dice por qué (deriva al asesor, fuera de contenedor, etc.). Ese
  -- par es lo que mide contra qué paredes choca la gente.
  total_usd    numeric(12,2) check (total_usd is null or total_usd >= 0),
  alerta       text,

  created_at   timestamptz not null default now()
);

-- Consulta objetivo: percentiles de densidad sobre una ventana de fechas, por
-- tenant. El índice sigue ese orden.
create index if not exists public_calc_events_tenant_created_idx
  on public.public_calc_events (tenant_id, created_at desc);

alter table public.public_calc_events enable row level security;

-- ⚠️ RLS ACTIVADO Y SIN NINGUNA POLÍTICA: eso NIEGA todo a `anon` y
-- `authenticated`, que es exactamente lo que queremos. La única vía de
-- escritura es `/api/public/calc-event`, que corre server-side con
-- service_role (bypassa RLS). El navegador nunca toca esta tabla —- de hecho
-- no podría: el sitio público tiene prohibido importar `@supabase/*` por la
-- frontera dura del ESLint.
--
-- Los revokes van explícitos igual: si mañana alguien agrega una política de
-- lectura sin pensar, los GRANT siguen cerrados y el dato no se abre solo.
revoke all on public.public_calc_events from anon, authenticated;

comment on table public.public_calc_events is
  'SDD-0259: telemetría ANÓNIMA de la calculadora pública (CBM, peso declarado, resultado). NO es un lead y NO puede llevar datos personales — sin nombre, teléfono, correo, IP, cookie ni sesión. Su fin es calibrar con datos propios lo que hoy no se puede (ver SDD-0257, presets de peso descartados). Escritura sólo por service_role desde /api/public/calc-event.';

comment on column public.public_calc_events.weight_kg is
  'Peso declarado por el cliente. NULL = no lo indicó — es la métrica que mide si SDD-0257 (precio sin peso) valió la pena.';

comment on column public.public_calc_events.alerta is
  'Tipo de alerta cuando la calculadora NO cotizó (deriva al asesor, fuera de contenedor, destino sin tarifa…). Con total_usd null, mide contra qué paredes choca la gente.';

comment on column public.public_calc_events.ciudad_id is
  'Slug del destino en Venezuela. Es a dónde va la carga, no dónde vive una persona.';
