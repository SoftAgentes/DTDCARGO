# Handoff — SDD-0672 entrega 2 · el cliente sin portal lo crea desde su correo

Fecha: 2026-11-18. Task ID: `sdd-0672-entrega-2-autoservicio`.
Owner / sesión escritora: `local_a765f1a9-4e02-4120-a971-85be64bbda5a` (Worker Claude Code, pedido directo de Sam).

- **Worktree:** `../DTD-worktrees/entrar-autoservicio-portal`, con `guard` y `claim` en PASÓ.
- **Rama:** `codex/entrar-autoservicio-portal`, **apilada sobre** `codex/entrar-reconoce-correo`
  (PR #683, entrega 1). Cuando #683 entre a `main`, esta rama trae `main` por merge.
- **SDD:** `docs/specs/0672-entrar-reconoce-el-correo/spec.md` §4. **Migración 0562**, asignada por el DG.

## OBJETIVO ORIGINAL

Segunda parte del pedido de Sam (2026-11-18): el cliente que existe en el ERP y nunca activó su portal
llena sus datos completos y queda enlazado a su ficha. Condiciones del DG: RPC `SECURITY DEFINER` con
`search_path` fijo y `EXECUTE` solo para `service_role`; la guarda de documento nunca revela si
coincidió; la pantalla de `/entrar` solo dice «te mandamos un enlace»; revisión independiente en
Opus; aplicar la 0562 en producción exige el OK nominal de Sam.

## COMPLETADO

- **Migración `0562_registro_link_autoservicio.sql`** (NO aplicada): `link_origin`, `issued_to_email` y
  `guard_failures` en `client_registration_links`. `peek` y `complete` de la 0552 aceptan solo enlaces
  del equipo; preflight con los md5 de sus cuerpos vivos (b90378a1…, 690860ca…; método validado con el
  md5 conocido de `bind`, 9dc4862d…). RPC nuevas: `create_self`, `peek_self`, `complete_self` (con la
  guarda, `coalesce` contra NULL) y `bind_self`; además `portal_registration_doc_key`, sin `EXECUTE`
  para nadie. md5 del archivo y de cada cuerpo: ver «VALIDACIÓN».
- **`lib/studio/portal/autoservicio-link.ts`:** emite el enlace y lo manda al correo de la ficha. El
  correo no lleva nombre ni Shipping Mark. Nunca tira; sin la 0562 devuelve `sin-migracion`.
- **`/entrar`:** resultado `crear_portal` si el enlace salió; si no aplica, falta la migración o no
  sale, queda el aviso al equipo de la SDD-0279 (entrega 1).
- **`/registro/activar/[token]`:** GET que solo lee (`peek_self`, sin datos de la ficha) y POST con
  la guarda. Si no coincide, o si el correo ya tiene cuenta, el mensaje es el mismo y no nombra el
  dato. Con el correo probado: cuenta con el correo real y `bind_self`; con otro correo: camino D-1.
- **Formulario:** `RegistroLinkForm` con variante `autoservicio` (sin Shipping Mark antes de la
  guarda, correo precargado).
- **Studio, «Registros por link»:** `origen` y «Correo comprobado» para el autoservicio con el correo
  probado. Si la 0562 no está aplicada, la consulta vuelve a pedir las columnas viejas (42703).
- **Pruebas unitarias** de todo lo anterior. Contrato SQL, PGlite, desarme y esperas: ver
  «SUBAGENTE».

## VALIDACIÓN

md5 de la 0562 nueva: `peek` 620cebdf32c25ad7f33c89dc1b058a37, `complete` 36fe32fa6e5ae9e8cefca187c0250dfa
(los que mira el preflight del desarme; los ajustes de la revisión no los cambian, porque tocan solo
`peek_self` y `complete_self`). Archivo: `637b3740d2ea…`; desarme: `0d422a005c50…` (sin cambio).

| Comprobación | Resultado |
|---|---|
| md5 de los cuerpos de la 0552 (preflight) | PASÓ: el método reproduce el md5 de `bind` que usó la 0559 |
| El desarme devuelve la 0552 exacta | PASÓ (estático): sus cuerpos dan b90378a1… y 690860ca… |
| El preflight del desarme reconoce la 0562 | PASÓ (estático): 620cebdf… y 36fe32fa… salen de los cuerpos de la 0562 |
| Anclas de los 33 mutantes | PASÓ (estático): cada texto está una sola vez en la 0562 y cada mensaje existe en el contrato (el de `anon` se arma con `\|\| f`) |
| `check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 1 AMARILLO declarado (lo esperado con una espera) |
| `migrations-lock.mjs verificar --sin-base` | PASÓ: la 0562 figura como espera sin sellar |
| `docs:check` / `sdd:check` / `git diff --check` | PASÓ |
| install, typecheck, vitest local, contrato SQL, PGlite | NO EJECUTADO: sin turno de PC y sin `node_modules` en el worktree; el CI hace de portón |
| CI «Calidad» en 527de903c | FALLÓ, 4 de 20.678. (1) La spec citaba el desarme con su nombre de archivo y la prueba de trazabilidad lo leyó como migración: ahora sin el punto pegado, como en la 0611. (2 y 3) Dos mutantes del origen sobrevivían porque el chequeo nuevo del correo ya rechazaba el enlace del equipo, que no lleva correo: el contrato le pone el correo de la ficha al link del equipo para que el origen se pruebe solo. (4) El inventario de quién acuña enlaces de entrada suma `/registro/activar/[token]/actions.ts`: correo probado o dirección interna, entregado en la página |

## SUBAGENTE

Un subagente escribió, con archivos propios, el contrato `supabase/tests/0562_registro_link_autoservicio.test.sql`
(bloques A a H: permisos, columnas, emitir, mirar, ruta del equipo, guarda, tres intentos y vincular),
la prueba PGlite `lib/portal/__tests__/registro-autoservicio.migration.test.ts` (contrato verde,
control rojo, 4 ensayos del desarme y 26 mutantes), el desarme `supabase/desarmes/0562_desarme.sql`,
la espera en `supabase/migrations-baseline.json` y las declaraciones de símbolos.

Encontró un defecto que corregí: la columna se llamaba `origin`, una palabra que la app usa en ~103
sitios ajenos (`url.origin`, cabeceras, Chatwoot); el gate de símbolos falla cerrado y quedaba ROJO.
Ahora es `link_origin` (como `cover_origin` de la 0547), con su constraint
`client_registration_links_link_origin_check`; recalculé los md5 del desarme y declaré la columna.

## REVISIÓN DE SEGURIDAD (Opus, lanzada por el DG)

APPROVED sobre `e4385408c` (delta `fb8b7d518..e4385408c`), sin bloqueantes. El DG pidió cerrar tres
sugerencias en un commit nuevo y anotar las otras tres:

- **1, hecho: orden de bloqueos.** `complete_self` ubica el enlace sin bloquear, bloquea la ficha y
  después el enlace, y vuelve a validar los dos: el mismo orden que `create_self`, sin 40P01. PGlite
  tiene una sola conexión, así que el orden no tiene mutante; queda a la lectura.
- **2, hecho: correo de la ficha.** `peek_self` y `complete_self` exigen
  `lower(btrim(c.email)) = issued_to_email`: un enlace mandado a un correo con tipeo deja de servir
  cuando el equipo lo corrige. Contrato, bloque I (con la ficha borrada y fusionada).
- **6, hecho: mutantes nuevos.** «Emitir otro revoca el anterior» (el contrato traduce el choque con
  el índice de un enlace abierto al mismo mensaje), y ficha borrada, fusionada o con otro correo en
  `peek_self` y `complete_self`. Total: 33.

Límites conocidos (sugerencias 3, 4 y 5 de la revisión, y el de los intentos):

- **Molestia por revocación (3):** quien sepa el correo de un cliente puede pedir `/entrar` hasta 5
  veces por hora; cada pedido revoca el enlace vivo y manda otro correo al buzón de la ficha. No da
  acceso a nada.
- **Lo que distingue `/entrar` (4):** `crear_portal` frente a `sin_portal` deja ver si la ficha tiene
  documento o teléfono que sirvan, o un enlace del equipo vivo. Es menor: la entrega 1 ya dice que el
  correo es de un cliente (riesgo aceptado por Sam, spec §0).
- **`correo_en_uso` como oráculo (5):** quien ya pasó la guarda puede probar qué correos tienen cuenta
  de Auth, a 5 intentos por hora por IP (ese cerrojo es fail-open, como en la 0552). Es el mismo
  comportamiento de la ruta del equipo.
- **Intentos por enlace:** `guard_failures` cuenta por enlace; cada `/entrar` da 3 intentos más. El
  techo real es ~15 por hora, y solo para quien lee el buzón de la ficha.

## PENDIENTES DE ESTA TAREA

- ~~Re-revisión del delta de los ajustes~~: APPROVED en 527de903c y en 49f0a09e0; #687 fusionada
  (`main` e204360b4).
- ~~Aplicar la 0562 en producción~~: **aplicada el 2026-11-19 a las 16:51:18Z** con el OK literal
  de Sam «OK, aplica 0566, 0565 y 0562», y cerrada (espera retirada y sellada) en
  `.agents/handoffs/2026-11-19-sdd-0672-cierre-0562.md`.
- Smoke en producción de la entrega 2: NO EJECUTADO. Un cliente sin portal pide el enlace en
  `/entrar`, lo recibe en el correo de su ficha y activa el portal con su cédula o su WhatsApp.
- `revisar-datos-ve` sobre la captura de la entrega 2 (resumen en la spec §7): NO EJECUTADO.

## FUERA DE ALCANCE DETECTADO

- La tarjeta de «Registros por link» no muestra los intentos fallidos de la guarda
  (`guard_failures`); se ven en la tabla. Si el equipo los quiere en pantalla, es una tarea aparte.

## HANDOFF AL DIRECTOR

- PR #687. Rama `codex/entrar-autoservicio-portal`, apilada sobre #683 (trae su cabeza fb8b7d518 por merge).
  La PR va contra `main`; mientras #683 no entre, su diff incluye la entrega 1.
- Orden: fusionar #683, luego esta PR. Aplicar la 0562 con el OK nominal de Sam
  (`0562_registro_link_autoservicio`) y el runbook; migrate-first: la app nueva sin la 0562 degrada al
  aviso de la entrega 1.
- Revisión independiente en Opus: APPROVED en e4385408c; los ajustes 1, 2 y 6 van en un commit
  nuevo, para re-revisión del delta.
