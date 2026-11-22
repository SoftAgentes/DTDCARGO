# Handoff — SDD-0646, enmienda D-1 (opción C): el correo del registro por link se comprueba

Fecha: 2026-11-17. Task ID: `sdd-0646-d1-opcion-c-correo-comprobado`.
Owner / sesión escritora: `local-0646-opcion-c` (Worker Claude Code, lanzado por el DG). Sin subagentes.

- **Worktree:** `.claude/worktrees/0646-invitacion-por-link-475356`; `guard` y `claim --owner local-0646-opcion-c` PASARON antes de los commits.
- **Rama:** `claude/0646-opcion-c-correo-bd40d2`, base `1a0085ffa` (main del 2026-11-17). PR SoftAgentes/DTDCARGO#654.
- **SDD:** enmienda de `docs/specs/0646-invitacion-portal-por-link/spec.md` (sigue `in-progress`). No se creó SDD nueva.
- **Migración:** `0559_registro_link_correo_comprobado` (número asignado por el DG). **NO APLICADA A PRODUCCIÓN.** Espera declarada en `supabase/migrations-baseline.json`. Su md5 cambió en la segunda ronda; el vigente va en el mensaje de cierre al DG.
- **Handoff anterior de la SDD (primera entrega, opción A):** `.agents/handoffs/sdd-0646-invitacion-portal-por-link.md`. Es evidencia fechada; su punto 5 quedó reemplazado por este documento.

## OBJETIVO ORIGINAL

Sam decidió el 2026-11-17 cambiar la decisión D-1 de la SDD-0646 de la opción A a una opción C: el cliente del sistema anterior sigue entrando directo al completar el formulario del link, pero el correo que escribió no sirve para obtener ni recuperar acceso hasta que se comprueba.

El diseño lo fijó el DG en dos rondas: primero ocho condiciones de diseño, y después de la revisión de seguridad independiente, diez ajustes. Las dos tablas de abajo las recorren.

## COMPLETADO

- **Migración 0559** (`supabase/migrations/0559_registro_link_correo_comprobado.sql`).
  - Tabla `client_email_checks`: el estado «comprobado» propio (no el `email_confirmed_at` de Auth). RLS encendida y sin policies: no se lee ni se escribe por PostgREST.
  - `portal_registration_link_bind` reemplazado con preflight por md5 del cuerpo de la 0552 (`9dc4862d…`).
  - RPC del enlace (solo `service_role`); reclamar y confirmar reciben el usuario de la sesión y exigen que sea el titular. `portal_email_check_revisar` para una confirmación que quedó a medias.
  - `portal_email_check_estado` (equipo): solo el estado y la fecha del último envío.
  - `portal_email_check_prepare` (equipo, rol y tenant), `portal_email_sin_comprobar`, trigger de cambio de correo en `clients`, fila «sin comprobar» para las cuentas por link ya creadas, retiro de `portal_registration_link_email_status`.
  - Desarme en `supabase/desarmes/` (leer su cabecera).
- **Registro por link** (`app/registro/link/[token]/actions.ts`): la cuenta nace con una dirección interna aleatoria en dominio `.invalid`; la entrada directa se acuña para esa dirección; al correo le sale el enlace de comprobación.
- **Enlace de comprobación** (`app/registro/correo/[token]/`): el GET solo lee. El POST exige la sesión del portal del titular; después reclama, pasa el correo a la cuenta y marca comprobado. No crea sesión ni ofrece ninguna entrada. Cada paso de la vuelta se revisa.
- **Bloqueo en la app (segunda capa):** `/entrar` (misma respuesta y mismas consultas que un correo inexistente; sin el cliente admin no envía nada), invitación por correo (`sendPortalInviteEmail`, que cubre la ficha, el recordatorio por cron y el reenvío masivo) y `sendEmail` (ningún envío toma la dirección interna). El portal no tiene recuperación de contraseña: la entrada es por enlace.
- **Acceso por WhatsApp (SDD-0253):** `loadAccessTarget` acuña para la cuenta del cliente, preguntándole a Auth qué dirección lleva. Es la recuperación de estas cuentas.
- **Studio:** «Registros por link» muestra el estado real (comprobado, sin comprobar, choque, para revisar, nunca comprobado); botón «Reenviar comprobación»; corregir el correo en la ficha deja la cuenta sin comprobar y avisa; invitar por correo a quien nunca comprobó el suyo pide una confirmación explícita.
- **Corrida única** de las cuentas ya creadas: `infra/ops/portal-correo-comprobacion/` (ensayo por defecto, paginada, código de salida distinto de 0 si queda algo pendiente). **No se corrió.**
- **Spec enmendada:** D-1 a opción C, §4.1, criterios 9 a 24, tabla de datos personales de la enmienda, límites de las pruebas y allowlist.

