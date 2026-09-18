---
sdd: "0477"
title: "Un vínculo del Portal revocado conserva su correo y sus fechas 30 días; después se borran y la fila queda como «Revocado»"
status: in-progress
author: "Claude Code (Worker) para Sam"
created: 2026-09-18
updated: 2026-09-18
supersedes: null
superseded_by: null
related: ["0467", "0469", "0219", "0186", "0455"]
confidencialidad: interno
---

# SDD-0477 — Retención de 30 días del vínculo del Portal revocado

> Un vínculo del Portal revocado (`client_users` en `revoked`) guardaba sin
> plazo el correo y las fechas de la persona. Con la migración
> `0460_retencion_vinculo_portal_revocado`, un cron diario los borra a los 30
> días de la revocación. La fila queda `revoked`, y cada borrado deja un evento
> de auditoría. El cron arranca en dry-run y borra de verdad sólo cuando Sam
> activa `PORTAL_REVOKED_RETENTION_ENABLED`.

## Decisión

- **Plazo y alcance.** Sam, 2026-09-15, textual, en respuesta a la pregunta del
  Director sobre cuánto tiempo guardar el email y las fechas de un vínculo del
  Portal revocado: «30 dias se gusrdan guardamos el email y las fechas de un
  vínculo del Portal revocado.».
- **El resto de la fila.** Sam, 2026-09-18, por AskUserQuestion. Pregunta:
  «¿Qué pasa con el resto de la fila?». Eligió «Queda como «Revocado»», cuya
  descripción decía: «La fila sigue, sin correo ni fechas: el Studio muestra
  «Revocado» y el cliente no reaparece como candidato a invitar en masa. Se
  conservan created_at técnico, contadores y quién invitó.».

## Contexto

- **Quién revoca un vínculo.** Hay tres caminos:
  - `portal_revoke_client`, desde la tarjeta del Studio
    (`supabase/migrations/0080_portal_cliente.sql:184-202`);
  - el borrado lógico del cliente, desde 0454 (SDD-0467);
  - `merge_clients`, cuando el superviviente ya tenía acceso.
  Los tres dejan `status = 'revoked'`. Una revocación completa vacía además
  `auth_user_id` y `token`.
- **Qué quedaba.** El mapa de borrado (`docs/legal/privacidad/mapa-de-borrado.md`
  §10) marcaba 🔴 SIN FUNDAMENTO la conservación de `email`, `invited_at`,
  `bound_at` y `last_login_at`. Del mismo tipo son `revoked_at`,
  `last_email_invite_at` y `last_whatsapp_invite_at` (0226), y, en filas
  anteriores a 0454, `auth_user_id` y `token`.
- **Por qué la fila no se borra.** Tres lectores dependen de que la fila siga
  existiendo:
  - `listPortalInviteCandidates` y `listPortalContactlessClients`
    (`lib/studio/client-queries.ts:392-421` y `:618-640`) excluyen a todo
    cliente con fila en `client_users`;
  - `listAltasSinAcceso` (`lib/studio/alta-health.ts:70-90`) también;
  - la tarjeta del cliente (`PortalAccessCard.tsx`) pinta «Revocado».
  Borrar la fila devolvería a un cliente vivo, revocado a mano, a la lista
  «Sin invitar» y a la invitación en masa.
- **Quién lee el correo de una fila revocada.** Sólo `getClientPortalAccess`
  (`lib/studio/client-queries.ts:250-266`), y la tarjeta usa el correo del
  cliente, no el del vínculo. Los demás lectores de `client_users` filtran
  `invited` o `active`:
  - `app/entrar/actions.ts:124-129`;
  - `app/api/cron/portal-cold-reminder/route.ts:80-82`;
  - `portal-backfill-actions.ts:463-467`;
  - `portal-queries.ts:74-77` y `:408-410`;
  - `change-request-notify.ts`, `conversation-reply-push.ts`,
    `drain-client-notifications.ts` y `prealertas/queries.ts`.
  En SQL, `portal_bind_session` busca por correo sólo filas `invited`.
- **Holds legales.** 0301 (SDD-0219) creó `audit_legal_holds` y
  `audit_legal_hold_events`. MP-01 MP-D3 exige que un hold bloquee la purga de
  forma cerrada.

