# Auditoría de datos personales — DTD Cargo · julio 2026

> **Esto no es asesoría legal.** Es un inventario técnico con evidencia
> `archivo:línea`, para saber qué revisar y qué preguntarle a la abogada.
>
> Corrida con `/revisar-datos-ve` sobre el commit `d35d0f2a`.
> Marco: Venezuela (CRBV 28 y 60 · SC 332/2001 y 759/2025 · Delitos Informáticos ·
> Mensajes de Datos y Firmas Electrónicas) + China (PIPL). RGPD y Chile 21.719
> como **referencia**, no como obligación.
>
> Clasificación: **interno**. No contiene datos de clientes — solo nombres de
> tablas, columnas y rutas de archivo.

---

## 1 · Resumen

| # | Punto | Estado |
|:-:|---|---|
| 1 | Inventario de datos personales | 🔴 ENCONTRADO |
| 2 | Minimización y proporcionalidad | 🔴 ENCONTRADO |
| 3 | Consentimiento con evidencia | 🟡 MIXTO — 1 `CORRECTO`, 2 `ENCONTRADO` |
| 4 | Los derechos, como caminos reales | 🔴 ENCONTRADO |
| 5 | El borrado que borra de verdad | 🔴 ENCONTRADO |
| 6 | Trazabilidad de las solicitudes | 🟡 MIXTO — base parcial |
| 7 | La política pública de tratamiento | 🔴 ENCONTRADO |
| 8 | Inventario de terceros | 🔴 ENCONTRADO |
| 9 | Transferencia internacional | 🟡 MITIGADO — ver H-7 |
| 10 | Decisiones automatizadas trazables | 🟡 MIXTO — 1 `CORRECTO`, 2 `ENCONTRADO` |
| 11 | Valor probatorio de la aceptación electrónica | 🔴 ENCONTRADO |
| 12 | Titulares que no son tus usuarios | 🔴 ENCONTRADO |

**Alcance recorrido:** 288 migraciones · 221 tablas, de las cuales **101 tienen
campos de persona** · **11 buckets** de Storage · el sitio público, el Portal del
Cliente y las tres PWA de operario.

**Lo que ya está bien y hay que defender** (los `CORRECTO`, en detalle en §4):
los 11 buckets son privados · `legal_acceptances` es append-only por *trigger* ·
el sellado de evidencia es server-side · `newsletter_subscribers` guarda
consentimiento con evidencia completa · Consent Mode v2 arranca en `denied` · GA
está excluida de toda ruta con datos de cliente · RLS por tenant.

---

## 2 · Inventario de datos personales

### 2.1 Las tablas que concentran el riesgo

