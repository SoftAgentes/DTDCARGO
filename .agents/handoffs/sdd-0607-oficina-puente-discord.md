# Handoff — SDD-0607 · Puente de ALFRED en el repositorio y corte de la oficina a Discord

Fecha: 2026-11-05. Task ID: `sdd-0607-oficina-puente-discord`.
Owner / sesión escritora: `claude-oficina-puente-discord` (Worker Claude Code; la misma sesión de la
SDD-0605).

Estado de la tarea: **lista para revisión. Commits locales, sin publicar.** La rama no está en
`origin` y no hay PR.

- **Worktree:** `DTD-worktrees/oficina-puente-discord`, sin `node_modules`.
- **Rama:** `codex/oficina-puente-discord`, desde `main` `243df5c0a`.
- **SDD:** `docs/specs/0607-oficina-puente-discord/spec.md`, estado `proposed`. Reservada con
  `sdd:next --reserve`: rama `codex/sdd-reserve-0607-oficina-puente-discord` y ref
  `refs/dtd/reservations/0607`, las dos solo locales.
- **Permisos:** el encargo llegó de la sesión que coordina el plan de la oficina, no de Sam, y pide
  una PR en borrador. Esta sesión hizo los commits locales y **no publicó**: publicar la rama y
  abrir la PR esperan la autorización de Sam en esta sesión. Nada de merge, VPS, Discord ni
  producción.

## OBJETIVO ORIGINAL

Versionar en el repositorio el puente de ALFRED, que vivía solo en el VPS de la oficina; proponer
dónde vive; subirlo con sus pruebas corriendo en el harness; revisar con ojo crítico el parche a
Discord que dejó la sesión coordinadora; y escribir el runbook del corte de la oficina a Discord
(recepción, puente, prueba de ida y vuelta, apagado de Telegram en el mismo paso y vuelta atrás).

## COMPLETADO

- **El puente en `infra/oficina/dtd-alfred/`,** en tres commits que se leen por separado: la
  versión de Telegram tal como corre, el parche de la sesión coordinadora sin retoques y la
  revisión.
- **Identidad comprobada:** el primer commit es idéntico byte a byte a la copia recibida
  (`bridge.py` sha256 `3266e86c8b0ac072…`). El parche se regeneró desde ese original y da los
  mismos archivos que entregó la sesión coordinadora (`fe3d98915dcb3035…`).
- **Pruebas en el harness:** `scripts/tests/oficina-puente.node.mjs` corre el `unittest` del
  puente, exige un piso de 32 pruebas y no acepta saltos en el CI.
- **Revisión del parche:** nueve hallazgos, cada uno con su prueba. Están en la spec, sección
  «Revisión del parche». Los tres de más peso:
  1. El enmascarado de secretos solo conocía la llave de Telegram: la dirección de un webhook de
     Discord salía tal cual hacia el canal.
  2. Los avisos que estén en cola al cortar se guardaron con el largo de Telegram y Discord no
     los acepta: se habrían reintentado para siempre.
  3. Si un envío fallaba, los siguientes seguían saliendo: un mensaje largo llegaba desordenado.
     Ahora la cola es estricta y respeta el plazo que pide Discord.
- **Runbook:** `docs/runbooks/oficina-corte-discord.md`. Corta primero el puente y después la
  recepción, para probar cada pieza con un mensaje real sin dejar a Sam sin canal.
- **README** del puente y spec SDD-0607.

Decisiones propias, para que quien revise las vea:

- **Ubicación:** `infra/oficina/dtd-alfred/`. Es una propuesta.
- **La cola estricta cambia una conducta que también tenía la versión de Telegram.** Un webhook
  roto frena toda la cola en vez de dejar pasar a los demás avisos. Está escrito en la spec y en
  el README.
- **Destino del webhook:** el runbook propone `#alfred`. Lo decide Sam al crearlo.
- **El runbook no trae los nombres de las opciones de Discord en Hermes** ni el contenido de las
  unidades de systemd: nadie los verificó. Manda leerlos en el paso 0.
- **El runbook trae el ID del servidor y los de los cuatro canales de Oficina.** No son llaves.
  No trae nombres de miembros, la IP del VPS ni ninguna credencial.

## VALIDACIÓN

Sobre el árbol del commit que contiene este documento.

| Comprobación | Resultado |
|---|---|
| `python -I -B -W error -m unittest discover -s infra/oficina/dtd-alfred/tests` | PASÓ: 32 pruebas, Windows, Python 3.14.7 |
| Rojo previo: las pruebas de la revisión contra el parche tal como llegó (`bafb330de`) | 19 fallaron de las 22 que había entonces; las 3 que pasaron son guardas. La prueba 23 se agregó después, con su mutante |
| `python infra/oficina/dtd-alfred/tests/mutantes.py infra/oficina/dtd-alfred` | PASÓ: 35 de 35 mutantes mueren y la base sin mutar pasa. Corrió una vez, unos 40 segundos, **antes** de que llegara la regla de pedir turno para mutantes; no se repitió |
| `node --test scripts/tests/oficina-puente.node.mjs` | PASÓ |
| `pnpm harness:test` completo | NO EJECUTADO en local. Lo lancé y lo corté sin resultado cuando llegó la regla del Director General: una corrida pesada pide turno, y para este cambio bastan las pruebas del script. No quedó ningún proceso. Lo corre el CI |
| `node scripts/build-docs-index.mjs` y `--check` (`pnpm docs:index`, `pnpm docs:check`) | PASÓ: 585 specs |
| `node scripts/check-numbering.mjs` (`pnpm sdd:check`) | PASÓ: «numbering: sin números repetidos» |
| `git diff --check` y diff contra la allowlist | PASÓ |
| Llaves, direcciones de webhook, IP y nombres de miembros en lo escrito | PASÓ: solo aparece la dirección local de Paperclip, que ya estaba en el código |
| Pruebas en Linux con el Python del CI | NO DISPONIBLE en local: Docker estaba apagado. Las corre el CI de la PR |
| `pnpm lint` sobre `scripts/tests/oficina-puente.node.mjs` | NO EJECUTADO: el worktree no tiene `node_modules`. Lo corre el CI |
| Prueba contra Discord real | NO EJECUTADO: fuera del límite del encargo. Es del runbook |
| Comparación de la copia contra el VPS | NO EJECUTADO: fuera del límite del encargo. Es el paso 0 del runbook |
| `pnpm verify` | NO EJECUTADO, no aplica al producto: el diff no toca la aplicación ni migraciones. De sus pasos, solo `harness` lee estos archivos |
| `pnpm knowledge:status` | NO EJECUTADO en este worktree: no tiene el grafo. Ningún archivo tocado es fuente del piloto semántico |

