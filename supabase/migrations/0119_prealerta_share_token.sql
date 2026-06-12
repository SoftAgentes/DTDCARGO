-- ─────────────────────────────────────────────────────────────
-- SDD-0057 (ext) · Link del proveedor por compra/prealerta.
--
-- Token no adivinable para exponer una página PÚBLICA por compra
-- (`/p/{share_token}`) donde el proveedor chino baja, sin login: la dirección de
-- la bodega CN (con el shipping mark del cliente) + las etiquetas + (Fase 2) el
-- template de packing list/factura. El cliente comparte UN link en vez de
-- descargar y reenviar archivos.
--
-- La página pública lee por `share_token` con admin client (service_role) — el
-- visitante es anónimo. NO se abre RLS al público: el token ES la capacidad, y
-- solo expone esa compra (baja sensibilidad: las etiquetas se comparten con el
-- proveedor igual). Aditivo, sin pérdida de datos: las filas existentes reciben
-- un token vía el default.
--
-- NO se aplica a prod desde acá (lo hace el founder / MCP). Número 0119.
-- ─────────────────────────────────────────────────────────────

alter table public.prealertas
  add column if not exists share_token uuid not null default gen_random_uuid();

comment on column public.prealertas.share_token is
  'SDD-0057 ext: token no adivinable del link público del proveedor (/p/{token}). Lo lee el route público con admin client.';

create unique index if not exists prealertas_share_token_idx
  on public.prealertas (share_token);