## Alcance

- Migración `supabase/migrations/0460_retencion_vinculo_portal_revocado.sql` y
  su contrato `supabase/tests/0460_retencion_vinculo_portal_revocado.test.sql`.
- Cron `app/api/cron/portal-revoked-retention/route.ts`, sus pruebas y la
  entrada en `vercel.json`.
- `.env.example`: el interruptor `PORTAL_REVOKED_RETENTION_ENABLED`.
- `lib/studio/client-queries.ts`: el tipo `ClientPortalAccess` admite `email` e
  `invitedAt` en null.
- `supabase/migrations-baseline.json` (la espera de 0460) y
  `supabase/pending-migration-symbol-declarations.json` (la degradación del
  cron).
- Documentos: `mapa-de-borrado.md` §10, `registro-tratamiento.md`, esta spec, el
  índice y el handoff.
- Fuera de alcance:
  - la cuenta de Supabase Auth del antiguo titular (ver «Revisión de datos
    personales»);
  - `portal_access_links`, que no guarda correo;
  - la ficha del cliente borrado (`clients`), que sigue en §3 del mapa;
  - aplicar 0460 en producción y activar el interruptor.

## Diseño

### La regla

**Pasados 30 días de la revocación, un vínculo revocado no conserva datos de la
persona. La fila queda `revoked`.**

| Pieza | Qué hace |
|---|---|
| `email`, `invited_at` | Pasan a admitir NULL, sólo en una fila `revoked`: CHECK `client_users_erased_only_when_revoked` (`status = 'revoked' or (email is not null and invited_at is not null)`) |
| `erase_revoked_portal_access_data(p_limit integer default 200, p_dry_run boolean default false)` | SECURITY DEFINER, volátil, `search_path = ''`, devuelve `jsonb`. EXECUTE sólo para `service_role` |
| `/api/cron/portal-revoked-retention` | Diario, a las 04:30 UTC. Llama la RPC con tope 200. Dry-run salvo `PORTAL_REVOKED_RETENTION_ENABLED === "true"` |

### Qué se borra y qué queda

| Campo | Después del plazo |
|---|---|
| `email`, `invited_at`, `bound_at`, `last_login_at`, `revoked_at`, `last_email_invite_at`, `last_whatsapp_invite_at` | NULL |
| `auth_user_id`, `token` | NULL (una revocación completa ya los deja así) |
| `id`, `tenant_id`, `client_id`, `status = 'revoked'` | Se conservan: la fila sigue siendo el marcador «Revocado» |
| `invited_by`, `last_email_invite_by`, `last_whatsapp_invite_by` | Se conservan: son ids del equipo, no del titular |
| `email_invite_count`, `whatsapp_invite_count` | Se conservan: contadores sin dato personal |
| `created_at`, `updated_at` | Se conservan: `created_at` es la fecha técnica de la fila (coincide con la primera invitación) y `updated_at` pasa a ser la hora del borrado |

### Elegibilidad

Una fila es elegible si cumple las tres condiciones:

1. `status = 'revoked'`;
2. `coalesce(revoked_at, updated_at) <= now() - 30 días`, con el reloj de la base;
3. le queda algo que borrar (cualquiera de los nueve campos no nulo).

- **La base es `revoked_at`.** Una fila revocada sin `revoked_at` (fusiones
  anteriores a 0454) usa `updated_at`. `client_users_touch` lo fija en cada
  UPDATE, así que nunca es anterior a la revocación: el plazo sólo puede
  alargarse.
- **Sin la condición 3**, una fila ya borrada con `updated_at` de más de 30 días
  volvería a entrar cada día y repetiría su evento. El mutante M8 lo demostró.
- **Holds.** Queda retenida, sin tocarse, la fila cuyo tenant tenga un hold de
  tenant, o cuyo cliente esté cubierto como tipo (`entity_type`) o como entidad
  (`entity`) de `client` o de `portal_invitation`. Cuenta el estado del último
  evento del hold, en `active` o `release_requested`.
  - Se ignoran el rango y la correlación del hold: cualquier hold que cubra el
    alcance bloquea. Es más conservador que `audit_event_is_held`, que evalúa
    eventos y no datos.

