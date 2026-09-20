---
sdd: "0439"
title: "Portal cliente — edición controlada y contención de fotos de identidad"
status: in-progress
author: "Codex + founder"
created: 2026-09-04
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0138", "0145", "0151", "0186", "0191", "0268"]
confidencialidad: interna
---

# SDD-0439 · Edición controlada del perfil del cliente

## Pedido y lectura del contrato

El cliente puede corregir sus datos y reemplazar la foto de su cédula/RIF desde
`/portal/perfil` hasta **tres veces**. Sus direcciones de entrega no consumen ese
cupo: puede agregar nuevas y editar las existentes siempre.

La implementación conserva la aprobación humana introducida por SDD-0151. Un
cambio de nombre, cédula/RIF o teléfono se propone en el portal y cuenta como
efectivo sólo cuando el asesor lo aprueba. La solicitud pendiente reserva un
cupo para impedir carreras; si el cliente la cancela o el asesor la rechaza, el
cupo vuelve a quedar disponible.

### Decisiones explícitas

- El límite es **compartido** entre cambios de datos aprobados y reemplazos de
  la foto de identidad.
- La primera carga de una foto faltante completa el expediente y no consume
  cupo; cada reemplazo posterior sí consume uno.
- Email, Shipping Mark y avatar cosmético permanecen fuera de esta edición.
- La migración histórica 0445 conserva la foto de identidad reemplazada y su
  ruta en un ledger restringido. Como todavía no existen purga gobernada, hold
  y control regional, 0447 bloquea nuevos reemplazos de forma fail-closed.
- Los tres cambios son un límite de negocio de por vida. No existe bypass en la
  UI ni escritura directa a `clients` desde el portal.

## Estado encontrado

| Capacidad | Estado antes de este SDD |
|---|---|
| Proponer nombre, documento y teléfono | Ya existe con aprobación del asesor, sin límite acumulado. |
| Reemplazar foto de cédula/RIF | El backend lo permite, pero la UI sólo muestra “Ver” cuando ya existe; además borra la foto anterior. |
| Agregar, predeterminar y eliminar direcciones | Ya existe. |
| Editar una dirección | La server action existe, pero no hay botón ni formulario que la invoque. |

## Contrato funcional

1. El portal muestra `N de 3 cambios disponibles` junto al editor de datos y a
   la foto de identidad.
2. Enviar una solicitud pendiente reserva un cupo atómicamente en PostgreSQL.
3. Aprobarla convierte la reserva en cambio aplicado; rechazarla o cancelarla la
   libera.
4. Reemplazar una foto existente permanece deshabilitado en UI y base de datos
   hasta demostrar purga, hold y control regional. El cliente conserva un
   enlace a soporte para tramitar la corrección.
   **Reemplazado por [SDD-0481](../0481-portal-cliente-reemplazo-foto-identidad/spec.md)
   (decisión de Sam, 2026-09-18):** el cliente puede cambiar la foto dentro del
   cupo compartido; la migración 0461 retira el gate de 0447 y la versión
   sustituida se conserva (MP-01 §9).
5. Cuando no queda cupo, servidor y UI bloquean nuevas solicitudes de datos con
   un mensaje que conduce a soporte.
6. La primera foto, si falta, se puede cargar incluso con cupo agotado porque no
   es un reemplazo.
7. Cada dirección muestra “Editar”; el formulario sale prellenado, valida los
   mismos campos que el alta y guarda por la action/RLS ya existentes.
8. Agregar y editar direcciones nunca consultan ni alteran el cupo de perfil.

## Persistencia y seguridad

La migración histórica 0445 crea `client_profile_edits`, un ledger sin grants directos
para `anon`, `authenticated` ni `service_role`. Su trigger `SECURITY DEFINER`
serializa por fila de `clients`, de modo que dos solicitudes simultáneas no
pueden superar el límite. El portal sólo recibe totales agregados mediante una
RPC estrecha.

La sustitución de foto usa otra RPC `SECURITY DEFINER` que:

- resuelve el cliente exclusivamente con `auth.uid()` y
  `get_portal_client_id()`;
- valida que el objeto exista en el bucket privado `client-docs` y dentro del
  prefijo del cliente;
- registra la ruta anterior y la nueva sólo en el ledger restringido;
- actualiza `clients.cedula_photo_path` y consume el cupo en una transacción;
- escribe auditoría canónica sin copiar nombre, documento, teléfono ni rutas al
  payload de auditoría.