| Tabla | Campos de persona | Sensible | Borrado | Evidencia |
|---|---|---|---|---|
| `clients` | `name`, `email`, `phone`, `address`, `rif`, `notes`, `facade_photo_url` | — | `deleted_at` | `0006_clients.sql` · `0066_foundation_v3.sql:157` |
| `persons` | `national_id`, `name`, `email`, `phone` | — | `deleted_at` | `0170_persons.sql` |
| `client_users` | `email`, `token` | — | `revoked_at` | `0080_portal_cliente.sql` |
| `tms_drivers` | `cedula`, `name`, `phone`, `email`, `address`, **`emergency_contact`**, `rating` | — | `deleted_at` | `0011_tms_schema.sql` |
| `tms_truck_locations` | `lat`, `lng`, `accuracy_m` + `driver_id` | 🔴 **geolocalización** | **ninguno** | `0066_foundation_v3.sql` |
| `dispatch_pods` | `photo_path`, `signature_path`, `received_by`, `received_doc`, GPS | 🔴 **biométrico + geolocalización** | **ninguno** | `0025_operario_roles_extend.sql` · `0068_pod_partial_and_gps_addons.sql` |
| `nomina_employees` | `full_name`, `birth_date`, `phone`, `email`, `bank_account`, `salary_usd` | — | — | `0160_nomina_employees.sql` |
| `nomina_employee_registrations` | + `national_id`, `photo_path` | — | **ninguno, por diseño** | `0180_employee_invites_registrations.sql` |
| `legal_acceptances` | `ip`, `client_markbox`, `hash` | — | append-only | `0102_capa_legal.sql:86` |
| `newsletter_subscribers` | `email`, `consent_ip_hash`, `user_agent` | — | `unsubscribed_at` | `0259_newsletter_subscribers.sql` |
| `public_verify_throttle` | `ip` (IP en claro de quien consulta `/verificar`), `created_at` | — | purga técnica de filas con más de 60 min, cron diario (SDD-0455) | `0169_public_verify_throttle.sql:23-27` · `app/api/cron/purge-throttle/route.ts:36,78-82` |
| `portal_registro_throttle` | `ip`: clave de 12 escritores en cuatro formas (IP en claro con o sin prefijo, huella SHA-256 de la IP, huella SHA-256 sin sal del email; detalle en la nota), `created_at` | — | purga técnica a 48 h, mismo cron | `0094_portal_registro_throttle.sql:20-24` · `app/api/cron/purge-throttle/route.ts:27,62-65` |
| `public_track_log` | `ip` (huella SHA-256 desde `0326`; las filas previas pueden conservar la IP en claro), `code`, `found`, `requested_at` | — | **ninguno**: sin backfill ni purga | `0059_public_track_rpc.sql:24-30` · `0326_public_tracking_privacy_throttle.sql:32,90-91` |
| `no_olvidar_access_log` | `user_id`, `ip_address`, `user_agent` | — | **ninguno**: inmutable; cascada al borrar el usuario | `0017_no_olvidar.sql:121-129,430-436` |

> **Corrección del 2026-09-11 (SDD-0455).** Estas cuatro filas eran una sola, con
> `ip_address`/`user_agent` y «throttle purga». Esas columnas solo existen en
> `no_olvidar_access_log`; las otras tres guardan `ip`. Ninguna purga alcanzaba a
> `public_verify_throttle`, `public_track_log` ni `no_olvidar_access_log`, y
> SDD-0455 incorpora solo la primera. Verificado contra el árbol del 2026-09-11,
> no contra `d35d0f2a`; producción NO VERIFICABLE.
>
> Quién escribe `portal_registro_throttle.ip` (12 sitios):
>
> - **IP en claro con prefijo:** `contact:` (`app/api/contact/route.ts:143`),
>   `newsletter:` (`app/api/newsletter/subscribe/route.ts:70-71`), `calc:`
>   (`app/api/public/calc-event/route.ts:76`), `est:`
>   (`app/api/public/estimacion/route.ts:82`), `docheck:`
>   (`app/api/registro/check/route.ts:72`), `packing:`
>   (`app/p/[token]/packlist/route.ts:132`) y `upload:`
>   (`app/p/[token]/upload/route.ts:141`).
> - **IP en claro sin prefijo:** `app/registro/actions.ts:126,143` y
>   `app/m/emp/actions.ts:86,98`.
> - **Huella SHA-256 de la IP:** `portal-login:` (`app/entrar/actions.ts:106-109`)
>   y `studio-recuperar:` (`app/studio/(auth)/login/recuperar/actions.ts:64-67`).
> - **Huella SHA-256 sin sal del email:** `portal-login-mail:`
>   (`app/entrar/actions.ts:113,117`). Sin sal, se revierte probando correos
>   conocidos.
>
> `public_track_log`: la huella rige desde `0326`
> (`0326_public_tracking_privacy_throttle.sql:32`). Ninguna migración hace
> backfill ni purga, así que las filas previas pueden conservar la IP en claro.

Otras **90 tablas** tienen `name` o `notes`; la mayoría se refieren a entidades
(proveedores, navieras, rutas), pero `notes` es texto libre en todas y por eso
entra en el punto 1.

### 2.2 Los 11 buckets

