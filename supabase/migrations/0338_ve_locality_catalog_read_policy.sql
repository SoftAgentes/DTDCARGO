-- ─────────────────────────────────────────────────────────────
-- 0338 · ve_locality_catalog: política de lectura (RLS quedó sin política)
--
-- PROBLEMA
--
-- `0024_dispatch_core.sql` creó esta tabla **explícitamente sin RLS** —su
-- propio comentario dice "PÚBLICO · sin RLS · solo lectura"— y le dio
-- `grant select` a `anon` y `authenticated`. Es un catálogo inmutable de
-- referencia: 24 estados, 98 ciudades y sus códigos postales de IPOSTEL. No
-- tiene `tenant_id` ni dato de nadie.
--
-- Pero en PRODUCCIÓN la tabla tiene `relrowsecurity = true` y **cero
-- políticas**. Ninguna migración del repo la enciende: se activó a mano,
-- casi seguro respondiendo al aviso `rls_enabled_no_policy` del advisor de
-- Supabase. Encender RLS sin escribir la política es un no-op aparente que
-- en realidad **niega todo**: `authenticated` conserva el GRANT pero no pasa
-- ninguna política, así que ve CERO filas.
--
-- Efecto medido: `listVeLocalities` (lib/studio/dispatch-routes-queries.ts:92)
-- devuelve vacío → el cascade Estado → Municipio → Ciudad → CP de
-- `CityDrawer` no ofrece nada → no se puede dar de alta una ciudad en
-- `/studio/admin/rutas`. Roto en producción, en silencio.
--
-- POR QUÉ ESTA ES LA CURA Y NO "APAGAR RLS"
--
-- Apagar RLS devolvería el acceso y volvería a levantar el aviso del advisor,
-- que es lo que empezó todo. La política explícita deja las dos cosas bien:
-- el acceso funciona y la intención queda ESCRITA en vez de implícita en la
-- ausencia de RLS. Que la tabla sea legible por cualquiera no es un descuido:
-- es su propósito (catálogo público de referencia geográfica).
--
-- La migración también **enciende RLS** aunque el repo diga que no la tiene:
-- así un schema reconstruido desde cero queda igual que producción, en vez de
-- divergir. Eso es lo que hace que `schema-rebuild` valga de algo.
--
-- ⚠️ Es de SÓLO LECTURA. Sin políticas de INSERT/UPDATE/DELETE, y con el
-- GRANT limitado a SELECT, el catálogo sigue siendo inmutable para
-- `authenticated`. Mantenerlo así es deliberado: se siembra por migración.
-- ─────────────────────────────────────────────────────────────

alter table public.ve_locality_catalog enable row level security;

drop policy if exists "ve_locality_catalog_public_read" on public.ve_locality_catalog;

create policy "ve_locality_catalog_public_read"
  on public.ve_locality_catalog
  for select
  to anon, authenticated
  using (true);

comment on table public.ve_locality_catalog is
  'Catálogo público inmutable de localidades VE (24 estados + ~98 ciudades + CP IPOSTEL). Referencia inicial para dispatch_city_catalog per-tenant. SDD-0241: RLS activa con política de LECTURA para anon+authenticated — `using (true)` es correcto acá: no hay tenant_id ni PII, el dato es geografía pública. Sin políticas de escritura a propósito: se siembra por migración.';

-- El service_role bypassea RLS, pero el GRANT explícito evita sorpresas si
-- alguien revoca los privilegios por defecto del rol.
grant select on public.ve_locality_catalog to anon, authenticated;
grant all on public.ve_locality_catalog to service_role;