La migración 0447 agrega un trigger previo sobre el ledger: una primera carga no
crea una fila `identity_photo` y sigue disponible, pero un reemplazo intenta
crear esa fila y se rechaza dentro de la misma transacción antes de mover el
puntero. El Portal repite el guard antes del upload para evitar crear objetos
que dependan de rollback. Si una carrera o fallo ocurre después de subir, la
action distingue rechazo SQL explícito de respuesta incierta. Ante error vuelve
a resolver el cliente de sesión y lee únicamente el puntero/tenant/prefijo y
estado retirado de esa cuenta. Si confirma el mismo objeto conserva la carga;
si no puede reconciliar conserva y deriva a soporte sin anunciar éxito. Un
puntero vacío tras pérdida de respuesta no prueba rollback: el commit puede
seguir en vuelo. Sólo un rechazo SQL exacto conocido con respuesta HTTP 4xx,
identidad/tenant/prefijo estables y puntero distinto habilita retirar el objeto
nuevo de esta invocación. Se comprueba `Storage.remove()` y también su excepción;
no se anuncia éxito si la compensación falla. No se repite la RPC de escritura.

Las solicitudes históricas aprobadas por el cliente se contabilizan. Los
reemplazos de foto anteriores a 0445 no pueden reconstruirse con certeza y no se
inventan. 0445 no se renumera ni se reescribe porque ya fue aplicada; este SDD
fue renumerado desde 0435 a 0439 para resolver la colisión con otra rama.

Nota de trazabilidad: los comentarios SQL de `0445_portal_profile_edit_limit.sql`
(aplicada) y `0446_portal_profile_functional_remediation.sql` (aplicada el
2026-09-10, ledger `20260910165737`) conservan deliberadamente `SDD-0435`.
Las dos son historia aplicada y no se reescriben: cambiar su texto rompería la
identidad por md5 contra el ledger. Esta excepción histórica no cambia
la numeración vigente de este SDD, que es 0439.

## Datos personales · revisión VE/CN

| Estado | Evidencia |
|---|---|
| ENCONTRADO | Nombre, documento, teléfono, foto de identidad y direcciones son datos personales; la foto/documento exige acceso restringido y trazabilidad. |
| CORRECTO | Storage privado, URL firmada de 60 segundos, validación server-side, aislamiento por sesión/RLS, ledger no expuesto y auditoría sin valores PII. |
| CORRECTO | La rectificación de datos existe, pero mantiene aprobación humana para identidad documentada. |
| CORRECTO | 0447 y la UI contienen nuevos reemplazos: no crean otra versión histórica mientras falten los controles de disposición y acceso. |
| ENCONTRADO | La directiva propuesta `docs/legal/privacidad/fotos-identidad-cliente-v1.md` fija históricos por máximo 30 días, borrado integral solicitado y cero acceso China, pero aún no está activa. |
| ENCONTRADO | La policy vigente de `client-docs` no distingue VE de CN y no existe purga; la contención no se presenta como implementación de esos controles. |
| NO VERIFICABLE | Fundamento por categoría, holds reales, contratos y eliminación en copias de proveedor requieren validación humana/profesional. |

Esta revisión técnica no constituye asesoría legal.

## Gobernanza

| Política | Clasificación | Aplicación |
|---|---|---|
| SGE-00 | cumplimiento | El límite vive en servidor/DB; se informa estado y siguiente paso. |
| AUD-01 / AUD-02 | cumplimiento | Reserva, aplicación y liberación dejan eventos estructurados sin PII; el reemplazo contenido no deja éxito falso. |
| FRM-01 / ERR-01 / LOD-01 | cumplimiento | Labels persistentes, errores próximos al campo y estados pendientes. |
| UPL-01 | cumplimiento | Tipo, tamaño, propósito y privacidad se explican; un reemplazo bloqueado no inicia upload. |
| A11Y-01 / BTN-01 | cumplimiento | Controles con nombre accesible, foco y área táctil mínima. |
| MP-01 | no conformidad contenida | Falta disposición gobernada de históricos; 0447 impide ampliar el inventario hasta cerrar ese control. |

## Allowlist exacta

