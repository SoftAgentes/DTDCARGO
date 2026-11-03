# Handoff — SDD-0582 · Preparación de la tanda A de Chatwoot

- **Owner / sesión:** Subdirector, Claude Opus 5.5, `eeeb0433-bf95-4b6b-8cdc-d201699e5f95`.
- **Ruta y rama:** `.claude/worktrees/0582-e6-entrada-leads-ef62df`, `claude/0582-e6-entrada-leads-ef62df` (punta de la pila, #364).
- **Encargo:** Director General, 2026-11-03: preparar la tanda A sin corridas pesadas y sin tocar `main`.
- **Autorización registrada a su nombre:** Sam, ~20:10Z, en el chat del Director General, a «¿Das el mandato para terminar las fases 2, 3 y 4 sin detenerme?»: «Doy el mandato». Texto íntegro en su nota `mandato-fases-2-3-4.md`. No cubre claves y PIN, borrado físico, gastos, Meta, TikTok y WhatsApp real, capacitación, revisión legal, E7 ni E8.

## Qué falta de Chatwoot vivo (medido en el VPS, solo lectura, 2026-11-03 ~20:16Z)

| Pieza | Estado | Qué falta |
|---|---|---|
| Dashboard App «Ficha DTD» (2.4) | No está: 0 filas | Registrarla después de publicar. Antes, la pestaña abriría una ruta que no existe en producción |
| Equipos (2.7) | La cuenta no tiene ninguno | Crear «Clientes» y «Leads». De ahí sale `CHATWOOT_TEAM_CLIENTES_ID` |
| Bandejas (2.7) | 1 «WhatsApp · prueba 0582», 2 «Clientes», 3 «Correo · pruebas», 4 «DTD Cargo», 5 «dtdcargo.ve» | Nada. Leads llega en el corte |
| `zz_dtd_revocar_sesiones.rb` (2.7) | No está en `rails/`; `DTD_CHATWOOT_SERVICIO_ID` sin valor; 0 líneas de arranque | Prueba local, copiarlo, dos piezas en el compose vivo y recrear `rails` |
| `DASHBOARD_SCRIPTS` (2.7) | Vacío | Cargar `infra/chatwoot/panel/dashboard-scripts.html`. Solo actúa cuando Studio lo llame |
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
| `prueba-revocar-sesiones.sh` (Docker) | NO EJECUTADO: corrida pesada, pide turno |
| `pnpm verify` en la punta | NO EJECUTADO: lo corre el Director General |

## PENDIENTES DE ESTA TAREA

- **Escribir en Chatwoot vivo:** equipos, `DASHBOARD_SCRIPTS`, inicializador y regla de Traefik. Nada de esto está hecho. Falta que Sam confirme que su mandato también me cubre a mí. Reiniciar `rails` lleva aviso previo al Director General.
- Registrar la hora de la #352 (`8b6b3a0e1`, 2026-11-03T20:01:19Z) en la SDD-0593 con el próximo cambio de esa zona.
- Traer `main` a la punta una sola vez, al abrirse el turno de la tanda A.

## FUERA DE ALCANCE DETECTADO

- **Un webhook sobre la cuenta 1 hacia prueba quedó descartado por el Director General,** porque copiaría a prueba datos de clientes. La alternativa medida, una segunda cuenta con su Platform App, está en `docs/runbooks/chatwoot-bandeja.md`, «Prueba no se conecta a la cuenta real», con lo que cubre y lo que no. Leída en el código de la imagen; no ejecutada.

## Impacto documental

`docs/runbooks/chatwoot-bandeja.md` y `docs/runbooks/chatwoot-agentes.md`. Graphify y Archify: los revisa el Director desde `main`.
