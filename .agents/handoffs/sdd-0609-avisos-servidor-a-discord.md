# Handoff — SDD-0609 · Avisos del servidor: de Telegram a Discord

Fecha: 2026-11-05. Task ID: `sdd-0609-avisos-servidor-a-discord`.
Owner / sesión escritora: `local_d3ee839a-avisos-servidor` (Worker Claude Code). La inició el Subdirector `local_61442abe-3b66-423e-9af4-8008d5457aa3` («SEO, GEO y AEO»), que coordina el corte a Discord y no programa producto.

Estado: **rama publicada y PR en borrador. No se fusiona ni se instala hasta que el Director General lo decida.** Fusionar a `main` despliega a producción y la publicación de la web está congelada.

- **Worktree:** `.claude/worktrees/angry-wing-89de72`.
- **Rama:** `claude/angry-wing-89de72`, desde `fff7249fc`.
- **SDD:** `docs/specs/0609-avisos-servidor-a-discord/spec.md`, `in-progress`. Reservada con `next-number.mjs --reserve … --number 0609`: rama `codex/sdd-reserve-0609-avisos-servidor-a-discord` y ref `refs/dtd/reservations/0609`, **sin publicar**. La PR lleva la spec. 0603–0608 ya estaban tomados.

## OBJETIVO ORIGINAL

Tercera pieza del corte a Discord que decidió Sam el 2026-11-05 (corte directo): los avisos del servidor de producción.

1. `publicar-web.sh` avisa a `#publicaciones` por webhook:
   - lo mínimo, sin menciones, `?wait=true` y User-Agent DiscordBot;
   - respeta los 429 y recorta a 2.000;
   - la dirección nunca aparece en logs y vive en una credencial del servidor;
   - sin doble envío: si falta Discord, falla visible y la publicación sigue.
2. Uptime Kuma: documentar cómo apuntar su notificación nativa a `#salud` y retirar Telegram de la carpeta.
3. Runbook del corte y handoff.

## COMPLETADO

- `infra/ops/web/aviso-discord.sh` (nuevo, D1 y D2 de la spec):
  - **Dirección:** validada entera, con la forma de la 0606. Llega a curl por stdin, curl corre con stderr a `/dev/null` y ninguna salida la muestra.
  - **Envío:** `allowed_mentions.parse = []` y `flags: 4`. `?wait=true`, y entregado solo si vuelve el id.
  - **429:** reintenta con `Retry-After` hasta 3 veces si la espera es de 10 s o menos.
  - **Recorte:** a 2.000 bytes sin partir UTF-8.
  - **JSON:** armado sin `jq`.
  - **Modos:** `--estado` y `--probar`.
  - **Códigos:** 0, 2, 3, 4, 5 y 64.
- `infra/ops/web/publicar-web.sh`:
  - Sin Telegram, ni variables ni caída a Telegram.
  - `avisar()` siempre devuelve 0: `congelar` y `descongelar` ya no terminan con el código del envío.
  - `avisar_una_vez` recuerda el aviso solo si salió (D4).
  - `estado` muestra `Discord: configurado | SIN CONFIGURAR | NO VÁLIDO | SIN INSTALAR`.
- Pruebas:
  - `infra/ops/tests/prueba-aviso-discord.sh`, nueva, sin red. Registrada en `infra/ops/tests/pruebas-linux.sh`.
  - `prueba-publicar-web.sh` adaptada: el doble de curl entiende el webhook y hay una sección nueva «avisos sin Discord».
- Uptime Kuma:
  - `infra/ops/uptime-kuma/README.md` (nuevo), con el paso manual de Sam hacia `#salud`.
  - Comentario de `compose.yml` y `infra/ops/README.md` actualizados.
- Runbooks:
  - `docs/runbooks/avisos-servidor-discord.md` (nuevo).
  - Referencias de Telegram en `publicacion-automatica-web.md` actualizadas.
- `telegram-webhook.sh` **no aplica** (D6): es el webhook entrante del bot de la app, no un aviso del servidor.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `bash infra/ops/tests/prueba-aviso-discord.sh` (Git Bash) | **PASÓ**: 39 PASÓ · 0 FALLÓ. Cubre configuración, 10 direcciones malas, envío, JSON, recorte en todas las alineaciones UTF-8, 429, 4xx, 5xx, errores de curl y que la llave no sale |
| `bash infra/ops/tests/prueba-publicar-web.sh` | **NO DISPONIBLE en local.** En Git Bash `install -d -m 700` no puede cambiar permisos y el script sale 4 en `cargar_config`: la línea 132 en `main`, la 135 aquí, igual en los dos lados y antes de cualquier aviso. Los 197 FALLÓ de esa corrida son todos `rc=4` del entorno, no del cambio. Corre en el CI Linux (`quality.yml` → `pruebas-linux.sh`) o en Docker con turno |
| `vitest run scripts/__tests__/ci-workflow-contract.test.mjs` | **PASÓ**: 48/48. La prueba nueva quedó bien clasificada |
| `node scripts/build-docs-index.mjs --check` | **PASÓ**, con el índice regenerado |
| `node scripts/check-numbering.mjs` | **PASÓ**: sin números repetidos; solo los choques históricos conocidos |
| `bash -n` de los scripts y `git diff --check` | **PASÓ** |
| Mutantes de `prueba-aviso-discord.sh --mutantes` (19) y los 3 nuevos de `prueba-publicar-web.sh --mutantes` | **NO EJECUTADO.** Pedido de turno abajo |
| `pnpm verify` | **NO EJECUTADO.** Cambio de scripts de ops y docs, sin código de la app. Corrida pesada: solo con turno del Director General |
| `pnpm knowledge:status` | **NO DISPONIBLE**: «Respuesta inválida del adaptador Graphify» en este worktree |

