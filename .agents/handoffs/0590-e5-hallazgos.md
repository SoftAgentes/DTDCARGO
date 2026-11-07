# SDD-0590 · Los tres hallazgos de la corrida real de E5 (handoff de Worker)

- **Owner:** Worker de Claude Code, sesión `95191146-c154-4468-af0e-d46ad5a1e391`, lanzada por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`).
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\jolly-lumiere-3a11de`.
- **Rama:** `claude/jolly-lumiere-3a11de`, desde `main` en `ecadbac91`.
- **PR:** [#413](https://github.com/SoftAgentes/DTDCARGO/pull/413), en borrador, base `main`.
- **SDD:** [0590](../../docs/specs/0590-kommo-historial-e5/spec.md), §10.16 «Hallazgos para una PR aparte» y §10.17, con el diseño, la allowlist, las huellas y la evidencia.

## OBJETIVO ORIGINAL

Los tres hallazgos de la corrida real de E5 del 2026-11-07, para que el próximo ensayo o carga se lea bien. No cambia lo cargado ni toca producción.

## COMPLETADO

1. **`ensayo-archivo.sh`:** trap de TERM, INT y HUP que sale con 143, 130 o 129 y lo anota (`HECHO senal=…`, `FALLÓ PARADA`). La limpieza usa el compose del ensayo, borra en orden lo que quede del proyecto, reintenta 3 veces y, si no queda en 0, lo dice (`FALLÓ L0`, `limpieza_completa=no`) y sale con 4 en vez de 0. La evidencia termina en `HECHO ensayo_codigo`.
2. **`pruebas/sonda-ensayo.rb`:** `en_busqueda` mide la pertenencia sobre la consulta entera de `SearchService` (`except(:limit, :offset).where(id:).exists?`) y anota `total_count`. `palabra_apta` elige para BQ1 el primero de los 60 mensajes más viejos con una palabra de 6 letras o más y 60 coincidencias o menos. `ensayo-archivo.sh` exige que BQ1 busque el mismo mensaje en las dos ventanas.
3. **Extractor 1.3.2:** `empaquetar` se niega sin `informe.json`, salvo `--sin-informe`; el manifiesto lleva el bloque `informe`. README (paso 5 de 5.4 y 5.5) y handoff `0590-e5-estado.md` §5.6 corren `informe` antes de `empaquetar`.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Prueba nueva de Python con el código de `main` | FALLÓ como se esperaba (rojo previo): 6 problemas |
| `test_respaldar.py` con los arreglos | PASÓ: 61 pruebas, 3 omitidas |
| 6 mutantes de Python | PASÓ: caen los 6, cada uno por su comprobación (primera versión con un verde falso, corregida; spec §10.17) |
| `--limpiar` con un `docker` falso y el trap de TERM, en la PC | PASÓ |
| `bash -n` de los `.sh` | PASÓ |
| `node scripts/check-numbering.mjs` | PASÓ |
| `node scripts/build-docs-index.mjs --check` | PASÓ: 595 specs |
| `git diff --check` | PASÓ |
| CI del cargador, rojo previo: run 42399372669 sobre `bb20ae5b6` | FALLÓ como se esperaba: 10 fallas en el ensayo (T1 a T3 en `success 0 0`; ME1 a ME3 no mutables en `main`; E10d, E10e, E10g por número y BQ1 `sin_palabra`, como en producción; R1, R3, R4 y R5). Los otros pasos, en verde |
| Revisión independiente del diff (subagente revisor) | Tres hallazgos, corregidos en `bb5c711ba`: docker caído contaba 0 (L3), T1/T2 sin runner vivo y mutantes sin motivo |
| CI del cargador con los arreglos | En curso sobre la cabeza de la PR; el resultado, en el cuerpo de la PR |
| `sonda-ensayo.rb` | NO DISPONIBLE en la PC (sin Ruby): lo mide el CI |
| `pnpm verify` | NO EJECUTADO: el cierre de esta tarea es el del diff (infra y docs, sin producto) |
| `node scripts/knowledge-sync.mjs status` | NO DISPONIBLE: «Respuesta inválida del adaptador Graphify» en el worktree |

## COMMITS

- `bb20ae5b6` test(0590): pruebas que fallan con los tres hallazgos
- `4d7624267` fix(0590): informe antes de empaquetar
- `30af929b3` fix(0590): el ensayo sale con 143 tras un TERM
- `ffd145739` fix(0590): la sonda mide la búsqueda en la consulta entera y BQ1
- `a616dec1c` docs(0590): §10.17
- `bb5c711ba` fix(0590): revisión de la #413 (docker caído, runner vivo, motivo de los mutantes)
- el commit de docs con el rojo del CI y este handoff

## PENDIENTES DE ESTA TAREA

- Ver el CI con los arreglos en verde y anotar el run en el cuerpo de la PR. No se publica otro commit solo para anotarlo: repetiría el job de 45 minutos.
- Cuando el Director General fusione, limpiar este worktree y su rama.

## FUERA DE ALCANCE DETECTADO

- El aislamiento del ensayo no mira si un contenedor ajeno se conecta a `chatwoot-ensayo_aislada` (spec §10.17).
- `sonda-cargador.rb` mira solo la primera página de 15 en E-10d; alcanza con los datos inventados.
- `preparar_corrida` deja `stamp.txt` abierto (`ResourceWarning`).

## Conocimiento

Impacto documental: spec 0590 §10.17, README de la carpeta y los dos handoffs. Graphify y Archify no se corrieron (el adaptador no responde en el worktree); quedan para el Director General al integrar.

## HANDOFF AL DIRECTOR

Borrador listo para revisar cuando el CI esté en verde. No se fusiona desde aquí. Nada corrió en producción ni en el VPS.
