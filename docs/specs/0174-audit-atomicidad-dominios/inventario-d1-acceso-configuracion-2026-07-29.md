# Inventario D1 — acceso y configuración

| Control | Valor |
|---|---|
| SDD | [SDD-0174](spec.md) |
| Fecha | 2026-07-29 |
| Modo | read-only |
| Alcance | acciones server-side de usuarios y Administración |
| Resultado | 47 acciones en 13 archivos |

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
