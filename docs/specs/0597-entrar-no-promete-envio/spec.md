---
sdd: "0597"
title: "/entrar no dice que salió un correo que no salió"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-02
updated: 2026-11-03
supersedes: null
superseded_by: null
related: ["0094", "0276", "0278", "0279", "0544", "0573", "0596"]
confidencialidad: interno
---

# SDD-0597 · /entrar no dice que salió un correo que no salió

## Pedido

Al recorrer el entorno de prueba el 2026-11-02 (SDD-0573), el enlace de acceso de `/entrar` no llegó al buzón mientras la pantalla decía «Revisa tu correo». El Director encargó comprobarlo con dobles, sin tocar producción, y corregirlo con tres condiciones:

- La pantalla nunca dice que se envió algo que no salió.
- No revela si el correo existe.
- Deja un camino para volver a intentar, respetando el anti-abuso.

**Límite:** toca el portal, así que la PR quedó retenida hasta la primera publicación. Esa publicación ya salió, y la fusión queda en manos del Director General.

## Qué pasaba

Reproducido con la acción, `sendEmail`, `resendSend` y `magic-link.ts` reales. Solo se doblaron el `fetch` a Resend, las tablas y GoTrue, este con su regla real (ver «Causa»).

| Situación | `/otp` de Auth | Salió un correo | Lo que veía la persona |
|---|---|---|---|
| Resend responde 500, primer intento | 429 | no | «Te enviamos un enlace de acceso a…», «✓ Enviado» |
| Segundo intento, 61 s después | 429 | no | lo mismo |
| Sexto intento, sobre el cupo de 5 por hora | no se llama | no | lo mismo |
| Entorno de prueba, `APP_ENV=staging` | 429 | no | lo mismo |

Esperar no arregla nada: cada intento vuelve a acuñar, y eso reinicia la ventana de 60 s.

## Causa

**Acuñar cuenta como envío.** En GoTrue v2.197.0, la versión de `infra/dtd-cargo/compose.supabase.yml`, `internal/api/mail.go`:

- `adminGenerateLink` escribe `user.RecoverySentAt = &now` (línea 151).
- `sendMagicLink` valida ese mismo campo con `validateSentWithinFrequencyLimit(u.RecoverySentAt, config.SMTP.MaxFrequency)` (línea 487).

Así que el plan B de SDD-0278 no podía entregar nada después de un acuñado: el `/otp` daba 429 siempre. Y la acción no miraba el error de `signInWithOtp`.

**Evidencia:** lectura del código en esa etiqueta, el 429 medido en prueba el 2026-11-02 durante la SDD-0573, y la medición propia contra GoTrue real del 2026-11-03 (ver «Validación»).

## Configuración de Auth en producción

Medido por el Director el 2026-11-02 a las 16:37:57Z, leyendo la configuración de los contenedores y sin imprimir valores:

| Variable | Contenedor | Resultado |
|---|---|---|
| `GOTRUE_SMTP_HOST` | `auth` | definida; es el host SMTP de Resend |
| `GOTRUE_SMTP_MAX_FREQUENCY` | `auth` | `60s` |
| `GOTRUE_SMTP_PASS` | `auth` | no vacía; **misma clave que `RESEND_API_KEY`, medido por sha256, sin registrarlo** |
| `RESEND_API_KEY` | `web` | no vacía |
| `APP_ENV` | `web` | `production` |

**Inferencia, sin provocar ninguna falla:** con la configuración de hoy, una caída de Resend o de esa clave se lleva también el plan B. Por eso aquí no se intenta rescatar el envío por Auth, y sí se deja una salida humana.

## Decisión

### Qué responde la acción

Antes de mirar el correo, la acción puede decir lo que pasó, porque le pasa igual a cualquier dirección. Después, responde siempre lo mismo, y esa respuesta no afirma ningún envío.

