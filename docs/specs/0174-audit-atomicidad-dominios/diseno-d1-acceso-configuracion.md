# Diseño técnico D1 — acceso y configuración

| Control | Valor |
|---|---|
| SDD | [SDD-0174](spec.md) |
| Gate | D1 · diseño local |
| Inventario | [47 acciones revalidadas](inventario-d1-acceso-configuracion-2026-07-29.md) |
| Revisión | [REV-AUD-017](../../governance/reviews/aud-d1-access-config-design.md) |
| Estado | aprobado técnicamente; implementación no abierta |

## 1. Decisión

D1 implementará 24 acciones obligatorias de acceso y configuración sensible.
Las otras 23 filas del inventario permanecen explícitamente fuera de esta
implementación: 21 pasan al ledger D5 y perfil/preferencias quedan fuera de D1.

Las mutaciones puramente PostgreSQL usarán RPCs de dominio que mutan y llaman
`append_audit_event` dentro de la misma transacción. Suspender y reactivar
usuarios usan un workflow durable porque Supabase Auth no comparte una
transacción con PostgreSQL.

**No existe ni se declara atomicidad ACID entre PostgreSQL y Supabase Auth.**

## 2. Workflow durable de Auth

```text
intención durable en PostgreSQL
  → claim idempotente por adapter
  → efecto Supabase Auth
  → confirmación PostgreSQL + evento final
       ↘ si falla: compensación Auth
           ↘ si falla: reconciliación requerida
```

### 2.1 Registro de operación

La futura tabla `audit_external_operations` conserva solo metadatos:

| Campo | Contrato |
|---|---|
| `id` | UUID interno y `operation_id` canónico. |
| `tenant_id` | Derivado de membresía activa; nunca del formulario. |
| `operation_key` | Clave opaca única por tenant y operación. |
| `operation_type` | `membership.disable` o `membership.enable`. |
| `target_id` | UUID del usuario objetivo. |
| `requested_by` | `auth.uid()` del actor. |
| `reason` | Obligatorio, 8–500 caracteres. |
| `correlation_id` | Une intención, Auth, confirmación y compensación. |
| `desired_state` | `disabled` o `enabled`. |
| `status` | Estado cerrado de la máquina. |
| `attempt_count` / `next_attempt_at` | Reintento acotado y observable. |
| `last_error_code` | Código estable y redactado; nunca mensaje crudo. |
| `claimed_at` / `claim_expires_at` | Lease para un solo ejecutor. |
| timestamps | Hora de servidor para intención y transiciones. |

`unique (tenant_id, operation_key)` devuelve el resultado existente para una
repetición compatible. La misma clave con target, tipo o estado distinto falla
como conflicto de idempotencia.

### 2.2 Estados

| Estado | Significado | Siguiente acción |
|---|---|---|
| `intent_recorded` | Validación, anti-lockout y evento de solicitud persistidos. | Ejecutar Auth. |
| `auth_in_progress` | Un adapter tiene lease vigente. | Esperar o recuperar lease vencido. |
| `auth_succeeded` | Auth confirmó el estado solicitado. | Confirmar membresía y evento final. |
| `confirmed` | DB y Auth observados en el estado deseado. | Terminal exitoso. |
| `auth_failed_retryable` | Auth falló con causa reintentable. | Backoff + reintento. |
| `auth_failed_terminal` | Auth rechazó de forma no reintentable. | Terminal fallido con causa estable. |
| `confirmation_failed` | Auth cambió, pero la confirmación DB falló. | Compensar. |
| `compensation_in_progress` | Adapter intenta restaurar el estado Auth previo. | Confirmar compensación. |
| `compensated` | Auth volvió al estado previo y DB nunca cambió. | Terminal sin mutación efectiva. |
| `reconciliation_required` | No se pudo confirmar ni compensar con certeza. | Operación visible y reconciliador. |

No se borra una operación fallida. Un nuevo intento usa la misma
`operation_key` o crea otra operación enlazada; nunca reescribe la historia.

### 2.3 Suspensión

1. La RPC de intención valida admin/capability, anti-lockout, membresía activa,
   motivo e idempotencia; registra `membership.disable_requested`.
2. El adapter bane a través de Auth fuera de la transacción PostgreSQL.
3. La RPC de confirmación vuelve a validar la intención, bloquea membresía,
   fija `disabled_at` y registra `membership.disabled` en un commit único.
4. Si Auth falla, DB permanece activa y la operación queda fallida/reintentable.
5. Si Auth funciona pero la confirmación DB falla, se intenta desbanear. Si la
   compensación falla, queda `reconciliation_required`; nunca se anuncia éxito.

### 2.4 Reactivación

1. La intención exige membresía desactivada y registra
   `membership.enable_requested`.
2. El adapter desbanea en Auth.
3. La confirmación DB retira `disabled_at` y registra `membership.enabled` en
   una sola transacción.
4. Si confirmar falla, se intenta rebanear. Mientras DB siga desactivada, RLS
   continúa negando acceso.
5. Si la compensación falla, el estado es `reconciliation_required`; la UI no
   muestra “Activo”.

## 3. Reconciliación

Un reconciliador read-only respecto de negocio:

- reclama operaciones no terminales con lease vencido;
- consulta en Auth únicamente `user_id` y estado de ban, sin email ni metadata;
- compara estado esperado, estado Auth y `disabled_at`;
- reintenta confirmar o compensar con la misma clave;
- eleva a intervención humana después del máximo de intentos;
- registra cada transición como evento, sin duplicar el evento final;
- expone conteos y antigüedad, nunca payloads o PII.

Un admin puede pedir reintento, pero no editar estados manualmente. Resolver una
operación incierta exige motivo y deja `membership.reconciled`.