### Una corrida

- **Primero cuenta.** Elegibles y retenidas, en agregado.
- **Con `p_dry_run`**, devuelve los conteos y no escribe nada.
- **Si no es dry run:**
  - Toma hasta `p_limit` filas elegibles no retenidas, de la más antigua a la
    más nueva, con `FOR UPDATE OF cu SKIP LOCKED`.
  - En cada una, borra los nueve campos (`where id = … and status = 'revoked'`)
    y escribe con `append_audit_event`:
    - evento `portal_access_data_erased` sobre `portal_invitation`, con el id
      del cliente (como D5);
    - actor `system`, origen `job`, resultado `succeeded`, sensibilidad
      `restricted`;
    - motivo: «Retención de 30 días cumplida: se borran el correo y las fechas
      del vínculo del Portal revocado (SDD-0477).»;
    - `before`: `status`, `email_present`, `identity_present` y
      `dates_present`, la lista de nombres de fechas que tenían valor;
    - `after`: los mismos con todo vacío;
    - `payload`: `mp01`, `retention_days`, `retention_basis` y `sdd`;
    - correlación `sdd0477:erase:<id>:<txid>`.
    Ningún valor del titular entra al evento.
- **En una sola transacción.** Si un evento no se escribe, no se borra nada
  (AUD-01 §1).
- **El motivo del evento es siempre el de la retención.** La RPC vacía
  `dtd.audit_reason` durante la corrida y al final restaura el valor del caller.
- **No cambia el status**, así que `audit_d5_client_users` (UPDATE OF status) no
  dispara.
- **Devuelve** `{dry_run, retention_days, cutoff, limit, eligible, held,
  erased, remaining}`.

### Idempotencia y concurrencia

- Una fila borrada deja de ser elegible: no tiene datos que borrar y su
  `revoked_at` es NULL.
- Una segunda corrida, el mismo día o reintentada, no repite filas ni eventos.
  El contrato lo prueba con una tercera corrida y con una fila ya borrada cuyo
  `updated_at` tiene 40 días.
- `SKIP LOCKED` evita que dos corridas concurrentes tomen la misma fila. Si una
  reinvitación tiene la fila bloqueada, esa fila espera a la corrida siguiente.
  No se prueba en una sola sesión de psql (ver «Riesgos y límites»).
- **Reinvitar** una fila borrada funciona como con cualquier revocada:
  `portal_invite_client` la vuelve `invited` con correo y fecha nuevos. Si se
  revoca otra vez, el plazo empieza de cero.

### El cron y el interruptor

- **Por qué un interruptor.** Es el patrón de `purge-receipt-orphans` y
  `bitacora-purge-orphans`. El borrado es irreversible y MP-D3 pide control
  humano sobre la purga: en dry-run el cron sólo reporta conteos en los logs
  (`[portal-revoked-retention] {...}`). Borra de verdad sólo con el valor
  exacto `"true"`, y `?dryRun=1` lo fuerza.
- **Qué devuelve.** Sólo conteos, nunca correos ni ids.
- **Si falla.** Un error de la RPC devuelve 500 genérico (`apiError`), sin
  filtrar el detalle.
- **Una respuesta con otra forma,** o cuyo modo no coincide con lo pedido,
  también da 500.

### Frontera e impacto en la aplicación

- **Studio.** La tarjeta del cliente sigue mostrando «Revocado» y «Volver a
  invitar». `ClientPortalAccess.email` e `invitedAt` pasan a `string | null`.
  La tarjeta no los usa para una fila revocada: pinta el correo del cliente y
  `fmt()` ya acepta null. Sin cambio visual: `/ui-check` no aplica.
- **Embudo de adopción.** `getPortalAdoptionStats` cuenta como «entró alguna
  vez» una fila con `bound_at` o `last_login_at`. Una revocada borrada deja de
  contar.
- **Portal y `/entrar`.** Sin cambio: sólo miran filas `invited` o `active`.
  Un titular revocado que pide el enlace ya caía en «Eres cliente, pero tu
  acceso no está activo» (SDD-0279), con o sin el correo en la fila.
- **Código desplegado sin 0460.** El cron no existe todavía. Con 0460 aplicada y
  el código viejo, nadie llama la RPC.
