# Handoff · SDD-0679 · Chatwoot v4.19.1-ce → v4.20.0-ce

| | |
|---|---|
| Owner | Worker (Claude), sesión iniciada por el Director General |
| Ruta | `.claude/worktrees/quizzical-aryabhata-307fe7` |
| Rama | `claude/quizzical-aryabhata-307fe7`, base `main` a `80ea7b3b2` |
| SDD | [0679](../../docs/specs/0679-chatwoot-4-20/spec.md) |
| Permisos | subir la rama y abrir la PR: sí (encargo del DG). Producción: **no** |

## OBJETIVO ORIGINAL

Preparar y dejar lista la subida de Chatwoot de v4.19.1-ce a v4.20.0-ce, que Sam pidió para el 2026-11-20 o el 21, por los arreglos de seguridad: spec con inventario y veredicto por pieza, imagen por digest, ensayo en prueba, runbook de producción y PR.

## COMPLETADO

- **Diff del código de Chatwoot** entre los tags `v4.19.1` y `v4.20.0`, descargados fuera del repo, sin ejecutar nada. Veredicto por pieza en la spec §2: **ninguna pieza propia se rompe por código.** El riesgo que queda es Rails 7.2 → 8.0, que solo descarta el ensayo.
- **Imagen fijada**: `chatwoot/chatwoot:v4.20.0-ce@sha256:03cc2004…f8be` (digest del índice, leído del registro de Docker Hub; amd64 `sha256:1cf633d4…`; imagen creada el 2026-11-18T09:07Z, Node 24.22.1, Ruby 3.4.4, `VIPS_BLOCK_UNTRUSTED=1`).
- `infra/chatwoot/pruebas/ensayo-local.sh`: C1 y R3b leen la versión esperada de la etiqueta del compose, en lugar de `4.19.1` escrito. Probado: con el compose nuevo da `4.20.0`; sin compose, vacío y el script sale 2.
- **Runbook de producción** [`chatwoot-subida-4-20.md`](../../docs/runbooks/chatwoot-subida-4-20.md): respaldo, avisos a «Cable Paso 3b», cambio de una sola línea en el compose del VPS, `prepare` con `run --rm --no-deps`, recreación solo de `rails` y `sidekiq` con `--no-deps`, verificación, vuelta atrás (a) y (b), duración. Nunca un `compose up` general.
- `chatwoot-versiones.md`: aviso de que su paso 5 (`up -d --wait`) ya no se usa así y fila «pendiente» en el Registro.

## Hallazgos que cambian el plan

1. **El entorno de prueba no tiene Chatwoot propio**: usa la cuenta 2 del mismo Chatwoot de producción. «Ensayar en prueba» la imagen sería subir producción. El ensayo quedó en tres fases (spec §5): A local, B copia en el VPS (`chatwoot-ensayo`), C smoke en la cuenta 2 **después** de la subida real.
2. **`sidekiq` del VPS no coincide con su compose** (dato de una sesión anterior, 2026-11-19): cambiar la imagen obliga a recrearlo y entran variables y montajes que hoy le faltan. El runbook las mide por nombre antes; **el OK de Sam tiene que nombrarlas**.
3. Las fechas pedidas (vie 20, sáb 21) caen fuera de la ventana del runbook de versiones (lunes a jueves). Decide Sam.
4. La vuelta atrás (b) necesita la clave `age`, que solo pega Sam: Sam tiene que estar durante la ventana.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ (avisos históricos de siempre) |
| `git diff --check` | PASÓ |
| `bash -n infra/chatwoot/pruebas/ensayo-local.sh` y la extracción de versión | PASÓ |
| Enlaces y anclas de los tres documentos | PASÓ (revisión con script) |
| `pnpm verify` / Vitest | NO EJECUTADO: el worktree no tiene `node_modules` y el cambio es de docs e infra; el portón es el CI de la PR |
| Fase A · 1 `ensayo-local.sh` (02:33Z–02:52Z, turno del DG) | **PASÓ**, 24/0. Controles en rojo: A1 (sin redacción se ven los datos), R4 y R4b (con otras claves el secreto no se recupera; `restaurar.sh` sale 1). C1 `"version":"4.20.0"`, C6 sin fugas, R2 restauración en 130 s, R3b restaurado en 4.20.0, D1–D4 Access. Arranque desde cero (`prepare` con todas las migraciones, `rails` y `sidekiq`): 74 s |
| Fase A · 2 `prueba-register.sh` (02:52Z–02:55Z) | **PASÓ**, 15/0. El control sin el inicializador sale en rojo: 7 de 9 exigencias fallan y el `/register` llega al servidor falso |
| Fase A · 3 `prueba-revocar-sesiones.sh` (02:55Z–02:57Z) | **PASÓ**, 14/0. Incluye R10 y R12: `RoomChannel` con Rails 8.0 corta el tiempo real a los 30 s sin reconectar. En el control C1, la ruta da 404 y la sesión sigue viva |
| Fase A · 4 `prueba-redaccion-canales.sh` (02:57Z–03:02Z) | **PASÓ**, 44/0. Los 16 tipos de línea (T1.1–T1.16) siguen en la imagen y quedan tapados; T1w tapa `entry` en los webhooks de Meta. Controles en rojo: C1 (24 valores aparecen sin el inicializador) y M1–M14 (cada patrón quitado hace reaparecer su valor) |
| Fase A · `smoke-guia.mjs` | NO EJECUTADO: necesita un agente y una conversación sintéticos con el ensayo conservado. No es vuelta atrás; la guía se mira en S13 después de la subida |
| Fase B (copia en el VPS) | NO EJECUTADO: el DG la omitió el 2026-11-19 (el tráfico entra casi todo por Kommo y el respaldo del §3 cubre). La receta queda en el §9 del runbook |
| Fase C (cuenta 2) | NO EJECUTADO. La cuenta 2 ya estaba activa: la usa la sesión «Cable Paso 3b» (webhook 4, bandeja 11). V7 y S10–S13 quedan pendientes y los hace Sam con su navegador: Bandeja y SSO, Ficha DTD y un mensaje de prueba a la bandeja 11. Si la cuenta 2 se suspende o no, lo decide Sam cuando termine Cable. |