## 4. Idempotencia por frontera

- todas las RPCs D1 reciben `p_operation_id uuid`;
- las operaciones puramente DB tienen `unique (tenant_id, operation_id,
  operation_type)` y retornan la respuesta previa;
- instalación de agente crea agente y grants en una sola RPC; no deja un agente
  “instalado” si falla un grant;
- crear API key genera el secreto solo después de reservar la operación y
  nunca persiste el texto claro en auditoría;
- webhooks y cuentas usan el ID de entidad y compare-and-set/versionado para
  impedir sobrescritura perdida;
- `before_data` y `after_data` solo incluyen campos allowlist;
- un fallo forzado de `append_audit_event` revierte toda mutación PostgreSQL.

## 5. Estados fallidos y respuesta

| Código | Uso |
|---|---|
| `invalid_input` | Validación determinista; no crea intención. |
| `permission_denied` | Actor/capability/tenant no autorizados. |
| `invalid_state` | Transición no permitida o anti-lockout. |
| `idempotency_conflict` | Clave reutilizada con parámetros distintos. |
| `auth_retryable` | Timeout/5xx/rate limit; se reintenta. |
| `auth_terminal` | Usuario inexistente u operación rechazada estable. |
| `confirmation_failed` | Auth cambió y DB no confirmó. |
| `compensation_failed` | No se pudo restaurar Auth. |
| `reconciliation_required` | Estado incierto; requiere reconciliación. |
| `audit_failed` | El evento obligatorio falló; la mutación DB revierte. |

Mensajes externos se mapean a estos códigos. No se persisten stack traces,
respuestas Auth completas ni mensajes que contengan datos personales.

## 6. Payloads prohibidos

Nunca entran en intención, auditoría, logs o respuestas persistidas:

- API key, token, secret, contraseña, cookie, JWT, refresh token, OTP o hash
  reutilizable;
- número de cuenta completo, datos de tarjeta, PIN o credenciales bancarias;
- URL de webhook completa, query string, headers, firma o URL firmada;
- email, teléfono, dirección, RIF, nombres completos o listas de destinatarios;
- `telegram_chat_id`, username, link code o contenido de mensajes;
- contenido de correo, plantilla renderizada, archivo, blob o base64;
- metadata completa de Auth, sesión, IP, user agent o respuesta cruda del
  proveedor;
- errores/stack traces sin redacción.

Se permiten IDs internos, estado anterior/nuevo, rol/scope, capability,
fingerprint no autenticable cuando esté justificado, últimos cuatro de cuenta
solo si una revisión de privacidad lo aprueba, códigos estables y conteos.

## 7. Ledger D1

Las 24 filas obligatorias usan los eventos definidos en el inventario. Por
grupo:

| Grupo | Acciones | Frontera |
|---|---:|---|
| membresía/canales | 8 | RPC; disable/enable con workflow Auth |
| API/webhooks | 4 | RPC transaccional |
| empresa/oficinas/cuentas | 5 | RPC transaccional |
| flags/legal | 2 | RPC transaccional |
| notificaciones | 3 | RPC transaccional |
| agentes/grants | 2 | RPC transaccional compuesta |
| **Total D1** | **24** | **cero writer best-effort** |

## 8. Allowlist exacta de implementación futura

Esta lista limita el futuro gate local; **no lo abre**. El correlativo fue libre
en `origin/main` al diseñar y debe revalidarse antes de crear archivos.

### Migración y pruebas

1. `supabase/migrations/0271_audit_d1_access_configuration.sql`
2. `supabase/tests/0271_audit_d1_access_configuration.test.sql`
3. `lib/studio/audit/__tests__/d1-access-config-adapters.test.ts`

### Adapters y callers

4. `lib/studio/audit/d1-access-config-adapters.ts`
5. `lib/studio/audit/auth-lifecycle-adapter.ts`
6. `app/studio/(app)/usuarios/actions.ts`
7. `app/studio/(app)/admin/api-integration-actions.ts`
8. `app/studio/(app)/admin/company-actions.ts`
9. `app/studio/(app)/admin/feature-flags/actions.ts`
10. `app/studio/(app)/admin/notificaciones/actions.ts`
11. `app/studio/(app)/admin/numbering-actions.ts`
12. `app/studio/(app)/admin/agentes/actions.ts`

### Documentación de cierre local

13. `docs/specs/0174-audit-atomicidad-dominios/spec.md`
14. `docs/specs/0174-audit-atomicidad-dominios/diseno-d1-acceso-configuracion.md`
15. `docs/specs/0174-audit-atomicidad-dominios/inventario-d1-acceso-configuracion-2026-07-29.md`
16. `docs/governance/reviews/aud-d1-access-config-implementation.md`
17. `docs/governance/README.md`
18. una nueva `docs/governance/BASELINE-YYYY-MM-DD[-NN].md`

Quedan fuera: archivos de correo, PDFs, documentos vivos, D2–D5, `0270`,
Vercel, Cloud y cualquier otro caller.

## 9. Criterios para abrir implementación

- correlativo 0271 revalidado contra `origin/main` y worktrees;
- diseño y ledger sin filas ambiguas;
- tests PostgreSQL 15/17 definidos antes del DDL;
- simulación de Auth con éxito, timeout, fallo terminal, confirmación fallida,
  compensación fallida y reconciliación;
- ACL mínima, `search_path=''`, owner revisado y EXECUTE sin `PUBLIC`/`anon`;
- cero secreto/PII en fixtures o snapshots;
- commit, Cloud y Producción conservan autorizaciones separadas.

## 10. Veredicto

El diseño D1 está cerrado y aprobado técnicamente. No se creó migración, no se
modificó producto/Auth y D2–D5 permanecen cerrados.
