-- ─────────────────────────────────────────────────────────────
-- SDD-0151 follow-up: traza también de los cambios de identidad que hace el
-- EQUIPO directo en la ficha (updateClientAction), no solo lo que el cliente
-- propone. Se registran como filas source='admin', status='approved' (ya
-- resueltas, no accionables) → aparecen en el historial del Studio junto a las
-- del cliente, en una sola línea de tiempo.
--
-- `source='client'` (default) = lo que el cliente propone desde el portal (flujo
-- original). Las queries del portal filtran source='client' para que el cliente
-- solo vea LO SUYO. El índice único parcial WHERE status='pending' no se toca
-- (las filas de auditoría son 'approved', nunca 'pending').
--
-- NO aplicar a prod (lo hace la coordinación / founder con su OK).
-- ─────────────────────────────────────────────────────────────

alter table public.client_change_requests
  add column source text not null default 'client'
    check (source in ('client', 'admin'));

comment on column public.client_change_requests.source is
  'SDD-0151: origen del cambio — client (propuesto por el cliente en el portal) o admin (edit directo del equipo en la ficha, auto-aprobado, solo traza).';
