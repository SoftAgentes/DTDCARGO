# Handoff — SDD-0608 · Consulta de clientes desde Discord (`/cliente`)

- **Owner:** Worker `local_discord_consulta_clientes` (sesión Claude iniciada por la sesión «SEO, GEO y AEO», `local_61442abe-3b66-423e-9af4-8008d5457aa3`).
- **Ruta:** `.claude/worktrees/discord-consulta-clientes-c50c23` · **Rama:** `claude/discord-consulta-clientes-c50c23` · **Base:** `origin/main` `fff7249fc` (+ stub de la reserva).
- **SDD:** [0608](../../docs/specs/0608-discord-consulta-clientes/spec.md), reservada con `sdd:next --reserve` (refs locales `codex/sdd-reserve-0608-discord-consulta-clientes` y `refs/dtd/reservations/0608`). **Migración:** 0516 (0514 y 0515 son de la SDD-0606).
- **Fecha:** 2026-11-05.

## OBJETIVO ORIGINAL

Especificar y construir `/cliente` en Discord: el equipo de Operación consulta un cliente por nombre y recibe, en privado, nombre, código (Shipping Mark) y enlace a su ficha del Studio; nada de facturas, montos, contacto, direcciones ni envíos. Firma Ed25519, PING, sólo el servidor de DTD Cargo, enlace de usuario de la SDD-0606 con membresía activa y permiso de clientes, comodines escapados, tope de 10, registro de cada consulta y límite por minuto. Revisión de privacidad e inventario de terceros. Pruebas con rojo causal. Sin fusionar, sin aplicar migraciones, sin tocar producción ni Discord.

## COMPLETADO

- Spec con allowlist exacta, decisiones D1–D8 y criterios de aceptación.
- **D1:** aplicación de Discord propia del Studio, no ALFRED (una URL de interacciones por aplicación; llaves aisladas).
- **D7:** rama propia desde `main`, sin apilar sobre la 0606; se integra **después** de la PR de la 0606.
- Ruta `POST /api/discord/interacciones` (`app/api/discord/interacciones/route.ts`) y lógica en `lib/studio/discord/consulta/` (`firma.ts`, `comando.ts` + `comando-cliente.json`, `consulta.ts`, `respuesta.ts`).
- Migración `0516_discord_consulta_clientes.sql` (registro, tope por minuto con candado por persona, búsqueda que devuelve sólo `markbox` y `name`), su contrato SQL y la prueba PGlite con control rojo y 8 mutantes. Espera en `migrations-baseline.json` y declaración en `pending-migration-symbol-declarations.json`.
- Script `scripts/discord/registrar-comando-cliente.mjs` (con `--dry-run`).
- `.env.example` e `infra/dtd-cargo/.env.example`: `DISCORD_CONSULTA_PUBLIC_KEY`, `DISCORD_TENANT_ID` y, sólo en la raíz, las dos variables del script.
- Revisión de privacidad [`privacidad.md`](../../docs/specs/0608-discord-consulta-clientes/privacidad.md) (8 CORRECTO, 3 ENCONTRADO, 5 NO VERIFICABLE) y fila propuesta en `docs/legal/privacidad/inventario-terceros.md`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ — 0 rojo, 1 amarillo declarado (0516) |
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ — 586 specs |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ — sin números repetidos |
| `git diff --check` | PASÓ |
| vitest focal (`firma`, `respuesta`, `route`, `consulta-clientes.migration`) | NO EJECUTADO — esperando turno de máquina (ver abajo) |
| `typecheck` / `lint` | NO EJECUTADO — mismo motivo |
| `pnpm verify` | NO EJECUTADO — requiere turno del Director General |
| Discord real (firma, PING, comando) | NO DISPONIBLE — la aplicación no existe todavía |

Turno: el 2026-11-05 pedí turno al Director General (`local_25e2dded…`); el mensaje no se entregó porque la sesión estaba detenida. Pregunté a la sesión que me inició. Mientras tanto, sólo lectura y edición.

## COMMITS

- `a53678e76` chore(sdd): reserva SDD-0608
- `5c7c2b5a7` feat(studio): migración 0516 y su contrato
- `ce4506872` feat(studio): ruta, firma, permiso, búsqueda, respuesta, script, env
- `69b487b3e` docs(specs): spec, privacidad, inventario
- (este handoff y lo que siga se anotan en la PR)

## PR / BRANCH

Rama `claude/discord-consulta-clientes-c50c23`. PR en borrador contra `main`: ver la descripción de la PR (número y SHA allí).

