# Diseño correctivo del Corte C — consulta gobernada y RBAC

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Diseño | Corte C · v1.2 |
| Base | [Inventario read-only](inventario-corte-c-2026-07-28.md) |
| Revisión de diseño | [REV-AUD-012](../../governance/reviews/aud-corte-c.md) |
| Revisión de implementación | [REV-AUD-013](../../governance/reviews/aud-corte-c1.md) |
| Estado | C1 en Producción; allowlist v2 implementada localmente y no aplicada |

## 1. Decisión

El Corte C se implementará con una frontera DB admin-only, dos RPCs separadas y
un adaptador de aplicación que nunca recibe JSON crudo en la lista.

```text
sesión autenticada
  -> membership activa + role=admin
  -> audit_list_events (redacted, filtros, cursor)
  -> adaptador tipado
  -> viewer server-side

reveal excepcional
  -> motivo + AAL2
  -> audit_get_event_detail
  -> evento audit_sensitive_accessed en la misma transacción
```

## 2. Capabilities

El código añadirá capabilities admin-only:

- `audit_view`;
- `audit_view_sensitive`.

Ambas usan `[]` en `CAPABILITIES`, por lo que solo `admin` pasa mediante
`canSpecial`. La DB repite el control con `auth.uid()`, membership activa,
tenant derivado y `user_tenants.role='admin'`. El módulo Administración no es
prueba suficiente de autorización.

## 3. RPC de lista

`audit_list_events`:

- no recibe tenant;
- deriva tenant/rol de la sesión;
- acepta `limit` entre 1 y 100;
- acepta filtros allowlist: entidad, actor, evento, source, result,
  sensitivity, rango UTC y coincidencia exacta de correlación;
- usa cursor base64url opaco de `occurred_at|id`;
- ordena por `occurred_at DESC, id DESC`;
- resuelve actor solo dentro del tenant;
- devuelve `actor_resolved` y nombre nullable;
- devuelve zona `UTC` como dato explícito;
- devuelve `has_more` y `next_cursor`;
- no devuelve `payload`, `before_data`, `after_data` ni `reason`;
- devuelve únicamente un `summary` generado por allowlist versionada. La v1
  fue vacía. La v2 admite solo `{ "action": <valor> }` cuando coinciden las
  cuatro dimensiones aprobadas: `entity_type=comment`, evento
  `comment_soft_deleted|comment_restored`, schema `comment.lifecycle.v1` y una
  de las cinco acciones de SDD-0168;
- cualquier otra entidad, evento, schema o acción devuelve `summary=null`.

Una clave futura no sale por defecto. Ampliar la allowlist exige revisión
documental y pruebas de no filtración.

## 4. Detalle sensible

`audit_get_event_detail(p_event_id, p_reason)`:

- exige admin del mismo tenant;
- exige motivo normalizado de 8 a 500 caracteres;
- exige JWT `aal2`; sin MFA falla cerrado;
- solo revela claves registradas en una allowlist versionada;
- en v1 la allowlist es vacía, por lo que la función prueba el control y
  registra acceso, pero devuelve un objeto redacted sin PII;
- inserta exactamente un evento `audit_sensitive_accessed` mediante
  `append_audit_event` en la misma transacción;
- el evento contiene alcance, motivo y resultado, nunca los valores leídos;
- consultar el evento de acceso no genera otro evento.

El reveal útil de campos se abre únicamente cuando exista una allowlist
aprobada. Esto evita fabricar una falsa reautenticación o exponer payload antes
de que MFA esté operativo para el flujo.

## 5. ACL, RLS y Realtime

La migración C1:

1. crea las RPCs y helpers privados con `search_path=''`;
2. revoca `EXECUTE` a `PUBLIC` y `anon`;
3. concede solo las RPCs públicas a `authenticated`;
4. prueba admin, no-admin, tenant ajeno, cursor y salida redacted;
5. retira `entity_audit_log` de `supabase_realtime`;
6. revoca `SELECT` de tabla a `authenticated`;
7. elimina `entity_audit_log_tenant_select`;
8. conserva RLS habilitado y `INSERT service_role`;
9. verifica que ningún rol de aplicación tenga `SELECT/UPDATE/DELETE`.

El retiro de Realtime se justifica por cero consumidores locales y porque la
tabla transmite payload crudo. Si aparece un consumidor externo, C1 se detiene
antes de DDL y exige un canal redacted con alcance propio.

## 6. Aplicación

El adaptador reemplaza `getRecentAuditEvents` por un resultado discriminado:

```ts
type AuditListResult =
  | { ok: true; events: AuditEvent[]; nextCursor: string | null }
  | { ok: false; events: []; code: "forbidden" | "invalid_filter" | "query_failed" };
```

El viewer:

- usa filtros en URL y consulta server-side;
- no recibe props con payload;
- muestra actor real o No resuelto;
- muestra fuente, resultado, sensibilidad, correlación y UTC;
- distingue vacío, sin resultados, error y fin;
- pagina con enlaces de cursor;
- no ofrece reveal hasta que AAL2 y una allowlist no vacía estén verificados;
- mantiene una alternativa móvil legible.

`AUDIT_GOVERNED_VIEWER=false` conserva temporalmente la presentación previa
sobre el nuevo adaptador redacted. No existe fallback al SELECT directo.

## 7. Índices

Los índices de tenant/fecha y tenant/correlación cubren el cursor y la
coincidencia exacta. C1 no añade índices especulativos para source, result o
sensitivity mientras Cloud conserva tres filas. Los advisors posteriores
determinarán si una carga real justifica otro índice.

## 8. Pruebas obligatorias

### PostgreSQL

