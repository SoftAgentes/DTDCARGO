# SDD-0590 · Los cinco puntos que no bloqueaban la #432 (handoff de Worker)

- **Owner:** Worker de Claude Code, sesión `95191146-c154-4468-af0e-d46ad5a1e391`. Lo encargó el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`) el 2026-11-08, cuando el tren #441 ya se había fusionado.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\0590-lanzador-pulido`.
- **Rama:** `codex/0590-lanzador-pulido`, creada desde `main` en `146d5ea5e`.
- **SDD:** [0590](../../docs/specs/0590-kommo-historial-e5/spec.md), §10.20.

## Alcance

1. `lanzar-unidad.sh`: una opción sin valor al final ya no deja el `while` girando para siempre.
2. Si el vigía no arranca, se para la unidad principal y el lanzador sale con 7.
3. El token nunca va por `--env`. Va escrito en el README y en el lanzador, y el lanzador niega esas claves.
4. El `<guion de la carga>` que no existe se cambia por lo que de verdad hay en el repo.
5. Los runs de la #432 en su handoff y en la §10.18.

## Límites

PR en borrador, sin fusionar. Nada en producción ni en el VPS. Lo que lleva systemd va a GitHub Actions.

## Commits

- `228d9d67e` test: solo las pruebas, con el código de `main` (el rojo previo).
- El commit de los arreglos sigue a este. Su SHA está en la PR #450.

## Validación

| Comprobación | Resultado |
|---|---|
| `prueba-docs-lanzador.sh` con el código de `main` (PC) | FALLÓ, como se esperaba: 0 de 4 |
| `prueba-docs-lanzador.sh` con los arreglos (PC) | PASÓ: 4 de 4 |
| `lanzar-unidad.sh` en la PC, sin systemd: `--dir` al final, `--env KOMMO_TOKEN=…` y `--env` sin `=` | PASÓ: los tres salen con 2. El primero sale enseguida, sin quedarse en el `while`, y ninguno imprime el valor |
| Cada texto de MLA3 a MLA6 aparece una sola vez en el lanzador | PASÓ |
| `bash -n`, `docs:check`, `check-numbering` y `git diff --check` | PASÓ |
| CI del cargador, el rojo previo sobre `228d9d67e` y el verde con los arreglos | En la PR #450 y en el mensaje al Subdirector. La rama se congela al publicar |
| `pnpm verify` | NO EJECUTADO: el cambio es de `infra/ops`, de docs y de un workflow, sin producto |

## Impacto documental

El README de `infra/ops/kommo-historial`, la spec 0590 (§10.18 y §10.20) y el handoff de la #432. Graphify y Obsidian los revisa el Director al integrar.

## FUERA DE ALCANCE DETECTADO

Nada nuevo. El vigía del repo todavía no mira la salud de los contenedores; está anotado en §10.18.

## Estado

Lista para revisión, en borrador. Solo falta el resultado del CI alojado.
