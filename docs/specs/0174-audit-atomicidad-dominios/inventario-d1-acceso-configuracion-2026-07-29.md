# Inventario D1 — acceso y configuración

| Control | Valor |
|---|---|
| SDD | [SDD-0174](spec.md) |
| Fecha | 2026-07-29 |
| Modo | read-only |
| Alcance | acciones server-side de usuarios y Administración |
| Resultado | 47 acciones en 13 archivos |
| Revalidación | 2026-07-29 · `origin/main` `e7be56c6245f23703703ff93026757c753e091f3` |

## 1. Clasificación

| Bloque | Acciones | Decisión D1 |
|---|---:|---|
| Usuarios, membresías y preferencias | 10 | roles, scopes, suspensión, reactivación y revocación son obligatorias; perfil/preferencias requieren clasificación separada |
| Integraciones API/webhooks | 4 | obligatorias; nunca registrar key, URL completa con secretos o headers |
| Empresa, oficinas y cuentas bancarias | 5 | obligatorias; cuenta bancaria solo por ID, tipo y últimos cuatro si la política lo permite |
| Feature flags | 1 | obligatoria |
| Numeración y leyendas legales | 1 | obligatoria |
| Notificaciones | 3 | obligatorias para reglas; no copiar destinatarios sensibles |
| Agentes y grants de herramientas | 2 | obligatorias |
| Configuración operativa restante | 21 | calendario, calculadora, FX, rutas, portal y addons pasan al ledger D5 salvo que el diseño D1 demuestre impacto de acceso |

## 2. Fronteras existentes

- invitación, cambio de rol, scope, disable/enable y revocación usan RPCs de
  membresía existentes;
- suspensión/reactivación también llama Supabase Auth y hoy no tiene una
  transacción distribuida;
- perfil, preferencias y Telegram escriben tablas directamente;
- feature flags, identidad de empresa, oficinas, cuentas bancarias y leyendas
  legales escriben tablas directamente;
- API keys y webhooks mutan configuración sensible directamente;
- instalación de agentes combina varias escrituras y grants.

## 3. Riesgos confirmados

1. una mutación DB puede persistir aunque falle el log best-effort;
2. Auth puede cambiar y DB fallar, o al contrario;
3. los payloads potenciales incluyen secretos, cuentas, URLs y destinatarios;
4. operaciones compuestas pueden quedar parciales;
5. la presencia de una RPC no demuestra que incluya el evento AUD-01;
6. el acceso administrativo debe usar capabilities explícitas, no solo la
   visibilidad de la pantalla.

## 4. Ledger inicial obligatorio

| Grupo | Eventos mínimos | Frontera prevista |
|---|---|---|
| membresía | `membership.invited`, `role_changed`, `scope_changed`, `disabled`, `enabled`, `invitation_revoked` | RPC de dominio; workflow durable para Auth |
| API | `api_key.created`, `api_key.revoked` | RPC; solo fingerprint/ID |
| webhook | `webhook.created`, `updated`, `disabled`, `deleted` | RPC; URL redactada |
| empresa | `tenant.identity_updated`, `office.*`, `bank_account.*` | RPC; payload mínimo |
| flags | `feature_flag.changed` | RPC con before/after |
| legal | `numbering.legal_legend_changed` | RPC |
| notificaciones | `notification_rule.*` | RPC |
| agentes | `agent.installed`, `agent.status_changed`, `tool_grant.changed` | RPC transaccional |

## 5. Exclusiones del payload

`api_key`, token, secret, password, hash reutilizable, número de cuenta completo,
datos personales no necesarios, URL firmada, contenido de mensajes y blobs.

## 6. Gate siguiente

D1 no está implementado. Antes de código se debe decidir la máquina
intención/confirmación/compensación de Auth, cerrar el ledger por acción y
publicar allowlist de migración, pruebas, adapters y documentación.

## 7. Revalidación de las 47 acciones

Se recontaron las funciones `export async function` de los mismos 13 archivos
contra `origin/main`. El total continúa en 47 y no apareció otro archivo dentro
del alcance D1. La clasificación distingue:

- `D1 obligatoria`: acceso, credenciales o configuración sensible;
- `D5 clasificar`: configuración operativa o personal que no se implementa en
  D1, sin declarar por ello conformidad;
- `no aplica D1`: la acción no cambia acceso/configuración sensible; conserva
  revisión posterior cuando otra política la requiera.