### Primera ronda: las ocho condiciones del DG

| # | Condición | Dónde quedó |
|---|---|---|
| 1 | Dirección interna en dominio reservado, de un id aleatorio; ningún envío la toma | `nuevoCorreoInterno` (128 bits, `@sin-comprobar.invalid`); `sendEmail` la rechaza. Auth real de prueba la acepta (corrida del 2026-11-18, ver «VALIDACIÓN»). |
| 2 | El correo real solo en nuestra tabla hasta confirmar; choque → genérico, marcado, sin fusionar | `client_email_checks.pending_email`; `portal_email_check_claim` marca `conflict_at`; contrato §L |
| 3 | El chequeo previo «ese correo ya tiene cuenta» se mantiene | `portal_registration_link_complete` no se tocó |
| 4 | `/entrar` con el correo sin comprobar: respuesta idéntica a la de uno inexistente | misma respuesta, mismas consultas y ningún envío. Se midió por consultas y envíos, no cronometrando |
| 5 | Corregir el correo vuelve a «sin comprobar» | trigger de la 0559 (contrato §M) + `updateClientAction` |
| 6 | Mantener el bloqueo en la app | `correoSinComprobar` en `/entrar` y en la invitación; falla cerrado |
| 7 | Botón «Reenviar comprobación» y corrida única con ensayo | `resendEmailCheckAction`; `pasar-cuentas-a-direccion-interna.mjs` |
| 8 | `service_role` solo en servidor y después del control de rol | orden probado en `correo-comprobacion-studio.test.ts` |

### Segunda ronda: ajustes de la revisión independiente

| # | Ajuste | Dónde quedó |
|---|---|---|
| 1 | La comprobación exige la sesión del portal del titular, en la app y en la base | `comprobarCorreoAction` (el usuario sale de `getUser()`); `portal_email_check_claim` y `_confirm` reciben y comparan `p_session_user_id`. Sin sesión o con otra cuenta: no confirma, no gasta, texto genérico. Pantalla de éxito y correo sin invitación a entrar. Contrato §K; `comprobar-correo-action.test.ts` |
| 2 | Corrida única en la misma ventana; el script pagina y no termina en 0 con pendientes | README y cabecera del script; lotes de 200 por id; `codigoDeSalida` (1 si algo falla, 3 si quedan) |
| 3 | Cada error de la vuelta del POST se revisa | lectura, vuelta de Auth y soltar se revisan; si la vuelta falla no se suelta el enlace y queda `review_needed_at` («para revisar» en Studio); avisos sin correo ni token |
| 4 | Revocar y volver a invitar: la señal sigue a la vista | estado `nunca_comprobado` en la tarjeta; `invitePortalAction` devuelve `requiereConfirmar` y `PortalAccessCard` abre un diálogo. No bloquea |
| 5 | `dejarCuentaSinComprobar` no falla abierto | error de lectura → «fallo» (aviso al equipo); solo «tabla inexistente» es «nada» |
| 6 | Un 422 a secas no es choque | `esCorreoOcupado` mira el código `email_exists` o el texto |
| 7 | `/entrar` pregunta antes de cualquier `signInWithOtp` | sin el cliente admin responde error igual para cualquier correo y no envía; prueba de inventario reforzada |
| 8 | `token_hash` y `pending_email` no legibles por el equipo | tabla sin policies ni `select` para `authenticated`; `portal_email_check_estado` devuelve solo el estado. El correo se ve en la ficha, con sus permisos de siempre |
| 9 | Neutralizar la frase sobre las cuentas anteriores | spec, README, baseline, script y este handoff |
| 10 | Prueba contra Auth real como pendiente previo | «PENDIENTES», punto 1 |

### Tercera ronda: segunda revisión independiente

| # | Ajuste | Dónde quedó |
|---|---|---|
| A | El titular ve qué correo confirma | `portal_email_check_peek(p_token_hash, p_session_user_id)` devuelve el correo por comprobar solo si la sesión es la del titular. La página lee la sesión en el servidor, muestra el correo completo («¿Es este tu correo?», «Revísalo letra por letra…») y ofrece «No es mi correo», que no confirma nada. Contrato §J; `comprobar-correo-page.test.tsx` |
| B | El acceso por WhatsApp falla cerrado | `direccionInternaDelCliente` devuelve ficha, cuenta o error; con error, `loadAccessTarget` devuelve `null` y `/entrar/[code]` responde el error genérico sin acuñar nada. Solo «la tabla no existe» cae a la ficha |
| C | La cuenta vieja del link no recibe la entrada | solo si sigue siendo el acceso activo del cliente (lo mismo que mira el estado de la 0559). Revocado y reinvitado, con la invitación ya aceptada: el correo de la ficha. Reinvitado sin aceptar todavía, o revocado sin reinvitar (ningún acceso activo): falla cerrado |
| D | Confirmación hecha con respuesta de error | antes de dar la vuelta se relee la fila; si ya está comprobada, es un éxito y no se revierte |
| INFO | Desarme de la 0559 | su cabecera exige, antes de usarlo, devolver el correo a las cuentas que siguen con dirección interna o desactivar su acceso por WhatsApp |
| E | Fila cuya cuenta de Auth ya no existe | la corrida única la cuenta aparte, no la toca ni la borra, no la cuenta como pendiente y sale con 4; el ensayo también la detecta. README con la tabla de códigos |