- **Código nuevo sin 0460.** El cron responde 500 y no borra nada. Es la
  degradación declarada `sdd-0477-retencion-vinculo-portal-revocado`. El orden
  previsto es migrate-first.

### La migración

1. `set lock_timeout = '5s'` y `set statement_timeout = '30s'` de sesión.
2. `do $preflight$`, que falla cerrado con `P0001` y mensajes sin ids ni
   correos. Exige:
   - roles de la API;
   - `client_users` con RLS y sus columnas;
   - el CHECK de status de 0080 exacto;
   - `email` e `invited_at` NOT NULL, o anulables con el CHECK final; el CHECK
     con otra forma aborta;
   - `append_audit_event` SECURITY DEFINER con `search_path` vacío y
     ejecutable por quien aplica;
   - las columnas de los holds de 0301;
   - que quien aplica se salte la RLS de `client_users` y de las dos tablas de
     holds, sin FORCE;
   - el tipo `portal_invitation` activo. Va después de la RLS: un rol que no se
     la salta leería la tabla vacía y el mensaje culparía al tipo;
   - ninguna otra firma de la RPC;
   - la huella del catálogo dependiente en un GUC de sesión: triggers,
     policies, ACL y RLS de `client_users`, y cuerpo, ACL y configuración de
     `portal_invite_client`, `portal_bind_session`, `portal_revoke_client`,
     `portal_bump_invite_count` y `append_audit_event`.
3. `alter column … drop not null` y el CHECK, si no existe.
4. Comentarios en el CHECK y en las dos columnas.
5. La RPC, su comentario, `revoke all` de los cuatro roles y `grant execute` a
   `service_role`.
6. `do $postflight$`. Exige:
   - la forma de la RPC y su ACL;
   - que su dueño se salte la RLS de las tres tablas;
   - las columnas anulables;
   - los dos CHECK con su forma y validados;
   - la huella idéntica.
   Al final limpia el GUC.
7. `reset statement_timeout` y `reset lock_timeout`.

- **Sin backfill.** Aplicarla no toca filas: el borrado lo hace la primera
  corrida del cron activado.
- **Reaplicarla no cambia nada.** Una ACL abierta a mano vuelve a cerrarse; sin
  el CHECK, aborta.

### Locks

- Los `ALTER TABLE` toman ACCESS EXCLUSIVE sobre `client_users` hasta el
  COMMIT. Mientras tanto espera toda resolución del principal del Portal
  (`get_portal_client_id` y las helpers de 0453).
- Con `lock_timeout` de 5 s, si hay contención, corta y se revierte entera.
  Aplicar en baja actividad y reintentar si corta.
- En el fixture del contrato, la migración corre en milisegundos. En
  producción `client_users` es chica: no se leyó su tamaño.

## Revisión de datos personales (`revisar-datos-ve`)

Revisión focal del cambio, 2026-09-18. Esto no es asesoría legal.

**Resumen:** 6 CORRECTO, 3 ENCONTRADO (fuera del alcance de esta spec) y 3 NO
VERIFICABLE.

**Inventario del cambio:**

| Tabla · campo | Qué es | Finalidad | Retención después de esta spec | Quién más lo ve |
|---|---|---|---|---|
| `client_users.email` | Correo de login del Portal | Acceso al Portal | Invitado o activo: mientras dure. Revocado: 30 días desde la revocación | Equipo del tenant por RLS («client_users self or tenant read»), incluido el equipo en China |
| `client_users.invited_at`, `bound_at`, `last_login_at`, `revoked_at`, `last_email_invite_at`, `last_whatsapp_invite_at` | Fechas de la relación de la persona con el Portal | Seguimiento de la adopción y del acceso | Igual que el correo | Igual |
| `client_users.auth_user_id`, `token` | Identidad de Auth y token de invitación | Vincular la sesión | Se vacían al revocar (0080 y 0454); la retención cubre las filas antiguas | — |
| `client_users.created_at` | Fecha técnica de la fila, igual a la primera invitación | Registro | Se conserva (decisión de Sam del 2026-09-18) | Equipo del tenant |