Logs de las cuatro corridas: en el scratchpad de la sesión, fuera del repo (solo datos sintéticos). Al terminar no quedó ningún contenedor de Chatwoot.

## COMMITS

Ver la PR.

## SUBIDA EN PRODUCCIÓN (2026-11-19, la ejecutó el DG)

Datos del informe del DG. Evidencias en el VPS: `/srv/ops/evidencias/chatwoot-0679-20261119T031009Z`.

| Paso | Resultado |
|---|---|
| §0 paso 5 | `rails` sin diferencias; `sidekiq` con exactamente las 4 esperadas |
| §3 respaldo | `chatwoot-20261119T031125Z`, `resultado=success`, `rclone check` con 0 diferencias |
| §4 corte | de 03:15:43Z a 03:18:48Z (**3 min 5 s**); `prepare=0` en **50 s**; migradas 0 → 15 |
| S1 / V1 | `4.20.0`, `queue_services` y `data_services` en `ok` |
| S2 | «activa: 2 Phone Number IDs» ×2 y 0 en `modo cerrado` (el runbook decía «1 »: corregido) |
| S3, S4, S5, S5b, S6, S7, S9 | OK |
| S8 | `/monitoring/sidekiq` 403, `/installation/onboarding` 403 y `/app/login` 200. `/super_admin/sign_in` da 302 a Cloudflare Access por el perfil `cf-access`: la exigencia de 403 estaba vencida (corregida) |
| V2, V5, V6 | OK; V5 = 0; V6 = 0/0/0/2/0 |
| V4 | solo `RAILS_ENV`, que es de la imagen, igual en los dos (anotado en el runbook) |
| V8 | `smoke-web` desde el VPS 14/0 |
| **V7 y S10–S13** | **PENDIENTES**: los ejecuta quien tenga el OK de Sam (abajo) |

Correcciones del runbook por lo medido:
- S2 cuenta los IDs del `.env`;
- S8 acepta el 302 de Access;
- V4 explica lo de `RAILS_ENV`;
- §2 avisa que `bash -s` por SSH se traga el guion si un `docker exec` no lleva `</dev/null`.

## PENDIENTES DE ESTA TAREA

- **V7 y S10–S13**: la cuenta 2 ya estaba activa: la usa la sesión «Cable Paso 3b» (webhook 4, bandeja 11). V7 y S10–S13 quedan pendientes y los hace Sam con su navegador: Bandeja y SSO, Ficha DTD y un mensaje de prueba a la bandeja 11. Si la cuenta 2 se suspende o no, lo decide Sam cuando termine Cable. Esta sesión no escribe en producción con un OK reenviado.
- Cierre (aceptación 8): cabeceras de los inicializadores, `IMAGEN_CHATWOOT` de los dos ensayos, `chatwoot-selectores.json`, Uptime Kuma y fila del Registro (ya escrita). La imagen vieja **no** se borra todavía (pedido del DG).

## FUERA DE ALCANCE DETECTADO

- La migración `enable_data_import_for_all_accounts` enciende **importar contactos por CSV** en todas las cuentas. Sam decide si se apaga desde el superadmin.
- La plantilla nueva de correo `contact_export_complete.liquid` sale en inglés y sin la marca (no está en `correo/views/`).
- Comentarios con números de línea vencidos en `zz_dtd_redaccion_logs.rb` (`message_text.rb` 67/70 → 71/74, `facebook_messenger.rb` 55/60 → 58/63): se corrigen en el cierre junto con la cabecera.

## Impacto documental

Spec nueva, runbook nuevo, `chatwoot-versiones.md` (aviso y Registro), índice de specs regenerado. Sin cambios en AGENTS ni en reglas.

## HANDOFF AL DIRECTOR

Fase A en verde y subida hecha por el DG el 2026-11-19 (corte de 3 min 5 s). Quedan V7 y S10–S13 con la cuenta 2 (los corre el DG o quien Sam autorice directamente) y el cierre de la aceptación 8.
