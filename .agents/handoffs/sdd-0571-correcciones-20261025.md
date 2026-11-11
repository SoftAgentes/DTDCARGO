# SDD-0571 · Correcciones seriales de auditoría y Drawer · 2026-10-25

## OBJETIVO ORIGINAL

Corregir AUD-01 en congelar_tarifa_recepcion (creación y reemplazo atómicos con su evento) y la carrera de servicio durante el guardado del Drawer. Tarea nueva del mismo CORE, sin reactivar otros encargos.

## Adopción previa a edición

- Autoridad: reasignación humana «Sí, reasigna esas correcciones al CORE existente (Recomendado)», respuesta01a174f9-84f5-72f0-a372-6ff9cc4fd1c7; General exec-ad48ddc8-4f43-4250-a6dd-75f77f7dfb8d, transmitido íntegramente por Parent.
- Adopción efectiva: 2026-10-25T22:16:17.6723283Z.
- Owner worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468; sesión CORE01a1601e-d9fd-7280-8977-6b5d4719a99b.
- Worktree managed REAL: C:/Users/AKX generator/.codex/worktrees/sdd-0571-correcciones-20261025/DTDCARGO.
- Rama codex/sdd-0571-correcciones-20261025; base ba43747a803ea9aec3b8750d1b461d69795834a5, tree6d589c384456a494fe6e999a7e262b07a9ddaf42, padre b70be5d792ca4ee0417426266301a9e2e7fd9ffc.
- Siete Git propios individuales0 antes de crear rama/claim; Native9dc136/0. Claim propio201bytes/SHA4c8c11447a8d40f154ec46e67f62e918b2307c6587b7ab781f13c3bfbefaf580, creado21:46:33.6391157Z en commonGit .git/worktrees/DTDCARGO4/harness-session-claim.json.
- Viejos worktrees, B4, S1/S2, CSV-UNIDAD y consumidores quedan fuera. No se escriben ni se usan como fallback.

## Alcance y preservación

Reutiliza docs/specs/0571-tarifa-congelada-por-embarque/spec.md, in-progress. Allowlist: 0496 SQL; su test SQL; tarifa-congelada.migration.test.ts; RateSnapshotDrawer.tsx y su test; spec0571; este handoff. Baseline sólo entrada0496 si su procedimiento exige reflejar nuevas dependencias antes de aplicar.

Preimágenes completas nuevas, leídas individualmente y conservadas antes de editar en 0571-correcciones:pre-*-native y Gitba437:
- migration43452/f59163473ec8c8575d1309575391b69ea455adbb33069911aecd72f3d8325a3d.
- sql-test36548/3e75ab00c04d4e062cfb78f1fc3126fbb1a0f1ecea64b8625120b6565d97f84b.
- migration-test18323/b8fb379c917c79f1c734bd7db75d740b7225409c6efd6144c266e2657a617797.
- drawer26485/f3383d822af3e4c1425fbdc1a23baa3d915fd3f65ccc03259b7af3488ee7254e.
- drawer-test16888/05f8c8243158a487d63f86b9bc91b5190208f07d799f509ae78931c9607e9f8a.
- spec25891/3d3712a7d6ee49e5133f86b67bdad7fc882c7e337289da6bf45c357952cd4274.
- baseline12114/d05a040fa7fbf615a1a45b6330b284ffefa8d9b171ad1fc5b66fc47e2cb36dc6.

No evidencia local de aplicación de0496: fuente/spec/baseline la declaran pendiente MIGRATE-FIRST. No se consultó ledger ni se afirma estado vivo de producción.

## Contratos leídos y diseño adoptado

AUD-01v1.0 exige atomicidad: si no se persiste el evento, falla la mutación. Fuentes completas nuevas: política6063/edf02e80..., writer0267 completo26690/10a9db44..., wrapper0294 completo10234/e95212db..., patrón logístico0292 completo5345/89409100..., spec, schema mínimo existente, ambas fuentes y tests. El schema _0496 queda intacto.

