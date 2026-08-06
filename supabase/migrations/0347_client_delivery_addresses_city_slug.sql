-- ─────────────────────────────────────────────────────────────
-- HOTFIX — `client_delivery_addresses.city_slug` nunca llegó a producción.
--
-- EL SÍNTOMA (2026-08-05): un cliente llena su dirección en
-- Portal › Mi perfil › Direcciones, aprieta "Guardar dirección" y no pasa nada;
-- sólo ve "No se pudo guardar la dirección. Intenta de nuevo.". No le faltaba
-- ningún dato: el único campo obligatorio es `line` y lo tenía lleno.
--
-- LA CAUSA. La columna existe en el `create table` de
-- 0198_client_delivery_addresses.sql, pero NO existe en la base de producción.
-- La 0198 se aplicó (version 20260702044508) con la versión del archivo ANTERIOR
-- a que f27f4941 (SDD-0138 Slice C, 2026-07-02 00:38 -0400) le agregara la línea
-- `city_slug text`. El commit anotó "migración 0198 (SIN APLICAR, editable)" y se
-- aplicó siete minutos después desde un checkout que aún no traía ese cambio:
-- editar el `create table` de una migración ya registrada NO la vuelve a correr.
-- Es exactamente lo que advierte docs/runbooks/aplicar-migraciones-prod.md.
--
-- EL DAÑO. `lib/studio/client-address-queries.ts` nombra `city_slug` en el
-- select, el insert y el update → PostgREST responde
-- "column client_delivery_addresses.city_slug does not exist" y el alta muere.
-- Rompe las DOS superficies que comparten el esquema: el Portal del cliente y la
-- ficha del cliente en el Studio. La tabla tiene 294 filas, TODAS del backfill
-- del 2026-07-02 04:45:08 — ni una sola dirección nueva en 34 días.
--
-- POR QUÉ ASÍ Y NO RENUMERANDO LA 0198. Una migración ya aplicada no se toca:
-- su cabecera tiene que seguir diciendo el número con el que corrió. El faltante
-- se cierra hacia adelante, con una migración aditiva propia.
--
-- SIN RIESGO DE PÉRDIDA: la columna es nullable y sin default, así que las 294
-- filas vivas quedan con `city_slug = null` — que es justo lo que Slice C llama
-- "ciudad fuera del catálogo → sin estimado de entrega" (degrada honesto). El
-- `if not exists` la hace idempotente por si algún entorno ya la tuviera.
--
-- ✅ APLICADA A PROD el 2026-08-05 con OK del founder nombrándola. Verificada
-- contra el OBJETO (no contra el nombre): la columna existe en
-- information_schema, las 294 direcciones vivas siguen ahí con city_slug null y
-- la fila quedó en el ledger como `0347_client_delivery_addresses_city_slug`.
-- ─────────────────────────────────────────────────────────────

alter table public.client_delivery_addresses
  add column if not exists city_slug text;

comment on column public.client_delivery_addresses.city_slug is
  'SDD-0138 Slice C: slug de calculator_cities (0104) → estima el recargo de entrega; null = ciudad fuera del catálogo, sin estimado. Llegó tarde a prod: la 0198 se aplicó sin esta columna y el hotfix 0347 la agregó el 2026-08-05.';