- `docs/specs/0439-portal-cliente-edicion-de-perfil/spec.md`
- `docs/specs/README.md` (generado)
- `docs/legal/privacidad/fotos-identidad-cliente-v1.md`
- `docs/legal/privacidad/revision-0445-2026-09-04.md`
- `docs/legal/privacidad/README.md`
- `docs/legal/privacidad/registro-tratamiento.md`
- `docs/legal/privacidad/mapa-de-borrado.md`
- `docs/legal/privacidad/inventario-terceros.md`
- `.agents/handoffs/2026-09-04-portalcliente-close.md`
- `supabase/migrations/0445_portal_profile_edit_limit.sql`
- `supabase/tests/0445_portal_profile_edit_limit.test.sql`
- `supabase/migrations/0447_identity_photo_replacement_privacy_gate.sql`
- `supabase/tests/0447_identity_photo_replacement_privacy_gate.test.sql`
- `lib/portal/profile-edit-quota.ts`
- `lib/portal/__tests__/profile-edit-quota.test.ts`
- `app/portal/(app)/perfil/page.tsx`
- `app/portal/(app)/perfil/actions.ts`
- `app/portal/(app)/perfil/DataChangeEditor.tsx`
- `app/portal/(app)/perfil/CedulaPhotoRow.tsx`
- `app/portal/(app)/perfil/PortalAddresses.tsx`
- `app/portal/(app)/perfil/PortalAddresses.test.tsx`
- `app/portal/(app)/perfil/ProfileEditControls.test.tsx`
- `app/portal/(app)/perfil/IdentityPhotoAction.test.ts`
- `.agents/handoffs/pr27-identity-photo-uncertain-response-20260906.md`

### Corrección aislada · respuesta perdida (2026-09-06)

Base PR27 `82fc49ff`; SDD permanece in-progress. Se conserva el bloqueo0447,
cuota y primera carga. RED sobre actions base: 14 fallos/7 aprobados incluyendo
commit con respuesta perdida que dejaba puntero sin objeto. GREEN inicial:
21/21 con SDK Supabase real 2.106.1, helper upload real y transporte offline.
El test simula commit y respuesta por separado; no demuestra comportamiento
de una base real ni aplica migraciones. Reconciliación fallida, fila retirada,
tenant/prefijo/cuenta cambiados, puntero concurrente y commit posterior a lectura
nula conservan el archivo. Cleanup fallido comunica soporte sin éxito falso.
Final: 27/27 (24 identidad + 3 cuota), TypeScript, ESLint focal, docs:check,
governance:check y components:check PASÓ. Código d7717861 enviado a revisión
independiente, favorable con 14 escenarios propios SDK/offline y sin nuevos
bloqueos; detalle y límites en handoff. Falta validación combinada coordinada
por Director. Sin push, build/verify masivo ni Cloud.

## Fuera de alcance

- Cambio de email o de Shipping Mark.
- Edición directa sin aprobación del asesor.
- Edición del avatar cosmético dentro del cupo.
- Desplegar o publicar el código.
- Crear o modificar datos reales de clientes.

## Verificación exigida

- Pruebas unitarias del cálculo/mapeo del cupo.
- Pruebas de UI para bloqueo, reemplazo de foto y edición prellenada de dirección.
- Contrato SQL desechable: límite atómico, liberación por rechazo/cancelación,
  primera foto gratis, reemplazo contenido, ACL/RPC y aislamiento.
- `pnpm docs:check`, `pnpm typecheck`, `pnpm lint`, pruebas focalizadas,
  `pnpm governance:check`, `pnpm components:check` y `node scripts/verify.mjs`.

### Resultado local

- 17/17 pruebas focalizadas pasaron; la suite Vitest completa pasó con 5.884
  pruebas en 501 archivos.
- 141/141 contratos SQL pasaron y el esquema se reconstruyó desde cero con las
  379 migraciones aplicables; aislamiento multi-tenant: verde.
- Lint (0 errores), TypeScript, Edge Functions, documentación, numeración,
  componentes, gobernanza y build de producción: verdes.