## PENDIENTES DE ESTA TAREA

1. Correr las pruebas focales, `typecheck` y `lint` con turno, y `pnpm verify` con turno del Director General. Anotar PASÓ/FALLÓ por paso.
2. Al integrar después de la 0606 (D7): una sola línea `DISCORD_TENANT_ID=` en cada `.env.example`; sumar `lib/studio/discord/consulta/consulta.ts` a la declaración `sdd-0606-discord-user-id` mientras la 0514 siga pendiente; fundir las dos filas de Discord del inventario de terceros (la de la 0606 dice «sin nombre»). Las declaraciones con `archivo:línea` se vencen si se edita arriba de esas líneas.

## Lo que Sam tiene que hacer para activarlo (en orden)

1. **Crear la aplicación** en https://discord.com/developers/applications → «New Application» (por ejemplo «DTD Cargo Studio»). No hace falta bot.
2. **Instalarla en el servidor:** OAuth2 → URL Generator → alcance sólo `applications.commands` → abrir la URL y elegir «DTD Cargo». O directo: `https://discord.com/oauth2/authorize?client_id=<APPLICATION_ID>&scope=applications.commands&guild_id=1534936818951262390`.
3. **Llave pública al servidor:** copiar «Public Key» (General Information) y ponerla como `DISCORD_CONSULTA_PUBLIC_KEY` en `/srv/dtd-cargo/.env` con `infra/ops/migrate/env-set.sh`. Poner también `DISCORD_TENANT_ID` (uuid del tenant de DTD; la misma de la 0606) si todavía no está.
4. **OK nominal de migraciones**, por el Director General y el runbook: `0514_user_profiles_discord_user_id` (SDD-0606) y `0516_discord_consulta_clientes`. Sin la 0514 el comando contesta «no disponible».
5. **Descongelar la publicación** y publicar la web con esta PR fusionada (fusionar es del Director General).
6. **Registrar el comando** desde su PC (no en el servidor), con «Application ID» y el secreto de OAuth2 («Reset Secret»):
   ```
   DISCORD_CONSULTA_APPLICATION_ID=… DISCORD_CONSULTA_CLIENT_SECRET=… node scripts/discord/registrar-comando-cliente.mjs
   ```
7. **Guardar la URL de interacciones:** General Information → «Interactions Endpoint URL» = `https://dtdcargo.com/api/discord/interacciones`. Discord la prueba al guardar (PING y una firma mala); si no guarda, revisar el paso 3 y que la web publicada tenga esta ruta.
8. **Habilitar el comando:** Ajustes del servidor → Integraciones → la aplicación → `/cliente`: permitir al rol «Equipo» y a los canales de Operación (nace oculto para no administradores).
9. **Enlaces:** cada persona del equipo pega su ID de Discord en su perfil del Studio (lo agrega la 0606). **No enlazar la cuenta compartida** «DTD Cargo» (hallazgo de privacidad 2): sin enlace recibe «No autorizado».
10. **Prueba:** `/cliente nombre:<un cliente conocido>` desde Operación → respuesta que sólo ve quien preguntó. Desde una cuenta sin enlace → «No autorizado».

## FUERA DE ALCANCE DETECTADO

- La búsqueda del listado de clientes del Studio (`lib/studio/client-queries.ts`, `construirQuery`) usa `.or(name.ilike.%term%…)` sin escapar `%`, `_` ni `*`. Ahí no es una fuga (la sesión ya ve todos sus clientes), pero «%» o «_» no buscan lo que el usuario escribió.
- `getRoleModuleOverrides` no filtra por tenant: con el cliente de sesión lo hace la RLS; si alguien lo llamara con `service_role` mezclaría desvíos de tenants.
- La 0514 no tiene índice único en `discord_user_id` ni verifica que el ID sea de quien lo pega (privacidad, hallazgo 3).
- `docs/legal/privacidad/mapa-de-borrado.md` no conoce `discord_consultas_clientes`; `/privacidad` no declara la mensajería interna.

## Impacto documental y conocimiento

- Documentos canónicos: spec y privacidad de la 0608, inventario de terceros, índice de specs.
- Graphify / Archify / `knowledge:status`: NO EJECUTADO (el Director los corre desde `main` integrado).

## HANDOFF AL DIRECTOR

Integrar **después** de la PR de la SDD-0606, trayendo `main` una vez y haciendo los tres ajustes de «Pendientes» punto 2. Migraciones en orden 0514 → 0515 → 0516, cada una con OK nominal. Fusionar no autoriza aplicar ni publicar.