| Momento | Caso | Respuesta | ¿Abre oráculo? |
|---|---|---|---|
| Antes de mirar el correo | Formato inválido | `{ error }` | no |
| Antes de mirar el correo | Cerrojo de origen (8 por hora) o de correo (5 por hora) | `{ error: «Hubo varios pedidos…», email }` | no: cuenta igual para un correo sin cuenta |
| Antes de mirar el correo | Falla al leer el cerrojo o `client_users` | `{ error: «No pudimos atender…», email }` | no: la consulta falla igual para cualquier correo |
| Después de mirar | Sin cuenta, cliente del ERP sin acceso, entregado, Resend caído, blacklist, Auth con error | `{ requested: true, requests, email }` | no: es la misma respuesta |

`sent` pasa a llamarse `requested`, y `MagicSent` a `MagicRequested`: esos nombres mentían y empujaban a volver a escribirlo.

### El plan B solo existe antes de acuñar

- **Resend no puede enviar** (`resendPuedeEnviar()`: sin `RESEND_API_KEY` o con `APP_ENV=staging`): va directo a Auth, sin acuñar. Es lo que hace cierto que en prueba el enlace llegue a Mailpit.
- **Acuñar falló o falta el cliente admin:** va a Auth, como antes.
- **Se acuñó y el envío falló:** ya no se llama a Auth. Sería un 429 seguro y un falso alivio en el código. Cambia lo que decía el punto 6 de la §3 de SDD-0278.

### Qué ve la persona

- Título: «Si tienes acceso, revisa tu correo».
- Cuerpo: «Recibimos tu pedido para … Si ese correo tiene acceso al portal, debería llegarte un enlace en un par de minutos.»
- Reintento: «Pedir otro enlace», sin «Reenviar», que daba por hecho el primer envío. El chip dice «Pedido recibido», que es lo único que se sabe.
- Un reintento se nota: «Recibimos 2 pedidos. Usa el último enlace que te llegue.» Avisa de algo real, porque acuñar de nuevo invalida el enlace anterior.
- ¿No llega nada? «Puede que ese correo no tenga cuenta con nosotros, o que el envío haya fallado», con WhatsApp para quien ya es cliente y «Crear mi cuenta» para quien no.

**Por qué WhatsApp.** Con Resend caído, reintentar no sirve, y la única otra salida era crear cuenta. Eso le parte el historial a un cliente real (`lib/studio/portal/sin-acceso.ts`, SDD-0279). El correo no viaja en esa URL.

**Desviación del Norte:** `docs/design/studio/_norte/portal/app.jsx` dice «Revisa tu correo». Se cambia a propósito, por lo de arriba.

### Anti-abuso

No cambian los cupos ni el hash. Reintentar gasta cupo igual que el primer pedido. Pasado el cupo no sale nada, y ahora se dice en vez de fingir. Mientras un pedido está en curso, un clic más no envía otro.

### Rastro para quien opera

- **Envío fallido:** queda en `mail_logs` con `status=failed`, y `/api/cron/mail-health` avisa cada 30 min (`infra/dtd-cargo/cron/crontab:24`).
- **Log:** `[entrar] el enlace no salió: failed|queued` y `[entrar] Auth no mandó el enlace: <status> <code>`. No llevan el correo ni el texto del proveedor, que puede repetirlo.

### Descartado

- **Pantalla «no pudimos enviar» solo cuando falla el envío:** es un oráculo. Solo le puede salir a un correo con cuenta, y un correo en blacklist falla siempre, sin necesidad de ninguna caída.
- **Marcador global de caída, igual para todos los correos:** deja un bit de oráculo al abrirse, pide escribir en una tabla compartida y el aviso duraría más que la falla. El condicional ya es cierto sin eso.
- **Reintentar por Auth tras un fallo de Resend, recordando el fallo:** con la misma clave en los dos lados, no rescataría una caída real.
- **Cuenta regresiva en el botón:** el cupo por hora ya frena el abuso, y el texto ya orienta el tiempo de espera.