### Pedido de turno para el Director General (lo pasa el Subdirector)

1. **`prueba-publicar-web.sh` en Linux.**
   - Comando: `docker run --rm -v "$PWD":/repo -w /repo node:24 bash infra/ops/tests/prueba-publicar-web.sh`.
   - Duración: unos 3–6 min en Docker.
   - Basta el CI de la PR si «Pruebas bash de operaciones» corre en verde.
2. **Mutantes de `aviso-discord.sh`.**
   - Comando: `bash infra/ops/tests/prueba-aviso-discord.sh --mutantes`.
   - Son 19 mutantes y el control rojo. Cada vuelta tarda ~70 s en Git Bash: ~25 min, o unos 5 min en Linux.
3. **Mutantes nuevos de `publicar-web.sh`, solo en Linux.**
   - Comando: `MUTANTES_SOLO="aviso que no sale|recuerda el aviso|anota la dirección" bash infra/ops/tests/prueba-publicar-web.sh --mutantes`.
   - Son 3 mutantes y el control: unos 4 × la prueba, ~15–20 min en Docker.

## COMMITS

- `6f3902cfb` chore(sdd): reserva SDD-0609
- `b81d05b46` docs(SDD-0609): spec
- `1192a7e3d` feat(ops): aviso-discord.sh y su prueba
- `f69d520b4` feat(ops): publicar-web.sh avisa por Discord, corte directo
- `f4416ed97` docs(ops): runbook del corte y Uptime Kuma hacia `#salud`
- (este handoff)

## PR / BRANCH

`claude/angry-wing-89de72` → `main`, en borrador. Texto de la PR: el cuerpo de `gh pr create` en esta sesión. Resumen: este handoff, VALIDACIÓN y «Qué le toca a Sam».

## QUÉ LE TOCA A SAM

1. **En Discord:** crear dos webhooks. El de `#publicaciones` se llama `Servidor · publicaciones` y el de `#salud`, `Uptime Kuma`. No pegues las direcciones en ningún chat.
2. **En Uptime Kuma:** notificación Discord hacia `#salud`.
   - Prefijo vacío, aplicada a todos los monitores.
   - Botón Probar.
   - Desmarcar Telegram en todos, incluidos los de Chatwoot.
   - Guía: `infra/ops/uptime-kuma/README.md`. Puede hacerse ya, sin esperar la PR.
3. **En el VPS, después del merge y con el OK del Director General:**
   - Sam pega la dirección de `#publicaciones` en la ventana tmux que abre la sesión de Contabo (runbook § 2).
   - La sesión de Contabo instala los dos scripts (runbook § 3).
   - Prueba con `aviso-discord.sh --probar` (runbook § 4). **No** con `congelar`/`descongelar`, porque la publicación está congelada.
4. Confirmar que ve el mensaje de prueba en los dos canales.

## PENDIENTES DE ESTA TAREA

- La prueba de publicación en Linux y los mutantes (pedido de turno arriba).
- Para pasar la SDD a `done`: instalación en el VPS, ida y vuelta de Sam en `#publicaciones` y `#salud`, y Kuma configurado.

## FUERA DE ALCANCE DETECTADO

- `docs/runbooks/chatwoot-vigilancia.md` (SDD-0583) dice «Aviso: Telegram» en sus monitores de Kuma. Cuando Sam aplique la notificación de Discord a todos los monitores, esa tabla queda vieja. Es del Subdirector de Chatwoot.
- `infra/ops/web/telegram-webhook.sh` y la línea de `corte-paso2.sh` que lo usa: se retiran con el bot de Telegram de la app (SDD-0606 o sucesora).
- `docs/runbooks/setup-telegram-bot.md` sigue describiendo el bot de la app (SDD-0606).

## HANDOFF AL DIRECTOR

Solo scripts de ops y docs: no toca código de la app, migraciones ni la base. El merge despliega la imagen, pero `publicar-web.sh` corre en el VPS desde `/srv/ops/web/`. **Nada de esto cambia en el servidor hasta que la sesión de Contabo lo instale.** Orden recomendado: llave primero, después `aviso-discord.sh`, por último `publicar-web.sh`.

Impacto documental:

- Spec, runbook nuevo, README de Kuma, `infra/ops/README.md` y `publicacion-automatica-web.md` actualizados.
- Graphify y Archify no se regeneraron: `knowledge:status` NO DISPONIBLE en el worktree.