**CORRECTO:**
1. **Temporalidad.** Los nueve campos se borran a los 30 días:
   `0460_retencion_vinculo_portal_revocado.sql`, UPDATE de la RPC. Base: SC
   332/2001 (temporalidad), CRBV art. 28, SC 759/2025 (derecho al olvido) y
   PIPL art. 47, si el equipo en China ve estos correos.
2. **El evento no copia el dato borrado.** `before` y `after` llevan
   booleanos y nombres de campo. El contrato busca `@`, `example.invalid` y el
   prefijo del token en todo el evento, sin encontrarlos.
3. **Los holds bloquean** (MP-D3). Hay pruebas con hold de tenant, de tipo, de
   entidad `client` y de entidad `portal_invitation`, y una liberación pedida
   sigue reteniendo.
4. **Los logs del cron sólo llevan conteos.** Lo prueba la prueba «la
   respuesta sólo lleva conteos».
5. **Sólo filas `revoked`.** Una `invited` o `active`, aunque tenga 60 días,
   nunca entra: el contrato lo comprueba fila por fila, y el CHECK impide
   vaciar una fila viva (23514).
6. **Se verificó contra datos, en una base efímera.** Un valor único y
   rastreable (`revtreintayuno@example.invalid`) desaparece de `client_users`
   y no aparece en `entity_audit_log`. Límite: PostgreSQL 17 local, no
   producción.

**ENCONTRADO, fuera del alcance de esta spec:**
1. **La cuenta de Supabase Auth del antiguo titular sobrevive a la revocación y
   a la retención.** `auth.users` conserva el correo y `last_sign_in_at`.
   Ningún código del repo borra usuarios de Auth: no hay ninguna llamada a
   `auth.admin.deleteUser` en `app/` ni en `lib/`. El mapa de borrado no la
   lista. Necesita una decisión propia: borrar la cuenta de Auth sin vínculo
   vivo tras el mismo plazo, o documentar por qué se conserva.
2. **Los eventos de auditoría conservan las horas.** `portal_access_invited` y
   `portal_access_status_changed` (0293:425-439) siguen fechando la invitación
   y la revocación, sin el correo. Es P4 y 🔵 CONSERVA según SDD-0186: «las
   fechas» del vínculo no desaparecen del todo. Se declara, no se cambia.
3. **La ficha del cliente borrado conserva su correo** en `clients.email`.
   Ya estaba en el mapa, §3 y §10.

**NO VERIFICABLE:**
1. Cuántas filas elegibles hay en producción: no se leyeron filas ni conteos.
   El primer dry-run del cron lo dirá, en agregado.
2. La retención de los respaldos de Supabase (PITR) y de los logs de Vercel,
   que conservan el dato mientras duren.
3. El comportamiento en producción, hasta aplicar 0460 y activar el
   interruptor.

Segunda opinión sugerida: que otro modelo revise la migración y el mapa.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| MP-01 MP-D1 · PII sin propósito vigente se elimina o anonimiza | cumplimiento | La decisión de Sam fija el plazo y la RPC lo aplica |
| MP-01 MP-D3 · la purga la hace sólo un job autorizado; los holds bloquean de forma cerrada | cumplimiento | RPC sólo para `service_role`, holds de 0301 y contrato con 5 casos de hold |
| MP-01 MP-D3 · «cada lote requiere dos decisiones humanas» | **excepción aprobada por Sam el 2026-09-18** | La decisión de clase del 2026-09-15 más el interruptor que activa Sam reemplazan la doble decisión por lote; la corrida es diaria y automática. Aprobación textual (AskUserQuestion): «Acepto la excepción (Recomendado)» — «La decisión de clase del 15-sep más el interruptor PORTAL_REVOKED_RETENTION_ENABLED reemplazan la doble decisión por lote. La spec queda con la excepción aprobada.» |
| MP-01 §9 · «hasta completar esos gates: no purgar» | excepción acotada | Se anonimiza una fila que sigue existiendo, no se purga. Alcance: un tipo de dato con decisión nominal del dueño de MP-01 |
| AUD-01 §1-§3 · mutación sensible y evento atómicos | cumplimiento | Un evento por fila en la misma transacción. Con el tipo inactivo, la corrida falla entera (contrato) |
| AUD-01 §5 · PII minimizada en el evento | cumplimiento | Booleanos y nombres de campo, sin valores |
| SGE-00.07 · estado visible y verdadero | cumplimiento | El cron reporta modo, elegibles, retenidas, borradas y pendientes |
| UI / marca | no aplica | Sin cambio visual |

