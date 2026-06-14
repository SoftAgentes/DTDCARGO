-- SDD-0082 (implementa SDD-0062 Slice D): consentimiento de marketing en clients.
-- Aditiva, sin DDL destructivo. Columnas NULLABLE (NULL = sin opt-in) → ADD COLUMN
-- no reescribe la tabla. No hay policies nuevas: las columnas viven en `clients`,
-- que ya tiene RLS por tenant_id (heredan el filtrado de fila, igual que 0108).
--
-- Email transaccional (welcome, factura) NO depende de estas columnas; son SOLO
-- para marketing (consentimiento explícito + canal de reactivación).

alter table public.clients
  add column if not exists email_marketing_optin_at timestamptz,
  add column if not exists email_optin_source text,
  add column if not exists whatsapp_marketing_optin_at timestamptz;

comment on column public.clients.email_marketing_optin_at is
  'SDD-0082/0062-D: instante del opt-in EXPLICITO a marketing por email. NULL = sin consentimiento. El unsubscribe lo vuelve a NULL.';
comment on column public.clients.email_optin_source is
  'SDD-0082/0062-D: como se capto el opt-in de email · "portal_register" | "kommo_flow" | "kommo_salesbot" | "admin_manual" | "sign_in_google" | "import". TEXT + validacion en app (convencion de clients, no CHECK).';
comment on column public.clients.whatsapp_marketing_optin_at is
  'SDD-0082/0062-D: instante del opt-in a marketing por WhatsApp (separado del de email). NULL = sin consentimiento.';

-- Indice parcial del segmento ALCANZABLE para reactivacion por email:
-- cliente vivo, con email y con opt-in de email. Acelera el conteo/segmento sin
-- cargar a las filas sin opt-in (la gran mayoria hoy).
create index if not exists clients_email_optin_idx
  on public.clients (tenant_id)
  where email is not null
    and email_marketing_optin_at is not null
    and deleted_at is null;
