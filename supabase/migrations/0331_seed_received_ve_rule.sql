-- ─────────────────────────────────────────────────────────────
-- Motor de Crecimiento · F0 — `received_ve` = disparador CANÓNICO del arribo a VE
--
-- Decisión del founder (2026-07-19): el aviso de "tu carga llegó a Venezuela"
-- pasa a dispararse por `received_ve` — al crear el recibo del contenedor en
-- Venezuela, el hecho físico que ejecuta el operario — y NO por la transición de
-- status `arrived_destination`. En el mismo cambio se quitó el mail
-- `shipment_arrived` que esa transición mandaba, para no duplicar el correo.
--
-- El motor SDD-0156 YA dispara `received_ve` (fan-out desde
-- `warehouse-receipt-ve-queries.ts`), pero sin una regla sembrada era un no-op
-- silencioso. Esta migración siembra la regla DEFAULT del evento para los tenants
-- existentes: email · ancla en el evento · al instante · visible en el portal.
-- El copy default vive code-side (`DEFAULT_EVENT_COPY.received_ve`).
--
-- ⚠️ Debe ir a prod JUNTO con el código que quita `shipment_arrived`: si el código
-- se despliega sin esta regla aplicada, el arribo queda SIN aviso. El gate
-- `migrations-applied` de verify.mjs lo vigila (grita si el archivo no está en
-- prod).
--
-- Idempotente: `on conflict` con el índice parcial de default de 0247
-- (`client_notif_rules_default_uniq` on (tenant_id, trigger_event) where
-- client_id is null). Re-correrla no pisa una regla ya editada por el admin.
-- ─────────────────────────────────────────────────────────────

insert into public.client_notification_rules
  (tenant_id, trigger_event, channel, anchor, offset_minutes, visible_in_portal, active)
select t.id, 'received_ve', 'email', 'event', 0, true, true
from public.tenants t
on conflict (tenant_id, trigger_event) where client_id is null do nothing;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0331_seed_received_ve_rule.sql
-- ─────────────────────────────────────────────────────────────