| Bucket | Qué guarda | Sensible | Migración |
|---|---|---|---|
| `client-docs` | **documento de identidad del cliente** (cédula/RIF) | 🔴 | `0091` |
| `client-facades` | **foto de la fachada de la vivienda del cliente** | 🟠 | `0066` |
| `receipt-photos` | recepción CN **y las fotos + firmas del POD** | 🔴 | `0022` |
| `payment-proofs` | comprobantes de pago (datos bancarios) | 🟠 | `0195` |
| `bitacora` | **audio y video de reuniones** | 🔴 voz | `0214` |
| `inspections` | fotos de inspección de mercancía | — | `0176` |
| `claim-evidence` | evidencia de reclamos | — | `0155` |
| `shipment-docs`, `prealerta-docs`, `documents`, `expense-receipts` | documentación operativa | — | varias |

✅ **Los 11 son `public = false`.** Verificado en cada `insert into storage.buckets`.

### 2.3 Titulares que no son usuarios (punto 12)

| Quién | Qué se le captura | Dónde | ¿Está en la política? |
|---|---|---|---|
| **Quien recibe una entrega** | nombre, documento, **firma**, **foto**, **GPS** | `dispatch_pods` | ❌ no |
| **Contacto de emergencia del chofer** | texto libre con nombre y teléfono de un tercero | `tms_drivers.emergency_contact` | ❌ no |
| **Contacto del proveedor CN** | nombre, datos de contacto | `suppliers`, `suppliers_cn` | ❌ no |
| **Referido** | contacto que da un cliente | `referrals` | ✅ parcial |
| **Pagador tercero** | nombre y relación con el cliente | Acuerdo cl. 7.4 | ❌ no |

---

## 3 · Hallazgos

### 🔴 H-1 · El hash de aceptación no sella el texto, y el documento es mutable

**Punto 11.** `acceptanceHashPayload` mete `docs: [{key, version}]` — la
**referencia**, no el contenido
([`lib/studio/legal/types.ts:343`](../../../lib/studio/legal/types.ts)). Y
`legal_docs` no tiene columna de hash del cuerpo (`0102_capa_legal.sql`), **ni
trigger de inmutabilidad**, mientras sí existen `policy "legal_docs update by
admin"` y `"legal_docs delete by admin"` (mismo archivo, líneas 262 y 276).

**Por qué importa.** Un administrador puede editar el `body` de un documento
vigente sin cambiar la versión, y **todas las aceptaciones previas seguirían
validando su hash contra un texto distinto del que el cliente aceptó**. La regla
*"un documento publicado es INMUTABLE"* (`HANDOFF_CAPA_LEGAL.md` §SDD-A) existe
como norma escrita, no como restricción de la base. Y la cláusula **13.1** del
Acuerdo le promete al cliente *"huella de integridad (hash)"*.

**Norma.** Mensajes de Datos y Firmas Electrónicas **art. 16.3** — la firma no
debe *alterar la integridad del Mensaje de Datos*. Un cuerpo mutable debilita
incluso la valoración por sana crítica del art. 17.

**El arreglo.** Columna `body_sha256` en `legal_docs` + incluirla en
`canonicalDocs()` del payload + trigger de inmutabilidad sobre `status='vigente'`.
**Sin PSC y sin costo.** Es el hallazgo con mejor retorno del informe.

---

### 🔴 H-2 · El POD no está sellado ni es inmutable

**Puntos 11 y 12.** `dispatch_pods` (`0025_operario_roles_extend.sql`) guarda foto,
firma, nombre y documento del receptor y GPS — **sin hash, sin trigger
append-only, sin `deleted_at`**. Contrasta con `legal_acceptances`, que sí tiene
`legal_acceptances_immutable_trg` (`0102_capa_legal.sql:135`).

**Por qué importa.** La firma dibujada en pantalla es **art. 17** (sana crítica):
falla los requisitos 1 y 2 del art. 16 —un trazo se reproduce y se copia—. Lo que
la sostiene es el haz de evidencia convergente; y lo primero que ataca la
contraparte es *"¿cómo sé que no la montaron después?"*. **Sellar el POD rinde más
que certificar la firma.**

