# SDD-0589 · paso 9.3: estado de la guía por usuario (handoff)

Rama `codex/0589-e9-estado`, worktree `DTD-worktrees/0589-e9-estado`, desde `main` en `186d505ff`. Encargo del Director General, 2026-11-06: la 9.3 entera, en local y en una PR en borrador, bajo SDD-0589.

## Puertas

- **OK de Sam, 2026-11-06 hacia las 17:35Z, en el chat del Director General:**
  - aplicar la 0517: «Prueba y producción (Recomendado)». La opción decía «Primero en prueba, con lectura previa; después en producción, con respaldo»;
  - fusionar la #384, junto con la #383: «Sí, las dos (Recomendado)».

  El texto completo, con las preguntas, está en `.agents/handoffs/0589-autorizacion-0517.txt`, el archivo que pide `aplicar.sh` y que nombra la 0517.
- **Smoke B de la guía en prueba:** Sam, el 2026-11-06 hacia las 18:40Z, en el chat del Subdirector de Chatwoot, a «¿Autorizas desplegar la #384 en prueba para el smoke B de la guía?»: «Sí, prueba.dtdcargo.com». Vale para ese recorrido. Va antes de la tanda que publica la #384 y sobre su cabeza final (Director General).

  Resultado, 2026-11-06 19:12Z, sobre `33a0680dd`: PASÓ, 37 de 37. Imagen `prueba-sha-33a0680dd…` desplegada a las 19:09Z (antes `55a65a60`), smoke de la puerta 7/7. Recorrido del Dashboard con admin, commercial y accounting, todas cuentas sintéticas sin fila previa: se abre sola la primera vez y anota `vistoEn`; recargar o abrir un navegador nuevo sin localStorage no la repite; reanuda en el paso guardado; «Ver la guía desde el principio» vuelve al 1; «Terminar» guarda `terminado`; «No volver a mostrar» guarda `noMostrar`, y la guía se sigue abriendo con `?guia=` y con el botón; sin errores de hidratación ni 5xx. El botón, sin montar, se probó con su mismo evento (`dtd:guia`, `origen: "boton"`). El login cae en `/studio/resumen`: la guía se abre sola al entrar por primera vez al Dashboard. Evidencia: `side-session-notes/local_535053f4-…/smoke-foco/evidencia/smoke-guia-b-20261106T191231Z.log`.
- **Orden (migrate-first), cumplido el 2026-11-06:** primero la 0517 en producción, que aplicó el Director General con respaldo (COMMIT a las 19:43:51Z), y enseguida la fusión de la #384 (19:44:04Z). Detalle en «Hecho: la 0517».
- **Aplicar la 0517 enciende el arranque automático:** cada persona de Studio verá abrirse sola la guía de demostración del Dashboard la primera vez que entre después.
- **Sin la tabla, la guía funciona sin romper nada.** `leerEstadoGuia` devuelve `null` con 42P01 o PGRST205 y el layout no se cae; con `null`, la guía no arranca sola; el almacén no llama a la acción; y la acción responde «No se pudo guardar.» sin el error crudo. Lo declaran las evidencias del gate de símbolos y lo prueba `lib/studio/guia/__tests__/estado.test.ts:193`.
- `verify` pide turno al Director General.

## Qué quedó

El detalle, con allowlist, cambios frente a §8, evidencia y `revisar-datos-ve`, está en `docs/specs/0589-guia-motor-studio/spec.md`, sección «2026-11-06 · Paso 9.3».

- **Migración 0517**, reservada con `codex/migration-reserve-0517-user-guide-prefs` (`be6e0f949`), y su contrato en PGlite.
- **Código:** validador, lectura, acción, almacén por usuario, motor con arranque automático, botón «Guía» sin montar y montaje con el estado del servidor.
- **S-6 y S-7**, pendientes de Sam, con las propuestas del guion como constantes en `lib/studio/guia/preferencias.ts`.
- **Prueba de «sin nada no abre»,** pedida por el Director General.

## Hecho: la 0517

Datos del Director General, que aplicó en producción. Este cierre no entró al VPS ni a producción.

