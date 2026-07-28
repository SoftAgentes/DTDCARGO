# Diseño técnico v1.0 — permanencia y restauración de comentarios

| Control | Valor |
|---|---|
| Documento | DT-SDD-0168 |
| SDD | [SDD-0168](spec.md) |
| Políticas | [MP-01](../../governance/policies/mp-01.md) · [AUD-01](../../governance/policies/aud-01.md) · [BTN-01](../../governance/policies/btn-01.md) |
| Dependencias | [SDD-0165](../0165-sistema-gobernanza-experiencia-erp-studio/spec.md) · [SDD-0166](../0166-auditoria-gobernada-aud-01-aud-02/spec.md) |
| Revisión | [REV-MP-002](../../governance/reviews/mp-01-comments-design.md) |
| Estado | aprobado técnicamente para implementación local |
| Fecha | 2026-07-22 |
| Alcance | diseño; no contiene migración ejecutable ni implementación |
| Confidencialidad | interno |

## 1. Decisión ejecutiva

El slice se implementará mediante una frontera server-side confiable y dos
migraciones futuras independientes:

1. **Contrato aditivo:** catálogo AUD, metadatos de ciclo de vida, índices y
   RPCs estrechas. Conserva temporalmente el camino heredado para permitir un
   deploy compatible.
2. **Hardening:** después de verificar el deploy, retira el `UPDATE` directo de
   `deleted_at`, reduce grants y obliga a pasar por las RPCs gobernadas.

Entre ambas se despliega la aplicación que sustituye `deleteComment()` por el
contrato nuevo. Cada migración recibirá basename y autorización Cloud propios
al iniciar su gate; este documento deliberadamente no reserva un número.

La mutación de `comments.deleted_at` y el evento AUD-01 ocurren en la misma
transacción PostgreSQL. El cliente no recibe `service_role`, no decide tenant,
actor, rol, ventana ni modo de transición.

## 2. Evidencia actual verificada

### 2.1 Repositorio

| Área | Estado comprobado |
|---|---|
| Acción | `deleteComment()` hace `UPDATE comments SET deleted_at=<hora cliente>` mediante el cliente autenticado. |
| Restauración | no existe action, query ni RPC. |
| Edición | `editComment()` actualiza `body` y `edited_at` directamente. |
| Hilo | `listComments()` filtra activos, ordena por `created_at` y limita a 500. |
| Menciones | el inbox filtra comentarios eliminados en memoria; el badge cuenta `comment_mentions` sin unir el padre. |
| UI | `CommentItem` solo muestra eliminar al autor; no hay moderación, recuperación ni Deshacer. |
| AVS | `ToastProvider` tiene duración nominal `undo=10s`, pero pausa el tiempo visible por hover, foco y pestaña oculta. |
| RBAC | no existen `moderate_comments` ni `restore_comments`; las capabilities actuales son código estático fail-closed. |
| Auditoría | el catálogo está validado por A2, pero no contiene `comment`; no hay eventos de permanencia. |

### 2.2 Supabase Cloud metadata-only

Se verificó `xpfuzqombmjmxvprjgmi` sin leer cuerpos, usuarios ni filas de
negocio:

- `comments`, `comment_mentions` y `comment_reactions` tienen RLS activa;
- `authenticated` conserva `SELECT/INSERT/UPDATE` sobre `comments`;
- `service_role` conserva `ALL` sobre las tres tablas;
- la policy `comments_author_or_admin_update` permite actualizar al autor o al
  admin y el trigger solo congela identidad/estructura;
- `deleted_at`, `body` y `edited_at` son hoy mutables bajo el mismo grant;
- no existen `deleted_by`, operación idempotente ni correlación de ciclo;
- las FK de menciones/reacciones usan `ON DELETE CASCADE`, pero no hay una ruta
  visible de hard-delete para `authenticated`;
- el CHECK de `comments.entity_type` contiene nueve tipos, incluido
  `bitacora_task`;
