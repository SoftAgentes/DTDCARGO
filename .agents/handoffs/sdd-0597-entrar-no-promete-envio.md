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
| `app/entrar` y `sin-promesa-rastreo-restantes.test.tsx` | PASÓ: 67 pruebas |
| Mutantes | PASÓ: 29 de 29 mueren, control verde antes y después de cada tanda. La primera (24) corrió antes de los ajustes de arriba; la segunda (5) cubre esos ajustes |
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

## PR / BRANCH

- Rama: `claude/sad-jones-d0695e`.
- PR en borrador contra `main`, retenida, enlazada desde la sesión.

## PENDIENTES DE ESTA TAREA

- [ ] `pnpm verify`, con turno del Director.
- [ ] Medición contra GoTrue real con Mailpit, con turno del Director. Si contradice la lectura del código, se revisa el plan B.
- [ ] Merge de prueba local con la PR #358, sin publicarlo, cuando las dos estén listas.
- [ ] Al desplegar a prueba, cuando Sam termine: pedir el enlace con el cliente de la semilla y leerlo en `/correo/`, y ver la pantalla con el servidor real.
- [ ] `status` de la spec: queda en `in-progress` hasta tener lo anterior.

## FUERA DE ALCANCE DETECTADO

- **Comodines en `.ilike("email", email)`** (por lectura, sin provocarlo), detalle en la spec: `a_b@x.com` coincide con el cliente `a.b@x.com`, se crea un `auth.users` y le llega un enlace. No da acceso, porque `portal_bind_session` compara exacto, pero es un oráculo para quien tenga esa dirección y rompe el invariante de SDD-0278. Propuesto como tarea aparte.
- **Oráculo por tiempo de respuesta** (por lectura, sin medir): un correo con cuenta acuña y llama a Resend; uno sin cuenta, no. Ya existía.
- **Agotar el cupo de un tercero:** cualquiera puede gastar los 5 pedidos por hora de un correo ajeno. Ya existía en silencio; ahora la persona lo ve.
- **«Da igual dónde lo abras»** no es cierto para el enlace de Auth (PKCE). Solo aplica sin Resend, y queda en `entorno-prueba.md`.
- **`RecoveryForm` de Studio** también dice «Revisa tu correo», en condicional. No se revisó si su envío puede fallar en silencio.
- **El plan B no protege de la falla para la que existe:** Auth usa la misma clave de Resend. Propuesta para Sam en la spec, sin decidir: otra clave u otro proveedor SMTP.

## HANDOFF AL DIRECTOR

- **Pido:** un turno para `verify` y para la medición de GoTrue, juntos o por separado. Condiciones de la medición: las tuyas, 1 GB por contenedor, 127.0.0.1, borrado al terminar y 5 minutos de tope.
- **Retenida:** no integrar antes de terminar la salida a producción.
- **Impacto documental:** `entorno-prueba.md` y `setup-portal-auth.md`, actualizados en esta rama. Sin cambios en AGENTS ni en políticas.
- **Conocimiento:** Graphify y Archify no se regeneraron: `knowledge:status` dio NO DISPONIBLE en este worktree. Queda pendiente para la integración.
- **Nota personal `entrar-plan-b-429`:** su texto dice borrarla cuando el plan B esté arreglado. Sigue vigente hasta que esto esté en producción y prueba.
