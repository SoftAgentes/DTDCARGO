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

## Commits

- `4cfa0403f` test: solo las pruebas nuevas, con el código de `main` (el rojo previo).
- `094c35851` fix: los arreglos, el lanzador, el README, el handoff de estado y la §10.18.
- `a52034e20` ci: `timeout-minutes` en 75, con el rojo previo anotado.

## Validación

| Comprobación | Resultado |
|---|---|
| `test_respaldar.py` con el código de `main` (PC) | FALLÓ, como se esperaba: `PruebasTexto403` («12 conversaciones y 1 mensajes sin acceso por 403») |
| `test_respaldar.py` con el arreglo (PC) | PASÓ: 63 pruebas, 3 omitidas |
| `bash -n` de `ensayo-archivo.sh`, `lanzar-unidad.sh`, `prueba-ensayo.sh` y `prueba-lanzador.sh` | PASÓ |
| `docs:check`, `check-numbering` y `git diff --check` | PASÓ |
| CI del cargador sobre `4cfa0403f` (rojo previo, run 42424887376, 43 min) | FALLÓ, como se esperaba, solo en las pruebas nuevas. Python: `PruebasTexto403` («12 conversaciones y 1 mensajes sin acceso por 403»). Lanzador: 0 de 9, porque `lanzar-unidad.sh` no existe en `main`. Ensayo: 11 fallas. T0 no pudo leer el tope; T1 y T2 dan `no:tope`; T4 da `no:siguio`, porque sin la guarda el ensayo sigue. ME2 y ME3 caen por T1 y T2. ME5 y ME6 no se pueden mutar. N7 da `no:siguio`: en `main` el ensayo siguió hasta el final y salió con 0. R6: «el 3º, de hace 500 días;  revisados si no hubo». F5. Siguen verdes completa (25), vigía (15) y el cargador (0 fallas) |
| Calidad continua sobre `4cfa0403f` (42424887337) | PASÓ |
| CI del cargador sobre `a52034e20` (run 42428357622, el job tardó 43 min 32 s) | PASÓ. Python: 63, OK. Lanzador: 9 de 9 (L1 a L5, M0 y MLA1 a MLA3). Ensayo: 0 fallas. T1 a T4 pasan; en T1, la unidad tenía 600 s y la limpieza tardó 0 s (con resolución de 1 s). T4 termina en `exit-code 1 5`. ME1 a ME4 y ME6 caen por su motivo. N7 para en adjuntos-1 con código 3, ME5 cae por `siguio`, y pasan R1 (48), R6 y F5. Completa: 25. Vigía: 15. Cargador: 0 fallas |
| Calidad continua sobre `a52034e20` (42428357683) | PASÓ |
| `pnpm verify` | NO EJECUTADO: el cambio es de `infra/ops`, de docs y de un workflow, sin producto. El cierre lo dan las pruebas propias y el CI |

## Impacto documental

- README de `infra/ops/kommo-historial`: el código 5, el lanzador y «Cómo pararlo».
- `0590-e5-estado.md` §5.5.
- La spec 0590 §10.18.

Graphify y Obsidian, sin cambios en esta tarea: los revisa el Director al integrar.

## Pendientes de esta tarea

Ninguno. Los cinco puntos de la revisión, que no bloqueaban, van en su propia PR (`0590-e5-lanzador-pulido.md`, §10.20).
Con 43,5 de 75 minutos, el tope alcanza. Si pasa de unos 55, se parte el job antes de subirlo.

## FUERA DE ALCANCE DETECTADO

- El vigía que lanza `lanzar-unidad.sh` es el `vigia-carga.sh` de `main`, que mira carga, `/dev/shm` y memoria. El del ensayo del 2026-11-07 miraba además la salud de cuatro contenedores y dos `curl`, y estaba fuera del repo.

## Estado

Cerrada. La #432 quedó APPROVED sobre `a52034e20` y se fusionó en el tren #441 (2026-11-08 12:09Z, `main` en `146d5ea5e`). El worktree y la rama se quitaron con evidencia. Los runs se anotan aquí desde la PR de §10.20: la rama de la #432 estaba congelada.