- La verificación integral terminó 14/15: Playwright global quedó rojo porque el
  worktree no contiene `NEXT_PUBLIC_SUPABASE_URL` ni
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`; 135 E2E públicos pasaron, 18 dependientes de
  seed quedaron omitidos y 15 de login/proxy fallaron por ese entorno. El
  reintento automático reprodujo el fallo y se detuvo al quedar WebKit colgado
  durante el cierre. `migrations-applied` también quedó omitido por falta
  deliberada de credenciales Cloud.

### Resultado Cloud

- `0445_portal_profile_edit_limit` aplicada el 2026-09-04 con ledger
  `20260904193612` y SHA-256 local
  `5A256A83E1E8C056D7AAE7EA6A22D39607D60B8C329683C6EE2AEA9557EACD4B`.
- Backfill: 4 solicitudes de 4 clientes; cero clientes quedaron sobre el límite.
- RLS activa, sin grants directos al ledger; las dos RPC quedan ejecutables solo
  por `authenticated`, con `SECURITY DEFINER` y `search_path` vacío.
- `0447_identity_photo_replacement_privacy_gate` se aplicó a Cloud el
  2026-09-10 (ledger `20260910164232`) y la retiró
  `0461_identity_photo_replacement_enable` el 2026-09-18 (ledger
  `20260918174236`, SDD-0481): el reemplazo de foto está habilitado dentro del
  cupo.
- UAT autenticado permanece pendiente: el código del Portal no se despliega
  hasta `cerrar` y falta identificar la cuenta empresarial y las mutaciones
  aprobadas.

### Concurrencia del cupo en la suite SQL (seguimiento del 2026-09-19)

Seguimiento sin número nuevo, asignado por el Director (la sesión «Director
notificación a workers»). Las migraciones 0445, 0446, 0461 y 0462 no se tocan.

**En producción** (verificado por el Director el 2026-09-19, leyendo sólo el
catálogo, sin filas):

- **Cuerpos:** el `md5(prosrc)` de producción es el de la última definición en
  `main` y el mismo que deja el fixture de la carrera. Las cinco funciones son
  DEFINER:
  - `portal_profile_edit_request_lifecycle` (0445): `5316eac7…`;
  - `portal_set_identity_photo` (0446): `057aea5c…`;
  - `portal_update_my_profile` (0462): `724dc0cf…`;
  - `portal_profile_edit_follow_request_reassignment` (0446): `10b6e764…`;
  - `portal_profile_edits_follow_client_merge` (0446): `8948fa55…`.

  `merge_clients` es la de la 0361 (`1a65fc74…`). El fixture usa la fusión
  recortada del contrato 0446, que toma las mismas dos fichas FOR UPDATE al
  empezar.
- **Triggers:** `client_change_requests_profile_edit_lifecycle`,
  `client_change_requests_profile_edit_reassignment` y
  `clients_profile_edits_follow_merge` existen y están habilitados.
- **Ledger:** la 0461 (`20260918174236`) y la 0462 (`20260919011316`) son
  idénticas a `main`. En la 0361, la 0445, la 0446 y la 0447, el md5 y los bytes
  del ledger no coinciden con el archivo. No es porque el archivo se haya editado
  después de aplicar:
  - el de la 0445 tiene exactamente el SHA-256 que registra «Resultado Cloud»
    (`5A256A83…`);
  - el último commit de las otras tres es anterior a su ledger.

  Lo más probable, aunque no está verificado, es que el texto aplicado no fue el
  archivo tal cual. Lo que ejercita la carrera, es decir, los cuerpos y los
  triggers, coincide con producción.

**Lo que afirma esta spec y cómo corre en la app.** La sección «Persistencia y
seguridad» dice que el trigger de la 0445 «serializa por fila de `clients`, de
modo que dos solicitudes simultáneas no pueden superar el límite». En la app, el
cupo se consume por dos caminos, y los dos toman FOR UPDATE de la ficha antes de
contar:

- la edición directa `portal_update_my_profile` (0462:214), que inserta la
  solicitud aprobada que el trigger cuenta;
- el cambio de foto `portal_set_identity_photo` (0446:256), que cuenta y asienta
  por su cuenta.

El Portal ya no crea solicitudes pendientes: sólo cancela las anteriores a
SDD-0482. El Studio registra sus cambios con `source = 'admin'`, que el trigger
no cuenta.

**`supabase/tests/0445_cupo_perfil_carrera.test.sql`** corre en el paso
`sql-tests` de `verify` (no en CI). Usa:

- sesiones reales por dblink;
- una barrera por `pg_blocking_pids`, sin esperas;
- el fixture de los contratos 0462 y 0446, con la cadena real 0445 → 0446 →
  0447 → 0461 → 0462;
- del lado del Portal, las dos RPC reales, con la sesión del cliente.

Cada escenario corre primero con la función que lo defiende sin su FOR UPDATE
(control) y después con las migraciones. Salvo en la fusión, el cliente arranca
con 1 cambio disponible:

| # | Escenario | Sin el FOR UPDATE (control) | Con las migraciones |
|---|---|---|---|
| 1 | Dos altas directas de la solicitud aprobada, desde un llamador sin lock propio: el contrato del trigger | trigger sin 0445:138: la segunda no espera, pasan las dos y quedan 4 | la segunda espera y recibe `profile_edit_limit_reached` |
| 2 | Dos ediciones directas a la vez, con cambios distintos | la 0462 y el trigger sin sus locks: pasan las dos y quedan 4 | la segunda espera y recibe el límite |
| 3 | Una edición directa y, encima, un cambio de foto | foto sin 0446:256: cuenta antes de esperar, pasa y quedan 4 | la foto espera y recibe el límite |
| 4 | Dos cambios de foto a la vez | ídem: pasan los dos y quedan 4 | el segundo espera y recibe el límite |
| 5 | Una fusión retira la ficha y su cliente edita sus datos a la vez | 0462 sin 0462:214: el cambio cae en la ficha retirada y se cuenta ahí, fuera del cupo del superviviente | la edición espera y recibe `profile_client_not_found` |
| 6 | Lo mismo con un cambio de foto | foto sin 0446:256: ídem | el cambio espera y recibe `profile_client_not_found` |
| 7 | Una fusión y un cambio del superviviente a la vez | sin control (ver abajo) | el cambio espera la fusión, cuenta la historia unida y recibe el límite |

En las siete corridas reales, la segunda sesión espera en `transactionid`.

**Mutantes, con el runner real y fuera del repo.** Los contratos 0445, 0446,
0461 y 0462, de una sola sesión, no detectan ninguno:

| Mutante | Lo que se quita | Escenarios que caen |
|---|---|---|
| M1 | el FOR UPDATE del trigger (0445:138) | 1 |
| M2 | el FOR UPDATE de la edición directa (0462:214) | 5 |
| M1+M2 | los dos | 1, 2 y 5 |
| M3 | el FOR UPDATE de la foto (0446:256) | 3, 4 y 6 |
| M4 | el FOR UPDATE del trigger de reasignación (0446:75) | ninguno |
| M5 | el FOR UPDATE del trigger de fusión (0446:133) | ninguno |
| M4+M5 | los dos | ninguno |
| M4+M5, con la fusión del fixture sin su FOR UPDATE inicial | todo lock explícito de la fusión | ninguno |

**Lo que muestran:**

- **El lock del trigger (0445:138) y el de la edición directa (0462:214) se
  cubren entre sí.** Con cualquiera de los dos, dos ediciones a la vez no pasan
  del límite: M1 y M2 no tumban el escenario 2, M1+M2 sí. En la app, el lock del
  trigger decide sólo si aparece un llamador que inserte la solicitud sin tomar
  antes la ficha (escenario 1).
- **El lock del trigger no cubre la fusión, porque no filtra fichas retiradas.**
  Lo que impide consumir sobre la ficha retirada son los FOR UPDATE con
  `deleted_at is null` de la 0462 y de la foto (escenarios 5 y 6).
- **El lock de la foto (0446:256) es el único de su camino.**
- **Los locks de los triggers de la fusión (0446:75 y :133) son de ejecución,
  pero no cambian nada observable.** En la app sólo los alcanza `merge_clients`,
  que ya toma FOR UPDATE de las dos fichas al empezar (0361:84-89). Y una fusión
  no aplica el máximo (0446:49-51): cualquier orden entre una fusión y un consumo
  del superviviente equivale a uno en serie. Por eso el escenario 7 no tiene
  control posible. Además, sin ningún lock explícito en la fusión, el consumo
  que llega durante ella espera igual. Mover las filas a la superviviente toma
  KEY SHARE sobre ella por las FK, y retirar la otra ficha la actualiza. Los FOR
  UPDATE de los dos caminos chocan con esos locks. Son defensa en profundidad.
- **El `lock table` de la 0446:175 es del backfill,** que corrió una sola vez al
  aplicar.

**Limpieza en tres modos de fallo** (guarda, corte en la barrera y rojo M3): el
clúster queda como estaba.

El detalle y los scripts están en el handoff
`.agents/handoffs/0439-carrera-cupo-0445.md`.

Rutas agregadas a la allowlist por este seguimiento:

- supabase/tests/0445_cupo_perfil_carrera.test.sql
- .agents/handoffs/0439-carrera-cupo-0445.md