- `audit_entity_types` tiene las columnas reales `entity_type`, `status`,
  `domain_code`, `contract_version`, `introduced_by_ref`, `deprecated_at` y
  `created_at`; `comment` está ausente;
- tamaños actuales: `comments` 64 kB, menciones 24 kB y reacciones 32 kB;
- cero locks en espera durante el inventario.

La evidencia Cloud confirma el riesgo: cualquier cliente `authenticated` que
cumpla la policy puede saltarse la Server Action y cambiar `deleted_at` sin
evento AUD-01.

## 3. Arquitectura y frontera de confianza

```text
CommentItem / CommentsThread
          │ operation_id UUID, intención y motivo
          ▼
Server Action con sesión real
          │ valida módulo + capability con cliente RLS
          ▼
createAdminClient() solo en servidor
          │ llama RPC service_role-only
          ▼
RPC SECURITY DEFINER · search_path vacío
          │ relee membership + contexto + fila FOR UPDATE
          │ cambia deleted_at + inserta AUD en una transacción
          ▼
respuesta estructurada + correlation_id + deadline de servidor
          ▼
refresh + aviso gobernado / diálogo / recuperación
```

Reglas:

1. Las RPCs revocan `EXECUTE` a `PUBLIC`, `anon` y `authenticated`; solo
   `service_role` puede invocarlas.
2. La Server Action deriva `actor_id`, `tenant_id` y rol desde la sesión. El
   navegador solo aporta intención, comentario, motivo y `operation_id`.
3. Aun siendo service-role-only, la RPC relee una membership activa y valida
   tenant, rol y contexto. No confía ciegamente en argumentos privilegiados.
4. El acceso al padre se valida dos veces: `moduleEditDenial()` en aplicación y
   una matriz DB acotada a los consumidores reales del slice.
5. Un fallo de auditoría revierte el cambio de permanencia.

## 4. Consumidores y permiso sobre el contexto

El primer release solo habilita ciclo gobernado donde existe un consumidor
real:

| `entity_type` | Módulo | Roles con edición además de admin |
|---|---|---|
| `shipment` | `tracking` | `commercial`, `operations`, `accounting`, `warehouse` |
| `bitacora_task` | `bitacora` | `commercial`, `operations`, `accounting`, `warehouse`, `marketing` |

`support` permanece read-only. Los otros siete tipos continúan legibles, pero
la RPC de ciclo devuelve `unsupported_context` hasta que un consumidor real
registre su módulo y prueba de permisos. Esto evita duplicar de forma
aspiracional toda la matriz RBAC.

Los dos contextos actuales no exponen una señal de hold/protección aplicable a
comentarios. La función de elegibilidad conserva un resultado fail-closed
`protected_context`; cualquier señal futura debe agregarse antes de habilitar
la transición para ese contexto.

## 5. Modelo de datos futuro

No se reemplaza `deleted_at`. Se añaden columnas nullable, sin backfill:

| Columna | Tipo | Regla |
|---|---|---|
| `deleted_by` | `uuid` | Actor real de la eliminación vigente. Sin FK: el ID no desaparece si se elimina el usuario. |
| `deletion_mode` | `text` | `self` o `moderation`; null en activo/legacy. |
| `deletion_reason` | `text` | 1–500 caracteres para moderación; null para eliminación propia. |
| `lifecycle_correlation_id` | `uuid` | Identifica el ciclo delete→restore y permanece después de restaurar hasta un nuevo delete. |
| `last_lifecycle_operation_id` | `uuid` | Última operación aceptada; permite reconocer reintentos sin duplicar eventos. |
| `lifecycle_contract_version` | `smallint` | `1` para transiciones gobernadas; null para filas nunca migradas por acción. |

Constraints nuevas:

- `deletion_mode is null or deletion_mode in ('self','moderation')`;
- `deletion_reason is null or length(trim(deletion_reason)) between 1 and 500`;
- `lifecycle_contract_version is null or lifecycle_contract_version = 1`.

La coherencia entre estado y metadatos vive en un trigger porque debe distinguir
edición, transición gobernada y compatibilidad temporal. No se backfillea
`deleted_by`, razón, correlación ni evento para historia legacy.