## COMMITS

1. `5c8d0d546` — `chore(oficina)`: el puente tal como corre hoy en el VPS.
2. `14e12b49c` — `chore(sdd)`: stub de la reserva 0607.
3. `bafb330de` — `feat(oficina)`: el parche a Discord de la sesión coordinadora, con sus pruebas y
   el enganche al harness.
4. `6ddf7da0c` — `fix(oficina)`: la revisión del parche.
5. El commit que contiene este documento — `docs(oficina)`: spec, runbook, README y handoff.

## PR / BRANCH

- Rama `codex/oficina-puente-discord`, base `main` `243df5c0a`. **Sin publicar y sin PR.**
- Worktree `DTD-worktrees/oficina-puente-discord`.

## PENDIENTES DE ESTA TAREA

- [ ] **Autorización de Sam para publicar** la rama y abrir la PR en borrador.
- [ ] **CI de la PR:** es la primera corrida en Linux de estas pruebas y del lint del archivo del
      harness.
- [ ] **Que la sesión coordinadora o Sam acepten la cola estricta** y la ubicación.
- [ ] **El índice de specs va a chocar** con las PR #377 (0605), #376 (0604) y la de la 0606: hoy
      las lista como huecos. Se regenera con `pnpm docs:index` después de traer `main`.

## FUERA DE ALCANCE DETECTADO

No se tocó nada de esto.

1. **La unidad de systemd del puente no está en ningún lado fuera del VPS.** Sin ella el runbook
   no puede dar el cambio exacto de la credencial. Conviene versionarla, sin llaves.
2. **Ninguna herramienta del puente le dice a Sam cuántos avisos hay sin entregar.** Con la cola
   estricta importa más. Sería un dato más en `estado_conexion`.
3. **Los avisos van al canal y no al hilo de cada pedido.** El plan dice que cada pedido abre su
   hilo; un webhook escribe en un hilo solo si se le pasa el identificador.
4. **Mientras el puente envía una tanda, las llamadas de la recepción esperan,** porque comparten
   candado. Ya era así con Telegram. Con Discord el envío se corta antes, por el límite de
   envíos.
5. **`emit` no reemplaza un aviso ya encolado con la misma clave.** Si el puente se cae entre
   encolar y marcar un comentario como visto, justo en el corte, ese aviso puede salir con
   trozos mezclados de los dos largos. Es un caso de borde; cortar con la cola vacía lo evita.
6. **El inventario de terceros** (`docs/legal/privacidad/inventario-terceros.md`) no menciona el
   uso de Discord por la oficina. La SDD-0606 da de alta a Discord por los avisos del Studio; si
   también cubre este uso lo decide esa SDD.
7. **`docs/organizacion/` todavía describe el canal como Telegram.** Lo cambia la SDD-0605
   (PR #377); después del corte habrá que decir que ya se ejecutó.
8. **El dueño del servidor de Discord no es Sam** y puede ver los canales privados y gestionar
   sus webhooks. Sam lo sabe; queda escrito en el runbook como razón para no escribir ahí datos
   de clientes ni llaves.

## HANDOFF AL DIRECTOR

- **Orden de integración** que comunicó la sesión coordinadora, corregido tras hablar con el
  Director General, que serializa las fusiones: #376, después #377 y al final la 0606. Esta rama
  no depende de ninguna de las tres y ninguna depende de ella; su turno lo fija el Director
  General.
- **Corridas pesadas:** antes de `verify`, Vitest completo, Docker o mutantes se le pide turno al
  Director General. Para esta rama bastan las pruebas del puente y los checks de documentos.
- **Carpetas de `infra/`:** esta rama solo crea `infra/oficina/`. No toca `infra/dtd-cargo`,
  `infra/chatwoot` ni `infra/ops`.
- **Siguiente acción:** autorización de Sam para publicar; después, push y PR en borrador.
- **Revisión sugerida:** el commit `6ddf7da0c` contra `bafb330de`, sobre todo `flush`, y el paso 3
  del runbook.
- **Sin migraciones, sin código de producto, sin textos públicos, sin variables.** No se tocó el
  VPS de la oficina, Discord, Paperclip ni producción.
- **Fusionar esta PR no instala nada.** El corte es otro paso, con el runbook y la autorización
  de Sam nombrando el VPS.
- **Pendiente de otra tarea, anotado por la sesión coordinadora:** alinear
  `docs/marketing/agente-seo-noticias.md` con el esquema mixto cuando entre la #376. Va en un
  cambio aparte, no en esta rama ni en la #377.
- **Reserva 0607:** las dos refs locales se pueden borrar cuando la spec esté en `main`.
- **Ownership:** claim liberado al cerrar esta sesión de escritura.