## Allowlist exacta

- `supabase/migrations/0460_retencion_vinculo_portal_revocado.sql` (nuevo)
- `supabase/tests/0460_retencion_vinculo_portal_revocado.test.sql` (nuevo)
- `app/api/cron/portal-revoked-retention/route.ts` (nuevo)
- `app/api/cron/portal-revoked-retention/__tests__/route.test.ts` (nuevo)
- `vercel.json`: la entrada del cron
- `.env.example`: `PORTAL_REVOKED_RETENTION_ENABLED`
- `lib/studio/client-queries.ts`: sólo el tipo `ClientPortalAccess` y su mapeo
- `supabase/migrations-baseline.json`: sólo la espera de 0460
- `supabase/pending-migration-symbol-declarations.json`: sólo la degradación
  `sdd-0477-retencion-vinculo-portal-revocado`
- `docs/legal/privacidad/mapa-de-borrado.md` (§10)
- `docs/legal/privacidad/registro-tratamiento.md`
- `docs/specs/0477-retencion-vinculo-portal-revocado/spec.md`
- `docs/specs/README.md` (regenerado con `docs:index`)
- `.agents/handoffs/retencion-vinculo-portal-revocado.md`

Integrar a `main` **dispara el deploy de Vercel**. La autorización de merge
tiene que cubrirlo, y el orden es migrate-first.

## Criterios de aceptación

- [x] 1. A los 30 días de la revocación, la RPC borra los nueve campos y la fila
      queda `revoked`, con tenant, cliente, quién invitó, contadores y
      `created_at`.
- [x] 2. Una fila `invited` o `active` nunca entra, tampoco una revocada hace
      menos de 30 días. El CHECK impide vaciar una fila viva.
- [x] 3. Un evento AUD-01 por fila, en la misma transacción y sin valores del
      titular. Si el evento falla, no se borra nada.
- [x] 4. Idempotente: una segunda corrida, o una fila ya borrada vieja, no
      repite filas ni eventos.
- [x] 5. Tope por corrida, de la más antigua a la más nueva.
- [x] 6. Los holds de 0301 retienen de forma cerrada.
- [x] 7. Sólo `service_role` ejecuta la RPC. El cron exige `CRON_SECRET`, arranca
      en dry-run y sólo reporta conteos.
- [x] 8. Preflight que falla cerrado sin tocar el catálogo, postflight y
      reaplicación sin cambios. Contrato con control rojo y mutantes.
- [ ] 9. Aplicada en producción con OK nominal de Sam, y el primer dry-run leído
      antes de activar el interruptor. Es de release, no de esta rama.

## Riesgos y límites

- **SKIP LOCKED sin prueba de comportamiento.** El contrato corre en una sola
  sesión. El mutante que lo quita sólo muere por la aserción sobre el texto de
  la RPC.
- **`created_at` y los eventos de auditoría conservan fechas** de la relación,
  sin el correo. Ver «Revisión de datos personales».
- **La cuenta de Auth del antiguo titular no se toca.** Ver el hallazgo 1.
- **Hasta activar el interruptor, la retención no corre.** Dejar el cron en
  dry-run indefinidamente equivale a no tener retención. El handoff lo lleva
  como pendiente de release.
- **Plazo con el reloj de la base.** El cron corre una vez al día: una fila se
  borra entre el día 30 y el 31 después de su revocación.

## Producción

Pendiente. La 0460 no está aplicada. Requiere:
- OK nominal de Sam;
- que el Director confirme que no hay otra aplicación en curso;
- el runbook `docs/runbooks/aplicar-migraciones-prod.md`.

Recomendado:
- **Antes:** lectura de catálogo sin filas: columnas y CHECK de `client_users`,
  `append_audit_event`, tipo `portal_invitation` y holds de 0301.
- **Después:** postflight de catálogo, identidad del ledger contra el blob y
  advisors. Luego el primer dry-run del cron y, con sus conteos a la vista, la
  decisión de Sam sobre el interruptor.