### Índices

1. Recuperación por hilo:
   `(tenant_id, entity_type, entity_id, deleted_at desc, id desc)
   where deleted_at is not null`.
2. Badge de menciones:
   `(tenant_id, mentioned_user_id, created_at desc, id desc)
   where read_at is null`.

El índice activo vigente se conserva en la primera entrega. La paginación de
recuperación usa cursor `(deleted_at,id)`, nunca `OFFSET`.

## 6. Máquina de estados DB

| Estado previo | Operación | Estado posterior | Condiciones |
|---|---|---|---|
| activo | `delete` propio | eliminado | actor=autor, permiso vigente, contexto soportado, motivo vacío |
| activo | `moderate` | eliminado | admin + `moderate_comments`, razón obligatoria |
| eliminado ≤10 s | `undo` | activo | mismo `deleted_by`, mismo ciclo, permiso vigente |
| eliminado ≤30 días | `ordinary_restore` | activo | admin + `restore_comments`, confirmación R2 |
| eliminado >30 y ≤90 días | `exceptional_restore` | activo | admin + capability, razón obligatoria, R3 |
| eliminado >90 días | cualquier restore UI | sin cambio | `retained_not_ordinary_restorable` |

La base usa una única hora de servidor capturada al comenzar la función. El
cliente nunca calcula la elegibilidad final.

El trigger de transición congela identidad, padre, autor, fechas y cuerpo
durante delete/restore; una edición de body no puede mezclarse con permanencia.
Una restauración limpia `deleted_by`, `deletion_mode` y `deletion_reason`, pero
conserva `lifecycle_correlation_id` y actualiza
`last_lifecycle_operation_id`.

## 7. Contratos RPC

### 7.1 `rpc_soft_delete_comment`

Entrada conceptual:

```text
p_comment_id uuid
p_actor_id uuid
p_tenant_id uuid
p_operation_id uuid
p_reason text default null
```

La función determina `self` o `moderation`; el cliente no elige el modo.

### 7.2 `rpc_restore_comment`

Entrada conceptual:

```text
p_comment_id uuid
p_actor_id uuid
p_tenant_id uuid
p_operation_id uuid
p_expected_correlation_id uuid
p_mode text -- undo | ordinary | exceptional
p_reason text default null
```

La función recalcula la ventana y rechaza un modo que no corresponda. El
`expected_correlation_id` impide restaurar un ciclo distinto al que la UI vio.

### 7.3 Resultado

Ambas devuelven JSON tipado, sin body ni PII:

```json
{
  "ok": true,
  "code": "deleted",
  "comment_id": "uuid",
  "state": "deleted_undoable",
  "correlation_id": "uuid",
  "deleted_at": "timestamptz",
  "undo_expires_at": "timestamptz"
}
```

Códigos de negocio estables:

- `deleted`, `restored`, `idempotent_replay`;
- `not_allowed` para inexistencia, tenant ajeno o permiso insuficiente sin
  revelar cuál condición falló;
- `unsupported_context`, `protected_context`, `state_conflict`,
  `operation_conflict`, `undo_expired`, `ordinary_window_expired` y
  `not_ordinary_restorable`.

Errores de infraestructura o integridad levantan excepción y revierten toda la
transacción. Los estados de negocio no generan eventos `failed` falsos.

## 8. Concurrencia e idempotencia

Cada RPC:

1. fija `lock_timeout` y `statement_timeout` acotados;
2. obtiene una sola fila `comments` con `FOR UPDATE`;
3. adquiere siempre primero el comentario y luego inserta auditoría;
4. ejecuta un `UPDATE` condicional sobre el estado leído;
5. inserta un solo evento únicamente si hubo transición real;
6. reconoce el mismo `last_lifecycle_operation_id` como replay exitoso sin
   segundo evento;
7. devuelve conflicto para otro operation id sobre un estado ya cambiado.

