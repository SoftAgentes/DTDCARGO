## SDD-0606 — Avisos del Studio: de Telegram a Discord

**Borrador.** No fusionar: `pnpm verify` falló y quedó incompleto (detalle abajo), la rama lleva una migración sin aplicar y la publicación de la web está congelada. Va tercera en el orden de integración, después de la #376 y la #377. Fusionar, aplicar la migración y publicar la web los autoriza Sam por separado.

### Qué hace

- **Discord primero, Telegram de respaldo.** Cada aviso al equipo sale al canal de Discord de su categoría. Si esa categoría no tiene dirección, cae a `#avisos-equipo`; si Discord no entrega, sale por Telegram mientras exista su token. Sin variables de Discord en el servidor, el comportamiento es el de antes.
- **A Discord sale lo mínimo:** un título fijo, el código del registro y el enlace al Studio (o conteos, en los reportes). El texto completo con nombre, teléfono y montos sigue yendo sólo a Telegram y deja de salir cuando Discord entrega.
- **Envío por webhook:** recorte a 2.000 caracteres, sin menciones por defecto, reintento con el tiempo que indica Discord, nunca lanza y la dirección no aparece en errores.
- **Avisos por persona:** mención en el canal, sólo para quien pegue su ID de Discord en Perfil › Preferencias.
- **Pantalla:** Ajustes › «Alertas del equipo» muestra el estado de cada canal de Discord; la matriz de Telegram queda abajo como respaldo.
- **Apagado en el entorno de prueba** (`APP_ENV=staging`).

Decisiones y su porqué: `docs/specs/0606-avisos-studio-a-discord/spec.md`. Qué lleva cada aviso, campo por campo, y lo que no se pudo verificar: `docs/specs/0606-avisos-studio-a-discord/privacidad.md`.

### Revisión de Codex (tanda 2)

Corregidos A3 (`wait=true`, ID del mensaje y cola durable para registro, bugs y reporte diario), A4 (el reintento de bugs sigue vivo sin Telegram), A5 (Discord sólo para el tenant de `DISCORD_TENANT_ID`), M1 (espera ante 429), M2 (una entrega incierta no se repite) y M4 (User-Agent y URL entera). Cada punto tiene una prueba que falló antes del arreglo; detalle en el handoff.

### Migraciones

`0514_user_profiles_discord_user_id` y `0515_studio_alert_outbox` — **no aplicadas**. La 0515 crea la cola: sólo el aviso mínimo, sin acceso para `anon` ni `authenticated`; sin ella, lo que Discord no guarda sigue por Telegram. Sobre la 0514: Agrega una columna de texto y su CHECK de formato. No es migrate-first: sin ella los avisos salen sin menciones y el perfil dice que todavía no se puede guardar el ID. Está registrada como espera en `supabase/migrations-baseline.json` y declarada ante el gate de símbolos (0 ROJO · 2 AMARILLO).

### Validación

`pnpm verify`, una corrida sobre `67d6f2ecb` (2026-11-05, 17:47Z a 18:41Z): **FALLÓ** en el paso `test` y quedó incompleto.

| Paso | Resultado |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions | PASÓ |
| docs:check, numbering, feature-constants, components:check, governance:check | PASÓ |
| pending-migration-symbols | PASÓ (0 ROJO · 1 AMARILLO declarado) |
| e2e | PASÓ (238 pasaron, 20 omitidas) |
| build | PASÓ |
| test | **FALLÓ** |
| migrations-applied | NO DISPONIBLE (worktree sin acceso a la base) |
| sql-tests, schema-rebuild | NO EJECUTADO (Docker apagado) |

Rojos del paso `test`:

- `lib/studio/rbac-actions-guard.test.ts` — **real y de esta rama**: las dos acciones nuevas del perfil sólo comprobaban la sesión. Corregido en `01a41c74c` (exigen membresía activa con `getStudioAccess` y quedaron en `EXCEPCIONES` con su verificación). Vuelto a correr aislado: PASÓ.
- `app/p/[token]/supplier-flow.test.tsx` y `app/portal/la-accion-lanza.test.tsx` — archivos que esta rama no toca; fallaron en el primer intento y pasaron en el reintento de la misma corrida.
- `scripts/__tests__/entorno-prueba-scripts.test.mjs` — pasó en el primer intento y agotó su tope de 600 s en el reintento.

**No medido:** el paso `test` completo después del arreglo, las suites SQL en contenedor, una prueba contra un webhook real de Discord (no existe ninguno todavía) y la vista en el navegador.

Medido aparte: 71 pruebas nuevas en 7 archivos, incluido el contrato de la 0514 en PostgreSQL embebido con control rojo y un mutante.

### Antes de fusionar

- Una corrida completa de `pnpm verify` sobre la rama final, con Docker encendido.
- Resolver el cruce con la SDD-0603 en `app/studio/_components/wiring/ProfileModal.tsx`: falta decidir quién va primero.
- Traer `main` una sola vez, en su turno; regenerar el índice de specs y revisar las líneas declaradas en `supabase/pending-migration-symbol-declarations.json`.

### Para que llegue a producción (Sam)

1. Descongelar la publicación de la web.
2. **Los avisos a Discord no se encienden hasta que se publique la #399.** La [SoftAgentes/DTDCARGO#399](https://github.com/SoftAgentes/DTDCARGO/pull/399) (`codex/privacidad-mensajeria-interna`) trae el texto de `/privacidad` que los cubre, aprobado por Sam. Hasta entonces no se ponen las direcciones del paso 3. Cuando esta PR traiga `main` con la #399 adentro, se quita de `docs/legal/privacidad/inventario-terceros.md` la fila de Discord de esta rama: la #399 ya trae la fila fundida.
3. Crear un webhook por canal en Discord y poner las cinco direcciones y `DISCORD_TENANT_ID` en el servidor (`DISCORD_WEBHOOK_REGISTRO`, `_CONVERSACIONES`, `_BUGS`, `_REPORTES`, `_EQUIPO`). Las direcciones son llaves: nunca en el repositorio.
4. Probar un aviso por categoría.
5. OK nominal para aplicar `0514_user_profiles_discord_user_id` y `0515_studio_alert_outbox`, de a una, con el Director General y el runbook.
6. Retirar `TELEGRAM_BOT_TOKEN`: ese es el apagado de Telegram.

El orden completo, las decisiones abiertas y lo que quedó fuera de alcance están en `.agents/handoffs/sdd-0606-avisos-studio-a-discord.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