Se usará public.append_audit_event, con entidad canónica warehouse_receipt_cn y entity_id de la recepción; eventos rate_snapshot_frozen/rate_snapshot_replaced, source rpc y result succeeded. El before/after identifica el snapshot y su reemplazo; se omite Shipping Mark del evento. Actor user/auth.uid, tenant resuelto en servidor, motivo validado y correlación por snapshot. Una llamada obligatoria tras INSERT, dentro de la misma transacción, sin catch que absorba errores. Dry-run sale antes de mutar/auditar.

No hay trigger equivalente en la fuente: sólo guardián BEFORE y chequeo diferido de integridad. El bridge0292 afecta INSERT legacy del log de actor operario, no snapshots ni el nuevo evento user/rpc.

El test SQL alojará un doble estrecho FICTICIO del writer y su almacenamiento, sólo como fixture del contrato de esta RPC; no revalida el writer canónico ni producción. Se preserva _0496_schema sin editar. Los oráculos observarán eventos/filas reales de la RPC sobre fixture: creación, reemplazo, dry-run, rechazo, rollback y fallo forzado del sink. Mutantes nuevos deben morir en esos oráculos, no por buscar cadenas.

UI: selección de servicio bloqueada mientras saving, con guard también en su manejador; la promesa diferida A→intentoB→resoluciónA debe conservar A y permitir B tras terminar. Se conserva también el error devuelto por la operación y la recuperación, sin cambiar permisos o validación de preview.

El baseline imprime sus esperas enteras antes de aplicar y exige que el operador lea dependencias: si se modifica, se agrega sólo a0496 el requisito de auditoría y se conserva PENDIENTE/MIGRATE-FIRST; las otras entradas y cutoff permanecen íntegros.

## COMPLETADO / estado al adoptar

Implementación local completada para revisión fija:
- RPC: preflight del contrato audit, before mínimo sin Shipping Mark/reason duplicado, append canónico atómico y rechazo de ID null. Excepciones del writer se propagan.
- Drawer: sólo selector de servicio disabled durante saving y guard en onChange; conserva el resto del formulario y sus guardas.
- Tests SQL: fixture estrecho explícito dentro del archivo autorizado y oráculos de eventos/efectos; _0496_schema no se modifica.
- Test migración: cuatro mutantes nuevos y un negativo de preflight; los bootstrap dedicados reutilizan el bloque audit del MISMO testSQL. Oráculos legacy preservados por sustituciones explícitas.
- Test Drawer: dos casos diferidos (éxito/rechazo), intento sintético B durante A y selección B legítima después.
- Spec: actualización de fecha y apéndice de esta corrección; historia y resultados previos conservados.
- Baseline: sólo descripción0496 ampliada según su contrato de lectura antes de aplicar; demás entradas/cutoff byte-intactos.

Preservaciones enteras en memoria: migration cinco spans count1 forward/inversa WHOLE; Drawer un span count1 e inversa WHOLE; retirar sólo el bloque nuevo del testDrawer recupera WHOLE su original. TestSQL recupera WHOLE su original retirando los dos bloques exactos y su separador LF; testMigration coincide entero con los cinco spans explícitos previstos. Spec y baseline coinciden con sus derivaciones enteras y sus inversas.

| Fuente final | Bytes | SHA256 |
|---|---:|---|
| 0496 SQL | 45610 | 1856b60aae8f4d382e3b4ad618ec51fe0c70a5041a0ad1d3db7973e4d4718755 |
| Test SQL0496 | 47626 | 6540c1d8d340419b9ec946d9ad55d4f14e00b3ed5e557c0ecf101ec214a27754 |
| Test migración | 21009 | 193e1e54d954195046f88f4c26b0d9552ec2f744d130a7ff4c8d8861e4ca9c60 |
| Drawer | 26561 | 331b268224dffdf88d8d93ff8bfef87b6d501820735b3a18a7e213b0ad178d99 |
| Test Drawer | 19360 | 56a2d299aa5bbd60acfc61d09f84d880e256b4ce67d109df1447e42b6f44a338 |
| Spec0571 | 30137 | 4665c95e0d0383e5f0c772e0c28540f62e9752d82d61ee00e7011d21b11527b0 |
| Baseline | 12823 | c2761478e3111c83e6b706b184b0a86e368c74a7a5989bbb2a1e55f89699ce1d |