### El correo se compara literal, no como patrón

**Pedido de Sam, literal:** «Haz esta tarea aquí: "Escapar comodines del correo en /entrar"». Salió del recorrido de esta misma spec, porque es otra forma de revelar si un correo existe.

**El problema, por lectura, sin provocarlo en producción:** `.ilike("email", email)` parece una igualdad sin mayúsculas, pero `%` y `_` son comodines, y PostgREST además convierte `*` en `%`. Quien escriba `a_b@x.com` coincide con el cliente `a.b@x.com`, y entonces:

- Si ese cliente tiene acceso, `mintPortalMagicToken` crea un `auth.users` confirmado para `a_b@x.com` y le llega un enlace válido.
- Si no tiene acceso, le llega el aviso de SDD-0279, y el equipo recibe otro con el nombre y el Shipping Mark de un cliente que nadie nombró.
- Con `%@x.com` o `*@x.com`, cualquiera escoge el dominio y no el correo, y cada variante tiene su propio cupo por correo.

**No da acceso a datos:** `portal_bind_session` compara exacto (`0080_portal_cliente.sql`), y el aviso va sin nombre ni Shipping Mark. Pero rompe el invariante de SDD-0278, «sólo se crea para quien el equipo habilitó», y recibir algo le confirma a esa persona que una dirección parecida es cliente.

**Decisión:** `lib/shared/email-literal.ts`, con dos funciones que hacen falta juntas:

