# Auditoría Capa de Datos (RLS / GRANTs / Storage) — DTD Cargo ERP

**Alcance:** análisis estático de `supabase/migrations/*.sql` (302 archivos, 0001–0305). READ-ONLY.
**Método:** extracción programática (parser propio sobre los 302 SQL, con strip de comentarios y parseo dollar-quote) + revisión manual de contexto de cada hallazgo. 293 sentencias ENABLE RLS, 763 CREATE POLICY, 371 funciones SECURITY DEFINER analizadas.

---

## (a) Cobertura RLS: **230/231 tablas (99,6%)**

- 231 tablas `public.*` detectadas estáticamente (dedup por nombre; excluidos falsos positivos de string literals, p.ej. `CREATE TABLE AS` dentro del cuerpo del event trigger de 0277).
- **230 con `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` explícito** en migraciones.
- **1 sin RLS, deliberada:** `public.ve_locality_catalog` (0024_dispatch_core.sql:73) — catálogo público de estados/municipios VE, comentario explícito "PÚBLICO · sin RLS · solo lectura", grant solo SELECT (0024:95).
- **0 tablas de negocio sin RLS.** Cero `DISABLE ROW LEVEL SECURITY` en todo el set. Cero `FORCE RLS` (informativo: el owner postgres bypassea; los roles PostgREST no).
- **Red de seguridad:** event trigger `rls_auto_enable` (0277) habilita RLS automáticamente ante cualquier CREATE TABLE futuro en `public` — con test de contrato (0277/0278).

**Tablas con RLS pero CERO políticas (15, deny-by-default — patrón deliberado, verificado):** audit_legal_holds, audit_legal_hold_events (0301) · audit_export_requests/artifacts/events (0302) · audit_export_expiry_events (0303) · audit_retention_batches(+events) (0304) · audit_d1_operations, audit_external_operations (0289) · audit_d5_external_operations (0293) · audit_entity_types (0258) · ocean_rates (0146) · portal_registro_throttle (0094) · public_verify_throttle (0169). En todas: acceso exclusivo vía RPCs SECURITY DEFINER o service_role; 0301 revoca ALL explícitamente de public/anon/authenticated/service_role a nivel tabla (0301:70). **No son hallazgos — son postura correcta.**

## (b) Buckets de Storage (12 creados + 1 ampliado) — **0 públicos**

| Bucket | Migración | ¿Público? | Límite | MIME | ¿Políticas RLS storage.objects? | Qué guarda |
|---|---|---|---|---|---|---|
| receipt-photos | 0022:13 | No | 8 MB | imágenes | Sí — tenant folder[1] + service_role (0022:26) | Fotos recepción/POD almacén CN |
| expense-receipts | 0049:20 | No | 5 MB | imágenes | Sí — dueño folder[2]=uid o admin (0049:33) | Comprobantes de gastos |
| client-facades | 0066:161 | No | 5 MB | imágenes | Sí — tenant (0066:182) | Fachadas de clientes |
| shipment-docs | 0086:70 | No | 10 MB | pdf/imágenes | Sí — tenant (0086:83) | Docs de embarque |
| client-docs | 0091:30 | No | 8 MB | imágenes | Sí — tenant (0091:46) | Docs identidad cliente (registro portal) |
| documents | 0097:214 | No | 10 MB | pdf/imágenes | Sí — tenant (0097:110) | Hub documental |
| prealerta-docs | 0118:84 · ampl. 0147:288 | No | 15 MB | pdf/img/office | Sí — tenant (0118:100) | Packing lists proveedor |
| claim-evidence | 0155:101 | No | 10 MB | pdf/imágenes | Sí — tenant (0155:114) | Evidencia de reclamos |
| inspections | 0176:238 | No | 25 MB | pdf/imágenes | Sí — tenant (0176:139) | Informes de inspección |
| payment-proofs | 0195:317 | No | 10 MB | pdf/imágenes | Sí — tenant (0195:329) | Comprobantes de pago |
| bitacora | 0214:726 | No | 50 MB | audio/video/img | Sí — tenant (0214:746) | Notas de voz/bitácora |
| audit-exports | 0302:80 | No | 50 MB | csv | **No** — solo service_role (backend `lib/studio/audit/export-service.ts`) | Exportaciones de auditoría |