## DECISIONES TOMADAS

1. **«Comprobado» vive en `client_email_checks`**, una fila por cliente registrado por link, atada a la cuenta de Auth que nació del link.
2. **A quién aplica:** solo a esa cuenta, mientras sea el acceso activo del cliente. Revocar y volver a invitar por correo (SDD-0042) saca al cliente de la regla, con la señal a la vista.
3. **Cuentas por link ya creadas:** quedan todas «sin comprobar» al aplicar la 0559.
4. **El enlace de comprobación vence a los 7 días** y hay uno vivo por cuenta.
5. **La ficha manda:** el correo por comprobar es el de la ficha; «Reenviar comprobación» lo vuelve a leer.
6. **El cliente no puede cambiar su correo desde el portal** (no existe ese camino hoy). El trigger cubre cualquier camino que escriba `clients.email`.
7. **Con sesión de equipo o de otra cuenta** el enlace responde lo mismo que sin sesión.
8. **Textos aprobados que NO cambié:** «Marcar comprobado» y «Comprobado» de la tarjeta.
9. **Comportamiento que cambió a pedido del DG:** `/entrar` sin el cliente admin ya no cae al envío de Auth; responde un error igual para cualquier correo. Se ajustaron las dos pruebas que fijaban lo anterior (`actions.test.ts`, `entrar-no-promete-envio.test.tsx`).

## DECISIONES QUE NECESITAN A SAM

