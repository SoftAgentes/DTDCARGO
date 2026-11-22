# Handoff — SDD-0672 · /entrar reconoce el correo y dice en pantalla qué pasó

Fecha: 2026-11-18. Task ID: `sdd-0672-entrar-reconoce-el-correo`.
Owner / sesión escritora: `local_a765f1a9-4e02-4120-a971-85be64bbda5a` (Worker Claude Code, pedido directo de Sam).

- **Worktree:** `../DTD-worktrees/entrar-reconoce-correo`, con `guard` y `claim` en PASÓ.
- **Rama:** `codex/entrar-reconoce-correo`, desde `origin/main` `9434cc4f6`.
- **SDD:** `docs/specs/0672-entrar-reconoce-el-correo/spec.md`. Número tomado con
  `scripts/next-number.mjs --reserve --expect 0672`; el DG lo confirmó («quédate con la 0672») y
  asignó la migración **0562** para la entrega 2. Reserva local: rama
  `codex/sdd-reserve-0672-entrar-reconoce-el-correo` y ref `refs/dtd/reservations/0672`, sin publicar;
  incorporada a esta rama por cherry-pick.

## OBJETIVO ORIGINAL

Pedido de Sam (2026-11-18): que `/entrar` mire el correo antes de mandar nada y diga en pantalla si
tiene portal, si es cliente sin portal o si no existe; y que el cliente sin portal pueda completar sus
datos enlazados a su ficha. Decisión literal de Sam sobre la pantalla: «Decirlo en pantalla».

Terminado (entrega 1) es: los cuatro resultados en pantalla, los textos de `/registro` corregidos,
pruebas, spec con allowlist, handoff y PR. La entrega 2 (crear el portal desde el correo, con
migración) va en otra PR.

Límites: sin migración en esta entrega, sin tocar producción ni prueba, no fusionar, turno de PC
antes de install, typecheck o vitest.

## COMPLETADO

- **`app/entrar/actions.ts`:** `resultado` (`enlace`, `sin_portal`, `sin_comprobar`, `sin_cuenta`) en
  vez de `requested`. El envío fallido (Resend, blacklist, `queued`, Auth en el plan B) devuelve
  `error` «No pudimos enviarte el enlace». Cerrojos antes de mirar, sin cambio. La dirección interna
  `@sin-comprobar.invalid` responde `sin_cuenta` sin consultar nada.
- **`lib/studio/portal/sin-acceso.ts`:** `buscarClienteSinAcceso` distingue «no es cliente» de «no se
  pudo preguntar»; `findClienteSinAcceso` queda como envoltura.
- **`app/entrar/EntrarForm.tsx`:** `ResultadoEntrar` reemplaza `MagicRequested`: una pantalla por
  resultado, «Probar con otro correo», WhatsApp con mensaje por caso y «Crear mi cuenta» como
  primaria solo en `sin_cuenta`.
- **`lib/portal/entrar-resultado.ts`:** nuevo (tipo y mensajes de WhatsApp).
- **`/registro`:** `REGISTRO_YA_ERES_CLIENTE` y los textos de duplicado y de acceso no activado ya no
  mandan a «entrar con tu Shipping Mark» ni a «recuperar tu contraseña».
- **Pruebas:** `actions.test.ts`, `entrar-no-promete-envio.test.tsx`, `entrar-dos-filas.test.tsx` y
  `la-accion-lanza.test.tsx` al estado nuevo. Lo que protegía la SDD-0597 sigue cubierto: nunca
  afirmar un envío que no salió, cerrojos antes de mirar, comparación literal y nada sale para un
  desconocido. Lo que cambió a propósito es «el mismo HTML para todos».
- **Piso de tiempo (condición del DG):** `lib/portal/tiempo-minimo.ts`, 700 ms desde el pedido para
  toda respuesta posterior a validar el formato. Límite anotado en la spec: con la pantalla que nombra
  el caso, el piso no oculta nada que el texto no diga.