**El arreglo.** Hash server-sellado sobre fotos (sha256 del objeto), firma,
`received_by`, `received_doc`, GPS y timestamp + trigger append-only. Reusar
[`lib/studio/legal/seal.ts`](../../../lib/studio/legal/seal.ts).

---

### 🔴 H-3 · La política promete borrado y el sistema hace soft delete

**Punto 5.** `/privacidad` §8 ofrece *"**Eliminar** tu cuenta y tus datos"*
([`app/privacidad/page.tsx:302`](../../../app/privacidad/page.tsx)). En el esquema
hay **753 ocurrencias de `deleted_at`** en `supabase/migrations/`, y `clients`,
`persons` y `tms_drivers` lo usan.

**Los escondites verificados:** la fila completa sobrevive al soft delete ·
`entity_audit_log` guarda payloads · los **buckets no se tocan** — el único
barrido, `purge-receipt-orphans`, borra solo objetos **sin fila en la base** y
está escrito explícitamente para **no** borrar los referenciados
([`lib/studio/storage/receipt-orphans.ts:6`](../../../lib/studio/storage/receipt-orphans.ts))
· `kommo_contacts` y `kommo_leads` ya recibieron copia.

**Norma.** CRBV art. 28 (*destrucción*) · SC 759/2025 (derecho al olvido) ·
SC 332/2001 (temporalidad).

**El arreglo.** Mapa de borrado documentado antes de tocar código: todos los
destinos del dato y qué pasa con cada uno, distinguiendo lo que se conserva por
obligación fiscal (y por cuánto) de lo que simplemente nadie borró.

---

### 🔴 H-4 · Cero retención: nada caduca

**Puntos 2 y 5.** No existe ningún mecanismo de retención por antigüedad. Los
únicos barridos son de **huérfanos** y **throttle** (`purge-receipt-orphans`,
`purge-throttle`, `bitacora-purge-orphans` en `app/api/cron/`), que son otra cosa.

Casos concretos:
- La **foto y la cédula de quien recibió una caja** viven para siempre
  (`dispatch_pods`, sin `deleted_at`).
- `nomina_employee_registrations` guarda `national_id`, `birth_date`,
  `bank_account` y `photo_path` de candidatos **rechazados**, y el comentario del
  esquema lo declara a propósito: *"Sin deleted_at: una solicitud rechazada queda
  como rastro (no se borra)"* (`0180_employee_invites_registrations.sql`).
- `tms_truck_locations` acumula la posición GPS del chofer sin corte.

**Norma.** SC 332/2001, **temporalidad**: los datos se conservan solo durante el
período necesario para la finalidad.

---

### 🔴 H-5 · Los derechos no tienen camino: solo un correo

**Punto 4.** Búsqueda en `app/portal/`, `app/api/` y `lib/portal/` por
`eliminar mi cuenta`, `export`, `portabilidad`, `anonimiz`: **cero resultados**.
`/privacidad` §8 remite a escribir a `info@dtdcargo.com` y promete responder *"en
un plazo razonable"* ([`app/privacidad/page.tsx:319`](../../../app/privacidad/page.tsx)).

**Qué falta**, según lo que **sí** reconoce el derecho venezolano: acceso ·
conocer el uso y la finalidad · actualización · rectificación · **destrucción** ·
confidencialidad e inclusión (SC 759/2025).

> **Matiz honesto:** **portabilidad y oposición no son derechos reconocidos en
> Venezuela.** No ofrecerlos no es un incumplimiento. Ofrecerlos es
> diferenciación; prometerlos y no tenerlos sí sería el problema.

**El arreglo.** "Mis datos" en `app/portal/(app)/perfil/`: exportar en **JSON**
(no PDF — un PDF no es operable por otro sistema), solicitar supresión, retirar
consentimiento de marketing.

---

### 🔴 H-6 · El receptor de una entrega no existe en ninguna política

**Punto 12.** `/privacidad` §1 enumera **siete** momentos de captura —contacto,
estimado, registro, Portal, seguimiento, navegación, seguridad
([`app/privacidad/page.tsx:35`](../../../app/privacidad/page.tsx))— y **el trabajo
de campo no está**. No aparecen la foto de quien recibe, su documento, su firma ni
el GPS del punto de entrega.

