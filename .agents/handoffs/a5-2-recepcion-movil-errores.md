# a5-2 · Recepción móvil · recuperación ante errores

- Fecha: 2026-09-10
- Owner / claim: `a5-2-recepcion-movil-errores`
- Sesión: Worker Codex actual
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/a5-2-recepcion-movil-errores`
- Rama: `codex/a5-2-recepcion-movil-errores`
- Base asignada: `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2` (`main`)
- Estado de tarea: `lista-para-revision`
- SDD reutilizada: `docs/specs/0154-recibir-por-escaneo/spec.md` (`in-progress`)

## OBJETIVO ORIGINAL

Evitar que la pantalla dedicada de recepción por escaneo quede trabada cuando
rechaza cualquiera de sus acciones de servidor, y distinguir en español y chino
los fallos permanentes —como `PGRST202`— de los transitorios sin ordenar reintentos
inútiles al operario de Yiwu.

## COMPLETADO

- `lookupForReceptionAction` quedó dentro de `try/catch/finally`: todo resultado,
  rechazo de red o excepción de Next libera `busy`; el rechazo informa el fallo y
  conserva el escáner habilitado.
- `receivePrealertaAction` también tiene recuperación explícita: un rechazo vuelve
  al escáner con un mensaje visible y permite iniciar una nueva lectura, sin depender
  de cerrar una pantalla que por diseño no tiene salida.
- El banner persistente de la pantalla recibe los errores de `ActionButton` y usa
  `role="alert"`; no se depende de un toast fugaz.
- La Server Action clasifica el código exacto `PGRST202` como permanente. El copy
  manda a avisar al responsable y a no reintentar. Los fallos no catalogados quedan
  como transitorios/no determinados y conservan un reintento desde la UI.
- Se preservó la lista real de nueve errores de negocio: `P0001`, `P0002`, `P0003`
  y `P0130`–`P0135`. No se inventaron `P0136` ni `P0137`.
- Los nuevos mensajes de recuperación y el mensaje permanente existen en español
  y chino mediante `t(lang, …)`.
- Se agregaron seis pruebas regresivas: tres de la pantalla y tres de la Server
  Action. El rojo previo reprodujo ambos defectos; el verde cubre recuperación,
  traducción china y clasificación por `error.code`.
- SDD-0154 actualizada con fecha, criterio de clasificación y recibos focales. Se
  regeneró el índice de specs; `docs/specs/README.md` no cambió porque `updated` no
  forma parte del índice generado.
- La llamada permanece en `receive_prealerta_as_operario`. No se modificó ninguna
  RPC, migración, archivo bajo `supabase/**`, la 0449 ni otra pantalla móvil.

### Gobierno aplicable

- `ERR-01` — **cumplimiento**: copy humano, bilingüe, persistente, accionable y sin
  exponer detalles crudos de PostgREST/SQL.
- `LOD-01` — **cumplimiento**: ninguna espera queda indefinida; el error reemplaza
  el estado de carga y devuelve una acción usable.
- `FRM-01` — **cumplimiento**: `ActionButton` conserva el bloqueo durante la acción,
  vuelve a idle en error y ahora comunica el fallo al banner de la pantalla.
- `PRG-01` — **no aplica**: no se agregó progreso porcentual ni estimaciones.

## VALIDACIÓN

| Comprobación | Estado | Evidencia |
| --- | --- | --- |
| `corepack pnpm install --frozen-lockfile` | **PASÓ** | 813 paquetes; lockfile respetado; pnpm 12.3.4. |
| Rojo focal antes del arreglo | **FALLÓ como se esperaba** | 2 archivos fallidos, 6 pruebas fallidas y 1 rechazo no manejado. El lookup quedó en «Buscando…», el rechazo al recibir no mostró salida y `PGRST202` devolvió «Intenta de nuevo». |
| Vitest focal final, 1 worker | **PASÓ** | 2 archivos, 6 pruebas, 0 fallos. Comando: `corepack pnpm vitest run "app/m/cn/recibir/_components/RecibirClient.test.tsx" "app/m/cn/recibir/actions.test.ts" --maxWorkers=1`. |
| `corepack pnpm vitest run` | **PASÓ** | 515 archivos, 6502 pruebas, 0 fallos. |
| `corepack pnpm docs:check` | **PASÓ** | Índice documental al día. |
| `corepack pnpm sdd:check` | **PASÓ** | 395 specs y 403 migraciones; sin números nuevos repetidos. Conserva avisos históricos ya aceptados. |
| `corepack pnpm verify` | **INCOMPLETO / NO DISPONIBLE** | Pasaron harness 12/12, lint (0 errores, 8 warnings ajenos), frontera RSC (1596 módulos), typecheck, 4 Edge Functions, Vitest 6502/6502, docs, numbering, constantes, componentes, gobierno, 145 contratos SQL y reconstrucción desde cero de 385 migraciones + 18 ledger-only. El ledger de producción fue omitido por falta de credenciales. E2E no pudo certificar: el primer webServer agotó 120 s; el segundo despachó 186 casos (153 pasaron, 15 fallaron por ausencia de `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, 18 se omitieron por falta de seed) y luego WebKit quedó colgado en teardown. La sesión se interrumpió tras el último caso, sin resumen JSON; no llegó al paso build. |
| `node scripts/check-build.mjs` | **PASÓ** | Build de producción aislado posterior: compilación, TypeScript y prerender 160/160; `.next-verify` limpio y `tsconfig.json` restaurado. Los avisos por Supabase ausente fueron tolerados por las rutas públicas y no rompieron el build. |
| `git diff --check` | **PASÓ** | Sin errores de whitespace. |
| E2E autenticado / Supabase real | **NO DISPONIBLE** | Faltan credenciales y seed en este worktree; no es verde ni regresión atribuible a esta tarea. |
| Revisión visual `/ui-check` | **NO EJECUTADO** | Queda expresamente en manos del Director antes de integrar. |
| Producción / UAT real | **NO EJECUTADO** | No autorizado; ninguna migración ni dato de producción fue tocado. |

Nota de shell: el comando literal con `&&` no fue aceptado por la versión local de
PowerShell, así que esa primera invocación no ejecutó checks. Se repitió con control
condicional de `$LASTEXITCODE`; ambos checks pasaron. Un recheck focal adicional bajo
alta contención agotó 60 s sin iniciar workers (0 tests); la repetición con un solo
worker produjo el verde final 6/6 indicado arriba.

## COMMITS

- Un commit selectivo contiene implementación, pruebas, SDD y este handoff. El SHA
  final queda en el propio PR y en el reporte de cierre de la sesión para evitar un
  segundo commit documental recursivo.

## PR / BRANCH

- Rama: `codex/a5-2-recepcion-movil-errores`.
- Base: `main` en `8ee41f19fb25cfe8b9cd4f01e8110ca507745ed2`.
- Destino autorizado: PR **en borrador** contra `main`. Este handoff se usa como
  cuerpo del PR; la metadata de GitHub conserva número, URL y SHA final.
- Merge, deploy y producción no están autorizados.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación o pruebas focales. La tarea queda lista para revisión;
las validaciones externas indicadas abajo no amplían la autorización del Worker.

## FUERA DE ALCANCE DETECTADO

- El lint global conserva 8 warnings preexistentes fuera del allowlist en pruebas
  de compras y componentes CRM (`NewPurchaseWizard.test.tsx`,
  `PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx`, `KommoClient.tsx`). Cero
  errores; no se tocaron.
- `sdd:check` conserva colisiones históricas ya aplicadas que el propio gate marca
  como no renumerables; no guardan relación con SDD-0154.
- El worktree no tiene credenciales/seed de Supabase: ledger de producción y E2E
  autenticado permanecen no disponibles. No se copiaron secretos.
- La revisión visual `/ui-check` corresponde al Director antes de integrar.

## HANDOFF AL DIRECTOR

1. Revisar el único commit y confirmar que el diff permanece dentro del allowlist.
2. Verificar en `/ui-check` los tres estados: rechazo de lookup, rechazo de recepción
   y `PGRST202` en chino, confirmando que el escáner reaparece y el banner persiste.
3. Tratar el E2E autenticado y el ledger como **NO DISPONIBLE**, no como verde. Si se
   quieren certificar, repetirlos en un entorno autorizado con credenciales y seed.
4. No asociar esta PR con el destrabe de 0449: no cambia la RPC ni autoriza migración,
   merge, deploy o producción.
