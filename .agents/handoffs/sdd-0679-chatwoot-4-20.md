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
| Fase A del ensayo (Docker, cuatro corridas) | NO EJECUTADO: pedido turno al DG |
| Fase B (copia en el VPS) | NO EJECUTADO: pide OK de Sam; la corre quien tenga SSH |
| Fase C (cuenta 2) | NO EJECUTADO: va después de la subida real y pide OK para reactivar la cuenta |

## COMMITS

Ver la PR.

## PENDIENTES DE ESTA TAREA

- Fase A del ensayo con turno del DG; sin ella no se pide el OK de la subida.
- Fase B con OK de Sam (mide `prepare` con datos reales y fija la duración).
- OK nominal de Sam para la subida: versión, digest, hora, smoke y la lista de diferencias de `sidekiq`.
- La subida (DG o sesión designada) y la fase C.
- Cierre (aceptación 8): cabeceras de los inicializadores, `IMAGEN_CHATWOOT` de los dos ensayos, `chatwoot-selectores.json`, Uptime Kuma y fila del Registro.

## FUERA DE ALCANCE DETECTADO

- La migración `enable_data_import_for_all_accounts` enciende **importar contactos por CSV** en todas las cuentas. Sam decide si se apaga desde el superadmin.
- La plantilla nueva de correo `contact_export_complete.liquid` sale en inglés y sin la marca (no está en `correo/views/`).
- Comentarios con números de línea vencidos en `zz_dtd_redaccion_logs.rb` (`message_text.rb` 67/70 → 71/74, `facebook_messenger.rb` 55/60 → 58/63): se corrigen en el cierre junto con la cabecera.

## Impacto documental

Spec nueva, runbook nuevo, `chatwoot-versiones.md` (aviso y Registro), índice de specs regenerado. Sin cambios en AGENTS ni en reglas.

## HANDOFF AL DIRECTOR

PR lista para revisión. El siguiente paso es tuyo: turno para la fase A y los dos OKs de Sam (fase B y reactivar la cuenta 2), más el OK nominal de la subida con la hora.
