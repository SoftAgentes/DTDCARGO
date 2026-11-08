# SDD-0590 · Los cinco puntos que no bloqueaban la #432 (handoff de Worker)

- **Owner:** Worker de Claude Code, sesión `95191146-c154-4468-af0e-d46ad5a1e391`. Lo encargó el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`) el 2026-11-08, cuando el tren #441 ya se había fusionado.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\0590-lanzador-pulido`.
- **Rama:** `codex/0590-lanzador-pulido`, creada desde `main` en `146d5ea5e`.
- **SDD:** [0590](../../docs/specs/0590-kommo-historial-e5/spec.md), §10.19.

## Alcance

1. `lanzar-unidad.sh`: una opción sin valor al final ya no deja el `while` girando para siempre.
2. Si el vigía no arranca, se para la unidad principal y el lanzador sale con 7.
3. El token nunca va por `--env`. Va escrito en el README y en el lanzador, y el lanzador niega esas claves.
4. El `<guion de la carga>` que no existe se cambia por lo que de verdad hay en el repo.
5. Los runs de la #432 en su handoff y en la §10.18.

## Límites

PR en borrador, sin fusionar. Nada en producción ni en el VPS. Lo que lleva systemd va a GitHub Actions.

## Estado

En curso.