- **Control previo**, en solo lectura, el 2026-11-06 a las ~18:05Z: en prueba y en producción, las 10 comprobaciones de `scripts/qa/0517-control-previo.sql` dan `si`.
- **Prueba:** aplicada el 2026-11-06 a las 18:20:23Z. Evidencia en el VPS: `/srv/ops/evidencias/apply-0517-dtd-cargo-staging-20261106T182020Z`.
- **Producción:** aplicada el 2026-11-06, COMMIT a las 19:43:51Z, con la lectura previa en PASÓ. El ledger quedó en 513 filas, y el control posterior (`scripts/qa/0517-control-posterior.sql`) dio 15 de 15. Evidencia en el VPS: `/srv/ops/evidencias/apply-0517-dtd-cargo-20261106T194351Z`. Respaldo previo `dtd-cargo-20261106T194220Z`, con su sha256 OK.
- **Fusión:** la #384 entró en `main` en `a63623ac9` a las 19:44:04Z, 13 s después del COMMIT.
- **Cierre (runbook `aplicar-migraciones-prod.md` §6):** rama `codex/0589-cierre-0517`, worktree `DTD-worktrees/0589-cierre-0517`, desde `a63623ac9`, owner `worker-0589-cierre-0517`. `retirar-espera.mjs` sacó la 0517 de `pendingBelowCutoff`, quitó su declaración `sdd-0589-guia-estado` del gate de símbolos y la selló en `supabase/migrations.lock.json`: sha256 `ab7e09ea…`, md5 `22769e1bb0280481c5fd0b7b201a314f` y 3676 bytes, `ledger` del 2026-11-06, forma `exacta`. La cabecera «NO APLICADA» del `.sql` no se corrige. La prueba `guia-estado.migration.test.ts` dejó de afirmar la espera.
- **El md5 del encargo tenía 31 caracteres** (`22769e1b0280481c5fd0b7b201a314f`, le falta una `b` después de `22769e1b`), y `retirar-espera.mjs` lo rechaza con el código 2. Se selló con el md5 del archivo, que es ese mismo valor con la `b`. **NO VERIFICADO** contra `blob_md5=` de `IDENTIDAD.txt`, que está en el VPS: compararlo le toca al Director General antes de fusionar.
- **Lo que lee las esperas, antes y después, sin editarlo:** `infra/ops/web/publicable.mjs` sigue exigiendo 270 migraciones, con la 0517, y la lista «en espera» pierde la 0517. El reset de la base de prueba ya no la salta. `findMissing` de `migrations-applied` exige la 0517 a un ledger que no la tenga; con la 0517 en el ledger, no falta ninguna.
- **Comentarios condicionales que siguen siendo ciertos, sin tocar:** `app/studio/(app)/layout.tsx` («sin la 0517 devuelve null»), `GuiaStudio.tsx` y `almacen.ts` («la base no respondió o la 0517 no está aplicada»), `estado-queries.ts` («por ejemplo antes de aplicar la 0517») y la fila de evidencia del gate de símbolos de la spec, que es del momento de la #384.
- **Validación del cierre**, sin `pnpm verify`, sin Vitest completo y sin Docker (una corrida pesada a la vez; el CI de la PR cubre el resto):

  | Comprobación | Resultado |
  |---|---|
  | `node scripts/migrations-lock.mjs` | PASÓ: 501 selladas, la mayor la 0517; quedan 2 esperas (0422 y 0423) |
  | `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 0 AMARILLO |
  | `node scripts/build-docs-index.mjs --check` y `node scripts/check-numbering.mjs` | PASÓ: 590 specs; sin números repetidos |
  | Vitest de la 0517 y de la guía: `guia-estado.migration.test.ts`, `guia-estado-control.migration.test.ts`, `lib/studio/guia/` y `app/studio/_components/guia/` | PASÓ: 7 archivos, 100 de 100 |
  | Mutantes de la prueba nueva: vuelve la espera, vuelve la declaración, falta el sello | PASÓ: cada uno la tumba; los archivos quedaron restaurados con el mismo md5 |
  | `node --test scripts/tests/migrations-lock.node.mjs` | PASÓ: 22 de 22 |
  | `git diff --check` y ESLint de la prueba editada | PASÓ |
  | `typecheck` del proyecto | NO EJECUTADO: lo cubre el CI de la PR |
  | `pnpm knowledge:status` | NO DISPONIBLE: «Respuesta inválida del adaptador Graphify» en este worktree, que no tiene `graphify-out`; no terminó en 120 s |

- **Impacto documental:** la spec SDD-0589 y este handoff. Graphify, Archify y Obsidian no se tocaron: los publica el Director desde `main` integrado.

## Pendiente

- **Del cierre de la 0517:** que el Director General compare el md5 sellado (`22769e1bb0280481c5fd0b7b201a314f`) con `blob_md5=` de `IDENTIDAD.txt` en la evidencia de producción antes de fusionar la PR del cierre.
- **S-6 y S-7:** cuando Sam conteste, cambiar las constantes.
- **Montar `<GuiaBoton />` en `StudioTopbar.tsx`** cuando la adopción del rediseño (SDD-0603) lo permita: es una línea.
- **Fila 9.3 del checklist:** no se tocó; queda `pendiente` hasta que el Director General decida cómo contarla.
- **9.6:** `/ui-check` en vivo y prueba con quien atiende.

## FUERA DE ALCANCE DETECTADO

- `user_dashboard_prefs` (0233) no exige `disabled_at is null`: un usuario desactivado conserva el acceso a su fila del Dashboard. Ya lo anotaba §8.2. No se toca aquí.
- `node scripts/knowledge-sync.mjs status` en un worktree nuevo, sin `graphify-out`, imprime `"ok": false` con «Respuesta inválida del adaptador Graphify» y no termina: lo cortó un `timeout` de 120 s (cierre de la 0517, 2026-11-06). No se investigó.
