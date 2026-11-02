# Handoff — SDD-0597 · /entrar no dice que salió un correo que no salió

Fecha: 2026-11-02. Task ID: `sdd-0597-entrar-no-promete-envio`.
Owner / sesión escritora: `sad-jones-d0695e-sdd-0597` (Worker Claude Code).

Estado: **PR en borrador, retenida.** Toca el portal: no se integra hasta terminar la salida a producción. Falta `verify` y la medición contra GoTrue real, los dos con turno del Director.

- **Worktree:** `.claude/worktrees/sad-jones-d0695e`, con `guard` y `claim` en PASÓ.
- **Rama:** `claude/sad-jones-d0695e`, sobre la reserva `a15896213`, cuyo padre es `7be2ed9e5` (`origin/main`).
- **SDD:** `docs/specs/0597-entrar-no-promete-envio/spec.md`, asignada por el Director. Reserva: rama `codex/sdd-reserve-0597-entrar-no-promete-envio` y ref `refs/dtd/reservations/0597`, sin publicar.

## OBJETIVO ORIGINAL

Comprobar si la acción de `/entrar` puede mostrar «Revisa tu correo» sin que salga ningún correo, y corregirlo para que la pantalla nunca diga que se envió algo que no salió, sin revelar si el correo existe, con un camino para volver a intentar y respetando el anti-abuso.

Terminado es: spec con allowlist, PR en borrador contra `main` y handoff. Con pruebas de control rojo, `/ui-check`, y el runbook y la semilla de prueba actualizados.

Límites: no provocar fallas de Resend en producción, no leer filas de clientes, no fusionar, coordinar `EntrarForm` con la PR #358 y pedir turno antes de `verify` o suites amplias.

## COMPLETADO

- **Hipótesis confirmada.** Acuñar cuenta como envío: `adminGenerateLink` escribe `RecoverySentAt` y `sendMagicLink` lo valida contra `SMTP.MaxFrequency` (`internal/api/mail.go:151` y `:487`, en v2.197.0).
- **Reproducido con dobles.** Con Resend en 500, cuatro situaciones terminan en «Te enviamos… ✓ Enviado» con el buzón en cero. Tabla en la spec.
- **`app/entrar/actions.ts`:**
  - El estado `sent` pasa a `requested`, y no afirma ningún envío.
  - Los cerrojos y las consultas caídas lo dicen, porque corren antes de mirar el correo o fallan igual para cualquiera.
  - El plan B solo corre antes de acuñar. Con Resend simulado va directo a Auth, y eso hace cierto el enlace en `/correo/` de prueba.
  - El fallo queda en el log sin el correo.
- **`app/entrar/EntrarForm.tsx`:** condicional, «Pedir otro enlace», «Pedido recibido», contador de pedidos, foco en el título, salida por WhatsApp y `MagicSent` renombrado a `MagicRequested`.
- **`lib/studio/mail/resend-api.ts`:** `resendPuedeEnviar()`, sobre el mismo `envioSimulado` de `resendSend`.
- **Runbooks y semilla:** `entorno-prueba.md`, `setup-portal-auth.md` y `sembrar-prueba.sh`.

