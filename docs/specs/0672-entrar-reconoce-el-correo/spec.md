---
sdd: "0672"
title: "/entrar reconoce el correo y dice en pantalla qué pasó"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-18
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0094", "0276", "0278", "0279", "0597", "0646"]
confidencialidad: interno
---

# SDD-0672 · /entrar reconoce el correo y dice en pantalla qué pasó

> Antes de mandar nada, `/entrar` mira el correo y le dice a la persona qué pasa con él: si tiene
> portal, si es cliente sin portal o si no lo encontramos. Modifica la SDD-0597, que respondía lo
> mismo para todos los correos.

**Estado:** `in-progress`. Entrega 1 (#683): los resultados en pantalla y los textos de
`/registro`, sin migración. Entrega 2 (#687, con la migración 0562 asignada por el DG): el
enlace para crear el portal llega al correo del cliente sin portal.

> **Estado al 2026-11-19.** Las dos entregas están en `main` (#683 y #687). La migración
> `0562_registro_link_autoservicio` está **aplicada en producción** el 2026-11-19: commit del apply
> a las 16:51:18Z (inicio 16:51:17Z), proyecto `dtd-cargo`, con el OK literal de Sam «OK, aplica
> 0566, 0565 y 0562». Md5 `637b3740d2ea71e9981da1b3d171161e`, 34441 bytes, una fila en el ledger y
> los 7 cuerpos vivos iguales al archivo. Evidencia en el servidor:
> `/srv/ops/evidencias/apply-0562-dtd-cargo-20261119T165117Z` (previa:
> `/srv/ops/evidencias/previa-0562-dtd-cargo-20261119T165049Z`). La espera quedó retirada y la
> migración sellada en el cierre. Datos del Director General: el md5 y los bytes los comprobé
> contra el archivo de `main` (también lo hace `retirar-espera.mjs`); la hora, el OK, la fila del
> ledger, los cuerpos vivos y la evidencia no los verifiqué yo. Falta el smoke en producción de la
> entrega 2 (un cliente sin portal recibe el enlace y lo activa).

## 0. Enmiendas explícitas

Esta spec es un cambio de seguridad del portal y **enmienda** dos decisiones anteriores:

| Spec | Qué decía | Qué queda |
|---|---|---|
| [SDD-0597](../0597-entrar-no-promete-envio/spec.md), aceptación 2 | «el mismo HTML para todos, salvo el correo escrito» | **reemplazada** por la aceptación 1 de esta spec: una pantalla por resultado. Sigue en pie su aceptación 1: la pantalla nunca afirma un envío que no salió |
| [SDD-0279](../0279-cliente-sin-acceso-al-portal/spec.md) §3, «pantalla idéntica en los tres casos» | el cliente sin acceso veía lo mismo que un desconocido | **reemplazada**: ve «Ya eres cliente de DTD Cargo». Siguen en pie los avisos al cliente y al equipo, y que el correo al cliente no lleva nombre ni Shipping Mark |
| SDD-0279 §3, decisión del 2026-08-23 «enlace automático **no**» | el correo de `clients` lo cargó el equipo; un tipeo entregaría el portal a un desconocido | **sin cambio en la entrega 1**. La entrega 2 la **enmienda**: el enlace sale al correo de la ficha, pero el portal se activa solo si la cédula/RIF o el WhatsApp coinciden con la ficha (§4). Con un tipeo, el desconocido recibe el enlace y no puede pasar la guarda |

**Riesgo que se acepta: enumeración.** Desde este cambio, cualquiera que escriba un correo en
`/entrar` sabe si es de un cliente de DTD Cargo, si tiene portal o si su correo falta comprobar.
Alguien con una lista de correos (un competidor, por ejemplo) puede averiguar cuáles son clientes.

**Mitigaciones que sí quedan** (condiciones del DG, 2026-11-18):

1. Cerrojos de 8 pedidos por hora por origen y 5 por correo, que corren **antes** de mirar el correo.
   Con el cupo gastado, un correo con cuenta y uno sin cuenta reciben la misma respuesta.
   - El origen sale del header de `REQUEST_IP_HEADER` (`lib/http/request-ip.ts:57`; respaldo por
     `x-forwarded-for` en `:89`). Detrás de Cloudflare tiene que ser `cf-connecting-ip`, con el origen
     cerrado a los rangos de Cloudflare: si no, el cerrojo por origen se esquiva cambiando el header.
     Lo verifica el DG en producción antes de publicar (revisión de seguridad del 2026-11-18).
   - El cerrojo cuenta y después inserta (`touchThrottle`): dos pedidos simultáneos pueden pasar los
     dos. La carrera ya existía antes de esta spec; el cerrojo por correo la acota.
2. El mismo piso de tiempo de respuesta en todos los casos (`lib/portal/tiempo-minimo.ts`, 700 ms),
   también cuando la acción termina con una excepción (`finally`).
   Límite: como la pantalla ya nombra el caso, el piso no oculta lo que dice el texto. Queda como
   defensa si una pantalla vuelve a ser común a varios casos.
3. Ninguna pantalla muestra el nombre, el Shipping Mark ni otro dato de la ficha.
4. A un correo desconocido no le sale ningún correo.

## 1. Pedido de Sam (2026-11-18)

Palabras de Sam, resumidas en la sesión. Hoy, si el correo no llega, la pantalla ofrece crear una
cuenta. Pidió dos cosas:

1. **Lo principal:** al escribir el correo, no mandar el enlace de inmediato. Primero buscar en la
   base: si existe, mandar el enlace; si no, decir «Usted no cuenta con una cuenta con nosotros,
   por favor cree una».
2. **Cliente sin portal:** si el correo es de un cliente, pero nunca activó su portal, decirle «Usted
   existe como cliente, pero no ha creado su portal» y que llene sus datos completos, como si se
   registrara desde cero, pero enlazados a la ficha que ya existe.

**Decisión de Sam, literal**, ante la pregunta «¿Qué debe decir la pantalla de /entrar cuando el
correo no existe?», con las opciones «Decirlo en pantalla» y «Solo por correo»: **«Decirlo en
pantalla»**.

Antes de decidir se le explicó que eso deja averiguar si un correo es cliente de DTD Cargo, que la
SDD-0597 lo evitaba a propósito y que `/registro` ya lo revela («Este correo ya tiene una cuenta en
DTD Cargo»).

## 2. Qué pasaba

| Caso | Pantalla | Correo |
|---|---|---|
| Correo con acceso | «Si tienes acceso, revisa tu correo» | el enlace, o nada si el envío falló |
| Cliente del ERP sin acceso (SDD-0279) | la misma | genérico al cliente y aviso al equipo |
| Correo de una cuenta por link sin comprobar (SDD-0646 D-1) | la misma | ninguno |
| Correo desconocido | la misma | ninguno |

El costo de no revelar nada lo pagaba el cliente. El que escribió mal su correo y el que nunca tuvo
portal esperaban un enlace que no iba a llegar. Y si probaban «Crear mi cuenta», `/registro` los
paraba con «Si eres tú, entra con tu Shipping Mark o pide recuperar tu contraseña»: dos puertas que
no existen, porque al portal se entra solo con el correo (SDD-0094).

## 3. Entrega 1 — los resultados en pantalla

### 3.1 Qué responde la acción

`requestMagicLink` (`app/entrar/actions.ts`) devuelve `resultado` en vez de `requested`:

| Momento | Caso | Respuesta | Sale |
|---|---|---|---|
| Antes de mirar el correo | formato inválido | `error` | nada |
| Antes de mirar el correo | cerrojo de origen (8/h) o de correo (5/h) | `error` «varios pedidos» | nada |
| Antes de mirar el correo | falla el cerrojo, falta el cliente admin | `error` «no pudimos atender» | nada |
| Mirando | falla `client_users`, `portal_email_sin_comprobar` o la búsqueda en `clients` | `error` «no pudimos atender» | nada |
| Mirando | dirección interna `@sin-comprobar.invalid` | `sin_cuenta` | nada |
| Mirando | correo sin comprobar (`bloquea`, o `pendiente` sin fila de acceso) | `sin_comprobar` | nada |
| Mirando | fila de acceso `invited`/`active`, literal (`sameEmail`) | `enlace` si salió; `error` «no pudimos enviarte el enlace» si no | el enlace |
| Mirando | sin fila de acceso y cliente vivo del ERP | `sin_portal` | aviso al cliente y al equipo (SDD-0279) |
| Mirando | nada de lo anterior | `sin_cuenta` | nada |

- **`enlace` sí afirma el envío.** Si el envío falla, sea por Resend caído, por la blacklist, por un
  `queued` que nadie reintenta o por un error de Auth en el plan B, la acción devuelve `error`. La
  regla de la SDD-0597 («la pantalla nunca dice que salió algo que no salió») se mantiene; lo que
  cambia es que ahora se puede decir que no salió.
- **Una consulta caída no se convierte en «no encontramos».** `buscarClienteSinAcceso`
  (`lib/studio/portal/sin-acceso.ts`) distingue «no es cliente» de «no se pudo preguntar».
- Los dos cerrojos siguen corriendo **antes** de mirar el correo: son lo que queda en pie contra
  quien quiera recorrer una lista de correos.
- `requests` cuenta los reintentos del mismo correo cuando el resultado es `enlace`.

### 3.2 Qué ve la persona (`ResultadoEntrar`, `app/entrar/EntrarForm.tsx`)

| Resultado | Título | Salidas |
|---|---|---|
| `enlace` | «Revisa tu correo» | «Pedir otro enlace», WhatsApp, «Probar con otro correo». Sin «Crear mi cuenta»: ya tiene una |
| `sin_portal` | «Ya eres cliente de DTD Cargo» | «Escribirnos por WhatsApp» (acción principal), «Probar con otro correo». Dice que no cree otra cuenta, y que el equipo ya está avisado **solo si el aviso salió** (`equipoAvisado`) |
| `sin_comprobar` | «Tu correo todavía no está comprobado» | «Escribirnos por WhatsApp» (acción principal), «Probar con otro correo» |
| `sin_cuenta` | «No encontramos una cuenta con este correo» | «Crear mi cuenta» (acción principal), «Probar con otro correo», WhatsApp |

- Ninguna pantalla muestra el nombre ni el Shipping Mark de la ficha. El correo de `clients` lo
  cargó el equipo y puede tener un tipeo (razón de la SDD-0279).
- «Probar con otro correo» vuelve al formulario con el correo escrito, para corregirlo.
- El correo no viaja en ninguna URL: ni a `/registro` ni en el mensaje de WhatsApp. Terminaría en los
  registros del servidor y en la analítica.
- Foco en el título al cambiar de pantalla, objetivos táctiles de 44 px (A11Y-01) y una sola acción
  primaria por pantalla (BTN-01 §2).

### 3.3 Textos de `/registro`

La cédula, el RIF, el correo o el WhatsApp que ya son de un cliente ahora llevan a «Entrar» con el
correo, sin contraseña, y a WhatsApp si no sabe con qué correo quedó (`REGISTRO_YA_ERES_CLIENTE`,
`lib/portal/register-types.ts`). También cambian los dos avisos de `app/registro/actions.ts`: la
cuenta quedó creada, pero no se pudo activar el acceso. Ninguno manda a «entrar con tu Shipping Mark»
ni a «recuperar tu contraseña».

### 3.4 Lo que NO cambia en la entrega 1

- El cliente sin portal sigue esperando a que el equipo lo active (SDD-0279): la pantalla lo dice,
  pero todavía no puede crear su portal solo. Eso es la entrega 2.
- `/registro` no recibe el correo por la URL (ver 3.2).
- Los cerrojos, el plan B, `token_hash`, `/abrir` y la comparación literal (`sameEmail`) quedan
  iguales.

## 4. Entrega 2 — crear el portal desde el correo (migración 0562)

Cumple la segunda parte del pedido sin abrir una toma de cuenta. Hay dos razones para no dejar
completar los datos en la misma pantalla:

1. Quien escribe el correo de otro en `/entrar` no demuestra que ese correo sea suyo. Si pudiera
   completar la ficha en el acto, se quedaría con el portal de ese cliente: sus envíos, sus facturas y
   sus direcciones.
2. El correo de la ficha puede tener un tipeo y ser de otra persona. Por eso Sam decidió el
   2026-08-23 «enlace automático **no**» (SDD-0279 §3).

El diseño (implementado en la PR de la entrega 2):

- `sin_portal` pasa a decir solo «Ya eres cliente. Te mandamos un enlace a tu correo para crear tu
  portal» (condición del DG: nada más de la ficha). El enlace es el link de registro de la SDD-0646,
  emitido por el sistema (origen `autoservicio`), enviado al correo de la ficha, con vencimiento de
  24 h y de un solo uso.
- La página del enlace pide los mismos datos que `/registro` y **no muestra el Shipping Mark** hasta
  que se comprueba la identidad.
- **Guarda:** el portal se activa solo si la cédula o el RIF, o el WhatsApp, coinciden con lo que ya
  tiene la ficha. La comparación se hace normalizada en la base: dígitos del documento y
  `phone_match_key` del teléfono. **La respuesta nunca dice si el documento coincidió ni cuál dato
  falló**: si no coincide, el cliente lee un mensaje genérico («No pudimos activar tu portal con esos
  datos; te contactamos») y el equipo lo ve en «Registros por link». Con 3 intentos fallidos el enlace
  muere. Si la ficha no tiene ni documento ni teléfono, no se emite el enlace y queda el aviso al
  equipo de la SDD-0279.
- Las RPC nuevas son `SECURITY DEFINER`, con `search_path = ''` y nombres calificados, `EXECUTE` solo
  para `service_role` y revocado a `public`, `anon` y `authenticated`. Nunca se exponen por PostgREST
  a un visitante.
- Si el cliente deja en el formulario el mismo correo al que llegó el enlace, el correo queda
  comprobado; si lo cambia, sigue el camino de la SDD-0646 D-1 (dirección interna y comprobación).
- No se emite si el acceso del cliente fue revocado por el equipo (`client_users.status = revoked`).
- La ruta del equipo (`/registro/link/<token>`) no acepta enlaces de autoservicio: `peek` y
  `complete` filtran por origen.
- Migración nueva: columna de origen en `client_registration_links`, correo al que se emitió,
  intentos, y RPC solo `service_role` para emitir, mirar, completar con la guarda y vincular. Preflight
  por md5 de los cuerpos vivos de `portal_registration_link_peek` y `portal_registration_link_complete`
  (0552).
- MIGRATE-FIRST: sin la migración, `sin_portal` se queda como en la entrega 1.

Migración: **0562**, asignada por el DG el 2026-11-18. Contrato SQL, desarme y espera declarada
van en su PR. Revisión independiente en Opus, por seguridad. Aplicarla en producción pide el OK
nominal de Sam nombrando el archivo. **HECHO el 2026-11-19 a las 16:51:18Z** (OK literal de Sam:
«OK, aplica 0566, 0565 y 0562»; detalle en el aviso de estado de arriba).

### 4.1 Aceptación de la entrega 2

1. Con la 0562, un cliente del ERP sin ninguna fila de acceso, con documento o teléfono en la ficha y
   sin enlace del equipo vivo, recibe en el correo de su ficha el enlace `/registro/activar/<token>`,
   y `/entrar` responde `crear_portal` («Te mandamos un enlace…»). No sale el aviso de la SDD-0279.
2. El correo y la página del enlace no muestran el nombre ni el Shipping Mark antes de la guarda.
3. El portal se activa solo si la cédula/RIF (dígitos) o el WhatsApp (`phone_match_key`) coinciden
   con la ficha. Si no, la ficha no cambia, el enlace no se gasta, se suma un intento y al tercero el
   enlace muere. El mensaje es el mismo que para un correo con cuenta, y no nombra el dato.
4. Un documento que no se puede normalizar no salta la guarda.
5. Con el mismo correo al que llegó el enlace, la cuenta nace con el correo real, sin «sin
   comprobar»; con otro correo, sigue el camino D-1 de la SDD-0646.
6. La ruta del equipo (`/registro/link/`) no acepta enlaces de autoservicio; los del equipo siguen
   funcionando igual.
7. Las RPC nuevas: `SECURITY DEFINER`, `search_path = ''`, `EXECUTE` solo para `service_role`.
8. Sin la 0562, `/entrar` sigue como en la entrega 1, `/registro/activar/` dice «Enlace no
   disponible» y «Registros por link» no se rompe.
9. «Registros por link» marca «lo pidió desde «Entrar»» y «Correo comprobado» cuando el cliente dejó
   el correo al que llegó el enlace.
10. Si con el enlace abierto la ficha queda borrada o fusionada, o el equipo le corrige el correo, el
    enlace no abre ni completa (sin gastarse ni sumar intentos). Así, un enlace mandado a un correo
    con tipeo deja de servir apenas se corrige.
11. Completar bloquea la ficha y después el enlace, en el mismo orden que la emisión: un `/entrar` y
    un envío del formulario a la vez no se traban.

### 4.2 Allowlist (entrega 2)

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0562_registro_link_autoservicio.sql` | nueva; aplicada en producción el 2026-11-19 (16:51:18Z) |
| `supabase/desarmes/0562_desarme` (extensión `.sql`; sin el punto pegado para que no se lea como migración citada) | nuevo |
| `supabase/tests/0562_registro_link_autoservicio.test.sql` | contrato |
| `lib/portal/__tests__/registro-autoservicio.migration.test.ts` | el contrato en PGlite |
| `supabase/migrations-baseline.json` | espera de la 0562 (retirada en el cierre del 2026-11-19) |
| `supabase/pending-migration-symbol-declarations.json` | símbolos de la 0562 que usa la app (retirados en el cierre del 2026-11-19) |
| `supabase/migrations.lock.json` | la 0562 sellada (cierre del 2026-11-19) |
| `lib/studio/portal/autoservicio-link.ts` | nuevo: emitir y mandar el enlace |
| `lib/studio/portal/__tests__/autoservicio-link.test.ts` | nuevo |
| `app/entrar/actions.ts` | `crear_portal` antes del aviso de la SDD-0279 |
| `app/entrar/EntrarForm.tsx` | pantalla `crear_portal` |
| `lib/portal/entrar-resultado.ts` | `crear_portal` |
| `app/entrar/__tests__/actions.test.ts`, `app/entrar/__tests__/entrar-dos-filas.test.tsx` | los casos nuevos |
| `app/registro/activar/[token]/page.tsx`, `actions.ts` y su prueba | nuevos: GET que solo lee, POST con la guarda |
| `app/registro/link/[token]/RegistroLinkForm.tsx` | variante `autoservicio`: sin Shipping Mark antes de la guarda, correo precargado |
| `lib/portal/registro-link-types.ts` | URL, TTL y los dos mensajes de autoservicio; `origen` en la fila de revisión |
| `lib/studio/registro-link-queries.ts` | lee `link_origin`/`issued_to_email` (con respaldo sin la 0562) |
| `lib/studio/__tests__/registro-link-correo-estado.test.ts` | los casos de autoservicio |
| `app/studio/(app)/clientes/_components/RegistrosLinkClient.tsx` | «lo pidió desde «Entrar»» |
| esta spec, el índice y `.agents/handoffs/sdd-0672-entrega-2-autoservicio.md` | docs |

## 5. Aceptación de la entrega 1

1. Cada uno de los cuatro resultados tiene su pantalla, con su título y sus salidas (tabla 3.2).
2. `enlace` solo aparece si el correo salió. Con Resend caído, la blacklist, un `queued` o un error
   de Auth, la pantalla dice que no salió y no afirma ningún envío.
3. A un correo desconocido no le sale ningún correo, ni a él ni al equipo.
4. Con el cupo agotado o el origen limitado no se mira el correo: un correo con cuenta y uno sin
   cuenta reciben la misma respuesta.
5. Una consulta caída (acceso, correo sin comprobar o ficha del ERP) no se dice como «no
   encontramos»: responde «no pudimos atender», igual para cualquier correo.
6. Un parecido o un comodín (`_`, `%`, `*`) no alcanza a ningún cliente: se responde «no
   encontramos», sin enlace, sin cuenta de Auth y sin aviso.
7. «Ya eres cliente» no muestra el nombre ni el Shipping Mark de la ficha, y ninguna pantalla con
   cuenta ofrece crear otra. Solo dice que el equipo está avisado si el aviso salió, y ninguna
   pantalla sin enlace afirma un envío.
8. «Probar con otro correo» vuelve al formulario con el correo escrito.
9. `/registro` ya no menciona «Shipping Mark» como forma de entrar ni «recuperar tu contraseña».
10. El reintento conserva el foco, no envía dos veces y se nota en pantalla.
11. Toda respuesta posterior a validar el formato espera el mismo piso de tiempo, contado desde el
    pedido: enlace, sin cuenta, cerrojo y consulta caída.

## 6. Allowlist (entrega 1)

| Archivo | Cambio |
|---|---|
| `app/entrar/actions.ts` | `resultado` en vez de `requested`; el envío fallido se dice |
| `app/entrar/EntrarForm.tsx` | `ResultadoEntrar` (reemplaza `MagicRequested`), «Probar con otro correo», `CrearCuentaBoton primario` |
| `lib/portal/entrar-resultado.ts` | nuevo: el tipo y los mensajes de WhatsApp |
| `lib/portal/tiempo-minimo.ts` | nuevo: piso de tiempo de respuesta (condición del DG) |
| `lib/portal/__tests__/tiempo-minimo.test.ts` | nuevo: el piso, con reloj simulado |
| `lib/studio/portal/sin-acceso.ts` | `buscarClienteSinAcceso` (distingue el error) |
| `lib/portal/register-types.ts` | `REGISTRO_YA_ERES_CLIENTE` y los textos de duplicado |
| `app/registro/actions.ts` | los tres avisos que mandaban a puertas que no existen |
| `app/entrar/__tests__/actions.test.ts` | los resultados nuevos |
| `app/entrar/__tests__/entrar-no-promete-envio.test.tsx` | la acción real con dobles: una pantalla por resultado |
| `app/entrar/__tests__/entrar-dos-filas.test.tsx` | ningún resultado es un callejón sin salida |
| `app/portal/la-accion-lanza.test.tsx` | el estado nuevo |
| `docs/runbooks/entorno-prueba.md` | la pantalla ya no es la misma haya salido o no |
| `docs/specs/0672-entrar-reconoce-el-correo/spec.md` | esta spec |
| `docs/specs/README.md` | índice generado |
| `.agents/handoffs/sdd-0672-entrar-reconoce-el-correo.md` | handoff |

Sin migraciones, sin variables nuevas y sin tocar producción ni prueba.

## 7. Gobernanza y privacidad

| Política o hallazgo | Clasificación | Evidencia |
|---|---|---|
| SDD-0597 aceptación 2 («el mismo HTML para todos») | **excepción** decidida por Sam el 2026-11-18 | §1; la reemplaza la aceptación 1 de esta spec |
| Auditoría 2026-07-31, hallazgo M7 (enumeración en el login: «respuesta uniforme + throttle») | **excepción** decidida por Sam; queda el throttle como control compensatorio | `docs/audits/2026-07-31-seguridad-full-project.md:83`; cerrojos 8/h por origen y 5/h por correo antes de mirar |
| ERR-01, «qué ocurrió y qué puede hacer» | cumplimiento | una pantalla por resultado, con salida |
| ERR-01, «no afirmar lo que no ocurrió» | cumplimiento | aceptación 2 |
| BTN-01 §2 y §3 | cumplimiento | una primaria por pantalla; «Pedir otro enlace», «Crear mi cuenta» |
| A11Y-01 | cumplimiento | foco al título; 44 px en «Probar con otro correo» y «Pedir otro enlace» |
| Datos personales (`revisar-datos-ve`) | aplica, sin captura nueva | ver abajo |

**Datos personales.** La entrega 1 no captura, mueve ni guarda datos nuevos. Lo que cambia es que
**revela** a quien escriba un correo si ese correo es de un cliente de DTD Cargo, si tiene portal o si
su correo falta comprobar. No revela nombre, Shipping Mark, envíos ni ningún otro dato de la ficha.
Ese dato, «es cliente», ya lo revelaba `/registro`. Base: CRBV art. 28 (habeas data), que exige
proteger el dato y su uso; el control que queda es el cerrojo, que no se toca. La entrega 2 sí
captura datos (la ficha completa) y pasa por `revisar-datos-ve` en su PR.

**Entrega 2, datos personales.** Captura los mismos datos que `/registro` y que el registro por link
de la SDD-0646 (tipo, nombre o razón social, cédula/RIF, correo, WhatsApp, teléfono de oficina,
ciudad, estado y dirección), con el mismo texto de finalidad y el mismo enlace a la política de
privacidad. Base: el titular los entrega para operar su portal (CRBV art. 28: acceso y
actualización de sus propios datos). Lo nuevo que se guarda: `issued_to_email` (el correo de la
ficha al que salió el enlace) y el conteo de intentos; ninguno sale de la base hacia la pantalla
antes de la guarda. El token se guarda solo como sha256. La cédula y el WhatsApp que escribe el
cliente se comparan en la base y no se registran en logs.

## 8. Validación

Ver el handoff `.agents/handoffs/sdd-0672-entrar-reconoce-el-correo.md` (comandos, resultados y lo
no ejecutado).
