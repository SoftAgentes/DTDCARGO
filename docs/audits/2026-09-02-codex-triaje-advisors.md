---
title: "Supabase: triaje de los 204 avisos de seguridad por dominio"
tipo: auditoria-operativa
autor: Codex
estado: clasificado-no-remediado
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
confidencialidad: interno
---

# Advisors de seguridad: clasificación completa, remediación separada

## Resultado y alcance

204/204 avisos clasificados: 20 INFO y184 WARN. Son **183 avisos sobre162
funciones distintas**,20 tablas y1 extensión. Los21 avisos anon se repiten en
authenticated; no son21 funciones adicionales. No se bajó el contador mediante
supresiones, grants, cambios de RLS o escrituras alojadas.

Fuente: proyecto DTD Cargo, `xpfuzqombmjmxvprjgmi`, ACTIVE_HEALTHY; advisor
observado el2026-09-03 a00:09:55 UTC (2026-09-02,20:09:55 Caracas).
Catálogos consultados después en modo lectura: pg_proc/pg_namespace/pg_trigger,
pg_class/pg_policy, pg_extension/pg_depend y pg_roles. No se leyeron filas de
negocio, sesiones, credenciales ni contenido de documentos. Las lecturas fueron
separadas, no un snapshot transaccional único.

Base de referencias locales: `a2456aa24ded1ac9974181ce2d9babd340bd216d`.
[Evidencia completa por objeto y aviso](assets/2026-09-02-advisors-security.json):
204 cache_keys únicos, firma, privilegios, tipo de retorno, owner, search_path,
MD5 del cuerpo, trigger vinculado, categoría, dominio y referencias de código.
Los hashes detectan diferencias futuras; no certifican por sí solos seguridad.

Esta es la clasificación de una casilla existente del checklist, **no** una
auditoría integral nueva ni una certificación de endpoints: nueve de las162
funciones son triggers. No se genera un Audit Score con evidencia parcial.

## Partición de los avisos

| Grupo | Objetos | Avisos | Decisión |
|---|---:|---:|---|
| Tablas sin policy y sin SELECT a nivel tabla/TRUNCATE anon/auth |16|16| Mantener cerradas; no crear policies para silenciar INFO |
| Tablas sin policy, sin SELECT a nivel tabla pero con TRUNCATE anon/auth |4|4| Pendiente0399; no afirmar un vector API demostrado |
| pg_net no relocatable |1|1| Análisis del proveedor; no ejecutar ALTER EXTENSION SET SCHEMA |
| Verificación pública pendiente0400 |2|4| Aplicar sólo con GO nominal; gate ya documentado |
| Triggers ligados a eventos |9|17| Revisar ACL sin tratarlos como RPC ordinarias |
| Matriz de roles con permiso anon y guard admin observado |2|4| Revisar mínimo privilegio; guard observado no sustituye contrato |
| Catálogo público con referencias RPC literales |8|16| Preservar contrato público; revisar minimización por dominio |
| Tracking público legado |1|2| No inferir desuso por ausencia de menciones RPC |
| Confirmación legacy de pagos |1|1| Respetar expansión0421, consumidores y restricción0422 |
| Otras funciones authenticated |139|139| Contratos de principal/tenant/rol/objeto pendientes por dominio |
| **Total** |**183 objetos distintos**|**204**| Clasificados, no remediados |

## Hallazgos que cambian la siguiente acción

### 1. RLS sin policy no equivale a tabla pública

Las 20 tablas tienen RLS, cero policies y ningún privilegio SELECT a nivel tabla
concedido a anon o authenticated. No se midieron grants de columna. Ambos roles
son NOLOGIN y no tienen BYPASSRLS. Los owners son
postgres. La inferencia acotada es que no hay un camino de **lectura directa**
por esos roles basado en las ACL/policies observadas, no que todo acceso
privilegiado o indirecto esté cerrado.