- **Comodines del correo, a pedido de Sam.** Literal: «Haz esta tarea aquí: "Escapar comodines del correo en /entrar"». `lib/shared/email-literal.ts` escapa `%`, `_` y `\`, y compara el resultado, porque PostgREST convierte `*` en `%` y eso no se puede escapar. Lo usan `app/entrar/actions.ts` y `lib/studio/portal/sin-acceso.ts`. Va en esta misma PR y SDD por decisión mía, avisada al Director General: mismo archivo y misma retención, y una PR apilada no tendría el check de `quality`. Si la prefiere aparte, el commit se separa.

**Ajustes que salieron de `/ui-check` y del navegador:**

| Hallazgo | Medido | Arreglo |
|---|---|---|
| El foco cae a `body` al reintentar; jsdom no lo ve | `activeElement` = `BODY` | `aria-disabled` y freno en el clic |
| El botón de reintento no llega al objetivo táctil de A11Y-01 | sin alto propio | 44 px, medidos a 375 de ancho; 32 px en escritorio |
| Un correo largo se corta contra el panel a 375 px | se salía 42 px del párrafo | `overflow-wrap: anywhere` |
| El aviso de error no llega a AA sobre el glass | ~3,9:1 calculado | fondo blanco: 5,42:1 medido |

**`/ui-check`:** OK con esos ajustes. Tokens del sistema, sin hex nuevos, tuteo, una sola acción por verbo. El párrafo se ensanchó de 34 a 46 caracteres porque el texto creció.

**Decisión a revisar, con su motivo en la spec:** se quitó el `/otp` después de acuñar. Cambia el punto 6 de la §3 de SDD-0278 («Plan B intacto»), y dos pruebas de `actions.test.ts` que exigían esa llamada ahora exigen lo contrario. No es debilitar pruebas: esa llamada era un 429 seguro.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Control rojo: `entrar-no-promete-envio.test.tsx` contra el código de la base | PASÓ: 27 de 31 en rojo. Las 4 verdes son invariantes que ya se cumplían |
| Control rojo de los comodines, sin escape ni `sameEmail` | PASÓ: 11 de 92 en rojo, entre ellas `_`, `%` y `*`. La última prueba añadida no estaba en esa corrida |
| `app/entrar` y `email-literal.test.ts`, con un solo worker | PASÓ: 92 pruebas, antes de la última, que pasó aparte en su archivo. Incluye correos reales con `_`, `+`, `%`, `*` y mayúsculas |
| `sin-promesa-rastreo-restantes.test.tsx` | PASÓ antes de los comodines. Se repite con `verify` |
| Mutantes | PASÓ: 40 de 40 mueren, en tres tandas. La primera (24) corrió antes de los ajustes de arriba; la segunda (5) cubre esos ajustes; la tercera (11) cubre los comodines. En esa tercera sobrevivió «sin-acceso sin escape»: faltaba la prueba de un parecido que aparece primero en el ERP. Añadida, muere |
| Un mutante quedó puesto al matar mi runner | Corregido antes de hacer commit: `sameEmail` quedó en `return true` al detener la corrida por el pedido de un solo worker. Lo vi leyendo los archivos, y la tanda se repitió sobre un commit con `git status` limpio al final |
| Navegador real: componente real, React de producción, Tailwind compilado y acción simulada | PASÓ: foco, contador, cerrojo, correo conservado por el reinicio real de React 19, y 375 px |
| `eslint` de los archivos tocados, `docs:check`, `sdd:check`, `governance:check`, `components:check`, `git diff --check` | PASÓ |
| `sembrar-prueba.sh` | `bash -n` PASÓ. `infra/ops/tests/prueba-scripts-entorno-prueba.sh`: NO EJECUTADO, solo cambia un texto que esa prueba no afirma (leído) |
| `pnpm verify`, incluido `tsc` | NO EJECUTADO: pide turno al Director |
| Medición contra GoTrue v2.197.0 real con Mailpit | NO EJECUTADO. El único intento autorizado, a las 16:44:58Z, falló antes de medir: mi script pasó a `node` una ruta `/tmp/...`. Contenedores limpiados, sin OOM y con puertos solo en 127.0.0.1. La ventana cerró a las 16:45Z y el Director acordó dejarlo para el turno de `verify`. El script ya está corregido |
| Enlace en `/correo/` de prueba con esta imagen | NO EJECUTADO: Sam está revisando prueba y la PR no se desplegó allí |
| Pantalla con el servidor real | NO EJECUTADO: el navegador usó la acción simulada |
| `pnpm knowledge:status` | NO DISPONIBLE: «Respuesta inválida del adaptador Graphify», con `structural` y `semantic` en `UNAVAILABLE` |

**Configuración de producción:** la midió el Director a las 16:37:57Z, sin imprimir valores. Está en la spec. Que una caída de Resend también se lleve el plan B es inferencia: no se provocó ninguna falla.

**No hecho, a propósito:** no se tocó producción ni prueba, no se leyeron filas de clientes y no se fusionó nada.

## COMMITS

Los SHA quedan en la PR: la rama es la fuente de estado.

1. `fix(web): SDD-0597 — /entrar no afirma que salió un correo que no salió`
2. `docs(runbooks): SDD-0597 — cómo llega el enlace del Portal en prueba y dónde sirve el plan B`
3. `docs(sdd): SDD-0597 — spec y handoff`
4. `fix(web): SDD-0597 — el correo de /entrar se compara literal, no como patrón`, aparte, como pidió el Director General
5. `test(web): SDD-0597 — un parecido que aparece primero no le quita la fila a un cliente del ERP`

## PR / BRANCH

- Rama: `claude/sad-jones-d0695e`.
- PR en borrador contra `main`, retenida, enlazada desde la sesión.

## PENDIENTES DE ESTA TAREA

- [ ] `pnpm verify`, con turno del Director.
- [ ] Medición contra GoTrue real con Mailpit y PostgREST v14.17, con turno del Director. Si GoTrue contradice la lectura del código, se revisa el plan B. Si el escape no pasa bien por PostgREST, **no se integra**: un cliente con `_` en el correo dejaría de poder entrar. El script está en el scratchpad de la sesión; se corre con `bash medir-gotrue.sh <raíz del worktree>`.
- [ ] Merge de prueba local con la PR #358 y pruebas sobre el resultado, sin publicarlo, cuando las dos estén listas. Hecho ya con `git merge-tree`, solo a nivel de texto: el primero chocó en un import de `EntrarForm`, el mío se movió y queda limpio.
- [ ] Al desplegar a prueba, cuando Sam termine: pedir el enlace con el cliente de la semilla y leerlo en `/correo/`, y ver la pantalla con el servidor real.
- [ ] `status` de la spec: queda en `in-progress` hasta tener lo anterior.

## FUERA DE ALCANCE DETECTADO

- **El mismo patrón de `.ilike` en otros sitios** (por lectura, sin provocarlo; tabla en la spec): el `From` del correo entrante (`inbound-email.ts:117`), que puede meter un mensaje en el hilo de otro cliente; la invitación (`app/invitar/[token]/actions.ts:144`), que puede dejar el `auth_user_id` en la ficha de nómina de otra persona; y la baja firmada (`unsubscribe-request.ts:108`), que puede dar de baja a un parecido. **No entran a esta PR**, por decisión del Director General: van como tarea aparte después de publicar. Hay tarjeta para Sam.
- **Oráculo por tiempo de respuesta** (por lectura, sin medir): un correo con cuenta acuña y llama a Resend; uno sin cuenta, no. Ya existía.
- **Agotar el cupo de un tercero:** cualquiera puede gastar los 5 pedidos por hora de un correo ajeno. Ya existía en silencio; ahora la persona lo ve.
- **«Da igual dónde lo abras»** no es cierto para el enlace de Auth (PKCE). Solo aplica sin Resend, y queda en `entorno-prueba.md`.
- **`RecoveryForm` de Studio** también dice «Revisa tu correo», en condicional. No se revisó si su envío puede fallar en silencio.
- **El plan B no protege de la falla para la que existe:** Auth usa la misma clave de Resend. Propuesta para Sam en la spec, sin decidir: otra clave u otro proveedor SMTP.

## HANDOFF AL DIRECTOR

- **Reporto al Director General** desde el 2026-11-02: Sam le pasó la salida a producción.
- **En cola, sin arrancar hasta su aviso:** `verify` va después de 0497, #356, guardas #351 y #352, y foco #358 y #360. La medición en Docker corre antes de ese `verify`, con su aviso y 3 GB libres, y es condición de integrar: GoTrue con Mailpit y PostgREST v14.17, 1 GB por contenedor, 127.0.0.1, borrado al terminar y 5 minutos de tope.
- **Mientras tanto:** solo pruebas sueltas de `app/entrar` y `eslint` de lo tocado, con `--maxWorkers=1`, y sin tocar prueba.
- **Comodines:** en esta PR y SDD, como commit aparte. Aceptado por el Director General.
- **Decisión de Sam sobre Resend y el plan B:** la presenta el Director General. En la spec va marcada como inferida. No se la pregunto por mi lado.
- **Retenida:** nada de portal o registro entra a `main` antes de publicar.
- **Impacto documental:** `entorno-prueba.md` y `setup-portal-auth.md`, actualizados en esta rama. Sin cambios en AGENTS ni en políticas.
- **Conocimiento:** Graphify y Archify no se regeneraron: `knowledge:status` dio NO DISPONIBLE en este worktree. Queda pendiente para la integración.
- **Nota personal `entrar-plan-b-429`:** su texto dice borrarla cuando el plan B esté arreglado. Sigue vigente hasta que esto esté en producción y prueba.
