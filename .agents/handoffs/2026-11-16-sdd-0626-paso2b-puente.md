# Handoff · SDD-0626 · Paso 2b del cable · puente interno de prueba («Opción 3: puente»)

| | |
|---|---|
| Owner | Claude Code, en una sesión lanzada desde la sesión del cable (`local_f13ed801`) |
| Fecha | 2026-11-16 UTC |
| Rama | `sdd/0626-paso2b-puente`, desde `main` `bd873493e` |
| Base | `main` |
| PR | SoftAgentes/DTDCARGO#591 |

**No hay merge ni auto-merge.** La fusión pasa por el portón del DG y la firma Sam.

## OBJETIVO ORIGINAL
Paso 2b de la SDD-0626: probar el webhook del cable (§3.2) con un mensaje real del inbox de prueba. Sam eligió el 15/11/2026 la «Opción 3: puente»: un puente interno que lee por la API de Chatwoot solo la cuenta 2 («DTD Prueba») y la bandeja 11 («Prueba Oficina»), y entrega al web de **prueba** el mismo `message_created` firmado que mandaría Chatwoot 4.19.1. Sin escribir en Chatwoot y sin guardar textos.

## QUÉ SE HIZO
1. **Piezas en Chatwoot**, solo en la cuenta 2:
   - la bandeja 11 «Prueba Oficina» (API, sin bot, sin automatizaciones, sin webhook de canal);
   - el usuario agente id 7, que solo tiene la cuenta 2 y la bandeja 11, con las notificaciones apagadas.
   - No se creó ningún webhook.
2. **Staging:**
   - imagen `prueba-sha-bd873493e…` (main con #580 y #587);
   - las migraciones 0541 y 0544 aplicadas en la base de prueba, con el mismo blob y ledger que producción.
3. **El puente:**
   - `infra/ops/cable-oficina/puente-prueba.mjs` y `puente-prueba.sh`;
   - sus pruebas en `infra/ops/tests/cable-oficina-puente.test.mjs`, contra el código real del ERP;
   - el runbook en `docs/runbooks/oficina-cable.md` §9.
4. **Revisión del DG (APPROVED con observaciones):**
   - O1: gobernanza, con la spec v0.3.2, la allowlist, la fila de §9, el hallazgo 11 de `privacidad.md` y este handoff;
   - O2: el destino es solo `dtd-cargo-staging-web-1`, sin el alias `web`, y el lanzador exige que `chatwoot_interna` no tenga ningún `-web-`;
   - O3: el puerto 3000 es obligatorio y Chatwoot solo puede ser su rails;
   - O6: `docker rm -f`, y `parar` no dice «borrado» si falló;
   - la prueba de que el token y el secreto no salen en el log;
   - O4 y O5 quedan anotados como pendientes en el runbook.

## EVIDENCIA DE LA PRUEBA (16/11/2026, en el VPS: `/srv/ops/evidencias/cable-puente-prueba-20261116T012638Z.txt`)

| Hora UTC | Paso |
|---|---|
| 01:26:51Z | Web de staging recreado con `OFICINA_WEBHOOK_ACTIVO=1` |
| **01:27:10.216Z** | **Cuenta 2 reactivada.** Solo cambió `status`; `updated_at` sigue en 2026-11-08T14:02:48Z |
| 01:27:11Z | Puente arrancado, con cursor inicial 0 |
| 01:27:32.933Z | Mensaje entrante con texto inventado en la bandeja 11 (conv 16, msg 54955) |
| 01:27:33.676Z | El puente lo entrega y el ERP responde `200 guardado` |
| 01:28:18Z | Puente parado y borrado |
| **01:28:32.601Z** | **Cuenta 2 suspendida otra vez** (status=1) |
| 01:28:42Z | Web recreado con el interruptor apagado; smoke por la IP de Cloudflare: 7/7 |
| **01:29:46.696Z** | **Token del usuario 7 rotado** (el viejo da 401); `/etc/dtd-cable/puente-prueba.env` borrado |

**Resultado:**
- `event_inbox` tiene 1 fila: `chatwoot.message_created`, prioridad 2, `payload_ref=chatwoot:conversations/16/messages/54955`, estado `nuevo`;
- no hubo respuesta automática: la conversación tiene 1 mensaje entrante y 0 salientes;
- los logs no traen datos personales: el texto y el nombre del contacto aparecen 0 veces en los logs del web y del puente;
- la cuenta 2 tiene 0 webhooks.

## DECISIONES
- **Puente y no webhook público.** Chatwoot 4.19.1 manda los webhooks de cuenta con todos los eventos de todas las bandejas y bloquea las IP privadas (SafeFetch). La ruta pública de prueba tiene basicauth.
- **La cuenta 2 se reactivó solo durante la prueba.** Se suspendió el 04/11/2026 al cerrar la prueba de la Tanda A. Ahora se cerró igual: suspendida, token rotado y sin webhooks.
- **El 403 del smoke por 127.0.0.1 no lo causa este paso.** Docker reenvía el 443 a Traefik por `chatwoot_edge` desde el 29/10, así que lo que llega por 127.0.0.1 viene de 172.31.0.1, que no está en la lista de IPs. El smoke de las 15:44Z del 15/11 se corrió contra la IP pública y por eso pasaba. Lo revisa el Subdirector Chatwoot.

## NO VERIFICADO
La entrada real del webhook desde fuera: la ruta pública, Traefik/Cloudflare y la firma **emitida por Chatwoot**. Aquí la firma la emite el puente con el mismo algoritmo.

## QUEDA
- Datos inventados en la cuenta 2: contacto 4326, conversación 4855 y mensaje 54955. En staging queda 1 fila de `event_inbox`. Las recetas para borrarlos están en `REVERTIR.txt` del VPS.
- Para volver a usar el puente hace falta un token nuevo.
- Pendientes O4 y O5 (runbook §9).
