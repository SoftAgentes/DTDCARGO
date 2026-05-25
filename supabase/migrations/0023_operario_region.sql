-- ─────────────────────────────────────────────────────────────
-- SDD-0028 schema-only step (pre-SDD-0029 Módulo de Despacho).
--
-- Agrega `region` a operario_pins para que el modelo soporte
-- operarios CN (almacén) y VE (chofer/delivery) sin asumir
-- todavía la taxonomía final que vendrá del brief de Claude Studio
-- (que va a unificar bodeguero + camionero + roles).
--
-- 100% aditivo y no destructivo:
--   - Existing rows quedan region='cn' (Wang Hua YIW-A1 sigue igual)
--   - warehouse_id pasa a nullable (chofer VE no se ata a hub CN)
--   - check constraint preserva la invariante de operarios CN
--   - verify_operario_pin / create_receipt_as_operario sin cambios
--
-- Si el brief de Despacho propone una taxonomía distinta (ej. agregar
-- 'bodeguero' como rol separado, o cambiar 've' a 'chofer'), el alter
-- enum es trivial sin rewrite de data.
-- ─────────────────────────────────────────────────────────────

create type operario_region as enum ('cn', 've');

alter table public.operario_pins
  add column region operario_region not null default 'cn';

comment on column public.operario_pins.region is
  'Región operativa del operario. cn=almacén China · ve=chofer/delivery Venezuela. Más roles vienen con SDD-0029 Despacho.';

alter table public.operario_pins
  alter column warehouse_id drop not null;

alter table public.operario_pins
  add constraint operario_pins_cn_requires_warehouse
  check (region <> 'cn' or warehouse_id is not null);

create index operario_pins_tenant_region_idx
  on public.operario_pins (tenant_id, region) where active = true;

grant select on public.operario_pins to authenticated;