Cuatro conservan TRUNCATE para ambos roles: `ocean_rates`,
`portal_registro_throttle`, `public_track_log` y `public_verify_throttle`.
Se vinculan a [0399](../../supabase/migrations/0399_revoke_truncate_anon_authenticated.sql),
ya preparada. No se ejecutó TRUNCATE ni se probó una vía de ataque alojada.
No hay que abrir una policy como remedio: eso ampliaría acceso.

Los objetos audit_* y entity_audit_log son del dominio de auditoría; sus accesos
privilegiados difieren por tabla, visibles en el snapshot. No se uniforman los
permisos de service_role ni se confunde su BYPASSRLS con un permiso SQL ausente.
La documentación oficial distingue policies de acceso y operaciones excluidas
de RLS: [RLS en PostgreSQL17](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

### 2. Funciones públicas: priorizar0400, no revocar todo

`academy_verify_diploma` y `markbox_existe_publico` continúan ejecutables por
anon y authenticated en Cloud. Se leyó su definición, no se invocaron. La
primera devuelve metadatos nominales del diploma; la segunda comprueba
existencia del Shipping Mark actual/histórico. La barrera de la página web no
impide una invocación directa de una RPC que conserve EXECUTE.

Ya tienen correctivo [0400](../../supabase/migrations/0400_revoke_public_verify_rpc_execute.sql)
y contrato local; falta su aplicación nominal. No se escribe otra migración ni
se declara aplicado el arreglo por estar en Git.

Otras ocho funciones anon tienen menciones RPC en lib/public:
public_calculator_cities, public_calculator_config, public_carrier_tariffs,
public_cbm_rate, public_fcl_rates, public_ocean_rate, public_service_faqs y
public_servicios. Eso sustenta su intención de catálogo público, **no** una
validación integral del dato devuelto o de cada filtro.

`public_track_shipment` no aparece como llamada RPC literal en el escaneo.
Se conserva para revisión de contrato/consumidores externos; no se declara
muerta ni se elimina. Ver [0326](../../supabase/migrations/0326_public_tracking_privacy_throttle.sql).

### 3. Los dos controles de matriz no son mutaciones anónimas demostradas

Se leyeron las definiciones alojadas de studio_set_role_module_access y
studio_reset_role_module_access. Ambas obtienen tenant/actor del contexto y
rechazan antes de mutar si no hay membership activo o el rol no es admin.
El set además protege módulos gobernados y valida parámetros.

La ACL anon sigue siendo más amplia que el contrato administrativo esperado:
queda una revisión de mínimo privilegio, **no un bypass confirmado**.
Referencias: [0357](../../supabase/migrations/0357_role_module_overrides.sql)
y [consumidores](../../app/studio/(app)/admin/actions.ts). Antes de retirar
anon/PUBLIC: prueba negativa anónima y controles positivos admin/no-admin,
preservando el acceso legítimo authenticated. No se ejecutó esa prueba en Cloud.

### 4. Nueve triggers, no nueve RPC ordinarias

El catálogo confirma retorno trigger y un evento asociado habilitado para cada
uno. Ocho producen aviso para ambos roles; update_user_tenants_last_login sólo
para authenticated y está ligado a auth.sessions. La definición de una función
de trigger y su contexto de ejecución son distintos de una función ordinaria:
[PostgreSQL17](https://www.postgresql.org/docs/17/plpgsql-trigger.html).

No se prueba exposición RPC invocándolos. Su ACL merece revisión acotada,
conservando los eventos y sus invariantes. No se toca auth.sessions ni se
interpreta esta clasificación como certificación de todos los paths de escritura.

### 5. pg_net no admite el traslado genérico sugerido

El catálogo reporta pg_net0.20.0 en public, `extrelocatable=false`; las funciones
miembro de la extensión están en net. Por eso no procede convertir la sugerencia
genérica del advisor en un ALTER EXTENSION SET SCHEMA. Esta operación exige una
extensión relocatable: [PostgreSQL17](https://www.postgresql.org/docs/17/sql-alterextension.html).
Falta el procedimiento específico soportado por el proveedor y un entorno
no productivo para validar dependencias. No se reinstala ni desactiva pg_net.

## Cola por dominio

Cuenta avisos, no vulnerabilidades ni tickets nuevos. La categoría individual
vive en el anexo y el JSON; todos los dominios requieren criterios explícitos
antes de autorizar cambios de contrato.

| Dominio | Avisos |
|---|---:|
| Portal, clientes y aliados | 35 |
| Auditoría y gobierno | 29 |
| Secuencias transversales | 29 |
| Identidad y permisos | 23 |
| Catálogo público y tarifas | 22 |
| Finanzas y reclamos | 13 |
| Operación logística | 10 |
| Documentos y adjuntos | 8 |
| Nómina y personal | 8 |
| Compras y proveedores | 6 |
| Bugs, bitácora y comentarios | 5 |
| Marca | 3 |
| Tracking público | 3 |
| Academia y personas | 3 |
| Telegram | 2 |
| Correo y marketing | 2 |
| Verificación pública | 1 |
| Extensiones de plataforma | 1 |
| Legal | 1 |
| **Total** | **204** |

Orden de revisión restante:

1. Terminar los gates ya preparados0399/0400 y0421→consumidores→0422/0423, cada
   uno con autorización independiente. La clasificación no habilita ejecución.
2. Finanzas/documentos: contrato por entidad para principal, tenant, rol,
   archivado, idempotencia y auditoría. Las139 funciones authenticated **no**
   fueron declaradas seguras leyendo su nombre o una referencia.
3. Matriz de roles: evaluar retirar permiso anon conservando admin autorizado;
   después helpers y secuencias por su dominio, sin un REVOKE global.
4. Público/Tracking: consumidores reales, minimización y barreras de abuso.
   El retorno o una mención en código no demuestran alcance comercial actual.
5. Triggers/extensión: higiene de privilegios y compatibilidad de plataforma,
   sin borrar eventos ni objetos gestionados por Supabase.

## Método, verificación y límites

- Cruce completo advisor↔pg_proc por nombre/firma: se normaliza únicamente el
  prefijo public. de tipos y espacios. Una firma ambigua o ausente aborta el
  emparejamiento; no se asigna un dominio por fallback silencioso.
- Escaneo textual de1.664 archivos TypeScript en app/, lib/, components/ y
  supabase/functions/, excluyendo tests.108 funciones tienen menciones .rpc
  literales;54 no. No analiza llamadas dinámicas, SQL/RLS, clientes externos o
  montado de páginas: **no es prueba de reachability ni desuso**.
- Los162 objetos tienen una referencia textual CREATE FUNCTION en migraciones.
  Se conservó la última por orden de archivo para navegación, no como prueba
  del cuerpo instalado: hay historia normalizada/reparaciones. El MD5 alojado
  es evidencia separada. No se certificó igualdad cuerpo por cuerpo con Git.
- No hay SQL de negocio, escrituras, migraciones, cambios de auth, secretos,
  despliegues, supresiones de avisos ni ejecución de funciones auditadas.
- La suite6.441/538 y Deno4/4 corresponden al incremento anterior de Kommo;
  no se presentan como pruebas nuevas de estos204 avisos. Esta pieza sólo
  requiere integridad del snapshot, rutas, recuentos y gates documentales.

Verificación local ejecutada con Node (fs, assert y crypto): JSON válido,
204 cache_keys únicos,162 firmas únicas,20 tablas,1 extensión y19 dominios;
correspondencia exacta entre cada aviso y sus metadatos, roles/categorías,
triggers habilitados y referencias de archivo/línea sin errores. Snapshot:
213.771 bytes, SHA-256
`8402922847e5de057e7e0b10e2ef7fd8ed38e43fc3ec46020165be62e965452a`.
docs:check y diff --check aprobados. La revisión independiente confirmó
341 referencias (179 menciones RPC y162 declaraciones CREATE), sin faltantes.
Se precisó que SELECT se midió a nivel tabla, no a nivel columna.

Fuentes oficiales del asesor, consultadas para interpretar los avisos:
[sin policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[extensión](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[EXECUTE anon](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable)
y [EXECUTE authenticated](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable).
Se consultó el changelog; no se adoptaron upgrades ni cambios de proveedor.

## Anexo: clasificación de las162 funciones

Las etiquetas son destinos de trabajo, no resultados de una prueba de autorización.
La firma completa, los helpers y las referencias están en el snapshot enlazado.

| Función | Dominio | Roles con EXECUTE | Categoría |
|---|---|---|---|
| `academy_verify_diploma` | Academia y personas | anon + authenticated | release_0400 |
| `add_document_version` | Documentos y adjuntos | authenticated | authenticated_contract_review |
| `admin_create_operario` | Identidad y permisos | authenticated | authenticated_contract_review |
| `admin_reset_operario_pin` | Identidad y permisos | authenticated | authenticated_contract_review |
| `admin_set_operario_active` | Identidad y permisos | authenticated | authenticated_contract_review |
| `admin_update_operario` | Identidad y permisos | authenticated | authenticated_contract_review |
| `aliado_prefix_chain` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `aliados_guard_prefijo_libre` | Portal, clientes y aliados | anon + authenticated | trigger_linked |
| `aliados_guard_raiz_con_lista` | Portal, clientes y aliados | anon + authenticated | trigger_linked |
| `aliados_guard_sin_ciclo` | Portal, clientes y aliados | anon + authenticated | trigger_linked |
| `assert_studio_role` | Identidad y permisos | authenticated | authenticated_contract_review |
| `attach_document_to_expense` | Documentos y adjuntos | authenticated | authenticated_contract_review |
| `audit_approve_export` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_approve_legal_hold_release` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_approve_retention_batch` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_authorize_export_download` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_create_legal_hold` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_d1_auth_intent` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_d1_auth_transition` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_d1_execute` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_d5_external_intent` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_d5_external_transition` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_get_event_detail` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_list_events` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_list_legal_holds` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_request_export` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_request_legal_hold_release` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `audit_retention_dry_run` | Auditoría y gobierno | authenticated | authenticated_contract_review |
| `authorize_consolidation_governed` | Operación logística | authenticated | authenticated_contract_review |
| `bitacora_assignable_profiles` | Bugs, bitácora y comentarios | authenticated | authenticated_contract_review |
| `bitacora_is_tenant_admin` | Bugs, bitácora y comentarios | authenticated | authenticated_contract_review |
| `bug_advance_state` | Bugs, bitácora y comentarios | authenticated | authenticated_contract_review |
| `bug_increment_duplicate` | Bugs, bitácora y comentarios | authenticated | authenticated_contract_review |
| `cancel_dispatch_order_governed` | Operación logística | authenticated | authenticated_contract_review |
| `charge_in_tenant` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `clear_customs_filing_governed` | Operación logística | authenticated | authenticated_contract_review |
| `client_duplicate_candidates` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `clients_guard_markbox_aliado` | Portal, clientes y aliados | anon + authenticated | trigger_linked |
| `clients_guard_no_merge_aliado` | Portal, clientes y aliados | anon + authenticated | trigger_linked |
| `comment_entity_in_tenant` | Bugs, bitácora y comentarios | authenticated | authenticated_contract_review |
| `complete_tms_route_governed` | Operación logística | authenticated | authenticated_contract_review |
| `complete_ve_delivery_governed` | Operación logística | authenticated | authenticated_contract_review |
| `confirm_bank_change` | Nómina y personal | authenticated | authenticated_contract_review |
| `confirm_payment_report` | Finanzas y reclamos | authenticated | release_0421_0422 |
| `container_in_tenant` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `current_studio_role` | Identidad y permisos | authenticated | authenticated_contract_review |
| `document_entity_in_tenant` | Documentos y adjuntos | authenticated | authenticated_contract_review |
| `finalize_document_upload` | Documentos y adjuntos | authenticated | authenticated_contract_review |
| `fiscal_post_book` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `get_accounting_closing_date` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `get_employee_id_for_user` | Nómina y personal | authenticated | authenticated_contract_review |
| `get_my_payslip` | Nómina y personal | authenticated | authenticated_contract_review |
| `get_my_payslip_periods` | Nómina y personal | authenticated | authenticated_contract_review |
| `get_portal_client_id` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `get_portal_client_markbox` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `get_portal_client_tenant` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `get_portal_person_id` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `get_user_tenant_id` | Identidad y permisos | authenticated | authenticated_contract_review |
| `has_any_back_role` | Identidad y permisos | authenticated | authenticated_contract_review |
| `has_back_role` | Identidad y permisos | authenticated | authenticated_contract_review |
| `is_tenant_admin` | Identidad y permisos | authenticated | authenticated_contract_review |
| `journal_entry_in_tenant` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `journal_entry_is_closed` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `ledger_entry_in_tenant` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `legal_client_in_tenant` | Legal | authenticated | authenticated_contract_review |
| `mail_check_blacklist` | Correo y marketing | authenticated | authenticated_contract_review |
| `mark_claim_offset_paid_in_china_governed` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `markbox_choca_con_insignia` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `markbox_existe_publico` | Portal, clientes y aliados | anon + authenticated | release_0400 |
| `merge_clients` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `newsletter_list_campaigns` | Correo y marketing | authenticated | authenticated_contract_review |
| `next_agent_slug` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_bill_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_booking_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_bug_folio` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_claim_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_consolidation_ref` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_dispatch_order_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_dua_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_employee_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_entry_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_estimate_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_expense_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_incident_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_invoice_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_markbox` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `next_markbox_aliado` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `next_order_seq` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_partner_ledger_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_payment_order_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_purchase_order_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_quote_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_receipt_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_referral_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_rendition_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_route_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_sales_order_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_settlement_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_supplier_claim_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_supplier_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_supplier_seq` | Secuencias transversales | authenticated | authenticated_contract_review |
| `next_warning_code` | Secuencias transversales | authenticated | authenticated_contract_review |
| `nomina_can_access` | Nómina y personal | authenticated | authenticated_contract_review |
| `pay_claim_indemnity_governed` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `person_in_tenant` | Academia y personas | authenticated | authenticated_contract_review |
| `portal_approve_client` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `portal_bind_session` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `portal_bump_invite_count` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `portal_create_access_link` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `portal_invite_client` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `portal_post_message` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `portal_revoke_access_link` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `portal_revoke_client` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `prealerta_sales_order_in_tenant` | Compras y proveedores | authenticated | authenticated_contract_review |
| `prealerta_supplier_in_tenant` | Compras y proveedores | authenticated | authenticated_contract_review |
| `price_books_guard_aliado` | Catálogo público y tarifas | anon + authenticated | trigger_linked |
| `public_calculator_cities` | Catálogo público y tarifas | anon + authenticated | public_catalog_contract_review |
| `public_calculator_config` | Catálogo público y tarifas | anon + authenticated | public_catalog_contract_review |
| `public_carrier_tariffs` | Catálogo público y tarifas | anon + authenticated | public_catalog_contract_review |
| `public_cbm_rate` | Catálogo público y tarifas | anon + authenticated | public_catalog_contract_review |
| `public_fcl_rates` | Catálogo público y tarifas | anon + authenticated | public_catalog_contract_review |
| `public_ocean_rate` | Catálogo público y tarifas | anon + authenticated | public_catalog_contract_review |
| `public_service_faqs` | Catálogo público y tarifas | anon + authenticated | public_catalog_contract_review |
| `public_servicios` | Catálogo público y tarifas | anon + authenticated | public_catalog_contract_review |
| `public_track_shipment` | Tracking público | anon + authenticated | legacy_public_tracking_review |
| `purchase_order_in_tenant` | Compras y proveedores | authenticated | authenticated_contract_review |
| `rates_guard_price_book` | Catálogo público y tarifas | anon + authenticated | trigger_linked |
| `reauthorize_document_upload` | Documentos y adjuntos | authenticated | authenticated_contract_review |
| `referral_client_in_tenant` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `rename_client_markbox` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `rename_legacy_markboxes` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `rendition_receipt_in_tenant` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `request_document_restore` | Documentos y adjuntos | authenticated | authenticated_contract_review |
| `request_my_bank_change` | Nómina y personal | authenticated | authenticated_contract_review |
| `reserve_document_upload` | Documentos y adjuntos | authenticated | authenticated_contract_review |
| `resolve_markbox` | Portal, clientes y aliados | authenticated | authenticated_contract_review |
| `retire_inspection_report_governed` | Operación logística | authenticated | authenticated_contract_review |
| `seed_tenant_cities_from_ve_catalog` | Operación logística | authenticated | authenticated_contract_review |
| `set_brand_access_code` | Marca | authenticated | authenticated_contract_review |
| `set_brand_internal_code` | Marca | authenticated | authenticated_contract_review |
| `set_prealerta_share_active` | Compras y proveedores | authenticated | authenticated_contract_review |
| `shipment_in_tenant` | Operación logística | authenticated | authenticated_contract_review |
| `soft_delete_document` | Documentos y adjuntos | authenticated | authenticated_contract_review |
| `statement_in_tenant` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `studio_accept_invitation` | Identidad y permisos | authenticated | authenticated_contract_review |
| `studio_change_user_role` | Identidad y permisos | authenticated | authenticated_contract_review |
| `studio_invite_user` | Identidad y permisos | authenticated | authenticated_contract_review |
| `studio_reset_role_module_access` | Identidad y permisos | anon + authenticated | anon_admin_guarded_review |
| `studio_revoke_invitation` | Identidad y permisos | authenticated | authenticated_contract_review |
| `studio_set_role_module_access` | Identidad y permisos | anon + authenticated | anon_admin_guarded_review |
| `studio_set_user_disabled` | Identidad y permisos | authenticated | authenticated_contract_review |
| `studio_set_user_warehouse_scope` | Identidad y permisos | authenticated | authenticated_contract_review |
| `supplier_cn_in_tenant` | Compras y proveedores | authenticated | authenticated_contract_review |
| `supplier_in_tenant` | Compras y proveedores | authenticated | authenticated_contract_review |
| `telegram_alert_routes_guard_tenant` | Telegram | anon + authenticated | trigger_linked |
| `update_my_contact` | Nómina y personal | authenticated | authenticated_contract_review |
| `update_shipment_plan` | Operación logística | authenticated | authenticated_contract_review |
| `update_user_tenants_last_login` | Identidad y permisos | authenticated | trigger_linked |
| `upsert_dispatch_rules` | Operación logística | authenticated | authenticated_contract_review |
| `user_in_tenant` | Identidad y permisos | authenticated | authenticated_contract_review |
| `void_expense_governed` | Finanzas y reclamos | authenticated | authenticated_contract_review |
| `void_payroll_settlement_governed` | Nómina y personal | authenticated | authenticated_contract_review |

## Allowlist de este incremento documental

- docs/audits/2026-09-02-codex-triaje-advisors.md
- docs/audits/assets/2026-09-02-advisors-security.json
- docs/audits/2026-09-02-codex-arranque-checklist.md
- .agents/handoffs/2026-09-02-saneamiento-integral-close.md

No requiere SDD nueva: no cambia comportamiento, API, esquema ni componentes.
No cambia el número de specs ni el denominador103 del checklist.