Doble click, dos pestañas o dos restauraciones simultáneas producen un único
estado y un único evento durable. No hay llamadas HTTP, correo ni notificación
dentro de la transacción.

## 9. Auditoría transicional compatible con SDD-0166

La migración de contrato agrega `comment` a `audit_entity_types` con:

```text
status=active
domain_code=collaboration
contract_version=1
introduced_by_ref=SDD-0168
```

Hasta que el Corte B materialice columnas globales, los eventos usan las
columnas actuales de `entity_audit_log` y un payload `comment.lifecycle.v1`:

```json
{
  "schema": "comment.lifecycle.v1",
  "source": "studio",
  "result": "succeeded",
  "sensitivity": "internal",
  "operation_id": "uuid",
  "correlation_id": "uuid",
  "action": "self_delete | moderation | undo | ordinary_restore | exceptional_restore",
  "classification": "P2",
  "friction": "R1 | R2 | R3",
  "before": { "deleted_at": null },
  "after": { "deleted_at": "timestamptz" },
  "reason": null
}
```

El evento usa `entity_type=comment`, `entity_id=comments.id`, actor real
`user/id` y `event_type=comment_soft_deleted|comment_restored`. No copia body,
menciones, reacciones, nombres, emails, secretos ni datos del padre. La razón
solo existe cuando el contrato la exige, se limita a 500 caracteres y la UI
advierte que no se incluya PII ni credenciales.

Este slice implementa atomicidad para el dominio comentarios, pero no declara
completo el Corte D global de SDD-0166.

## 10. RLS, grants y bypass directo

### Después del hardening

- `authenticated`: `SELECT`, `INSERT` y `UPDATE(body,edited_at)` sobre
  `comments`; sin UPDATE de `deleted_at` ni DELETE.
- `service_role`: sin UPDATE/DELETE/TRUNCATE directo sobre `comments`; las
  transiciones usan RPCs owner-controlled.
- RPCs: `EXECUTE` solo para `service_role`.
- policy SELECT de comments: activos del tenant; además, el autor ve su fila
  eliminada solo durante la ventana de undo y admin ve eliminados para
  recuperación.
- policy UPDATE directa: autor, tenant activo y comentario activo; el grant por
  columna impide tocar permanencia.
- menciones/reacciones: SELECT solo si el comentario padre es visible; INSERT
  y toggle exigen que el padre esté activo.

Ampliar `restore_comments` a un rol no-admin exige cambiar en el mismo gate la
policy DB y la matriz de la RPC. Cambiar solo `CAPABILITIES` no concede acceso.

## 11. Queries y presentación

### Hilo activo

- orden determinista `(created_at,id)`;
- sigue excluyendo `deleted_at is not null`;
- reacciones y menciones solo de IDs activos devueltos;
- sin optimistic success antes de la respuesta durable.

### Recuperación

`listDeletedComments()` recibe entidad y cursor, devuelve máximo 50 filas y se
ejecuta con cliente RLS. Solo admin pasa la policy y la capability. Devuelve el
estado derivado, autor resoluble, fecha, modo/razón permitida y correlación; no
crea una papelera global.

### Menciones

- `listMyMentions()` usa join interno a comentario visible;
- `countUnreadMentions()` usa el mismo join y `deleted_at is null`;
- restaurar no inserta ni actualiza `comment_mentions`;
- una mención conserva `read_at`; no se reenvía ninguna notificación.

## 12. Server Actions y RBAC

Archivos previstos:

- `lib/studio/rbac.ts`: capabilities admin-only
  `moderate_comments: []` y `restore_comments: []`;
- `lib/studio/rbac.test.ts`: roles válidos y admin implícito;
- `lib/studio/comments/lifecycle-types.ts`: estados, códigos y validadores;
- `lib/studio/comments/lifecycle-queries.ts`: recuperación keyset;
- `app/studio/(app)/_actions/comments.ts`: delete, undo y restore gobernados;
- pruebas de actions/queries y contrato DB.