| # | Acción server-side | Tabla/RPC principal | Clasificación | Evento mínimo o ledger posterior |
|---:|---|---|---|---|
| 1 | `inviteUserAction` | `studio_invite_user` | D1 obligatoria | `membership.invited` |
| 2 | `changeUserRoleAction` | `studio_change_user_role` | D1 obligatoria | `membership.role_changed` |
| 3 | `changeWarehouseScopeAction` | `studio_set_user_warehouse_scope` | D1 obligatoria | `membership.scope_changed` |
| 4 | `disableUserAction` | membresía + Supabase Auth | D1 obligatoria | `membership.disable_requested` → `membership.disabled` |
| 5 | `enableUserAction` | Supabase Auth + membresía | D1 obligatoria | `membership.enable_requested` → `membership.enabled` |
| 6 | `revokeInvitationAction` | `studio_revoke_invitation` | D1 obligatoria | `membership.invitation_revoked` |
| 7 | `updateMyProfileAction` | `user_profiles` | no aplica D1 | perfil propio; revisar PII en D5 |
| 8 | `updateMyPreferencesAction` | `user_profiles` + `user_notification_prefs` | no aplica D1 | preferencias propias; revisar operación compuesta en D5 |
| 9 | `linkTelegramAccountAction` | `user_profiles` | D1 obligatoria | `notification_channel.link_requested` |
| 10 | `unlinkTelegramAccountAction` | `user_profiles` | D1 obligatoria | `notification_channel.unlinked` |
| 11 | `createApiKeyAction` | `api_keys` | D1 obligatoria | `api_key.created` |
| 12 | `revokeApiKeyAction` | `api_keys` | D1 obligatoria | `api_key.revoked` |
| 13 | `saveWebhookAction` | `webhooks` | D1 obligatoria | `webhook.created` o `webhook.updated` |
| 14 | `deleteWebhookAction` | `webhooks` | D1 obligatoria | `webhook.deleted` |
| 15 | `updateCompanyIdentityAction` | `tenants` | D1 obligatoria | `tenant.identity_updated` |
| 16 | `saveOfficeAction` | `company_offices` | D1 obligatoria | `office.created` o `office.updated` |
| 17 | `deleteOfficeAction` | `company_offices` | D1 obligatoria | `office.deleted` |
| 18 | `saveBankAccountAction` | `company_bank_accounts` | D1 obligatoria | `bank_account.created` o `bank_account.updated` |
| 19 | `deleteBankAccountAction` | `company_bank_accounts` | D1 obligatoria | `bank_account.deleted` |
| 20 | `toggleFeatureFlagAction` | `feature_flags` | D1 obligatoria | `feature_flag.changed` |
| 21 | `updateLegalLegendsAction` | `tenants` | D1 obligatoria | `numbering.legal_legend_changed` |
| 22 | `upsertRuleAction` | reglas de notificación | D1 obligatoria | `notification_rule.created` o `notification_rule.updated` |
| 23 | `deleteRuleAction` | reglas de notificación | D1 obligatoria | `notification_rule.deleted` |
| 24 | `restoreDefaultsAction` | reglas de notificación | D1 obligatoria | `notification_rule.defaults_restored` |
| 25 | `installSkillAction` | `agents` + `agent_tool_grants` | D1 obligatoria | `agent.installed` + `tool_grant.changed` |
| 26 | `toggleAgentStatusAction` | `agents` | D1 obligatoria | `agent.status_changed` |
| 27 | `saveCalculatorSettingsAction` | `calculator_settings` | D5 clasificar | `calculator.settings_changed` |
| 28 | `createCityAction` (calculadora) | `calculator_cities` | D5 clasificar | `calculator_city.created` |
| 29 | `updateCityAction` (calculadora) | `calculator_cities` | D5 clasificar | `calculator_city.updated` |
| 30 | `deleteCityAction` (calculadora) | `calculator_cities` | D5 clasificar | `calculator_city.deleted` |
| 31 | `saveCalendarEventAction` | `operational_calendar` | D5 clasificar | `calendar_event.created` o `calendar_event.updated` |
| 32 | `deleteCalendarEventAction` | `operational_calendar` | D5 clasificar | `calendar_event.deleted` |
| 33 | `recordExchangeRateAction` | `tenant_fx_history` | D5 clasificar | `exchange_rate.recorded` |
| 34 | `updateClientContactAction` | `clients` | D5 clasificar | `client.contact_updated` |
| 35 | `portalWhatsAppInviteAction` | portal/WhatsApp | D5 clasificar | `portal_invitation.sent` |
| 36 | `bulkWhatsAppInviteAction` | portal/WhatsApp | D5 clasificar | `portal_invitation.bulk_sent` |
| 37 | `bulkInvitePortalAction` | portal/Auth/correo | D5 clasificar | `portal_invitation.bulk_created` |
| 38 | `bulkResendPortalInviteAction` | portal/correo | D5 clasificar | `portal_invitation.bulk_resent` |
| 39 | `updatePrealertaAddonConfigAction` | `prealerta_addons` | D5 clasificar | `prealerta_addon.changed` |
| 40 | `createRouteAction` | `dispatch_routes` | D5 clasificar | `dispatch_route.created` |
| 41 | `updateRouteAction` | `dispatch_routes` | D5 clasificar | `dispatch_route.updated` |
| 42 | `softDeleteRouteAction` | `dispatch_routes` | D5 clasificar | `dispatch_route.deleted` |
| 43 | `toggleRouteActiveAction` | `dispatch_routes` | D5 clasificar | `dispatch_route.status_changed` |
| 44 | `createCityAction` (rutas) | `dispatch_city_catalog` | D5 clasificar | `dispatch_city.created` |
| 45 | `updateCityAction` (rutas) | `dispatch_city_catalog` | D5 clasificar | `dispatch_city.updated` |
| 46 | `softDeleteCityAction` (rutas) | `dispatch_city_catalog` | D5 clasificar | `dispatch_city.deleted` |
| 47 | `seedTenantCitiesFromVeCatalogAction` | RPC de catálogo | D5 clasificar | `dispatch_city.seeded` |

Resultado: 24 acciones D1 obligatorias, 21 trasladadas al ledger D5 y 2
acciones personales fuera de D1. Ninguna fila trasladada se considera conforme
ni implementada por esta clasificación.
