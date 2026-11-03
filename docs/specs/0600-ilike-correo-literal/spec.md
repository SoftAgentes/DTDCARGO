---
sdd: "0600"
title: "Un correo no se compara como patrón: correo entrante, invitación y baja"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-02
updated: 2026-11-03
supersedes: null
superseded_by: null
related: ["0056", "0082", "0113", "0140", "0597"]
confidencialidad: interno
---

# SDD-0600 · Un correo no se compara como patrón: correo entrante, invitación y baja

## Pedido

**Sam, literal:** «Haz esta tarea aquí: "Comodines de .ilike: correo entrante, invitación y baja"».

Salió de la SDD-0597 (PR #361), que corrigió el mismo patrón en `/entrar` y dejó estos tres sitios fuera de su alcance.

**Límites del Director General:** rama, worktree y PR en borrador propios desde `origin/main`. Sin `verify` ni Docker hasta su aviso, y sin tocar prueba. Pidió pruebas con control rojo del daño concreto en cada sitio, no solo del escape, y que la invitación pase por `revisar-datos-ve`. La primera publicación ya salió, y esta PR entra en el mandato de Sam para las fases 2, 3 y 4: la fusiona el Director General.

## Qué pasaba

`.ilike("email", correo)` parece una igualdad sin mayúsculas, pero `%` y `_` son comodines, y PostgREST convierte `*` en `%`. El código lo daba por exacto: `inbound-email.ts` decía «case-insensitive exact (sin %)».

Reproducido con dobles que aplican los comodines de verdad, sin provocarlo en producción. **Hoy no queda huella en producción de la ficha mal enlazada,** aunque eso no prueba que nunca pasó: ver «No verificable».

| Sitio | De dónde viene el correo | El daño, reproducido |
|---|---|---|
| `lib/studio/conversaciones/inbound-email.ts` | el `From` de un correo entrante | `juan_perez@` y `*@ejemplo.com` entran al hilo de `juan.perez@`. Y un parecido en otro tenant vuelve «ambiguo» al cliente real, cuyo correo se pierde |
| `app/invitar/[token]/actions.ts` | el correo de la invitación | La invitada `ana_diaz@` queda enlazada a la ficha de nómina de `ana.diaz@`. Con ese enlace, `app/m/emp` le muestra esa ficha y sus recibos (`app/m/emp/page.tsx:6`) |
| `lib/studio/mail/unsubscribe-request.ts` | el correo del enlace firmado | La baja de `juan_perez@` también le quita el permiso de marketing a `juan.perez@`, que nunca la pidió |

Los dos últimos no los provoca alguien de afuera a propósito: la invitación la escribe el equipo y el enlace de baja va firmado. Pasan solos, porque `_` es común en un correo real y solo hace falta que exista un parecido.

**Por qué nadie lo vio:** el doble de `inbound-email.test.ts` comparaba exacto, y la baja de marketing y el enlace con la ficha no tenían prueba.

## Decisión

Reutiliza `lib/shared/email-literal.ts` de la SDD-0597: `emailIlikePattern` escapa `%`, `_` y `\`, y `sameEmail` compara el resultado, porque `*` no se puede escapar. El archivo es idéntico al de la #361, y git fusiona limpio dos altas iguales (medido con `merge-tree`).

- **Correo entrante:** filtra los resultados con `sameEmail`.
- **Invitación y baja:** un `.update` con `.ilike` no deja descartar nada después. Ahora se leen primero las filas, se filtran y se actualiza por `id`, repitiendo en el `.update` los filtros que protegen (`tenant_id`, y `auth_user_id is null` en la ficha).
- **El escape se mantiene aunque aquí no cambie el resultado.** Estos sitios no usan `.limit(1)`, así que `sameEmail` ya decide. El escape evita traer de la base filas que después se descartan, y protege si mañana alguien añade un `.limit`.
- **La baja sigue confirmando aunque no encuentre filas,** como antes, y avisa el error si no puede leer o escribir.

**Descartado:**
- **`.eq` con el correo en minúsculas:** `clients.email` viene de importaciones y planillas, sin normalizar; dejaría sin reconocer a quien tenga mayúsculas guardadas.
- **Función SQL con `lower(email) = lower($1)`:** es lo más limpio, pero pide migración, y esto no la necesita.
- **Apilar sobre la #361:** cuando se decidió esa PR estaba retenida, y una PR apilada no tiene el check de `quality`.

## Aceptación

1. Un `From` parecido o con comodines no entra al hilo de otro cliente, ni vuelve ambiguo a nadie.
2. El `auth_user_id` no queda en la ficha de otra persona. Tampoco pisa una ficha enlazada, ni toca otro tenant ni una ficha borrada.
3. La baja no le quita el marketing a un parecido, ni toca otro tenant.
4. Los correos reales siguen funcionando en los tres sitios, con `_`, `+`, `%`, `*` o mayúsculas.
5. La baja no confirma si no pudo leer o escribir. Un fallo al buscar la ficha no tumba la aceptación de la invitación.
6. **No se integra sin medir el escape contra PostgREST real.** Si el `\` no pasara bien por esa capa, un cliente con `_` no recibiría su hilo, y su baja diría «Listo» sin hacer nada. Medido el 2026-11-03: ver «Validación».

## Allowlist

| Archivo | Cambio |
|---|---|
| `lib/shared/email-literal.ts` | sin cambios: ya en `main` por la #361 |
| `lib/shared/__tests__/email-literal.test.ts` | sin cambios: ya en `main` por la #361 |
| `lib/shared/__tests__/coincide-ilike.ts` | nuevo: la imitación de `ILIKE` para los dobles |
| `lib/shared/__tests__/coincide-ilike.test.ts` | nuevo: esa imitación contra Postgres, en PGlite |
| `lib/studio/conversaciones/inbound-email.ts` | compara el remitente literal |
| `lib/studio/conversaciones/__tests__/inbound-email.test.ts` | el doble aplica comodines; casos nuevos |
| `app/invitar/[token]/actions.ts` | lee, filtra y enlaza por `id` |
| `app/invitar/[token]/__tests__/vinculo-ficha-empleado.test.ts` | nuevo |
| `lib/studio/mail/unsubscribe-request.ts` | lee, filtra y da de baja por `id` |
| `lib/studio/mail/__tests__/unsubscribe-marketing-literal.test.ts` | nuevo |
| `docs/specs/0600-ilike-correo-literal/spec.md` | esta spec |
| `docs/specs/README.md` | índice generado |
| `.agents/handoffs/sdd-0600-ilike-correo-literal.md` | handoff |

Sin migraciones, sin variables nuevas y sin tocar producción ni prueba.

## Datos personales (`revisar-datos-ve`)

**Alcance:** solo lo que toca este diff. No se recorrieron los doce puntos, y esto no dice nada de los que quedan fuera. No se leyeron filas. **No es asesoría legal:** es un inventario técnico y una lista de preguntas para un abogado.

**Resumen:** 5 ENCONTRADO (3 corregidos aquí, 2 sin corregir), 2 CORRECTO, 4 NO VERIFICABLE.

| Campo | Qué es | Finalidad en el código | Base de licitud y retención | Quién más lo ve |
|---|---|---|---|---|
| `nomina_employees.email` | correo del empleado | enlazar su login con su ficha | NO VERIFICABLE: abogado | equipo de nómina |
| `nomina_employees.auth_user_id` | cuenta que ve esa ficha | acceso a `/m/emp` | NO VERIFICABLE: abogado | el empleado enlazado |
| `clients.email` | correo del cliente | reconocer al remitente, dar la baja | NO VERIFICABLE: abogado | equipo |
| `clients.email_marketing_optin_at` | consentimiento de marketing | enviar o no marketing | NO VERIFICABLE: abogado | equipo |
| `From` y cuerpo del correo entrante | mensaje de quien escribe, que puede no ser cliente (punto 12) | atender la conversación | NO VERIFICABLE: abogado | equipo |

**Hallazgos, por gravedad:**

| Estado | Qué | Dónde | Norma | Arreglo |
|---|---|---|---|---|
| ENCONTRADO, corregido | Un login podía quedar enlazado a la ficha de otra persona y ver sus recibos | `app/invitar/[token]/actions.ts:149`, `:151`; `app/m/emp/page.tsx:6` | CRBV art. 28 · SC 332/2001, finalidad y calidad. Si ocurrió, qué implica frente a los arts. 20 a 22 de la Ley de Delitos Informáticos es pregunta para un abogado | Esta spec |
| ENCONTRADO, corregido | El mensaje de un tercero quedaba en el hilo de un cliente | `lib/studio/conversaciones/inbound-email.ts:118`, `:123` | CRBV arts. 28 y 60 · SC 332/2001, calidad | Esta spec |
| ENCONTRADO, corregido | Se le retiraba el consentimiento a quien no lo pidió | `lib/studio/mail/unsubscribe-request.ts:112`, `:115` | SC 332/2001, autonomía | Esta spec |
| ENCONTRADO, **sin corregir** | El remitente sin cliente queda en el log en texto plano, y este cambio manda ahí a los parecidos | `app/api/conversaciones/email/route.ts:146`, `:151` | SC 332/2001, temporalidad | Registrar el `email_id` y un hash del correo |
| ENCONTRADO, **sin corregir** | La baja deja `email_marketing_optin_at` en `NULL`: no queda cuándo se retiró. No encontré auditoría de esa columna (`0293…:517` cubre `email` y `phone`) | `lib/studio/mail/unsubscribe-request.ts:120` | SC 332/2001: la carga de probar el consentimiento es de quien trata los datos | Una columna con la fecha de retiro, o una tabla de consentimientos. Pide migración |
| CORRECTO | Las filas leídas no salen del servidor, y no se añade ningún log con el correo | `app/invitar/[token]/actions.ts:151`; `lib/studio/mail/unsubscribe-request.ts:115` | | |
| CORRECTO | Sigue sin pisar una ficha ya enlazada | `app/invitar/[token]/actions.ts`, doble filtro `auth_user_id is null` | | |

**No verificable:**
- **¿Ya pasó en producción?** Solo se puede responder en parte. Con autorización de Sam («Sí, autorizo el conteo»), el Director General contó las fichas cuyo `auth_user_id` apunta a una cuenta con otro correo, el 2026-11-02 a las 18:52Z, sin imprimir datos: `por_comodin` = 0 y `correo_distinto` = 1. **No es incidente:** hoy no queda huella de este defecto. Cero no prueba que nunca pasó, porque un enlace ya deshecho no deja rastro y una ficha que cambió de correo después ya no cuenta en `por_comodin`. `correo_distinto` no es este defecto, y revisar esa ficha es una decisión aparte de Sam. Un conteo igual para la baja no es posible: no queda rastro (ver el hallazgo sobre la fecha de retiro).
- **Comportamiento contra una base real:** las cadenas de los tres caminos se midieron contra PostgREST real, con tablas mínimas y datos sintéticos (ver «Validación»). No corrieron el código de la app contra el esquema real, ni contra producción.
- **Base de licitud y retención** de cada campo: abogado.
- **Qué autentica el `From`:** no encontré SPF ni DKIM en `app/api/webhooks` ni en `lib/studio/conversaciones`. Quien falsifique el `From` exacto de un cliente no queda cubierto por esta spec; puede que Resend lo filtre antes.

**Segunda opinión:** conviene que otro modelo revise este diff.

## Validación

| Comprobación | Resultado |
|---|---|
| Control rojo: las pruebas nuevas contra el código anterior | PASÓ: 19 en rojo. Correo entrante 7, baja 3, invitación 9 |
| Mutantes | PASÓ: 10 de 11 mueren. El otro («la baja no mira el tenant») es equivalente, porque el `.update` repite el filtro. Quitando los dos filtros, muere |
| Conteo de fichas en producción, por el Director General | `por_comodin` = 0 y `correo_distinto` = 1, a las 18:52Z del 2026-11-02. Ver «No verificable» |

### Medición contra PostgREST real (2026-11-03)

PostgREST v14.17 y Postgres, 2 contenedores de 1 GB, con el `supabase-js` y el `email-literal.ts` del repo. **PASÓ: 28 de 28.** Son copias de las cadenas de `select` y `update` de cada sitio, y la medición comprueba antes que siguen escritas así en sus archivos. No es el código de la app corriendo.

| Camino | Casos | Resultado |
|---|---|---|
| Correo entrante | 11: `_`, `+`, `*`, mayúsculas, el mismo correo en dos tenants, cliente borrado, y `%` o `*` como comodín | solo el correo exacto |
| Invitación | 8: `_`, `+`, mayúsculas, `%` o `*` como comodín, ficha con login y ficha borrada | enlaza solo la ficha exacta, con el `update` por `id` |
| Baja | 6: `_`, `+`, `*`, `%`, dos filas con el mismo correo y correo sin fila | da de baja solo el correo exacto, con el `update` por `id`, sin tocar otro tenant |

### `pnpm verify` sobre `bfc6cc9f0`

Exit 1. Corrieron 16 de 17 pasos, de las 20:32Z a las 22:13Z, con `node_modules` propio, 0 pesadas ajenas al lanzar y Docker en `running` las 81 muestras.

| Paso | Resultado |
|---|---|
| `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions` | PASÓ |
| `test` | **FALLÓ por carga, sin relación con este diff.** Primer intento: 13.286 bien, 4 mal en 3 archivos, y 3 errores de workers. Reintento: 13.452 bien, 14 mal en 6 archivos. Hubo tiempos agotados, workers que no arrancaron y búsquedas de texto en pantalla que no llegaron a tiempo, con un mínimo de 0,7 GB libres. **Aislados sobre el mismo SHA, con un solo worker: PASÓ, 192 de 192 en 10 archivos, en 513 s** |
| `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check`, `pending-migration-symbols` | PASÓ |
| `migrations-applied` | NO EJECUTADO: este worktree no tiene `.env.local`. Esta PR no trae migraciones |
| `sql-tests`, `schema-rebuild` | PASÓ, con Docker arriba |
| `e2e` | PASÓ con aviso, al reintento. Primer intento: falla `company-photo-carousel.spec.ts:93` y `smoke.spec.ts:150` inestable. Reintento: 226 bien, 20 omitidas, 3 inestables (`auth.spec.ts:81`, `company-photo-carousel.spec.ts:93`, `smoke.spec.ts:150`), y el proceso salió ≠ 0 por el worker de WebKit, que `verify` absuelve. Ninguna depende de esta spec |
| `build` | PASÓ |

### Cierre de la diferencia con `main`, sobre `30099400c`

Mientras corría `verify` entró a `main` la #361. Con `main` en `8feae0e8b` y un solo worker:

| Comprobación | Resultado |
|---|---|
| Los tres sitios, `email-literal`, `coincide-ilike`, la ruta del correo entrante, las pruebas de baja, `token-get-idempotente` y `app/entrar` | PASÓ: 209 pruebas en 13 archivos |
| `typecheck` | PASÓ |
| `eslint` de lo tocado | PASÓ |
| `docs:check` y `sdd:check` | PASÓ |


## Fuera de alcance detectado

- Los dos hallazgos sin corregir de la tabla anterior: el remitente en el log y la fecha de retiro del marketing.
- Lo que no autentica el `From`.
- `.ilike` con búsquedas de texto del Studio con sesión (`kommo-convert.ts:105`, `kommo-queries.ts:180`, `destination-change.ts:38`, entre otros): `%`/`_` amplían una búsqueda, sin daño comprobado. No se revisaron uno por uno.
- `coincideIlike` está también dentro de la prueba de la #361. Cuando las dos estén en `main`, esa copia se puede cambiar por esta.