La cláusula *"si nos das datos de otra persona… declaras que cuentas con su
permiso"* (§1, línea 144) cubre lo que **el cliente entrega**; **no cubre lo que
DTD captura directamente** de alguien que tiene enfrente.

Mismo caso: `tms_drivers.emergency_contact` (`0011_tms_schema.sql`) guarda nombre
y teléfono de un familiar que nunca supo nada.

**Norma.** CRBV arts. 28 y 60 (propia imagen) · SC 332/2001 (consentimiento
**previo** e informado) · **Delitos Informáticos art. 20** (obtención indebida) ·
PIPL art. 28 si el rostro llega a China: es **información sensible**.

**El arreglo.** Aviso corto en la PWA del operario **antes** de pedir la firma, y
registrar que se mostró (versión + hora). Sin eso, ampliar la captura a tres fotos
sube el riesgo en vez de bajarlo.

---

### ✅ H-7 · Transferencia a China — **resuelto el 2026-07-30**

> **Estado:** cerrado por `cf62256e` (código) y `56ec4ff8` (política).
>
> Al auditar el alcance real apareció que la fuga era mayor de lo descrito abajo:
> no eran las 6 recepciones con nombre, era el **picker de cliente**, que mandaba
> la tabla `clients` completa —428 filas con nombre— al dispositivo en Yiwu. Y la
> regla *"China ve códigos, no nombres"* **ya estaba implementada en el Studio**
> (`listReceipts({ redactClientNames })`, SDD-0039 B.9): la PWA `/m/cn` se
> construyó después y no la heredó. Drift, no descuido.
>
> Hoy el nombre no llega a China por ningún camino: ni lista, ni búsqueda, ni
> picker, ni estiba, ni etiqueta QR, ni formulario de edición. El snapshot
> `warehouse_receipts_cn.client_name` —que el Studio VE sí usa— lo resuelve el
> **server** desde el Shipping Mark (`resolveClientNameByMarkbox()`), para que el
> nombre no tenga que viajar al dispositivo ni siquiera de ida.
>
> ⚠️ **PIPL no desaparece, se reduce.** El equipo de Yiwu sigue tratando el
> Shipping Mark en territorio chino, y un identificador seudónimo **sigue siendo
> dato personal** (es reversible: DTD puede vincularlo). Lo que cambia es la
> gravedad: ya no hay nombre, documento, dirección ni teléfono. La decisión sobre
> el mecanismo del art. 38 sigue abierta para la abogada.

*Hallazgo original:*

**Punto 9.** `/privacidad` §5 despacha la transferencia en un párrafo genérico
(*"Operamos entre China y Venezuela…"*,
[`app/privacidad/page.tsx:240`](../../../app/privacidad/page.tsx)) y el Acuerdo
cl. 11.3 la mete dentro de la aceptación general
(`docs/legal/acuerdo-servicios-v3.mdx:105`).

Hay **equipo propio en Yiwu** → hay tratamiento en territorio chino → **PIPL
aplica**. Y el art. 39 exige **consentimiento separado**, informando nombre y
contacto del receptor extranjero, finalidad, método y categorías. Una casilla que
lo incluye todo no lo satisface. Falta además el mecanismo del art. 38
(evaluación CAC, certificación o contrato estándar).

**Sanción de referencia:** hasta **5% de la facturación anual** (PIPL art. 66).

---

### 🟠 H-8 · Terceros sin inventario, y uno que recibe domicilios sin contrato

**Punto 8.** No existe registro de qué recibe cada proveedor. Detalle completo en
[`inventario-terceros.md`](inventario-terceros.md). Los tres que más pesan:

1. **`nominatim.openstreetmap.org`** — recibe **la dirección del cliente** para
   geocodificar
   ([`lib/studio/geocoding.ts:10`](../../../lib/studio/geocoding.ts)). Servicio
   gratuito, sin contrato, sin acuerdo de datos. Es el caso de libro del
   "proveedor que nadie contó".
