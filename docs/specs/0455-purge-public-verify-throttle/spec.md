---
sdd: "0455"
title: "Retención de public_verify_throttle en el cron purge-throttle"
status: done
author: "Claude (Worker)"
created: 2026-09-11
updated: 2026-09-11
supersedes: null
superseded_by: null
related: ["0235", "0374", "0375"]
confidencialidad: interno
---

# SDD-0455 — Retención de `public_verify_throttle` en el cron de purga

> La IP de cada consulta a `/verificar` se guardaba sin fecha de caducidad. Esta
> spec la incorpora a la purga diaria con una retención de 60 min, derivada de la
> ventana de 30 min del throttle, y corrige los documentos de privacidad que
> afirmaban lo contrario.

## Contexto

Hallazgo de la revisión de datos de L17 (PR #80, handoff
`.agents/handoffs/c-l17-verificar-throttle.md` en `codex/c-l17-verificar-throttle`):

- `public.public_verify_throttle` guarda `ip` en claro y `created_at` por cada
  verificación bajo el límite (`supabase/migrations/0169_public_verify_throttle.sql:23-27`).
  La IP sale de `getRequestIp()` (`app/verificar/page.tsx:211-213`): primer
  `x-forwarded-for`, `x-real-ip` o `unknown` (`lib/http/request-ip.ts:41-56`).
- El cron `app/api/cron/purge-throttle/route.ts` purgaba solo
  `portal_registro_throttle` y `operario_pin_attempts` (líneas 45-56 en la base
  `50100cc4`). Desde la aplicación de 0169 (2026-07-16,
  `docs/runbooks/aplicar-migraciones-prod.md:179-181`) la tabla crece sin límite.
- `0169:18` dice que el cron «puede limpiarla por antigüedad», y
  `docs/legal/privacidad/AUDITORIA-2026-07.md:61` le atribuía `ip_address` y
  `user_agent`, que no existen, y el borrado «throttle purga».