- anon no ejecuta RPC;
- no-admin autenticado falla;
- admin lista solo su tenant;
- tenant arbitrario no es parámetro;
- cursor estable no duplica ni omite;
- filtros inválidos fallan;
- salida no contiene columnas JSON ni motivo;
- resumen de comentario contiene una sola clave `action` para la combinación
  allowlist y queda `null` ante schema, acción, entidad o evento desconocido;
- un secreto colocado junto a `payload.action` no aparece en la fila serializada;
- reveal sin AAL2, sin motivo o de tenant ajeno falla;
- reveal permitido produce exactamente un evento sin copiar PII;
- tabla queda sin `SELECT authenticated`;
- `service_role` conserva solo `INSERT`;
- Realtime deja de publicar la tabla;
- rollback total en PostgreSQL 15 y 17.

### Aplicación

- capabilities admin-only;
- adaptación de los cinco tipos de actor;
- actor desconocido queda No resuelto;
- filtros se serializan de forma segura;
- error no se convierte en vacío;
- HTML/props no contienen payload;
- estados vacío, error y fin;
- revisión visual y accesibilidad conforme SGE-00/A11Y-01/TBL-01.

## 9. Rollback

Un fallo de UI permite desactivar la presentación nueva mediante el flag y
usar la presentación compatible sobre la misma RPC. La ACL cruda no se
restaura. Un defecto DB se corrige hacia adelante; reotorgar SELECT exige
excepción SGE con responsable y vencimiento.

## 10. Allowlist exacta de C1 local

Antes de crear archivos se revalidan `origin/main`, worktrees y el número de
migración. C0 reservó inicialmente `0269`, pero otra ventana publicó
`0269_prealertas_client_note.sql` durante C1. La revalidación previa a integrar
movió este contrato al siguiente número libre:

1. `supabase/migrations/0270_audit_governed_query_rbac.sql`;
2. `supabase/tests/0270_audit_governed_query_rbac.test.sql`;
3. `lib/studio/rbac.ts`;
4. `lib/studio/rbac.test.ts`;
5. `lib/studio/audit-types.ts`;
6. `lib/studio/audit-queries.ts`;
7. `lib/studio/audit-queries.test.ts`;
8. `app/studio/(app)/admin/_components/AuditLogSection.tsx`;
9. `app/studio/(app)/admin/page.tsx`;
10. `docs/specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md`;
11. `docs/specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-c.md`;
12. `docs/governance/reviews/aud-corte-c1.md`;
13. `docs/governance/BASELINE-2026-07-28-08.md`;
14. `docs/governance/README.md`.

El índice generado `docs/specs/README.md` solo entra si `docs:index` lo cambia.
Ningún otro archivo está autorizado para C1 sin registrar la ampliación.

## 11. Gates

C0 aprueba diseño. C1 local, commit, integración, Cloud, receipt Cloud y
verificación visual son gates separados. Aplicar Cloud exige nombrar
exactamente `0270_audit_governed_query_rbac`.

## 12. Resultado local C1

La implementación conserva la allowlist exacta de §10 y deja:

- `audit_list_events` con filtros allowlist, cursor estable y actor resuelto
  dentro del tenant;
- `audit_get_event_detail` fail-closed con admin, AAL2, motivo y allowlist v1
  vacía;
- tabla sin lectura directa para roles de aplicación en el contrato resultante;
- Realtime sin `entity_audit_log`;
- viewer server-side sin `payload`, `before_data`, `after_data` ni `reason`;
- fallback visual compatible sobre la misma RPC redacted, nunca sobre la tabla.

La prueba contractual cerró con rollback total en PostgreSQL 15 y 17. Las
pruebas de queries/RBAC sumaron 29 casos y typecheck quedó verde. Cloud no fue
modificado y la revisión visual autenticada requiere primero que la migración
exista en el entorno objetivo.

## 13. Ampliación allowlist v2 para SDD-0168

La autorización local del 2026-08-29 amplía exclusivamente el resumen de lista;
no abre el payload, `before_data`, `after_data`, `reason`, la tabla base ni el
reveal sensible. El contrato exacto es:

| Dimensión | Allowlist |
|---|---|
| Entidad | `comment` |
| Eventos | `comment_soft_deleted`, `comment_restored` |
| Schema de payload | `comment.lifecycle.v1` |
| Acciones | `self_delete`, `moderation`, `undo`, `ordinary_restore`, `exceptional_restore` |
| Salida | objeto JSON con la única clave `action` |

La implementación usa `CREATE OR REPLACE` sobre la definición completa de
`audit_list_events`. Antes de reemplazarla, la migración exige owner
`postgres`, `SECURITY DEFINER`, `search_path` vacío, control admin por tenant,
firma redacted y ausencia de `SELECT` directo. Si la definición base cambió,
aborta para evitar borrar trabajo concurrente.

Allowlist exacta de archivos:

1. `supabase/migrations/0398_audit_comment_action_summary.sql`;
2. `supabase/tests/0398_audit_comment_action_summary.test.sql`;
3. `lib/studio/audit-types.ts`;
4. `lib/studio/audit-queries.ts`;
5. `lib/studio/audit-queries.test.ts`;
6. `e2e/comments-lifecycle.spec.ts`;
7. `docs/specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md`;
8. `docs/specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-c.md`;
9. `docs/specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md`;
10. `docs/specs/0168-mp-01-comentarios-permanencia-restauracion/diseno-tecnico.md`;
11. `docs/governance/reviews/mp-01-comments-preview-e2e.md`.

`docs/specs/README.md` puede cambiar solo como índice generado. Commit,
aplicación Cloud de `0398_audit_comment_action_summary` y push conservan
autorizaciones separadas.