2. **Anthropic y OpenRouter** — reciben contenido de reuniones y conversaciones
   con clientes (`lib/studio/bitacora/extract.ts`,
   `lib/studio/conversaciones/digest-extract.ts`).
3. **Kommo** — espejo con `kommo_contacts`, `kommo_leads`, `kommo_users`.

**Norma.** **Delitos Informáticos arts. 20-22**: revelación indebida de data
personal = **prisión de 2 a 6 años**, aumentada de ⅓ a ½ con fin de lucro. Es
responsabilidad **penal de personas**, no multa a la empresa: por eso el contrato
con cada tercero es lo que delimita quién responde.

---

### 🟠 H-9 · La política no está versionada ni sellada, a diferencia del Acuerdo

**Punto 7.** `/privacidad` y `/cookies` llevan solo *"Última actualización"*
(`app/privacidad/page.tsx:17`, `app/cookies/page.tsx:18`) — **sin versión, sin
hash, fuera de `legal_docs`**. El Acuerdo sí tiene las tres cosas.

En Venezuela no hay lista legal de contenidos obligatorios: eso **no** vuelve la
política opcional, la vuelve un **compromiso contractual** — lo publicado obliga
por haberlo publicado.

Además: los comentarios de código en `app/cookies/page.tsx:139` y
`app/privacidad/page.tsx:71` dicen *"`noindex` sin tocar"*, pero **no hay clave
`robots` en el metadata de ninguna de las dos**. (Está bien que se indexen; lo
desactualizado es el comentario.)

---

### 🟠 H-10 · El consentimiento de cookies no deja evidencia y no es granular

**Punto 3.** Dos problemas:

1. La decisión vive **solo en la cookie del navegador**
   ([`lib/cookie-consent.ts:32`](../../../lib/cookie-consent.ts)). Si el usuario la
   borra o cambia de equipo, DTD **no puede probar** qué consintió ni cuándo. Bajo
   SC 332/2001 la carga de probar el consentimiento es de quien trata.
2. La política presenta analítica (§3c) y publicidad (§3d) como categorías
   separadas, pero el banner solo ofrece "Aceptar todas" / "Rechazar opcionales" y
   `updateGtagConsent` mueve **las cuatro señales juntas**
   ([`lib/cookie-consent.ts:46`](../../../lib/cookie-consent.ts), con el comentario
   *"no fragmentamos el consentimiento en esta fase"*).
3. El valor es `granted|denied` **sin versión del texto**: si mañana entra un
   pixel nuevo, un "granted" viejo cubriría algo que el usuario nunca vio.

**El arreglo más barato del informe:** o el banner separa las categorías, o la
política dice que van juntas. Lo segundo es gratis y honesto.

---

### 🟡 H-11 · Verificación de identidad: veredicto sobre una persona sin trazabilidad

**Punto 10.** [`lib/studio/identity/name-match.ts`](../../../lib/studio/identity/name-match.ts)
compara el nombre del cliente contra CNE/SENIAT y emite `ok | mismatch` por score
Jaccard. **No se guarda el score, ni la versión del algoritmo, ni hay camino
declarado de revisión.**

Está bien diseñado como **advisory** y el umbral es conservador a propósito (el
propio archivo lo documenta) — pero el veredicto se persiste y afecta cómo se
trata a un cliente.

Mismo caso, menor: `tms_drivers.rating` (0.0–5.0) es una calificación de desempeño
sobre una persona (`0011_tms_schema.sql`), sin factores ni revisión.

> ✅ **Falso positivo descartado:** `lib/studio/dispatch-scoring.ts` puntúa
> **paquetes**, no personas. No es un hallazgo del punto 10.

**Norma.** CRBV art. 28 (conocer el uso) y art. 60 (honor y reputación) ·
PIPL art. 24.

---

### 🟡 H-12 · Campos de persona sin finalidad declarada

**Puntos 1 y 2.** Ningún campo del esquema documenta su finalidad. Con **221
tablas y 288 migraciones**, un inventario en documento aparte se desactualiza en
dos sprints.

