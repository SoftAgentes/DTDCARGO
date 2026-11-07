# SDD-0590 · La guarda de carga en los adjuntos y los cuatro puntos del Director General (handoff de Worker)

- **Owner:** Worker de Claude Code, sesión `95191146-c154-4468-af0e-d46ad5a1e391`. Encargo del Director General, relayado por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`), el 2026-11-07.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\0590-guarda-adjuntos`.
- **Rama:** `codex/0590-guarda-adjuntos`, desde `main` en `dda93b219`.
- **SDD:** [0590](../../docs/specs/0590-kommo-historial-e5/spec.md), §10.18. Ahí van el diseño, la allowlist y la evidencia.
- **Diseño previo:** `0590-guarda-adjuntos-diseno.md`, en las notas compartidas de la sesión del Subdirector.

## Alcance

1. La guarda de carga corta también los pasos de adjuntos. El `exit 3` de `rr` en `flujo-adjuntos | rr` salía solo del subshell.
2. El texto de los 403 en el log de `empaquetar` («conversaciones con mensajes sin acceso»).
3. La línea de BQ1, que dejaba «; … revisados si no hubo» con el valor vacío.
4. `TimeoutStopSec`:
   - `lanzar-unidad.sh` para `kommo-e5-ensayo` y `kommo-e5-carga`, con su vigía;
   - la guarda propia del ensayo, con un mínimo de 300 s;
   - `limpieza_segundos`.
5. La documentación de que un TERM al proceso principal espera al paso en curso.

## Límites

PR en borrador, sin fusionar. Nada en producción ni en el VPS. Lo que lleva contenedores o systemd va a GitHub Actions.

## Estado

En curso.
