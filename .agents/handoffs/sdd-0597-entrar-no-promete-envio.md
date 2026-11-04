# Handoff — SDD-0597 · /entrar no dice que salió un correo que no salió

Fecha: 2026-11-02. Task ID: `sdd-0597-entrar-no-promete-envio`.
Owner / sesión escritora: `sad-jones-d0695e-sdd-0597` (Worker Claude Code).

Estado (2026-11-03): **lista para que el Director General la fusione cuando pase el CI.** PR en borrador; la retención se levantó al salir la primera publicación. `verify` salió con exit 1, solo por tiempo agotado en dos pruebas que pasan aisladas: ver «VALIDACIÓN».

- **Worktree:** `.claude/worktrees/sad-jones-d0695e`, con `guard` y `claim` en PASÓ.
- **Rama:** `claude/sad-jones-d0695e`, con `main` en `8b6b3a0e1` traído por merge.
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
| Mutantes | PASÓ: 40 de 40 mueren, en tres tandas. La primera (24) corrió antes de los ajustes de arriba; la segunda (5) cubre esos ajustes; la tercera (11) cubre los comodines. En esa tercera sobrevivió «sin-acceso sin escape»: faltaba la prueba de un parecido que aparece primero en el ERP. Añadida, muere |
| Un mutante quedó puesto al matar mi runner | Corregido antes de hacer commit: `sameEmail` quedó en `return true` al detener la corrida por el pedido de un solo worker. Lo vi leyendo los archivos, y la tanda se repitió sobre un commit con `git status` limpio al final |
| Navegador real: componente real, React de producción, Tailwind compilado y acción simulada | PASÓ: foco, contador, cerrojo, correo conservado por el reinicio real de React 19, y 375 px |
| Enlace en `/correo/` de prueba con esta imagen | NO EJECUTADO: la PR no se desplegó allí |
| `pnpm knowledge:status` | NO DISPONIBLE: «Respuesta inválida del adaptador Graphify», con `structural` y `semantic` en `UNAVAILABLE` (2026-11-02). No se repitió |

**Medición contra servicios reales (2026-11-03):** tablas en la spec. 4 contenedores de 1 GB, puertos en 127.0.0.1, sin OOM y borrados al terminar.