- **`/ui-check`:** OK con ajustes, los tres aplicados. (1) «Ya eres cliente» afirmaba «te dejamos un
  correo» y «ya le avisamos al equipo» aunque el aviso puede fallar: ahora depende de `equipoAvisado`
  y no menciona el correo. (2) «Correo sin comprobar» afirmaba un envío no verificado. (3) WhatsApp
  pasa a botón primario de ancho completo donde es la salida principal.
- **Docs:** runbook `entorno-prueba.md` (la pantalla ya no es la misma haya salido o no), la spec con
  sus enmiendas explícitas a la 0597 y la 0279, y el índice regenerado.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `git diff --check` | PASÓ |
| `docs:check` / `sdd:check` | PASÓ (649 specs; numeración sin repetidos) |
| install, typecheck y vitest local | NO EJECUTADO: el DG no dio turno de PC (lo tiene la #318 con Docker) y pidió que el CI de GitHub haga de portón |
| CI de GitHub sobre la cabeza de la PR | PENDIENTE |
| Control rojo: pruebas nuevas contra el código de la base | NO EJECUTADO (sin turno de PC) |
| `/ui-check` | PASÓ con 3 ajustes aplicados (ver COMPLETADO) |
| `pnpm verify` | NO EJECUTADO: el portón es el CI de GitHub (memoria del DG, 2026-11-07) |

## COMMITS

PENDIENTE.

## PR / BRANCH

`codex/entrar-reconoce-correo`. PR: [#683](https://github.com/SoftAgentes/DTDCARGO/pull/683), base `main`, abierta con OK del DG («empuja la entrega 1 como PR y que el CI haga de portón»).

## PENDIENTES DE ESTA TAREA

- Entrega 2 (spec §4): enlace de autoservicio para crear el portal, con guarda de cédula o WhatsApp,
  migración nueva (siguiente libre al 2026-11-18: 0562), contrato SQL, desarme, espera declarada y
  revisión de seguridad Opus. Aplicar en producción exige el OK nominal de Sam.

## REVISIÓN DE SEGURIDAD (Opus, lanzada por el DG)

APPROVED sobre `35ceee37c`, sin bloqueantes. Dos arreglos pedidos antes de fusionar, en un commit
nuevo encima:

1. El piso de tiempo envuelve la acción en `try { … } finally { … }`: una excepción (por ejemplo, el
   envío que tira) tampoco se lo salta. Prueba: «una excepción tampoco se salta el piso».
2. Prueba de que con el cerrojo **por correo** lleno no se consulta `client_users` ni `clients` ni
   ninguna RPC (además del cerrojo por origen).

Notas que quedan en la spec §0: el origen sale de `REQUEST_IP_HEADER` y detrás de Cloudflare debe ser
`cf-connecting-ip` con el origen cerrado (lo verifica el DG en producción antes de publicar); la
carrera contar-e-insertar de `touchThrottle` ya existía.

## FUERA DE ALCANCE DETECTADO

- `app/registro/actions.ts:142-144` (revisión de seguridad): el cerrojo por IP de `/registro` falla
  abierto si no puede leer la base. Es una decisión de la SDD-0042 §10; no se tocó.
- `app/invitar/[token]/actions.ts:135` (invitación del equipo, no del cliente): «Cuenta creada pero
  login automático falló: … Intenta login manual.» muestra el mensaje crudo del error. No es del portal
  del cliente; no se tocó.

## IMPACTO DOCUMENTAL

- Actualizado: `docs/runbooks/entorno-prueba.md`.
- La SDD-0597 queda modificada en su aceptación 2 por esta spec (excepción decidida por Sam). No se
  editó su texto: esta spec lo dice en §7.
- Auditoría 2026-07-31 M7: excepción documentada en la spec §7; el archivo de la auditoría no se toca.

## HANDOFF AL DIRECTOR

PENDIENTE.