1. **Aviso dentro del portal** («Tu correo está sin comprobar» + «Reenviar») — propuesto, no hecho. Con la exigencia de sesión gana peso: el cliente confirma desde donde ya tiene el portal abierto.
2. **Renombrar «Marcar comprobado» → «Marcar revisado»:** en la misma tarjeta conviven «Comprobado» (el equipo revisó) y «Correo comprobado».
3. **Vaciar `pending_email` al confirmar** y sumar la tabla al plazo de purga pendiente de la 0552.
4. **Textos nuevos de cara al cliente** para su visto bueno: el correo «Comprueba tu correo», la página `/registro/correo/…` (con «¿Es este tu correo?» y «No es mi correo» de la tercera ronda), el texto «entra primero a tu portal» y la línea del mensaje final del registro.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Contrato de la 0559 en PGlite (`correo-comprobado.migration.test.ts`): contrato, control rojo, desarme y 25 mutantes | PASÓ (28/28) |
| Tercera ronda: 14 archivos tocados y vecinos (incluidos `access-link.test.ts` y `access-link-bulk.test.ts`) | PASÓ (739 casos) |
| Tercera ronda: 12 mutantes de la app (A a E) | PASÓ: mueren los 12 |
| Vitest de los archivos tocados y vecinos, con vitest 5.1.0: `app/registro`, `app/entrar`, `app/abrir`, `app/studio/(app)/clientes`, `lib/studio/portal`, invitación, correo, estado y corrida única, `rbac-actions-guard` | PASÓ (45 archivos, 938 casos) |
| eslint sobre los archivos tocados | PASÓ |
| `pending-migration-symbols` | PASÓ: 0 rojo, 4 amarillo declarados (uno es el de la 0559) |
| `docs:check`, `sdd:check`, `git diff --check` | PASÓ |
| `pnpm install --frozen-lockfile` y `pnpm typecheck` | PASÓ en la primera ronda (turno del DG). `typecheck` de la segunda ronda: lo corre el CI |
| CI de la PR, primer push (`e768cb3ea`) | «Contratos SQL» PASÓ. «Calidad» FALLÓ: 38 casos de `app/entrar/__tests__/entrar-no-promete-envio.test.tsx`, cuyo doble no conocía la consulta nueva; no la había corrido en local. Corregido en la segunda ronda |
| `pnpm test` completo, build y e2e | NO EJECUTADO en la PC por decisión del DG: el portón es el CI |
| Contrato SQL con psql y Docker | NO DISPONIBLE en local; en el CI corre |
| Auth real del entorno de prueba (2026-11-18 01:49Z, la corrió el DG en el VPS con `infra/ops/portal-correo-comprobacion/probar-auth-prueba.mjs` de la PR #658, red interna de prueba, claves distintas de producción verificadas, primero el ensayo; evidencia en el VPS, sin secretos en Git) | PASÓ salvo el choque: `createUser` con la dirección interna 200; enlace de entrada 200 y canje con sesión 200; pedir código con el correo real 422 `signup_disabled` sin cuenta nueva ni correo; recuperación con el correo real 200 sin correo; control positivo de Mailpit, exactamente 1 correo; paso al correo real y vuelta 200 con la sesión válida y renovable; limpieza OK. El choque NO dio `422 email_exists`: dio **500 · 23505**, y la cuenta siguió con su dirección interna. La app ya reconoce esa forma (abajo) |
| Segunda corrida contra el Auth real de prueba (2026-11-18 02:17Z, la corrió el DG en el VPS con #658 en `80304bcef`; evidencia en el VPS, sin secretos en Git) | PASÓ: código de salida 0, todo PASÓ, choque con forma «500 23505», limpieza de 3 cuentas |
| Respuesta de Auth perdida (sin status o status 0) en `comprobarCorreoAction` | se relee la cuenta con `getUserById`: si ya lleva el correo real se sigue a marcar comprobado; si sigue con su dirección interna se suelta para reintentar; si no se puede leer o lleva otra cosa, queda «para revisar» sin soltar el enlace |
| Choque con la forma real (500 · 23505) en `comprobarCorreoAction` | PASÓ: queda como choque (Studio «choque», mensaje genérico, enlace marcado). Un 500 de otra causa va a «para revisar» sin soltar el enlace. 5 mutantes mueren |
| `/ui-check` | OK con ajustes menores (primera ronda). La segunda ronda sumó un diálogo de confirmación y dos avisos con los componentes del sistema; no se volvió a correr |
| Producción | NO TOCADA: ni lecturas ni escrituras |

## PENDIENTES DE ESTA TAREA

1. **Prueba contra Auth real: hecha y cerrada.** La primera corrida (2026-11-18 01:49Z) mostró que el choque llega como 500 · 23505, y la app lo reconoce. La segunda (02:17Z, #658 en `80304bcef`) dio código de salida 0. Ver «VALIDACIÓN».
2. **Orden de salida, en una sola ventana:** aplicar la 0559 (OK nominal de Sam) → publicar → corrida única inmediatamente (ensayo, después `--aplicar`, OK nominal de Sam), hasta código de salida 0.
3. **Smoke sugerido** (extiende el guion de la primera entrega): registrarse por link → entra directo; pedir enlace en `/entrar` con ese correo → pantalla de siempre y ningún correo; abrir el enlace de comprobación sin sesión → pide entrar primero y el enlace sigue vivo; abrirlo con el portal abierto y confirmar → comprobado; después `/entrar` ya manda el enlace; reusar el enlace → mensaje genérico; corregir el correo en la ficha → «sin comprobar»; acceso por WhatsApp de una cuenta sin comprobar → entra; revocar y volver a invitar → diálogo de confirmación y «Correo nunca comprobado».
4. La revisión independiente del delta la lanza el DG.

## FUERA DE ALCANCE DETECTADO

- **`scripts/buscar-voseo.mjs`** marca dos apariciones en `lib/studio/chatwoot/bot/conocimiento/reglas-duras.ts` (lista de palabras del bot). No es de esta tarea.
- **`/entrar` con dos filas de acceso para el mismo correo:** la búsqueda toma una sola (`limit(1)`). Ya era así.
- **`portalWhatsAppInviteAction`** (invitación por WhatsApp del panel de adopción) también pasa a «invitado» a un cliente revocado. Su lista de candidatos no incluye clientes con fila de acceso, así que no llega por la pantalla; no le sumé el diálogo.
- **Borrado lógico de clientes y copias de datos** (`prev_data`, `submitted_data`, ahora `pending_email`): sigue pendiente la decisión de plazo de la primera entrega.
- **Historial de la rama:** los commits de la primera ronda ya publicados conservan textos que la segunda ronda neutralizó. No se reescribió el historial (sin force push).

## IMPACTO DOCUMENTAL

- Actualizado: la spec de la SDD-0646 y este handoff. `infra/ops/portal-correo-comprobacion/README.md` es nuevo.
- No aplica: `docs/runbooks/setup-portal-auth.md` (no cambia la configuración de Auth).
- Propuesta, sin hacer: sumar el smoke del punto 3 al guion de smokes vigente cuando el DG lo integre.

## HANDOFF AL DIRECTOR

- Cabeza de la rama y md5 vigente de la 0559: en el mensaje de cierre de cada ronda.
- La PR está lista para revisión (no draft), base `main`.