| Con qué | Resultado |
|---|---|
| GoTrue v2.197.0 y Mailpit | PASÓ: acuñar y `/otp` da 429 con el buzón en 0; `/otp` sin acuñar da 200 y llega a Mailpit; otro en seguida da 429; sin cuenta da 422; a los 61 s sale el segundo; y cada acuñado reinicia la ventana |
| PostgREST v14.17 con `supabase-js` | PASÓ: 12 de 12, entre ellos `_`, `+`, `%`, `\`, `*` y mayúsculas |
| Sin explicar | Dos corridas. En la primera, `PGRST300` en todo PostgREST porque no le di secreto JWT (error mío), y el `/otp` a los 61 s dio 429 con 3 s restantes. En la segunda dio 200, con el reloj del contenedor en 0 s de diferencia; en la primera no lo medí |

**`pnpm verify` sobre `d4a54bb81`, exit 1.** 16 de 17 pasos corrieron, de las 18:54Z a las 20:05Z, con 0 pesadas ajenas al lanzar.

| Paso | Resultado |
|---|---|
| `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions` | PASÓ |
| `test` | **FALLÓ por tiempo, no por una aserción.** Primer intento: 13.416 bien y 1 mal (`infra/ops/tests/migraciones.test.mjs`). Reintento: 13.415 bien y 2 mal (ese y `scripts/__tests__/entorno-prueba-scripts.test.mjs`). Las dos vencieron sus 600 s. **Aisladas sobre el mismo SHA, con un solo worker: PASÓ, 32 de 32 en 322 s**, con `prueba-migraciones-produccion.sh` en 139 s. La segunda prueba cubre `sembrar-prueba.sh`, que esta PR toca: pasa. Durante `verify` hubo un mínimo de 1,8 GB libres, y una copia de 740 MB por error mío (`ln -s` en Git Bash copia) |
| `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check`, `pending-migration-symbols` | PASÓ |
| `migrations-applied` | NO EJECUTADO: worktree sin `.env.local`. Esta PR no trae migraciones |
| `sql-tests`, `schema-rebuild` | PASÓ, leído en el log, con Docker arriba |
| `e2e` | PASÓ al reintento. Primer intento: falla `company-photo-carousel.spec.ts:93` y `auth.spec.ts:81` inestable. Reintento: 227 bien, 20 omitidas, y `auth.spec.ts:81` y `sin-scroll-horizontal.spec.ts:215` inestables. Ninguna depende de esta spec |
| `build` | PASÓ |

**Docker aguantó todo el `verify`:** con `vigia-0597` (`--memory 64m`, `sleep infinity`), 61 muestras de 61 en `running`, 71 min, y 0 líneas `stopping VM` en su log. Ya está borrado.

**Cierre de la diferencia con `main`, sobre `6ad57f8d1`.** Durante `verify` entró la #358, que también toca `EntrarForm`. Con `main` en `8b6b3a0e1`, una cosa a la vez y con un solo worker:

| Comprobación | Resultado |
|---|---|
| `app/entrar`, `conservar-lo-escrito`, `email-literal`, `sin-promesa-rastreo-restantes` | PASÓ: 131 pruebas en 6 archivos |
| `typecheck` | PASÓ |
| `e2e/auth.spec.ts -g Portal`, en chromium | PASÓ, 2 de 2. **Solo dibujan `/entrar`, no lo envían** |
| Spec temporal, sin commitear: envía contra `next dev` y la server action real | PASÓ: pedido recibido con el foco en el título, sin afirmar el envío y sin el correo en la URL; el reintento dice «Recibimos 2 pedidos» y conserva el foco. La primera corrida falló por un selector mío: `getByRole("alert")` encuentra también el anunciador de rutas de Next, vacío |
| Enviar y caer en el cerrojo, conservando el correo, en navegador con `submitKeepingDraft` | NO EJECUTADO como e2e. Lo cubre `conservar-lo-escrito`, en jsdom |
| Spec de e2e del repo que envíe `/entrar` | NO EJECUTADO: no existe ninguno. Lo dejo como propuesta: el temporal está en el scratchpad |

**Configuración de producción:** la midió el Director a las 16:37:57Z, sin imprimir valores. Está en la spec. Que una caída de Resend también se lleve el plan B es inferencia: no se provocó ninguna falla.

**No hecho, a propósito:** no se tocó producción ni prueba, no se leyeron filas de clientes y no se fusionó nada.

## COMMITS

Los SHA quedan en la PR: la rama es la fuente de estado.

1. `fix(web): SDD-0597 — /entrar no afirma que salió un correo que no salió`
2. `docs(runbooks): SDD-0597 — cómo llega el enlace del Portal en prueba y dónde sirve el plan B`
3. `docs(sdd): SDD-0597 — spec y handoff`
4. `fix(web): SDD-0597 — el correo de /entrar se compara literal, no como patrón`, aparte, como pidió el Director General
5. `test(web): SDD-0597 — un parecido que aparece primero no le quita la fila a un cliente del ERP`
6. Merges de `main`: `0236d5b62`, `d4a54bb81` (el que midió `verify`), `6be330319` y `6ad57f8d1` (el del cierre)
7. `docs(sdd): SDD-0597 — registra medición, verify y cierre por comprobación`: solo documentación

## PR / BRANCH

- Rama: `claude/sad-jones-d0695e`.
- [PR #361](https://github.com/SoftAgentes/DTDCARGO/pull/361) en borrador contra `main`. La fusiona el Director General.

## PENDIENTES DE ESTA TAREA

- [ ] Al desplegar a prueba, cuando Sam termine: pedir el enlace con el cliente de la semilla y leerlo en `/correo/`.
- [ ] `status` de la spec: queda en `in-progress` hasta tener lo anterior.

## FUERA DE ALCANCE DETECTADO

- **El mismo patrón de `.ilike` en otros sitios:** correo entrante, invitación y baja firmada. No entran a esta PR: están en la SDD-0600, [PR #363](https://github.com/SoftAgentes/DTDCARGO/pull/363), que reutiliza `email-literal.ts`.
- **No hay e2e que envíe `/entrar`:** el formulario más usado en producción solo se dibuja en `e2e/auth.spec.ts`. Propuesta: subir el spec temporal de esta tarea.
- **`auth.spec.ts:81`, `sin-scroll-horizontal.spec.ts:215` y `company-photo-carousel.spec.ts:93`** fallaron o salieron inestables en el `e2e` de este `verify`. No dependen de esta spec, y no los investigué.
- **Oráculo por tiempo de respuesta** (por lectura, sin medir): un correo con cuenta acuña y llama a Resend; uno sin cuenta, no. Ya existía.
- **Agotar el cupo de un tercero:** cualquiera puede gastar los 5 pedidos por hora de un correo ajeno. Ya existía en silencio; ahora la persona lo ve.
- **«Da igual dónde lo abras»** no es cierto para el enlace de Auth (PKCE). Solo aplica sin Resend, y queda en `entorno-prueba.md`.
- **`RecoveryForm` de Studio** también dice «Revisa tu correo», en condicional. No se revisó si su envío puede fallar en silencio.
- **El plan B no protege de la falla para la que existe:** Auth usa la misma clave de Resend. Propuesta para Sam en la spec, sin decidir: otra clave u otro proveedor SMTP.

## HANDOFF AL DIRECTOR

- **Reporto al Director General** desde el 2026-11-02: Sam le pasó la salida a producción.
- **Medición, `verify` y cierre:** hechos, por comprobación, en «VALIDACIÓN». No se aplicó nada ni se fusionó nada. La cabeza trae `main` en `8b6b3a0e1`.
- **Para fusionar:** su decisión, leyendo el CI de la cabeza. Lo único en rojo de `verify` fue `test` por tiempo, y esas dos pruebas pasan aisladas.
- **Comodines:** en esta PR y SDD, como commit aparte. Aceptado por el Director General.
- **Decisión de Sam sobre Resend y el plan B:** la presenta el Director General. En la spec va marcada como inferida. No se la pregunto por mi lado.
- **Impacto documental:** `entorno-prueba.md` y `setup-portal-auth.md`, actualizados en esta rama. Sin cambios en AGENTS ni en políticas.
- **Conocimiento:** Graphify y Archify no se regeneraron: `knowledge:status` dio NO DISPONIBLE en este worktree. Queda pendiente para la integración.
- **Nota personal `entrar-plan-b-429`:** su texto dice borrarla cuando el plan B esté arreglado. Sigue vigente hasta que esto esté en producción y prueba.