Candidatos concretos a justificar o eliminar:
- `tms_drivers.emergency_contact` — dato de un tercero que no consintió.
- `clients.facade_photo_url` — foto de la **vivienda** del cliente. Tiene
  finalidad operativa clara (encontrar la casa), pero no está declarada en la
  política.
- `dispatch_pods.notes`, `clients.notes` y las otras ~90 columnas `notes` — texto
  libre sin restricción, que es donde termina cayendo lo que nadie previó.

**El arreglo.** Documentar la finalidad como `comment on column` en la propia
migración: viaja con el schema y se revisa en el code review.

---

### 🟡 H-13 · El reloj de solicitudes existe, pero solo para rectificar

**Punto 6.** `client_change_requests` (`0220_client_change_requests.sql`) tiene
`submitted_at`, `reviewed_at`, `reviewed_by`, `review_note` y `status` — es un
reloj de solicitudes real. Pero solo cubre **rectificación** de `name`, `rif` y
`phone`. No hay `tipo` de solicitud, no hay acuse de recibo, y no cubre acceso ni
supresión.

Y `/privacidad` promete *"un plazo razonable"*, que no significa nada y no se
puede auditar. **Venezuela no fija plazo legal** — pero el que DTD publique se
vuelve exigible por haberlo publicado. Publicar un número concreto convierte un
vacío en un compromiso controlado.

**El arreglo.** Extender la tabla con `tipo`
(`acceso|rectificacion|supresion|oposicion`), `acuse_at` y `resuelto_at`.

---

## 4 · Lo que está `CORRECTO` (y hay que no romper)

| Qué | Evidencia | Por qué cuenta |
|---|---|---|
| **Los 11 buckets son privados** | `public = false` en cada `insert into storage.buckets` | Ningún documento de identidad es accesible por URL directa |
| **`legal_acceptances` es append-only por trigger** | `0102_capa_legal.sql:125-138` — `raise exception` en `before update or delete` | Más fuerte que una policy: no depende de que nadie se equivoque |
| **La evidencia la sella el servidor** | [`lib/studio/legal/seal.ts`](../../../lib/studio/legal/seal.ts) | El cliente no controla `accepted_at`, `ip`, `user_agent` ni `hash` |
| **El hash es inyectivo y load-bearing** | `seal.ts` — el gate lo recomputa desde la fila | Detecta forja |
| **Consentimiento de marketing con evidencia** | `newsletter_subscribers`: `consent_text`, `consent_at`, `consent_ip_hash`, `user_agent`, `unsubscribed_at` (`0259`) | Es el patrón que el punto 3 pide, ya construido |
| **Consent Mode v2 arranca en `denied`** | [`components/Analytics.tsx:262`](../../../components/Analytics.tsx) | Ninguna cookie opcional cae mientras el usuario solo navega |
| **GA excluida de toda ruta con datos de cliente** | `PRIVATE_PREFIXES` + `isPrivatePath()` + `sanitizePath()` + whitelist de query params + kill-switch `ga-disable-*` (`Analytics.tsx:49-110, 241`) | Defensa en profundidad real, con la fuga de `/verificar` y `/p` ya cerrada |
| **RLS por tenant** | SDD-0085 | Aislamiento multi-tenant con tests contractuales SQL |
| **El GC de huérfanos protege las pruebas** | [`receipt-orphans.ts:6`](../../../lib/studio/storage/receipt-orphans.ts) | Escrito explícitamente para no borrar un POD referenciado |

---

## 5 · NO VERIFICABLE

Lo que **no se puede comprobar leyendo el repositorio**. Es la lista de lo que hay
que ir a mirar.

