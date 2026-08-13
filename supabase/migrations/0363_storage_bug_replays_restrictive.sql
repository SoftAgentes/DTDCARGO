-- ─────────────────────────────────────────────────────────────
-- 0363 · Storage: las dos políticas de `bug-replays` eran PERMISSIVE y abrían
--        TODOS los demás buckets a cualquier usuario autenticado.
--
-- EL BUG
-- Se escribieron con la expresión correcta y el modificador equivocado:
--
--   bug_replays_no_select_authenticated | SELECT | {authenticated} | PERMISSIVE
--     using (bucket_id <> 'bug-replays')
--   bug_replays_no_write_authenticated  | INSERT | {authenticated} | PERMISSIVE
--     with check (bucket_id <> 'bug-replays')
--
-- Las políticas PERMISIVAS se combinan con **OR**. La intención era "sobre
-- bug-replays, ninguno"; el efecto real es "sobre todo lo que NO sea
-- bug-replays, TODOS". En vez de restringir, **conceden**. El nombre dice
-- `no_select` y hace exactamente lo contrario.
--
-- QUÉ EXPONE HOY (medido en prod el 2026-08-11)
-- Los 68 usuarios del portal son `authenticated`. No están en `user_tenants`, así
-- que `get_user_tenant_id()` les da NULL y **ninguna** política por bucket los
-- deja pasar — sin este bug no verían nada. Con el bug leen:
--   · `client-docs` → **33 objetos**, que es donde vive `clients.cedula_photo_path`
--     (fotos de cédula de clientes),
--   · `brand-assets` → 424 objetos,
--   · y todo lo que haya en payment-proofs, claim-evidence, documents,
--     shipment-docs, inspections, prealerta-docs, receipt-photos, bitacora,
--     expense-receipts y client-facades.
--
-- LA CURA
-- La expresión no cambia. Sólo pasa a `AS RESTRICTIVE`, que es lo que el autor
-- quiso decir: una restrictiva se combina con **AND**, así que sobre las filas de
-- `bug-replays` niega, y sobre el resto no concede nada por su cuenta — cada
-- bucket vuelve a depender de su propia política por tenant.
--
-- POR QUÉ NO ROMPE NADA (verificado archivo por archivo, no asumido)
-- Tras el cambio, `authenticated` pierde el acceso de rebote a los cuatro buckets
-- que no tienen política propia: `brand-assets` (424 obj.), `bug-replays` (4),
-- `audit-exports` (0) y `erp-attachments` (0). Se revisó **todo** camino a Storage
-- del repo y ninguno depende de eso:
--   · brand-assets  → `app/marca/asset/[name]/route.ts:109`, `app/marca/doc/[...ruta]/route.ts:72`,
--     `app/api/marca/download/[assetId]/route.ts:58`, `lib/marca/zip.ts:69` y el HUB
--     (`app/studio/(app)/marketing/hub/actions.ts:137,165,211`) — TODOS `createAdminClient()`.
--   · audit-exports → `lib/studio/audit/export-service.ts:70,98` recibe un cliente que la ruta
--     `app/api/studio/audit/export/route.ts:21,62` construye con `createAdminClient()`.
--   · El portal firma URLs con admin en los 8 caminos que tocan Storage; el comentario de
--     `app/portal/(app)/envios/[code]/page.tsx:53` ya lo decía: *"un cliente puro no puede leer
--     el bucket por tenant vía storage RLS"*.
-- Los buckets con política propia (client-docs, documents, payment-proofs, etc.)
-- no se tocan: sus miembros de tenant siguen leyendo igual.
--
-- ALCANCE
-- Sólo SELECT e INSERT, que son los dos comandos que el par original cubría.
-- UPDATE y DELETE no hacen falta: ninguna política permisiva de `authenticated`
-- matchea `bug-replays` (las de borrado exigen `bucket_id = '<bucket>'` de otro
-- bucket, y la única de UPDATE es de `expense-receipts`), así que ya están negados
-- por ausencia.
--
-- Ref: hallazgo del 2026-08-11 mientras se auditaba el portal para SDD-0255.
-- Idempotente: `drop policy if exists` + `create policy`.
-- ─────────────────────────────────────────────────────────────

drop policy if exists bug_replays_no_select_authenticated on storage.objects;
drop policy if exists bug_replays_no_write_authenticated  on storage.objects;

create policy bug_replays_no_select_authenticated on storage.objects
  as restrictive
  for select
  to authenticated
  using (bucket_id <> 'bug-replays');

create policy bug_replays_no_write_authenticated on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (bucket_id <> 'bug-replays');