Eliminación propia exige `moduleEditDenial` del contexto. Moderación y
restauración exigen además `capabilityDenial`. La acción llama la RPC mediante
`createAdminClient()` solo después de validar sesión y contexto; nunca expone
la clave ni acepta tenant/actor del formulario.

## 13. UI, AVS y accesibilidad

### Eliminación propia P2/R1

1. **Eliminar** no abre diálogo.
2. El control entra en pending y bloquea doble ejecución.
3. Solo después del commit DB se retira el comentario.
4. `ToastProvider.show()` usa evento `comment:soft-deleted`, prioridad alta,
   `duration=undo`, `correlationId` durable y acción **Deshacer**.
5. La acción llama restore con modo `undo` y el mismo ciclo.

### Deadline real de Deshacer

AVS-01 pausa el tiempo visual por accesibilidad; MP-01 exige que la autorización
DB venza a los 10 segundos reales. Se amplía la primitiva con
`actionExpiresAt`:

- la tarjeta puede permanecer pausada, pero la acción no se extiende;
- al llegar el deadline del servidor, **Deshacer** se deshabilita o se retira y
  el texto indica que terminó la ventana inmediata;
- al volver de una pestaña oculta no se promete una acción ya vencida;
- la RPC sigue siendo la autoridad final ante clock skew o carrera.

El comportamiento existente de avisos sin deadline no cambia.

### Moderación y restauración

- admin ve **Moderar** en comentarios ajenos;
- `ConfirmDialog` R2 identifica autor y consecuencia, exige razón para
  moderación;
- **Comentarios eliminados** es una sección colapsada dentro del hilo, no un
  módulo nuevo;
- restauración ≤30 días usa R2;
- 31–90 días usa R3 con razón obligatoria;
- >90 días muestra estado informativo sin botón de restauración.

Foco, teclado, lector de pantalla, zoom 200 %, touch, viewport móvil y movimiento
reducido se verifican antes del commit de implementación mediante `/ui-check`.

## 14. Filas legacy

- no se inventa actor, razón, operación, correlación ni evento histórico;
- fila activa legacy: metadatos lifecycle null;
- fila eliminada legacy: no ofrece undo porque `deleted_by` es null;
- admin puede restaurarla dentro de 90 días, generando el primer evento real;
- después de 90 días queda retenida sin botón;
- el trigger acepta el paso legacy eliminado→activo solo mediante la RPC.

## 15. Despliegue por gates

### Gate DB-1 · contrato aditivo

Preflight metadata-only:

- proyecto y ledger correctos;
- A2 aplicada: FK AUD validada y CHECK legacy ausente;
- `comment` ausente del catálogo;
- forma exacta de tablas, constraints, triggers, policies, grants y funciones;
- cero locks en espera y basename libre;
- snapshot de advisors.

Aplicación futura:

- insertar catálogo `comment` de forma aditiva;
- añadir columnas nullable sin backfill;
- añadir constraints seguras e índices;
- crear RPCs y ACL service-role-only;
- instalar guard transicional que congela metadatos lifecycle para llamadas
  directas, pero conserva temporalmente el delete heredado.

### Gate APP · aplicación compatible

- añadir capabilities y guards;
- migrar delete/undo/restore a RPC;
- implementar recuperación, badge coherente y deadline absoluto;
- validar local, Preview y consumidores `shipment`/`bitacora_task`;
- verificar que no quedan writes directos de `deleted_at` en código.

### Gate DB-2 · hardening

Solo después del deploy verificado:

- reemplazar policy UPDATE por autor activo;
- revocar UPDATE general y conceder solo `body,edited_at` a authenticated;
- revocar UPDATE/DELETE/TRUNCATE directo de `comments` a service_role;
- activar guard estricto que rechaza cambios lifecycle fuera de RPC;
- endurecer policies de menciones/reacciones contra padre eliminado;
- comprobar que cliente autenticado y service_role directo no pueden alterar
  `deleted_at` ni hacer hard-delete.

Cada gate Cloud se aplica de a una, siguiendo el runbook y con autorización que
nombre el basename exacto. DB-1 no autoriza DB-2.

