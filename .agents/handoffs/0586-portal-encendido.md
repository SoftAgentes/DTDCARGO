# Handoff · SDD-0586 paso 10.5 — guion de encendido de `chatwoot_portal`, preparado y sin correr

- **Owner:** Claude Worker «10.5», en la sesión iniciada por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`), que coordina con el Director General.
- **Claim:** `worker-10.5-encendido`.
- **Ruta y rama:** `DTD-worktrees/0586-portal-encendido`, rama `codex/0586-portal-encendido`, desde `main` en `efd7e70f6` (la #434 fusionada).
- **Pedido:** el DG, comunicado por el Subdirector el 2026-11-08. Sam le dio un OK amplio y el DG fijó el orden: publicar la web, encender `chatwoot_portal` (prueba con punta a punta y después producción) y la 0518. Esto es el guion del paso 2, **sin encender nada**.

## Lo hecho

`docs/runbooks/chatwoot-portal-encendido.md`:

- condiciones previas (0519 y 0520 aplicadas; **T1 a T4 todavía no están en `main`**; la vía del atascado; la web publicada);
- qué hace falta por entorno;
- los comandos exactos (corte, encender y apagar el flag por tenant, comprobarlo, y conteos sin PII);
- la punta a punta en prueba, en 13 filas: ida, vuelta, adjunto, destrabar, salud y apagar o encender;
- producción, vuelta atrás y evidencia;
- la lista de lo que queda **⛔ FUERA DEL OK DE HOY**.

Hechos medidos en el código para escribirlo:

- el flag lo cambia solo un platform admin (policy `feature_flags_platform_admin_update`, 0355);
- `listFeatureFlags` no tiene caché;
- el crontab corre `chatwoot-reintentos` cada 5 min (`infra/dtd-cargo/cron/crontab:26`);
- prueba usa la cuenta 2 del mismo Chatwoot (`docs/runbooks/chatwoot-bandeja.md`);
- Conversaciones de Studio todavía no tiene la puerta de solo lectura: no hay ningún `chatwoot_portal` en `app/studio/(app)/conversaciones`.

## Decisiones y riesgos para el DG (I)

- **Encender antes de la 1c (resuelto por el DG el 2026-11-08):** en producción no se enciende hasta tener la 1c-1 (Studio en solo lectura) fusionada y publicada. En prueba, la punta a punta va antes, respondiendo solo desde la Bandeja. La 1c-2, la 1c-3 y la 1c-4 no son condición. El guion lo pone en §0 y en §4.
- **El corte sin P4 en producción:** deja fuera los 24 hilos y 73 mensajes que Sam eligió cargar. Es una decisión con su OK, y además es escribir en la base.

## Revisión del 2026-11-08 sobre `4285a89ea` (CHANGES_REQUESTED, comunicada por el Subdirector)

Corregido en un solo commit de docs:

1. **Producción espera a la 1c-1:** una fila en §0, el texto de «Lo que la 10.5 todavía no hace» y la condición 3 de §4.
2. **Encender el flag sí está cubierto por el OK de hoy.** Se cita en la cabecera, en §3 paso 3, en §4 paso 2 y en §6.
   - A eso de las 04:15Z, el DG preguntó «¿para qué es el OK?» en un selector con cuatro opciones: «Encender el portal», «Publicar la web», «Aplicar la 0518» y «Solo enterado».
   - Sam no marcó ninguna. Respondió con texto libre: «Tú decides cuál va primero. O decide si las tres van al mismo tiempo o cuál va primero, o aplica las tres.»
   - El DG lo leyó como OK para las tres y fijó el orden: la web, el portal y la 0518.
   - En `a547e6f7c` decía que Sam había marcado una de las opciones. Era falso, y se corrigió en la segunda y la tercera revisión. El error vino en el mensaje que se le pasó al Worker.
   - El guion usa el panel, que escribe por D1 (`executeD1Operation`, `feature_flag.toggle`) y deja auditoría. **En producción, el flag se enciende y se apaga solo desde el panel. El `update` por SQL en producción queda ⛔ y pide su propio OK nominal de Sam.** En prueba, el `update` sigue como alternativa, marcado como escritura sin auditoría.
3. **El smoke en producción con un cliente real** (§4, paso 3) queda ⛔ fuera del OK, con sus pantallas y roles, también en §6.
4. **Paso 9:** esperar más de 15 min, porque `chatwoot_portal_rezagados` exige `sent_at <= now() - 15 min` (0519). El cron le manda el aviso de rezago a los admins del tenant de prueba.
5. **§3:** se escribe que `entorno-prueba.md` §2.1 está desactualizado (IPv6). La ruta del webhook queda en una sola versión, la de `chatwoot-bandeja.md`: «sin la clave y con la misma lista de IP».
6. **El panel dentro de prueba:** no hace falta, porque el agente responde en la cuenta 2. `CHATWOOT_FRAME_ANCESTORS` recrea `rails` y `docker restart` no la toma.
7. Los SQL del corte, del flag y del atascado dicen **escritura**. `psql -U postgres` es el superusuario, no `service_role`.
8. **El corte:** primero se lee, y el `do update` lleva `where corte is null`, con `returning`.
9. **El curl del `source_id`:** ahora es `docker exec` dentro de la web, con `fetch` y el token del entorno del contenedor. No queda a la vista en `ps`.
10. **Apagar:** el flag lo miran `enviarPortalPendientes` y `chatwoot_portal_tomar`, no `pedirEnvioPortal`.
11. **La web:** publicada en los dos entornos desde ~04:20Z (cabecera y §0).
12. **Los conteos en producción** van con su propio OK nominal, que nombre las consultas de §2. El de encender no los cubre (§2 y §4).

## Segunda revisión, sobre `a547e6f7c` (cambios pedidos, comunicada por el Subdirector)

- **B2, la cita del OK:** reescrita con el selector y sus cuatro opciones, la respuesta libre de Sam y la lectura del DG (cabecera y §6).
- La #440 se nombra junto a su rama (§0 y §4).
- Los dos `update`, el del flag y el del atascado, llevan `returning` y dicen cuántas filas tienen que devolver.
- **Escrituras en la base, según el DG:** las de prueba (el corte y el atascado forzado) entran en el OK de encender en prueba. Las de producción, no.
- **El cron de prueba** se dispara desde su contenedor, con la cabecera por stdin (`printf` interno de `sh` y `curl -H @-`). La clave no queda en el host ni en `ps`. El nombre `dtd-cargo-staging-cron-1` sale del patrón de compose y se confirma con `docker ps` (I).
- **Recrear `rails`**, si algún día hace falta: `cd /srv/chatwoot && docker compose -f compose.yml up -d --no-deps --force-recreate rails`. Nunca `compose up` a secas.

## Tercera revisión, sobre `c62865d01` (cambios pedidos, comunicada por el Subdirector)

- **La cita del OK, en todas partes:** §3 paso 3 y §4 paso 2 todavía nombraban, entre paréntesis, la primera opción del selector como si Sam la hubiera elegido. Ahora llevan la frase literal de Sam y dicen que no marcó ninguna opción. Con `git grep` sobre el nombre de esa opción quedan solo las líneas que listan las cuatro opciones del selector.
- **El flag en producción, decisión del DG:** se enciende y se apaga **solo desde el panel**. El `update` por SQL en producción queda ⛔ y pide su propio OK nominal de Sam. En prueba, el SQL sigue como alternativa. Dice lo mismo en la cabecera, en §2, en §4 paso 2, en §5 y en §6.
- **La cabecera** quedó entera como blockquote.
- **La 1c-1b es condición de producción** (decisión del DG): en un hilo borrado, `setStatusAction` tiene que dar «no encontrada» y no escribir. Está en la cabecera, en §0, en §4 y en §6. Sale en su propia rama y PR cuando la #440 esté en `main`.

## FUERA DE ALCANCE DETECTADO

- La PR de T1 a T4 la tiene la hija del correo (no se duplica).
- La PR 2 (P4, la carga) no está escrita.
- La 1c-1 está en su PR, la #440 (rama `codex/0586-e10-5-1c-solo-lectura`). La 1c-1b (el hilo borrado y el enlace a la Bandeja con permiso) arranca cuando la #440 esté en `main`. La 1c-2, la 1c-3 y la 1c-4 no están escritas.
- **`docs/runbooks/entorno-prueba.md` §2.1 está desactualizado.** Dice que el 403 no se puede probar desde el VPS. El 2026-11-08, `curl` por DNS salió por IPv6 y dio 403 en todo, porque esa dirección no está en la lista. Corregirlo es otra PR de docs.

## Estado

En curso: PR de docs en borrador. Se corre con los OK nominales que el guion marca.