- SDD-0375 (PR #80, no integrada) deja esta retención como deuda separada
  (`docs/specs/0375-public-verify-atomic-reservation/spec.md:75-77` en esa rama).
  Esta spec es esa deuda.

## Objetivo

1. Purgar `public_verify_throttle` en el cron existente con la retención mínima
   que no altere el conteo del throttle.
2. Corregir la auditoría y alinear el registro de tratamiento y el mapa de borrado.
3. Decidir con evidencia si hace falta una migración nueva.

## Decisión: 60 minutos

**Quién lee la tabla.** Solo el throttle de `/verificar`, y solo dentro de su
ventana de 30 minutos:

| Lector | Ventana | Evidencia |
|---|---|---|
| `isVerifyThrottled` en `main` (fail-open, cuenta + insert) | `VERIFY_WINDOW_MINUTES = 30`; cuenta `created_at >= ahora − 30 min` | `lib/public/verify-throttle.ts:25,47-55` |
| RPC `reserve_public_verify_attempt` de 0426 (PR #80, sin integrar ni aplicar) | `interval '30 minutes'`, reloj de Postgres tras el lock | `0426:37,41` en la rama de PR #80; el archivo no existe en esta rama |

Ningún otro código lee la tabla (`git grep public_verify_throttle` en la base).
Una fila con más de 30 minutos no cambia ninguna decisión: su única finalidad
(`0169:2-10`) ya se cumplió.

**Retención elegida:** se borran las filas con `created_at` anterior a
`ahora − 60 min` (`PUBLIC_VERIFY_RETENTION_MINUTES`, `route.ts:29-36,57-59,78-82`).

- **Por qué no menos.** El corte lo calcula Vercel y la fila la fecha Postgres.
  El margen de 30 minutos absorbe el desfase de reloj (medido en local: +0,6 s)
  y cualquier espera de lock. El factor 2 también cubre un cambio de ventana en
  SQL que todavía no se haya reflejado en la constante TypeScript.
- **Por qué no 48 h, como las otras dos tablas.** Guardaría hasta ~72 h la IP en
  claro de personas que casi nunca son clientes, sin ninguna finalidad. Las
  retenciones de 48 h de las otras tablas no cambian: son decisiones previas
  (SDD-0235) y quedan fuera de alcance.
- **Vida efectiva.** El cron corre una vez al día, a las 04:00 UTC
  (`vercel.json:22-23`). Una fila vive entre 1 y ~25 h, unas 12,5 h de media; antes
  vivía indefinidamente. Bajar de 60 min casi no cambia esa vida, porque la manda
  la frecuencia del cron. Acortarla más exige un cron más frecuente (vercel.json
  compartido; la frecuencia permitida depende del plan de Vercel) o purgar dentro
  de la RPC (migración nueva). Ambas opciones quedan fuera.
- **Invariante.** La retención es ≥ 2 × `VERIFY_WINDOW_MINUTES`. La fija un test
  (`__tests__/route.test.ts`, «el corte no alcanza la ventana…») que importa la
  constante. Se prefirió una constante explícita a derivarla: los documentos
  legales declaran «60 min», y una derivación los desactualizaría sin aviso. Si la
  ventana crece, el test falla y obliga a revisar juntos la retención, esta spec y
  `docs/legal/privacidad`. Cuando PR #80 esté en `main`, su guard
  (`lib/public/verify-throttle.test.ts:147-154` en esa rama) ata la constante al
  SQL de 0426 y la cadena queda cerrada.

## Diseño

`app/api/cron/purge-throttle/route.ts`:

- constante `PUBLIC_VERIFY_RETENTION_MINUTES = 60` con su justificación (29-36);
- un solo `now` para ambos cortes (53-59);
- tercer `delete({ count: "exact" }).lt("created_at", verifyCutoff)` sobre
  `public_verify_throttle`, **al final**: si falla, las dos purgas previas ya
  quedaron hechas. El error sale por `apiError` con mensaje genérico y la etiqueta
  `purge-verify-throttle` (78-90);
- la respuesta suma el conteo y agrega `deletedByTable.public_verify_throttle` y
  `cutoffByTable`. `cutoff` conserva su significado de 48 h (92-106).

Sin cambios en `vercel.json`, en la autenticación, en las otras tablas ni en
`lib/public/verify-throttle.ts`.

## Evaluación: sin migración nueva

| Opción | Decisión y evidencia |
|---|---|
| Índice por `created_at` | **No hace falta.** Tras la primera corrida la tabla guarda como máximo ~25 h de filas. Con el índice actual `(ip, created_at)` (`0169:32-34`) el DELETE es `Seq Scan` (plan medido). La ruta real purgó 1.000.003 filas en 4,8 s y la corrida siguiente tardó 0,35 s. Un índice extra encarecería cada INSERT de `/verificar`, que es el camino caliente, para acelerar una tarea diaria sobre una tabla pequeña. |
| `grant delete` explícito a `service_role` | **No hace falta.** En la imagen `supabase/postgres` los default privileges dan ALL a `service_role`, y la tabla creada como `postgres` recibe DELETE (medido). En producción el runbook solo registró INSERT (`aplicar-migraciones-prod.md:179-181`). El 2026-09-11 el Director verificó por catálogo que `service_role` tiene DELETE (Release 2). |
| Corregir el comentario de 0169 | **No hace falta ni se puede.** 0169 está aplicada y no se edita. Su línea 18 («puede limpiarla por antigüedad») se vuelve cierta con este cambio. El comentario de catálogo (`0169:29-30`) no habla de retención y no es inexacto. No se registra deuda. |
| Comentario de 0426 | «sin purga» (`0426:119` en PR #80) describe la RPC, que sigue sin purgar. Sigue siendo cierto. |

## Relación con PR #80 (SDD-0375 / 0426)

- No comparten archivos de producto. PR #80 toca 0426, su contrato, su runner,
  `lib/public/verify-throttle.ts` y su test, el baseline y la spec 0375. Esta spec
  toca el cron, su test y documentación. Solo coinciden en `docs/specs/README.md`,
  que es generado y usa el driver `dtd-generated-records`.
- El orden de integración es indiferente. Antes y después de 0426 la ventana es
  de 30 minutos, y PR #80 conserva `VERIFY_WINDOW_MINUTES` (línea 26 en su rama).
- `0375:75-77` describe correctamente el límite de su propio corte. Queda como
  historia y no se edita.

## Allowlist

- `app/api/cron/purge-throttle/route.ts`: principal.
- `app/api/cron/purge-throttle/__tests__/route.test.ts`: pruebas.
- `docs/specs/0455-purge-public-verify-throttle/spec.md` y `docs/specs/README.md`
  (generado con `pnpm docs:index`).
- `docs/legal/privacidad/AUDITORIA-2026-07.md`: corrección de §2.1, filas 61-64 y
  la nota posterior.
- `docs/legal/privacidad/registro-tratamiento.md`: versión 1.4, fila de
  `public_track_log` en §4.2, §4.3 y fila en §5.
- `docs/legal/privacidad/mapa-de-borrado.md`: fila en §E.
- `.agents/handoffs/purge-public-verify-throttle.md`.

Exclusiones: `vercel.json`, `supabase/**` (0169 aplicada; 0426 es de PR #80), el
baseline y las declaraciones de símbolos, `lib/public/**`, `app/verificar/**`,
`lib/http/request-ip.ts`, las retenciones de las otras tablas y el texto de
`/privacidad`.

## Pruebas y aceptación

- [x] RED: con el test nuevo y la ruta anterior, fallan 4 de 7; pasan solo los
  tres casos 403.
- [x] GREEN (`route.test.ts`, 7/7):
  - tres tablas en orden, todas por `created_at` y con `count: "exact"`;
  - corte de 60 min para `public_verify_throttle` y de 48 h para las otras dos;
  - guard ≥ 2 × ventana;
  - fallo de la tercera purga: 500 genérico, con las dos anteriores ya hechas.
- [x] Verificación efímera de la ruta **real** contra `supabase/postgres:17.6.1.165`
  y `postgrest/postgrest:v16.1` locales. Detalle abajo.
- [x] Documentos de privacidad corregidos con `archivo:línea`:
  - auditoría §2.1: cuatro tablas, con los 12 escritores de
    `portal_registro_throttle` y la huella de `public_track_log` desde 0326;
  - registro: §4.2 (`public_track_log`), §4.3 y §5;
  - mapa: §E.
- [x] Gates locales: registrados en el handoff con PASÓ/FALLÓ/NO DISPONIBLE.
- [x] **Sam aprueba** la retención de 60 min y el borrado irreversible del
  historial (ver Release). Aprobación nominal del 2026-09-11, comunicada por el
  Director de ingeniería con la cita textual «Apruebo la retención de 60 min de
  #86». Según el Director, cubre también el borrado del historial actual.

### Verificación efímera (2026-09-11)

Contenedores propios, sin descargas y con la base en una red Docker `--internal`.
PostgREST publicado solo en `127.0.0.1`. Se aplicaron las migraciones reales 0094 y
0169 como `postgres`; `operario_pin_attempts` fue un stub con los grants de 0325.
Datos sintéticos con IPs de documentación (RFC 5737/3849). La ruta real se importó
con `tsx` y `createAdminClient` real, con un proxy que quita `/rest/v1`. Todo se
eliminó al terminar. Guion y recibo quedan fuera de Git, en el scratchpad de la sesión.

| Comprobación | Resultado |
|---|---|
| ACL de la tabla (dueño `postgres`) | `service_role` con SELECT/INSERT/DELETE vía default privileges; RLS activa, 0 policies |
| Plan del DELETE | `Seq Scan`, filtro `created_at < now() − 1 h` |
| Corrida sin Bearer | 403, sin borrar nada |
| Primera corrida (1.000.006 filas) | 200 en 4.796 ms: 1.000.003 borradas (backlog de 57 días, 65 min, 2 h y 10 días). Quedan exactamente 55 min, 29 min y la actual. Las otras tablas: una borrada de 3 días y una conservada de 1 h |
| Segunda corrida | 200 en 347 ms, 0 borradas (idempotente) |
| `anon` por PostgREST | DELETE → 204 `*/0`; SELECT → `[]`; las 3 filas siguen |
| Ajustes de rol | `authenticator`: `statement_timeout=8s`; `service_role`: sin ajuste |
| Desfase de reloj DB − host | +612 ms |

## Release y reversión

Los crons de Vercel se ejecutan sobre el despliegue de producción, según su
documentación: una preview no purga. El merge a `main` despliega en Vercel y activa
la purga desde la corrida siguiente de las 04:00 UTC, así que la autorización del
merge tiene que cubrir ese efecto. Antes de fusionar:

1. **Decisión de Sam sobre el historial.** La primera corrida tras el despliegue
   borra de forma irreversible todas las filas con más de 60 min, es decir, todo
   lo acumulado desde el 2026-07-16. No existe hold para esta tabla. Si hay un
   incidente de enumeración bajo análisis o un requerimiento que obligue a
   conservar, la decisión se toma antes del merge.
   - Resultado: aprobada el 2026-09-11 (ver Pruebas y aceptación).
2. **Privilegio en producción**, con autorización y sin leer filas:
   `select has_table_privilege('service_role', 'public.public_verify_throttle', 'DELETE');`.
   Si da `false`, primero va la migración `grant delete`.
   - Resultado del Director, por catálogo, 2026-09-11: `service_role` tiene DELETE
     (`relacl` `arwdDxtm`), `anon` y `authenticated` no, y RLS está activa.
3. **Tamaño del primer barrido (opcional, con autorización):**
   `select count(*) from public.public_verify_throttle where created_at < now() - interval '60 minutes';`.
   - En local, 1 M de filas tardó 4,8 s bajo un `statement_timeout` de 8 s en
     `authenticator`; en producción ese valor no se verificó.
   - Si el backlog excede el timeout, el DELETE hace rollback y el cron responde
     500 todos los días sin purgar esta tabla. Las otras dos purgas no se ven
     afectadas.
   - Contingencia: una purga manual única, autorizada según el runbook de producción.
   - Resultado del Director, por metadata y `pg_stat`, 2026-09-11: la tabla ocupa
     8 KB y tiene unas 32 filas; el primer barrido no corre riesgo con los 8 s.

Después del despliegue, la corrida siguiente de las 04:00 UTC debe responder 200,
sin `[purge-verify-throttle]` en los logs. Con autorización, el conteo de filas
anteriores a esa corrida menos 60 min debe ser 0.

**Reversión:** revertir la PR detiene la purga. No hay cambio de esquema que
deshacer. Lo ya borrado no se recupera desde la aplicación; los respaldos del
proveedor son NO VERIFICABLES.

## Gobernanza

| Principio | Clasificación y evidencia |
|---|---|
| SGE-00.01 / .02 / .08 / .10 / .12 | no aplica: sin UI, sin trabajo de usuario ni IA |
| SGE-00.03 y MP-01 | cumplimiento: P0 (purga física) de datos técnicos efímeros sin valor legal, operativo ni de auditoría. Sin acción visible |
| SGE-00.04 y AUD-01 | no aplica: no es una mutación de negocio ni evidencia; la corrida devuelve conteos por tabla |
| SGE-00.05 | cumplimiento: `CRON_SECRET` solo por header (`route.ts:38-44`), `service_role` solo en servidor; `anon` no borra ni lee (medido) |
| SGE-00.06 | cumplimiento: el guard impide una retención que corte la ventana; PostgREST exige filtro |
| SGE-00.07 | cumplimiento: conteos reales por tabla; un fallo responde 500 y no anuncia éxito |
| SGE-00.09 | cumplimiento: mismo cron, mismo patrón `delete().lt()` + `apiError`; sin primitiva nueva |
| SGE-00.11 y ERR-01 | cumplimiento: mensaje genérico al cliente y detalle solo en el log etiquetado |
| AUD-02 | no aplica: no es un log de auditoría. Se adoptan como criterio §2.4 (retención por finalidad, no por almacenamiento) y §2.7 (un hold suspende la purga: Release 1) |

## Revisión técnica de datos (`revisar-datos-ve`, focal)

Alcance: retención y minimización de `public_verify_throttle` y documentos
corregidos. Marco: Venezuela (CRBV art. 28; SC 332/2001, **temporalidad**; SC
759/2025). RGPD y 21.719 solo como referencia. Resumen: 5 CORRECTO, 5 ENCONTRADO
(preexistentes, fuera de alcance) y 5 NO VERIFICABLE.

| Dato | Qué es | Finalidad | Base de licitud | Retención | Quién lo ve |
|---|---|---|---|---|---|
| `public_verify_throttle.ip` (`0169:25`) | IP en claro del visitante | anti-enumeración de `/verificar` (`0169:2-10`) | NO VERIFICABLE | filas con más de 60 min, en el cron diario; vida máxima ~25 h (`route.ts:36,78-82`; `vercel.json:22-23`) | solo `service_role` (RLS sin policies, `0169:38`) |
| `public_verify_throttle.created_at` (`0169:26`) | hora del intento | ventana de 30 min | NO VERIFICABLE | igual | igual |

- CORRECTO — la retención existe y está acotada: `route.ts:36,57-59,78-82` y los
  tests de corte de `route.test.ts`. En la verificación efímera se borraron
  1.000.003 filas viejas y se conservaron las 3 recientes.
- CORRECTO — la purga no toca la ventana contada: corte de 60 min contra ventana
  de 30 (`verify-throttle.ts:25`), con guard en `route.test.ts`.
- CORRECTO — el cambio no captura ni envía datos nuevos. Solo borra. La respuesta
  lleva conteos y cortes, sin IP (`route.ts:92-106`). El log de error lleva el
  mensaje del proveedor, sin filas (`route.ts:83-89`; `lib/http/api-error.ts:38-39`).
- CORRECTO — `anon` no puede borrar ni leer la tabla: RLS sin policies
  (`0169:38`), medido en local (204 `*/0`, `[]`).
- CORRECTO — los documentos describen columnas y retención reales:
  - `AUDITORIA-2026-07.md` §2.1, con las cuatro tablas y los 12 escritores de
    `portal_registro_throttle`;
  - `registro-tratamiento.md` §4.2, §4.3 y §5;
  - `mapa-de-borrado.md` §E.
- ENCONTRADO — `public_track_log` no tiene purga. No hay DELETE ni cron en
  `supabase/migrations/` ni en `app/`/`lib/`. Desde `0326` guarda una huella
  (`0326_public_tracking_privacy_throttle.sql:32`), pero sin backfill: las filas
  previas pueden conservar la IP en claro. El registro §4.2 ya no dice «48 h en
  cron». Temporalidad (SC 332/2001). La purga se deja a un SDD propio.
- ENCONTRADO — `portal-login-mail:` guarda en `portal_registro_throttle` una huella
  SHA-256 **sin sal** del email (`app/entrar/actions.ts:113,117`), que se revierte
  probando correos conocidos. El registro §4.2 describe ese namespace como «no
  email». Arreglo en un SDD propio: sal o HMAC con secreto de servidor, y
  declararlo en §4.2.
- ENCONTRADO — `no_olvidar_access_log` conserva `ip_address` y `user_agent` sin
  plazo (`0017_no_olvidar.sql:121-129,430-436`). Es inmutable por diseño y
  necesita una decisión de retención propia.
- ENCONTRADO — la IP de `/verificar` se guarda en claro, mientras otros throttles
  guardan una huella: `app/entrar/actions.ts:106-109`, 0325 y 0326. El conteo
  solo necesita igualdad. Hashearla sería más minimización, pero cambia el
  contrato de 0426 (`0426:17-31` valida la sintaxis de la IP). Queda para un SDD
  posterior a PR #80.
- ENCONTRADO — `portal_registro_throttle` falta en `mapa-de-borrado.md` §E, y en
  el registro solo aparece su namespace `portal-login:`.
- NO VERIFICABLE — la base de licitud y si el aviso alcanza a quien escanea un
  QR. El pie de `/verificar` enlaza `/privacidad` (`app/verificar/page.tsx:558`;
  `components/Footer.tsx:194`), que menciona la IP «para prevenir usos
  indebidos» (`app/privacidad/page.tsx:65-66`).
- NO VERIFICABLE desde esta sesión — el privilegio DELETE de `service_role` en
  producción. El Director lo reporta presente por catálogo el 2026-09-11 (Release 2).
- NO VERIFICABLE — las copias en respaldos/PITR y WAL de Supabase y los logs de
  Vercel. En local, las tuplas borradas ocupan espacio (154 MB antes y después)
  hasta que autovacuum las recicla.
- NO VERIFICABLE desde esta sesión — el tamaño real del backlog. El Director
  reporta 8 KB y unas 32 filas (Release 3); la duración real se verá en la primera
  corrida.
- NO VERIFICABLE — la precisión horaria de la invocación del cron según el plan
  de Vercel.

Punto 12: quien escanea una caja o un diploma (almacén, destinatario) es un
titular que no es usuario. Este cambio reduce la vida de su IP de indefinida a
unas 25 h como máximo, y se agregó al registro §5.

Fuera de alcance, para la abogada: la base de licitud, si `/privacidad` cubre a
quien escanea un QR y el plazo de conservación como decisión legal. Los 60 min
son un corte técnico, no una opinión jurídica. Conviene que otro modelo audite
el mismo delta como segunda opinión. **Esto no es asesoría legal.**