## 16. Rollback y forward-fix

- DB-1 es aditivo: si la app no se despliega, el comportamiento actual sigue
  disponible y las columnas permanecen inertes.
- Antes de DB-2, un rollback de aplicación puede volver temporalmente al camino
  heredado.
- Después de DB-2, un rollback de aplicación deja delete/restore bloqueados de
  forma segura; no se reotorga UPDATE general como rollback ordinario.
- Un error de RPC se corrige hacia adelante. No se recrea el CHECK AUD, no se
  borra catálogo, no se elimina historia y no se purgan comentarios.
- Una excepción que reabra grants requiere gate SGE separado, responsable,
  mitigación y vencimiento.

## 17. Matriz mínima de pruebas

### Base de datos

- catálogo `comment` activo y FK AUD válida;
- grants por tabla/columna y EXECUTE exactos;
- actor, membership, tenant y contexto ajeno fallan cerrado;
- autor elimina propio; no puede moderar ajeno;
- admin modera/restaura con razón y ventana correctas;
- support y usuario deshabilitado no mutan;
- undo 9.999 s pasa y 10.001 s falla usando reloj DB controlado en fixture;
- 30/90 días prueban ambos bordes;
- doble operación/replay genera un solo evento;
- fallo forzado de INSERT audit revierte `deleted_at`;
- UPDATE/DELETE directo falla después de DB-2;
- identidad, menciones, `read_at` y reacciones permanecen iguales;
- fila legacy no recibe datos inventados.

### Aplicación

- guards de contexto/capability por rol;
- mapeo de códigos RPC a mensajes estables sin filtrar existencia;
- badge excluye comentario eliminado y reaparece al restaurar;
- toast usa correlation y deadline del servidor;
- acción en curso no admite doble click;
- moderación/restauración conservan pending/error dentro del diálogo;
- hilo server-rendered y Bitácora client-loaded refrescan correctamente.

### E2E y accesibilidad

- autor R1, admin R2/R3, support denegado y tenant cruzado;
- pestaña oculta más de 10 s muestra undo expirado;
- desktop/móvil, teclado, foco, Escape, lector de pantalla y zoom 200 %;
- cero requests con body del comentario dentro del payload audit.

## 18. Verificación de cierre de implementación

La implementación futura no se considera cerrada hasta demostrar:

- DB-1, APP y DB-2 aplicados en orden y con recibos separados;
- cero writes directos de `deleted_at` en repo y roles de aplicación;
- restauración real del mismo registro y relaciones;
- auditoría atómica y mínima;
- advisors sin hallazgos nuevos atribuibles;
- `pnpm typecheck`, lint, unit, SQL/pgTAP, build, E2E puntual,
  `pnpm docs:check` y `/ui-check` aprobados;
- producción verificada sin leer body, menciones ni PII.

## 19. Alternativas rechazadas

| Alternativa | Motivo |
|---|---|
| Mantener UPDATE directo y confiar en Server Action | PostgREST puede saltarse la acción y AUD-01. |
| Una sola migración que revoque antes del deploy | Rompe el cliente vigente entre DB y aplicación. |
| RPC invocable por authenticated | Amplía la superficie y obliga a duplicar toda la confianza en un endpoint público. |
| Copiar el comentario al restaurar | Pierde identidad, menciones, reacciones y orden. |
| Backfill de `deleted_by` | Fabrica historia sin evidencia. |
| Usar hora del navegador | Permite drift y carreras en la ventana R1. |
| Reusar el toast como auditoría | AVS-01 es efímero y no escribe evidencia durable. |
| Purga después de 90 días | MP-D2 limita restauración, no autoriza destrucción. |

## 20. Gates que permanecen reservados

Este diseño no autoriza:

- escribir las migraciones DB-1/DB-2;
- modificar código, RBAC o UI;
- deploy de Preview/producción;
- aplicar otra migración Cloud;
- ejecutar Cortes B–E completos de SDD-0166;
- Storage, jobs, retención automática, hard-delete o purga.