Recibo administrativo: una comparación de texto prevista salió FALSE porque String.replace interpretaba $$ del SQL esperado. Se conservó ese fallo y se corrigió sólo el comparador mediante callback literal y el separador LF real del patch; SQL físico intacto, forward/inversa WHOLE correctos. No fue ejecución/fallo SQL. Registros: literal-preservation-proof (original), sql-literal-delta y sql-literal-preservation-corrected del prefijo0571-correcciones. No se oculta ni retrocorrige el original.

## VALIDACIÓN

NO DISPONIBLE / NO EJECUTADA local: node_modules y node_modules/vitest/vitest.mjs están ausentes en el nuevo worktree (Native9dc136/0). No instalación/copia/junction/fallback, Nodeharness, Docker, SQL directo o consultas reales.

Checks focales previstos: archivo COMPLETO RateSnapshotDrawer.test.tsx y archivo COMPLETO tarifa-congelada.migration.test.ts con sus oráculos ficticios/PGlite. Ninguna invocación todavía; no hay resultado Native de suite, resultados por caso ni conteos PASÓ del candidato. Se preservan todos los tests anteriores; sus resultados históricos no se transfieren.

| Oráculo nuevo previsto | Estado real |
|---|---|
| Evento de creación: cantidad, tenant/actor, entidad, snapshot, correlación y minimización | NO EJECUTADO |
| Evento de reemplazo: antes/después, motivo y vínculo anterior | NO EJECUTADO |
| Dry-run con/sin tarifa viva y rechazos específicos sin eventos | NO EJECUTADO |
| Evento observado antes de rollback forzado; fila nueva/marca/evento revertidos | NO EJECUTADO |
| Sink lanza error; creación y reemplazo fallan sin efectos | NO EJECUTADO |
| Sink cancela INSERT/ID null; creación y reemplazo fallan sin efectos | NO EJECUTADO |
| Cuatro mutantes nuevos y preflight sin audit | NO EJECUTADO |
| Drawer A→intentoB→resoluciónA, éxito/rechazo, feedback y B posterior | NO EJECUTADO |

Inputs previstos NO DESPACHADOS (no se presentan como llamadas Native ejecutadas):
```json
{"cmd":"& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run 'app/studio/(app)/cn/_components/RateSnapshotDrawer.test.tsx' --maxWorkers=1 --no-file-parallelism --reporter=verbose","shell":"C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe","login":false,"tty":false,"workdir":"C:/Users/AKX generator/.codex/worktrees/sdd-0571-correcciones-20261025/DTDCARGO","yield_time_ms":10000,"max_output_tokens":12000}
```
```json
{"cmd":"& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run lib/studio/__tests__/tarifa-congelada.migration.test.ts --maxWorkers=1 --no-file-parallelism --reporter=verbose","shell":"C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe","login":false,"tty":false,"workdir":"C:/Users/AKX generator/.codex/worktrees/sdd-0571-correcciones-20261025/DTDCARGO","yield_time_ms":10000,"max_output_tokens":12000}
```
Registro0571-correcciones:focal-prerequisites. Sin resultados/exit/sesión/versión ejecutada ni contador de pases/canceladas/omisiones/Unhandled del candidato: NO DISPONIBLE, nunca cero inferido. No prueba directa en PG17 ni fixture real. Toda afirmación de casos/controles nuevos es PREVISTA por fuente.

CI remota del SHA revisado queda para publicación normal/revisión Parent-General por pipeline existente. No se cambia configuración, lockfile ni dependencias. Canónica/producto, revisión visual real y aprobación de migración siguen pendientes; no se aplica DB para resolver un gate.

## Gobernanza

