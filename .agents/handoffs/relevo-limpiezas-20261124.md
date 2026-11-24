# Relevo: limpiezas menores del 23 de noviembre

## OBJETIVO ORIGINAL
Cerrar tres ajustes menores del relevo de Claude, sin modificar textos, datos, permisos ni sesiones. SDD-0686 reutilizada; no se declara terminada su adopci?n global.

## Aislamiento y trazabilidad
- Owner: `codex-relevo-limpiezas-20261124`; ?nico escritor del hijo.
- Rama: `SoftAgentes/relevo-limpiezas-20261124`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/Orca/DTDCARGO/relevo-limpiezas-20261124`.
- Base y HEAD inicial: `8580490f8d95872a407ab83ab9acb6b1b265a451`.
- Run: `run_31c6634809ff`; Task: `task_dd90b95af79b`; Dispatch: `ctx_9389381357a3`.
- Sesi?n Worker: `6af02dff-fea1-4a74-b8ed-69d519f0e8e6`; Director: `14b98827-b1e5-41f3-aee0-c72c837f96fc`.
- Claim y guard con owner comprobados antes de editar; guard se repite antes de commit.
- Autorizaci?n del encargo: editar allowlist, pruebas ficticias, commit, push propio y PR hacia main; integraci?n y release quedan al Director.

## COMPLETADO
- Registro: eliminados prop tone y ternario de CodePart; ambos caminos devolv?an el mismo token de tinta.
- Planilla: hover de grpTog usa `color-mix(in srgb, var(--color-accion) 14%, transparent)`. El token claro es #1F4FA8: conserva el rgba original al 14 %, sin introducir otro color.
- Detector: cada alternativa de variante incluye su delimitador `:`. Se elimina la partici?n ambigua de letras entre iteraciones conservando clases y variantes arbitrarias.
- Regresi?n espec?fica: 20.000 letras sin `:` seguidas de bg-wine; adem?s variantes encadenadas, group-[[open]], [&>svg] y falsos positivos.
- Verificado `app/studio/CLAUDE.md:111`: compact|ultra, sin editarlo.

## VALIDACI?N
Solo fixtures sint?ticos; sin accesos reales.
- PAS?: pnpm install --frozen-lockfile (43,7 s), diff --check y eslint de los cinco archivos de c?digo/prueba.
- PAS?: pnpm typecheck (sin diagn?sticos).
- PAS?: governance:check, components:check, docs:check y sdd:check (colisiones hist?ricas exceptuadas por el propio gate).
- Test focal y suites: `pnpm exec vitest run app/studio/_components/__tests__/vino-detector.test.ts app/studio/_components/__tests__/color-accion app/studio/_components/__tests__/cierre-color app/registro/__tests__ 'app/p/[token]' --maxWorkers=2`: 37 archivos, 345 PAS? y 1 FALL? por ancla textual antigua del mutante.
- Correcci?n autorizada por Director (respuesta msg_bb0015fad60d): solo ancla del mutante en color-accion-fase3b2a-registro-contract.test.ts. Conserva expect(original).toContain(de) y expect(c[objetivo]).toBeGreaterThan(...): sustituye c?digo real e incrementa vino, activando la infracci?n esperada.
- PAS? repetici?n de ese contrato y vino-detector.test.ts: 2 archivos, 14 pruebas, 10,16 s. Sin aserciones reducidas.
- NO EJECUTADO local: verify completo; lint global, harness, rsc-boundary, edge-functions, suite global, feature-constants, migrations-applied, pending-migration-symbols, sql-tests, schema-rebuild, e2e y build. Validaci?n global delegada a CI; no se afirma cierre can?nico completo.
- Logs locales: %TEMP%/relevo-tests.log, relevo-retest.log y relevo-types.log. Turno PC entregado al terminar estas comprobaciones.

## COMMITS
La cabeza exacta se obtiene de la PR; este documento forma parte del commit de entrega.

## PR / BRANCH
PR: https://github.com/SoftAgentes/DTDCARGO/pull/805 (abierta, hacia main). Conservar rama y worktree.
Head de implementaci?n: `34d61d1b944b2512b97ab9fbe15744d3a9478e8d`; la cabeza final a?ade solo este cierre documental y se consulta en la PR.
Carril informativo: `revision`, por rutas Registro y token; clasificaci?n sobre esa cabeza, base `8580490f8d95872a407ab83ab9acb6b1b265a451`. Recalcular antes de integrar la cabeza final.
CI iniciado: Calidad local sin secretos, corrida `45406162585`, pendiente al corte; check Carril pas?. El push del cierre documental inicia CI para la cabeza final.

## PENDIENTES DE ESTA TAREA
CI completo y revisi?n independiente del Director antes de integraci?n.

## FUERA DE ALCANCE DETECTADO
Ninguna correcci?n adicional incorporada. El comentario hist?rico del detector sobre variantes arbitrarias ya era desactualizado; no cambia su contrato ejecutable.

## HANDOFF AL DIRECTOR
Cumplimiento SDD-0686: tinta en datos sin destino y token azul en interacci?n; no aplica cambio de comportamiento Studio ni contratos de datos. Impacto documental limitado a este handoff; no requiere modificar spec global ni pol?ticas. Sin merge ni despliegue.


## Revisi?n del Director: avance determinista de variantes arbitrarias

- Nuevo Task: `task_48baf0665ade`; Dispatch: `ctx_c9c39a61e0bc`; Run: `run_31c6634809ff`. Mismo owner, sesi?n, rama y PR #805.
- HEAD al retomar: `3a1ab330c7c0cd8073d28f4b7f5f07020f97fa03`; base de PR conservada: `8580490f8d95872a407ab83ab9acb6b1b265a451`.
- Claim readquirido y guard --owner comprobado antes de editar. Alcance de este seguimiento: detector, su test focal y este handoff; UI y resto de la PR sin modificaciones.
- El hallazgo del Director corrige la conclusi?n inicial: incluir `:` en las alternativas no eliminaba las particiones ambiguas de variantes arbitrarias. Esta revisi?n sustituye esa soluci?n por un recorrido de tokens con balance de corchetes. El ?ndice siempre avanza, no reintenta cierres previos y la clase base se comprueba una sola vez por token.
- Se conservan variantes simples, encadenadas y arbitrarias, incluido el anidado `group-[[open]]:` y `[&[data-open]]:`. No se ampl?an tokens de identidad ni se cambian criterios de datos o UI.
- Regresor: 64 variantes `[&>svg]:` seguidas de `text-accion`, sin coincidencia, y de `text-wine`, con coincidencia. Corre en proceso Node aislado con timeout de 5 s para terminar un eventual regreso al patr?n exponencial sin bloquear Vitest.
- PAS?: Vitest focal del detector y del contrato Registro/Planilla: 2 archivos, 15 pruebas, 12,64 s, maxWorkers=1. Log: `%TEMP%/relevo-r2-tests.log`.
- PAS?: comprobaci?n negativa acotada del instrumento: el detector anterior extra?do de `3a1ab330` sobre ese mismo caso sin coincidencia termina por ETIMEDOUT a los 1.500 ms; el nuevo sale con status 0 y cuenta 0. Proceso anterior terminado por spawnSync y archivo temporal eliminado.
- PAS?: eslint de los dos archivos tocados y git diff --check.
- NO EJECUTADO en este seguimiento: verify completo, tipos globales, build y dem?s suites/gates globales; se respeta el turno fuerte de Decimales. CI nuevo y revisi?n independiente sobre la cabeza publicada quedan al Director.
- Carril informativo de la PR: revisi?n previa por las mismas rutas sensibles; ning?n cambio de rutas de producto en este seguimiento. La cabeza exacta final se consulta en la PR y se reporta en worker_done; este handoff viaja en el mismo commit.
