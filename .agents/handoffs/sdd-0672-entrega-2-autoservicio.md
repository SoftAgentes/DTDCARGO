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
(los que mira el preflight del desarme). Archivo: `a30b133d564e…`; desarme: `0d422a005c50…`.

| Comprobación | Resultado |
|---|---|
| md5 de los cuerpos de la 0552 (preflight) | PASÓ: el método reproduce el md5 de `bind` que usó la 0559 |
| El desarme devuelve la 0552 exacta | PASÓ (estático): sus cuerpos dan b90378a1… y 690860ca… |
| El preflight del desarme reconoce la 0562 | PASÓ (estático): 620cebdf… y 36fe32fa… salen de los cuerpos de la 0562 |
| Anclas de los 26 mutantes | PASÓ (estático): cada texto está una sola vez en la 0562 y cada mensaje existe en el contrato (el de `anon` se arma con `\|\| f`) |
| `check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 1 AMARILLO declarado (lo esperado con una espera) |
| `migrations-lock.mjs verificar --sin-base` | PASÓ: la 0562 figura como espera sin sellar |
| `docs:check` / `sdd:check` / `git diff --check` | PASÓ |
| install, typecheck, vitest local, contrato SQL, PGlite | NO EJECUTADO: sin turno de PC y sin `node_modules` en el worktree; el CI hace de portón |

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

Límites conocidos, sin cambio (no contradicen la spec):

- `guard_failures` cuenta por enlace: cada `/entrar` da 3 intentos más. El tope real es el cerrojo de
  5 por hora por correo, y el enlace solo llega al buzón de la ficha.
- `complete_self` bloquea enlace→ficha y `create_self` ficha→enlace; un choque daría 40P01 y Postgres
  aborta uno sin dañar datos. Ya pasaba en la 0552 entre `complete` y el `create` del equipo.

## PENDIENTES DE ESTA TAREA

- Revisión independiente en Opus (la lanza el DG).
- Aplicar la 0562 en producción: OK nominal de Sam nombrando `0562_registro_link_autoservicio`,
  después de fusionar #683.
- `revisar-datos-ve` sobre la captura de la entrega 2 (resumen en la spec §7).

## FUERA DE ALCANCE DETECTADO

- La tarjeta de «Registros por link» no muestra los intentos fallidos de la guarda
  (`guard_failures`); se ven en la tabla. Si el equipo los quiere en pantalla, es una tarea aparte.

## HANDOFF AL DIRECTOR

- Rama `codex/entrar-autoservicio-portal`, apilada sobre #683 (trae su cabeza 56e4d1b98 por merge).
  La PR va contra `main`; mientras #683 no entre, su diff incluye la entrega 1.
- Orden: fusionar #683, luego esta PR. Aplicar la 0562 con el OK nominal de Sam
  (`0562_registro_link_autoservicio`) y el runbook; migrate-first: la app nueva sin la 0562 degrada al
  aviso de la entrega 1.
- Revisión independiente en Opus: pendiente, la lanza el DG.