- `emailIlikePattern` escapa `%`, `_` y `\`. No se quitan ni se rechazan: `_` es común en un correo de verdad, y el patrón escapado encuentra su fila aunque haya un parecido primero.
- `sameEmail` compara el resultado. `*` no se puede escapar: PostgREST lo cambia antes de llegar a Postgres, y `\*` quedaría en `\%` (`star` en `Query/SqlFragment.hs`, leído en v14.1, y medido en v14.17: `juan*@` devuelve tres filas).

Rechazar `*` también lo cerraría, pero dejaría fuera a un cliente real con ese carácter. No se puede saber si existe sin leer filas de clientes.

**Descartado:**
- **`.eq` con el correo en minúsculas:** `client_users.email` y `clients.email` son `text` sin normalizar, y `clients` viene de importaciones y planillas. Dejaría sin entrar a quien tenga mayúsculas guardadas.
- **Una función SQL con `lower(email) = lower($1)`:** es lo más limpio, pero pide migración, y esta PR no la necesita.

## Aceptación

1. Con el envío fallido, en el primer intento y en los siguientes, la pantalla no afirma que salió nada.
2. Cuenta entregada, correo sin cuenta, cliente del ERP sin acceso, Resend caído, blacklist, sin llave, entorno de prueba, sin cliente admin e invitada sin `auth.users` dibujan el mismo HTML, salvo el correo escrito.
3. Con el cupo agotado no sale ningún correo, la pantalla lo dice, y un correo con cuenta y uno sin cuenta reciben la misma respuesta.
4. Con Resend simulado no se acuña, el enlace llega por Auth, y un segundo pedido dentro de los 60 s no sale ni se afirma.
5. Después de acuñar no se llama a Auth.
6. Queda rastro del fallo, sin el correo de la persona.
7. El reintento conserva el foco, no envía dos veces y se nota en pantalla.
8. El runbook y la semilla de prueba dicen lo que de verdad pasa.
9. Un correo parecido o con comodines no alcanza a ningún cliente: no se acuña enlace, no se crea cuenta de Auth, no sale correo ni aviso, y la respuesta es la misma de un correo desconocido.
10. Quien escribe su correo de verdad sigue entrando, con `_`, `%`, `*` o mayúsculas, aunque un parecido aparezca primero.

## Allowlist

| Archivo | Cambio |
|---|---|
| `app/entrar/actions.ts` | estado `requested`, cerrojos que hablan, plan B antes de acuñar, rastro |
| `app/entrar/EntrarForm.tsx` | textos, reintento, foco, salida por WhatsApp, contraste del aviso |
| `lib/studio/mail/resend-api.ts` | `resendPuedeEnviar()` |
| `lib/shared/email-literal.ts` | nuevo: `emailIlikePattern` y `sameEmail` |
| `lib/shared/__tests__/email-literal.test.ts` | nuevo: el patrón contra Postgres en PGlite |
| `lib/studio/portal/sin-acceso.ts` | compara el correo literal |
| `app/entrar/__tests__/entrar-no-promete-envio.test.tsx` | nuevo: la acción real con dobles en el borde de red |
| `app/entrar/__tests__/actions.test.ts` | el estado nuevo; los dos casos que exigían un `/otp` condenado a 429 pasan a exigir lo contrario; las filas del doble traen `email` |
| `app/entrar/__tests__/entrar-dos-filas.test.tsx` | el nombre nuevo del componente; las aserciones no cambian |
| `docs/runbooks/entorno-prueba.md` | cómo llega el enlace en prueba y sus límites |
| `docs/runbooks/setup-portal-auth.md` | dónde sirve el plan B y qué hay en producción |
| `infra/ops/staging/sembrar-prueba.sh` | texto de la cuenta del Portal |
| `docs/specs/0597-entrar-no-promete-envio/spec.md` | esta spec |
| `docs/specs/README.md` | índice generado |
| `.agents/handoffs/sdd-0597-entrar-no-promete-envio.md` | handoff |

Sin migraciones, sin variables nuevas y sin tocar producción ni prueba.

**Cruce con la PR #358 (SDD-0596):** toca un import y el `<form>` de la fila 1 de `EntrarForm`. El primer merge de prueba chocó en el import, porque los dos lo añadían en la misma línea; el de esta spec se movió. `defaultValue={magicState.email ?? …}` se complementa con `submitKeepingDraft`. La #358 entró a `main` primero, y los dos cambios juntos se probaron en el cierre (ver «Validación»).

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| ERR-01, «sin revelar existencia» | cumplimiento | aceptación 2 y 3 |
| ERR-01, «qué ocurrió y qué puede hacer» | cumplimiento | los dos textos de `error`; el correo se conserva en el campo |
| ERR-01, «reintentar no duplica la mutación» | cumplimiento | un clic en curso no envía; cada pedido invalida el enlace anterior, y la pantalla lo dice |
| ERR-01, «un error crítico genera observabilidad» | cumplimiento | `mail_logs`, `mail-health` y el log sin datos personales |
| BTN-01, «el verbo coincide con el resultado» | cumplimiento | «Pedir otro enlace» |
| A11Y-01, objetivos táctiles | cumplimiento | 44 px medidos a 375 de ancho, 32 px en escritorio. Era texto sin alto propio |
| Contraste AA | cumplimiento | el aviso de error pasa de ~3,9:1 (calculado) a 5,42:1 medido, con fondo blanco |
| Datos personales (`revisar-datos-ve`) | no aplica | no se capturan ni se mueven datos nuevos: el log y la URL de WhatsApp van sin el correo |

## Validación

| Comprobación | Resultado |
|---|---|
| Control rojo: el archivo nuevo contra el código de la base | PASÓ: 27 de 31 en rojo. Las 4 verdes son invariantes que ya se cumplían, como que un correo desconocido no recibe nada |
| Control rojo de los comodines: sin escape ni `sameEmail` | PASÓ: 11 de 92 en rojo, entre ellas `_`, `%` y `*`. La prueba que se añadió después (ver «Mutantes») no estaba en esa corrida |
| Mutantes | PASÓ: 40 de 40 mueren. Uno sobrevivió («sin-acceso sin escape») y faltaba una prueba: un parecido que aparece primero le quitaba la fila al cliente real del ERP. Añadida, muere |
| `/ui-check` y navegador real: el componente real, React de producción y Tailwind compilado, con la acción simulada | PASÓ, con cuatro ajustes aplicados (ver el handoff) |
| Enlace en `/correo/` de prueba, con esta imagen | NO EJECUTADO: esta PR no se ha desplegado allí |

### Medición contra servicios reales (2026-11-03)

En Docker local, 4 contenedores de 1 GB, puertos solo en 127.0.0.1, sin OOM y borrados al terminar. Las imágenes son las de `infra/dtd-cargo`.

| Con qué | Qué se hizo | Resultado |
|---|---|---|
| GoTrue v2.197.0 y Mailpit | `generate_link` y después `/otp` | 429 `over_email_send_rate_limit`, buzón en 0 |
| | `/otp` sin acuñar | 200, y llega a Mailpit |
| | otro `/otp` en seguida | 429, el buzón sigue en 1 |
| | `/otp` de un correo sin cuenta | 422 `otp_disabled`, buzón en 0 |
| | `generate_link` otra vez, en seguida | 200: acuñar no está frenado |
| | `/otp` a los 61 s | 200, buzón en 2 |
| | `generate_link` y `/otp` a los 61 s | 429: cada acuñado reinicia la ventana |
| PostgREST v14.17 con `supabase-js` y `emailIlikePattern` | 12 casos, entre ellos `_`, `+`, `%`, `\`, `*` y mayúsculas | PASÓ, 12 de 12: el escape pasa bien por esa capa y un correo real sigue encontrando su fila |

Fueron dos corridas. En la primera, PostgREST respondió `PGRST300` en todo porque no le di secreto JWT: error mío, no resultado. Y ahí el `/otp` a los 61 s dio 429 con 3 s restantes; en la segunda dio 200, con el reloj del contenedor en 0 s de diferencia. Esa diferencia no la medí en la primera: **queda sin explicar.**

### `pnpm verify` sobre `d4a54bb81`

Exit 1. Corrieron 16 de 17 pasos, con 0 pesadas ajenas al lanzar y Docker en `running` las 71 min.

| Paso | Resultado |
|---|---|
| `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions` | PASÓ |
| `test` | **FALLÓ por tiempo, no por una aserción.** Primer intento: 13.416 bien, 1 mal (`migraciones.test.mjs`). Reintento: 13.415 bien, 2 mal (ese y `entorno-prueba-scripts.test.mjs`). Las dos vencieron sus 600 s. **Aisladas sobre el mismo SHA: PASÓ, 32 de 32 en 322 s**, y `prueba-migraciones-produccion.sh` tardó 139 s. Durante la corrida hubo un mínimo de 1,8 GB libres y una copia de 740 MB por error mío |
| `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check`, `pending-migration-symbols` | PASÓ |
| `migrations-applied` | NO EJECUTADO: este worktree no tiene `.env.local`. Esta PR no trae migraciones |
| `sql-tests`, `schema-rebuild` | PASÓ, con Docker arriba |
| `e2e` | PASÓ al reintento. Primer intento: falla `company-photo-carousel.spec.ts:93` y `auth.spec.ts:81` inestable. Reintento: 227 bien, 20 omitidas, y `auth.spec.ts:81` y `sin-scroll-horizontal.spec.ts:215` inestables. Ninguna depende de esta spec |
| `build` | PASÓ |

### Cierre de la diferencia con `main`, sobre `6ad57f8d1`

Mientras corría `verify` entró a `main` la #358, que también toca `EntrarForm`. Por eso se probaron juntas, sobre `main` en `8b6b3a0e1`, una cosa a la vez y con un solo worker.

| Comprobación | Resultado |
|---|---|
| `app/entrar`, `conservar-lo-escrito`, `email-literal`, `sin-promesa-rastreo-restantes` | PASÓ: 131 pruebas en 6 archivos |
| `typecheck` | PASÓ |
| `e2e/auth.spec.ts`, los de Portal | PASÓ, 2 de 2. **Solo dibujan `/entrar`, no lo envían:** no prueban los dos cambios juntos |
| Spec temporal, sin commitear: envía el formulario contra `next dev` y la server action real | PASÓ: llega al pedido recibido con el foco en el título, sin afirmar el envío y sin el correo en la URL; el reintento dice «Recibimos 2 pedidos» y conserva el foco. La primera corrida falló por un selector mío: `getByRole("alert")` también encuentra el anunciador de rutas de Next, siempre vacío |
| Enviar y caer en el cerrojo, conservando el correo, en navegador con `submitKeepingDraft` | NO EJECUTADO como e2e: el camino del spec fue el de pedido recibido. Lo cubre `conservar-lo-escrito`, en jsdom |
| Spec de e2e del repo que envíe `/entrar` | NO EJECUTADO: no existe ninguno |

**Lo que no se comprobó:** no se provocó ninguna falla de Resend en producción, ni se leyeron filas de clientes.

## Fuera de alcance detectado

- **El mismo patrón de `.ilike` en otros sitios.** No se tocan aquí; van en la SDD-0600 (PR #363):

  | Sitio | De dónde viene el valor | Qué puede pasar con un `_` |
  |---|---|---|
  | `lib/studio/conversaciones/inbound-email.ts:117` | el `From` de un correo entrante | `a_b@x.com` coincide con el cliente `a.b@x.com`, y su mensaje entra al hilo de ese cliente |
  | `app/invitar/[token]/actions.ts:144` | el correo de la invitación | el `auth_user_id` queda en la ficha de nómina de `a.b@x.com`, si está libre |
  | `lib/studio/mail/unsubscribe-request.ts:108` | el correo del enlace firmado | la baja de `a_b@x.com` también le quita el permiso de marketing a `a.b@x.com` |

  Comprobados sin este problema: `lib/studio/quote-queries.ts:208` compara después con `prospectMatches`. `app/registro/actions.ts` y `app/api/registro/check/route.ts` buscan por `rif`, validado antes con `normalizeDocument`. El resto de los `.ilike` del repo son búsquedas del Studio con sesión, y no se revisaron uno por uno.
- **Oráculo por tiempo de respuesta (por lectura, sin medir):** un correo con cuenta acuña y llama a Resend; uno sin cuenta, no. Ya existía, y esta spec no lo cierra.
- **Agotar el cupo de un tercero:** cualquiera puede gastar los 5 pedidos por hora de un correo ajeno. Ya existía en silencio. Ahora la persona al menos lo ve.
- **«Da igual dónde lo abras»** no es cierto para el enlace de Auth (PKCE). Solo aplica sin Resend, es decir en prueba. Queda en `entorno-prueba.md`.
- **`RecoveryForm` de Studio** también dice «Revisa tu correo», pero en condicional. No se revisó si su envío puede fallar en silencio.

## Decisión pendiente de Sam: Resend y el plan B

La presenta el Director General.

- **Medido:** el SMTP de Auth en producción es Resend, con la misma clave que usa `web` (ver «Configuración de Auth en producción»).
- **INFERIDO, sin provocar ninguna falla:** una caída de Resend o de esa clave se lleva también el plan B. Hoy el plan B no protegería de la falla para la que existe, y quien ya es cliente solo tendría la salida por WhatsApp.
- **Opciones:** dejarlo así, porque la pantalla ya es honesta y hay salida humana; darle a Auth otra clave, que cubre una clave revocada pero no una caída de Resend; o darle otro proveedor SMTP, que cubre las dos cosas, y además habría que cambiar el orden del plan B para aprovecharlo.

Cualquier cambio es de configuración en producción y necesita su aprobación concreta.