Todos los buckets con PII/documentos de negocio son **privados** con políticas por prefijo de carpeta = tenant_id. Ningún bucket público contiene PII.

## (c) Hallazgos

### HIGH

**H1 · RPC pública de tracking expone PII a anónimos con códigos enumerables y sin throttle en DB** — `supabase/migrations/0059_public_track_rpc.sql:48` (función), `:64`/`:127` (devuelve `pod_signed_by`), `:155` (grant execute a anon). `public_track_shipment(text,text)` es SECURITY DEFINER alcanzable directo vía PostgREST con la anon key. Devuelve `pod_signed_by` (nombre de quien recibió — PII), notas de eventos y ruta completa con solo conocer el código. El propio repo reconoce que los códigos son secuenciales/enumerables (0169:12) y por eso throttlea `/verificar` y `/registro` — pero **no hay throttle para track a nivel DB** (public_track_log solo registra, no limita). Un atacante puede cosechar receptores/rutas de todos los envíos saltándose cualquier throttle de la capa Next. **Fix:** migración nueva que (1) cree `public_track_throttle` (mismo patrón que 0169) verificado dentro de la función antes de resolver, y (2) reduzca el payload: quitar `pod_signed_by` del return (o enmascararlo, p.ej. "María G.") y filtrar `note` a estados públicos.

### MEDIUM

**M2 · `user_profiles_all_select`: miembro activo de cualquier tenant lee TODOS los perfiles (PII de staff)** — `supabase/migrations/0200_rbac_disabled_enforcement.sql:415`. La política que reemplazó a la original USING(true) exige fila propia O `exists (user_tenants activo del caller)` — **sin correlacionar el tenant del caller con el tenant del perfil**. En el despliegue actual (1 tenant) el impacto práctico es nulo; como propiedad multi-tenant, un usuario de un tenant futuro B leería nombre/teléfono/telegram del staff del tenant A (contradice el contrato `_tenant-isolation.assert.sql`). **Fix:** correlacionar tenant con join user_tenants del caller contra user_tenants del perfil (`ut_profile.tenant_id = ut_caller.tenant_id and ut_profile.user_id = user_profiles.user_id`).

**M3 · `public_track_log`: INSERT anónimo con CHECK(true) y retención indefinida de IPs** — `supabase/migrations/0059_public_track_rpc.sql:159` (grant insert a anon, authenticated) y `:167` (policy `public_track_log_anon_insert` with check(true)). La propia función ya inserta el log internamente (SECURITY DEFINER), así que el grant directo es **redundante** y permite a cualquiera escribir filas arbitrarias (ip, code, found) — polución del log forense. Además la tabla guarda IP + código consultado sin purga visible. **Fix:** `revoke insert on public.public_track_log from anon, authenticated;` (dejar el insert solo a la función) + purga programada tipo cron purge-throttle.

### LOW

**L1 · `ve_locality_catalog` sin RLS (deliberado, riesgo residual)** — 0024_dispatch_core.sql:73. Hoy es catálogo inofensivo con grant SELECT-only; si mañana alguien agrega una columna sensible, no hay RLS que la proteja. Fix opcional: enable RLS + policy `select using(true)` (mismo efecto, mejor cinturón).

**L2 · PII de negocio sin cifrado a nivel columna** — cédulas/RIF/teléfonos/direcciones (clients, nomina_employees, persons, client_delivery_addresses) dependen 100% de RLS. El repo sí usa pgcrypto/Vault donde corresponde (PINs, tokens), así que es decisión de diseño coherente con Supabase; queda como observación de defensa en profundidad.

**L3 · `audit-exports` sin políticas storage.objects** — 0302_audit_export_governed.sql:80. Consistente con el acceso actual (service_role backend + export-service.ts), pero si algún día se sirven signed URLs a authenticated no habrá policy que ate el objeto al tenant. Fix opcional: policy tenant-prefix como los otros 11 buckets, o comentario explícito.