| Política/principio | Clasificación acotada y evidencia |
|---|---|
| AUD-01 / SGE00.04 | NC enba437 corregida por fuente: append obligatorio en RPC, before/after y fallo seguro; oráculos de sink/rollback y cuatro mutantes. Runtime pendiente. |
| SGE00.01 | No aplica a nuevos verbos: conserva congelar/reemplazar; eventos estables describen esas operaciones. |
| SGE00.02 | Cumplimiento estático: el error no limpia el formulario; sólo éxito conserva el reset previo. No nuevo almacenamiento/pérdida. Runtime pendiente. |
| SGE00.03 | Cumplimiento por preservación: permisos/motivo/fricción R3 existentes byte-intactos fuera de spans audit. |
| SGE00.05 | Cumplimiento por fuente: tenant/actor confiables, sin widening de ACL/RLS/RBAC; caller autenticado preservado. |
| SGE00.06 | Cumplimiento por fuente: preflight exige dependencia; guard de servicio antes de cambiar selección. Negativos previstos. |
| SGE00.07 / FRM01 | Cumplimiento de implementación: selector disabled/guard durante saving y recuperación prevista para éxito/rechazo; sin PASÓ runtime. |
| SGE00.08 | No aplica a nuevos pasos/campos: no se agregan; bloqueo temporal sólo durante mutación pendiente. |
| SGE00.09 | Cumplimiento por fuente: writer/entidad/selector nativos existentes; ninguna primitiva nueva. |
| SGE00.10 / A11Y | Label/selector/teclado y estilos preservados; rúbrica estática limitada, sin revisión visible/zoom/móvil certificada. |
| SGE00.11 / ERR01 | Labels y errores seguros existentes preservados; nueva falta de ID devuelve mensaje dtd-tarifa y no éxito silencioso. |
| SGE00.12 | Autoridad humana vigente y ejecución local acotada; sin acciones remotas/producción por esta autoría. |

No se declara conformidad global ni excepción inventada. /ui-check se aplica sólo como rúbrica estática de interacción, sin browser o dispositivo; verificación visible pendiente.

AGENTS/Worker/runbook/AGENT-BRIEF/registro/project-rules del nuevo árbol se midieron; sus unidades coinciden con las instrucciones íntegras ya leídas en esta continuidad. Nuevas lecturas completas específicas: Supabase skill, backend/README, app/studio/CLAUDE, AUD-01/ERR-01/FRM-01 y los contratos arriba. La skill no amplía autoridad: CLI/MCP/advisors/DB/instalación no ejecutados. Gobernanza ejecutable/verify/knowledge/managers/bootstrap suspendidos o fuera del runner focal; no PASÓ inventado.

## COMMITS / PR / BRANCH

El commit que contiene este documento fija ocho rutas de la allowlist (siete del arreglo más baseline condicionado), con padre directo ba43747a803ea9aec3b8750d1b461d69795834a5; SHA/tree y cierre Git/claim se devuelven externamente sin selfhash. Sin publicación durante autoría, sin cambiar remoto307/crearPR alternativa/main/merge/deploy. Parent revisa fijo; General coordina mapeo seguro a PR307.

## PENDIENTES DE ESTA TAREA

Pruebas focales NO DISPONIBLES local por dependencias ausentes; ejecutar/revisar CI del SHA correcto y revisión semántica/visual posterior. La autoría corregida y sus pruebas redactadas no equivalen a resultado funcional ni a aplicación de0496.

## FUERA DE ALCANCE DETECTADO

#318 permanece en cola. Sin SQL financiero PG17/Q/B, servicios HUMAN, producción, ledger, cuentas, contactos, PII, secretos, gasto o migraciones aplicadas. No se recuperan lecturas detenidas ni Source03–06. Automatización pausada.

## HANDOFF AL DIRECTOR

Revisar sólo el fijo final y las unidades completas por separado. Conservar todos los worktrees consumidores; cerrar sólo el claim nuevo al terminar escritura propia. Publicación normal posterior y readback exacto bajo revisión Parent; jamás mover aún la rama remota de307. Conocimiento/Graphify/Archify/Obsidian quedan pendientes de integración autorizada, sin ejecutarlos aquí.
