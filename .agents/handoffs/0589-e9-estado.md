# SDD-0589 · paso 9.3: estado de la guía por usuario (handoff)

Rama `codex/0589-e9-estado`, worktree `DTD-worktrees/0589-e9-estado`, desde `main` en `186d505ff`. Encargo del Director General, 2026-11-06: la 9.3 entera, en local y en una PR en borrador, bajo SDD-0589.

## Puertas

- **OK de Sam, 2026-11-06 hacia las 17:35Z, en el chat del Director General:**
  - aplicar la 0517: «Prueba y producción (Recomendado)». La opción decía «Primero en prueba, con lectura previa; después en producción, con respaldo»;
  - fusionar la #384, junto con la #383: «Sí, las dos (Recomendado)».

  El texto completo, con las preguntas, está en `.agents/handoffs/0589-autorizacion-0517.txt`, el archivo que pide `aplicar.sh` y que nombra la 0517.
- **Orden (migrate-first):** primero la 0517 en producción, que aplica el Director General con respaldo en una ventana corta, y enseguida la fusión, que publica la web. No se cruza con la ventana de E5: si el ensayo de E5 o su carga la ocupan, la 0517 espera.
- **Aplicar la 0517 enciende el arranque automático:** cada persona de Studio verá abrirse sola la guía de demostración del Dashboard la primera vez que entre después.
- **Sin la tabla, la guía funciona sin romper nada.** `leerEstadoGuia` devuelve `null` con 42P01 o PGRST205 y el layout no se cae; con `null`, la guía no arranca sola; el almacén no llama a la acción; y la acción responde «No se pudo guardar.» sin el error crudo. Lo declaran las evidencias del gate de símbolos y lo prueba `lib/studio/guia/__tests__/estado.test.ts:193`.
- `verify` pide turno al Director General.

## Qué quedó

El detalle, con allowlist, cambios frente a §8, evidencia y `revisar-datos-ve`, está en `docs/specs/0589-guia-motor-studio/spec.md`, sección «2026-11-06 · Paso 9.3».

- **Migración 0517**, reservada con `codex/migration-reserve-0517-user-guide-prefs` (`be6e0f949`), y su contrato en PGlite.
- **Código:** validador, lectura, acción, almacén por usuario, motor con arranque automático, botón «Guía» sin montar y montaje con el estado del servidor.
- **S-6 y S-7**, pendientes de Sam, con las propuestas del guion como constantes en `lib/studio/guia/preferencias.ts`.
- **Prueba de «sin nada no abre»,** pedida por el Director General.

## Pendiente

- **La 0517:**
  - el ensayo en prueba (`docs/runbooks/entorno-prueba.md` §4). **Espera turno:** el 2026-11-06 a las 17:51Z y a las 17:53Z otra sesión ensayó en prueba la 0606 y aplicó la 0514. El orden lo pone el Director General;
  - el paquete y la lectura previa desde la cabeza final de la PR, después de traer `main` otra vez cuando entre la #383;
  - los controles, antes y después: `scripts/qa/0517-control-previo.sql` y `scripts/qa/0517-control-posterior.sql`. Están probados en PGlite con mutantes (`lib/studio/__tests__/guia-estado-control.migration.test.ts`). El previo se corrió en solo lectura el 2026-11-06 a las ~18:05Z: en prueba y en producción, las 10 comprobaciones dan `si`.
- **S-6 y S-7:** cuando Sam conteste, cambiar las constantes.
- **Montar `<GuiaBoton />` en `StudioTopbar.tsx`** cuando la adopción del rediseño (SDD-0603) lo permita: es una línea.
- **Fila 9.3 del checklist:** no se tocó; queda `pendiente` hasta que el Director General decida cómo contarla.
- **9.6:** `/ui-check` en vivo y prueba con quien atiende.

## FUERA DE ALCANCE DETECTADO

- `user_dashboard_prefs` (0233) no exige `disabled_at is null`: un usuario desactivado conserva el acceso a su fila del Dashboard. Ya lo anotaba §8.2. No se toca aquí.