## (d) Conteo

| Severidad | Cantidad |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low | 3 |

## (e) Sub-score: **79/100**

100 − (1×10 high) − (2×4 medium) − (3×1 low) = **79**

## (f) Evidencia positiva (lo que está bien)

1. **Cobertura RLS casi total + auto-enable:** 230/231 con RLS explícito, más event trigger `rls_auto_enable` (0277) que impide regresiones por olvido, con tests (0277/0278).
2. **Helpers de tenant/rol centralizados:** `get_user_tenant_id()` (0001:34, ~480 usos), `assert_tenant_match()` (0012:35), `is_platform_admin()` (0058:54), `get_portal_client_markbox()`, `nomina_can_access()`. Todas las tablas financieras sensibles muestreadas (payment_reports, payment_receipts, supplier_payments, bank_statements(+lines), company_bank_accounts, invoices, nomina_*, client/supplier_claims, tracking_snapshots, clients, quotes, renditions, shipment_costs) filtran por tenant en TODAS sus políticas no-service_role; las de portal filtran por markbox del cliente.
3. **SECURITY DEFINER saneado al 100%:** las 371 funciones SECURITY DEFINER tienen `SET search_path` fijado en el header (300 `public`, 23 `''` — máximo endurecimiento —, resto `public, extensions`/`pg_catalog`). Cero hijack-able. Patrón revoke-from-public/anon + grant-por-rol consistente (p.ej. `next_markbox_service` 0109: revoke de public/anon/authenticated, grant solo service_role).
4. **Hardening explícito en cadena:** 0200 corrige la policy PII de user_profiles (documenta el porqué, H7); 0263 endurece default ACL de postgres; 0275/0276 restauran search_path de PINs y barrido revoke-anon de RPCs; 0261b least-privilege de comments; newsletter con policies `using(false)` anti-anon (0259/0260).
5. **Secretos bien tratados:** tokens Kommo en Supabase Vault (`vault_secret_name`, 0082) — nunca en columna; PINs de operario como bcrypt (`crypt`/`gen_salt('bf')`, 0020); KEK de no_olvidar en Vault (0017). Cero secretos hardcodeados en migraciones (barrido de patrones api_key/token/JWT: vacío).
6. **Trigger de signup validado:** `no_olvidar_handle_new_user` (0017:311) solo actúa si metadata `tenant='dtd-cargo'`, `on conflict do nothing`, secdef + search_path.
7. **Inmutabilidad por trigger:** legal_acceptances append-only (0102:125), renditions solo transición emitida→anulada (0123:120) — cubren PostgREST directo, no solo la app.
8. **Tests SQL contractuales reales:** 43 archivos en `supabase/tests/` + `_tenant-isolation.assert.sql` que corre sobre el schema completo reconstruido (vía `check-schema-rebuild.mjs`) y pone en rojo el gate si una tabla con tenant_id queda sin policy; `run-sql-tests.mjs` los ejecuta en Postgres desechable. Cubren RLS auto-enable, ACL least-privilege, inmutabilidad, auditoría D1–D5, throttle, POD seal, legal holds, retention.
9. **Storage ordenado:** 0 buckets públicos, todos con file_size_limit + MIME allowlist, políticas por prefijo tenant y service_role separado; eTag de POD verificado contra storage.objects (0300, anti-sustitución).
10. **Superficie anónima mínima y deliberada:** grants a anon solo para CMS publicado (`is_published=true`), catálogo VE, y RPCs públicas documentadas (track, calculadora, tarifas, diplomas) — cada una con revoke from public previo.

## Limitaciones del análisis estático

- El estado "final" se infiere por orden correlativo de migraciones; las migraciones 0271–0288 son replay-history gates (regeneran el historial), lo que duplica statements pero no cambia la conclusión.
- No se verificó contra la DB viva (read-only por instrucción): drift repo↔prod lo vigila el paso `migrations-applied` de verify.mjs, fuera de alcance aquí.
- El throttle de /track podría existir en la capa Next.js (server-side); H1 se mantiene porque la RPC es invocable directo vía PostgREST con la anon key, saltándose esa capa.