| Qué | Dónde mirar | Por qué importa |
|---|---|---|
| **El borrado contra datos reales** | Branch de Supabase | Leer el código no prueba nada. Requiere sembrar un valor único, borrarlo y buscarlo en tablas, auditoría, logs, colas, buckets y Kommo. **Es escritura en producción → necesita tu autorización nombrada.** Ver §6 |
| **Contratos y acuerdos de datos** con Resend, Supabase, Vercel, Anthropic, OpenRouter, Kommo, SeaRates | Carpetas de contratos | Sin esto no se puede cerrar el punto 8 |
| **Región física del proyecto Supabase** | Panel de Supabase | Define si hay transferencia a EE.UU. y a dónde |
| **Retención configurada en GA4** | Panel de GA4 | El código no la fija |
| **Qué hace el equipo de Yiwu con los datos fuera del ERP** | Preguntar al equipo | WeChat, Excel, correo. **Probablemente el mayor punto ciego real**: si los datos de clientes viven en hojas y chats, nada de lo auditado acá los cubre |
| **Contenido real de los campos `notes`** | Consulta a producción con autorización | Un `notes` de texto libre suele contener lo que nadie previó |
| **Quién tiene credenciales de `operario_pins`** | Panel / consulta | Si hay transportistas externos, es una relación sin contrato de datos |
| **Vigencia de la acreditación de los PSC** | <https://www.suscerte.gob.ve/> | Se otorga y se revoca por providencia |

---

## 6 · El script del paso 3 (bloqueado hasta tu OK)

La verificación del borrado exige **escribir y borrar en la base**. `AGENTS.md` lo
prohíbe sin autorización explícita y nombrada, así que **no se corrió**.

Cuando autorices, contra una **branch de Supabase** —nunca contra prod, nunca
leyendo filas reales de clientes—:

1. Crear un cliente de prueba con un valor único y rastreable (ej. `rif` =
   `J-00000000-TEST-{timestamp}`).
2. Subirle un documento a `client-docs` y generarle un POD en `dispatch_pods`.
3. Ejercer el borrado por el camino que usaría una persona real.
4. Buscar ese valor único en: todas las tablas, `entity_audit_log`, los 11
   buckets, los logs de aplicación, las colas de outbox, y el espejo de Kommo.

Si sobrevive en algún lado, el borrado no borra — y eso convierte H-3 de
"promesa incumplida en la política" a hecho verificado.

---

## 7 · Fuera de alcance — para la abogada

1. **Los artículos `[__]` de la cláusula 13.1** del Acuerdo. La respuesta honesta
   hoy es **arts. 4 y 17**, no 16 y 18: no hay certificado de PSC. Rellenarlo con
   "16 y 18" sería afirmar algo falso sobre el propio sistema.
2. **Reescribir la cláusula 11.3**: dice *"Derechos ARCO"*, que es terminología
   **mexicana** y no existe en el derecho venezolano; empaqueta marketing con
   servicio en un solo consentimiento; y mete la transferencia internacional en la
   aceptación general.
3. **Plazos de respuesta a publicar** — propuesta a validar: acuse en 5 días
   hábiles, respuesta en 20 días hábiles.
4. **Firma certificada por umbral de valor**: la renuncia al seguro (Acuerdo
   cl. 6.3) es el acto de mayor impacto económico y descansa hoy en el art. 17.
5. **Los cinco documentos que no existen**: aviso de privacidad en el punto de
   entrega · texto legal del comprobante físico · autorización de retiro por
   tercero · anexo de datos del transportista tercero · cláusula de tratamiento
   para aliados white-label.
6. **Si el papel firmado se conserva** y por cuánto. El art. 4 §2 dice que lo
   reproducido en impreso vale como *copia fotostática*: la foto es impugnable, el
   original es prueba plena.
7. **Qué se conserva por obligación legal** —tributaria, mercantil, laboral,
   aduanera— y por cuánto. Sin eso no se puede escribir el mapa de borrado.
8. **Base de licitud** de cada tratamiento concreto.

---

## 8 · Segunda opinión

Una skill no encuentra sus propios puntos ciegos. Este informe salió de Claude;
conviene que **otro modelo audite el mismo repositorio** y se comparen los dos.

---

*Esto no es asesoría legal. Produce un inventario técnico y una lista de
preguntas. La evaluación del cumplimiento la hace un abogado habilitado.*
