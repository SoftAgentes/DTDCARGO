# Handoff — SDD-0582 · Preparación de la tanda A de Chatwoot

- **Owner / sesión:** Subdirector, Claude Opus 5.5, `eeeb0433-bf95-4b6b-8cdc-d201699e5f95`.
- **Ruta y rama:** `.claude/worktrees/0582-e6-entrada-leads-ef62df`, `claude/0582-e6-entrada-leads-ef62df` (punta de la pila, #364).
- **Encargo:** Director General, 2026-11-03: preparar la tanda A sin corridas pesadas y sin tocar `main`.
- **Autorización registrada a su nombre:** Sam, ~20:10Z, en el chat del Director General, a «¿Das el mandato para terminar las fases 2, 3 y 4 sin detenerme?»: «Doy el mandato». Texto íntegro en su nota `mandato-fases-2-3-4.md`. No cubre claves y PIN, borrado físico, gastos, Meta, TikTok y WhatsApp real, capacitación, revisión legal, E7 ni E8.

## Qué falta de Chatwoot vivo (medido en el VPS, solo lectura, 2026-11-03 ~20:16Z)

| Pieza | Estado | Qué falta |
|---|---|---|
| Dashboard App «Ficha DTD» (2.4) | No está: 0 filas | Registrarla después de publicar. Antes, la pestaña abriría una ruta que no existe en producción |
| Equipos (2.7) | **Hecho el 2026-11-03:** `clientes` (1) y `leads` (2) | Nada. `CHATWOOT_TEAM_CLIENTES_ID` = 1; el de Leads, en el corte |
| Bandejas (2.7) | 1 «WhatsApp · prueba 0582», 2 «Clientes», 3 «Correo · pruebas», 4 «DTD Cargo», 5 «dtdcargo.ve» | Nada. Leads llega en el corte |
| `zz_dtd_revocar_sesiones.rb` (2.7) | No está en `rails/`; `DTD_CHATWOOT_SERVICIO_ID` sin valor; 0 líneas de arranque | Prueba local, copiarlo, dos piezas en el compose vivo y recrear `rails` |
| `DASHBOARD_SCRIPTS` (2.7) | **Hecho el 2026-11-03:** igual al repo por sha256 `7c1d7ff0a95d…` | Probar el cierre de sesión cuando Studio esté publicado. Solo actúa cuando Studio lo llame |
| Regla de Traefik contra «olvidé mi clave» (2.7) | No está en el compose vivo ni en `dynamic/`, y tampoco en el compose del repo | Escribirla como etiquetas de `rails`; recrearlo aplica las dos cosas juntas |
| Webhook de cuenta | 0 filas | Al encender: prueba primero, y producción después de publicar |
| Variables de `web` | 0 de `CHATWOOT_*` en producción y en prueba | Van después de la 0505 |

**Trampa del runbook, ya corregida:** decía copiar el `compose.yml` de la rama. El del VPS difiere (`2c16fefcdd669605` frente a `70f1e5e42c31a22b`) y tiene `zz_dtd_proteccion_register.rb` y los correos, que están en PR de la tanda C. Copiarlo habría quitado la protección de `/register` del WhatsApp real.

## Lo que queda listo en esta rama

- **Guion de secretos:** `infra/chatwoot/pegar-secretos-web.sh`, con su prueba `infra/chatwoot/pruebas/prueba-pegar-secretos-web.sh`. No se ha copiado al VPS ni se ha corrido allá.
- **Lista de variables:** `docs/runbooks/chatwoot-bandeja.md`, «Variables del `.env` de `web`».
- **Punta:** ya contiene `e714aedb2` de #329 y los 5 commits de #343, con merge normal y sin conflictos. Solo traen documentos e `infra/hostinger`.

## Validación

| Comprobación | Resultado |
|---|---|
| `prueba-pegar-secretos-web.sh`, con `docker` falso y `.env` temporal | PASÓ, 14 de 14 |
| Mutantes a mano del guion | Ver el mensaje del commit |
| El guion contra el VPS real | NO EJECUTADO |
| `docs:check`, `sdd:check` | PASÓ |
| `prueba-revocar-sesiones.sh` (Docker), 2026-11-03 | PASÓ, 0 fallas, con control sin inicializador |
| `prueba-cuenta-prueba.sh` (Docker), 2026-11-03 | PASÓ, 0 fallas, con control de correo. La primera corrida falló por la sonda: el adaptador en línea no admite diferidos. La entrega se intercepta: no prueba la red, el borde ni la firma contra Studio |
| `pnpm verify` en la punta | NO EJECUTADO: lo corre el Director General |

## PENDIENTES DE ESTA TAREA

- **Autorización a mi nombre:** Sam, 2026-11-03, en esta sesión, a «¿Tu mandato me cubre para crear equipos, script del panel y cuenta de prueba?»: «Sí, te cubre».
- **Hecho con ella:** equipos y `DASHBOARD_SCRIPTS`, sin reinicios ni canales. Evidencia, estado anterior y `marcha-atras.rb` en `/srv/ops/evidencias/chatwoot-e2-config-20261103T213453Z`. El panel carga sin errores de consola; el script aparece en `/app/login`. Las 15 conversaciones sin equipo siguen igual.
- **Cuenta y app de prueba: hechas el 2026-11-03,** ensayadas antes en local. Cuenta 2, usuarios 4 y 5, bandejas 6 (API) y 7 (correo), equipos 3 y 4. Los tokens están en `secretos/platform-app-prueba.env`, 600. Evidencia en `/srv/ops/evidencias/chatwoot-cuenta-prueba-20261103T224846Z`. Con el token real, 401 sobre la cuenta 1 y su usuario, y 200 sobre la 2. **Sin webhook todavía.** Al terminar la prueba: borrar webhook, suspender cuenta y revocar token, sin borrar la cuenta.
- **Inicializador y regla de Traefik:** sin instalar en el VPS. `prueba-revocar-sesiones.sh` ya dio 0 fallas el 2026-11-03. La regla está escrita en el compose del repo y `prueba-regla-clave.sh` dio 0 fallas el mismo día, con Rails real, control de correo y control sin la regla. En el VPS se agregan a mano, sin copiar el compose. Recrear `rails` lleva aviso previo al Director General.
- Registrar la hora de la #352 (`8b6b3a0e1`, 2026-11-03T20:01:19Z) en la SDD-0593 con el próximo cambio de esa zona.
- **Prueba con la tanda A, 2026-11-04:** imagen, migraciones, variables y secretos cargados, webhook creado y ruta abierta en el borde por el Director General. Evidencia en `/srv/ops/evidencias/chatwoot-e2e-prueba/`. La primera corrida de punta a punta dio 0 fallas sobre `5fbb25045`.
- **El ensayo destapó avisos repetidos (E2-D55):** cada reintento encolaba otro. El Director General ordenó corregirlo antes de producción: «corrígelo ahora». Sin tocar migraciones.
- **`verificar-aislamiento.sh` acepta la cuenta propia de Chatwoot:** con el `.env.example` de la rama daba FALLÓ en esas variables. La copia de `/srv/ops` en el VPS sigue siendo la vieja, y `/srv/dtd-cargo-staging/.env.example` también; copiar los dos juntos.
- **Cron en prueba, sin instalar:** `dtd-cargo-cron:local` es la misma imagen en los dos proyectos. Las rutas se corren a mano desde el contenedor.
- **Producción, 2026-11-04:** las seis migraciones aplicadas por el Director General, 04:31Z a 04:33Z; cierre del runbook §6 en las SDD 0585, 0586 y 0587. Variables sin secreto en `/srv/dtd-cargo/.env`, sin recrear `web`: evidencia `/srv/ops/evidencias/produccion-chatwoot-vars-20261104T043643Z.txt`. Faltan los 3 secretos y el webhook, de Sam, en la ventana de publicar, y `rails` con su aviso de hora y bandejas.
- **Prueba cerrada, 2026-11-04 ~04:47Z:** el Director General cerró la ruta del borde; yo borré el webhook, suspendí la cuenta 2, revoqué el token de su app, apagué `chatwoot_inbox` y borré el vínculo del agente 5. La cuenta no se borró. Evidencia: `/srv/ops/evidencias/chatwoot-cierre-prueba-20261104T044525Z.txt`. El `.env` de prueba conserva las variables y los 3 secretos, ya sin efecto: el token de la app da 401, el de servicio da 401 con la cuenta suspendida, y el webhook no existe. Para repetir la prueba hace falta reactivar la cuenta y crear otro token, webhook y ruta.
- **Clave de la puerta de prueba:** se imprimió en esta sesión. Su rotación espera la respuesta de Sam; la lleva el Director General.

## FUERA DE ALCANCE DETECTADO

- **«Quién contesta el chat» en una tarjeta sin ficha:** dice «Sin conversación en Chatwoot ligada a esta ficha» aunque la tarjeta nació de una conversación, porque ese cruce va por `client_id` (`tarjeta-actions.ts`). Parece conducta de diseño para un lead sin ficha; no leí la spec de ese panel. El Director General pidió declararlo aquí.
- **Otros textos «solo lectura» del CRM, sin tocar:** `KommoClient.tsx` (nota bajo la lista de Asesor y el comentario de cabecera) y `RecoveryTab.tsx` dicen «Datos espejados · solo lectura» o que la pantalla no modifica nada en Kommo, junto a controles que mueven etapa. No los medí contra lo que hacen esas pestañas. El encargo fue solo el encabezado.
- **Un webhook sobre la cuenta 1 hacia prueba quedó descartado por el Director General,** porque copiaría a prueba datos de clientes. Sam decidió, en su chat, «Probar WhatsApp al publicar»: segunda cuenta en prueba y lo de WhatsApp real en producción justo después de publicar. Detalle en `docs/runbooks/chatwoot-bandeja.md`, «Prueba no se conecta a la cuenta real». Leído en el código de la imagen; no ejecutado.

## Impacto documental

`docs/runbooks/chatwoot-bandeja.md` y `docs/runbooks/chatwoot-agentes.md`. Graphify y Archify: los revisa el Director desde `main`.
