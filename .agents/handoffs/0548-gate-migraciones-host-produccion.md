# Handoff · SDD-0548 — el gate `migrations-applied` mide solo producción

- Fecha: 2026-10-17. Estado de la tarea: **lista-para-revision** (PR en borrador).
- Owner: Worker (Claude) `worker-gate-migraciones-host-20261017`, subagente del Director.
- Worktree: `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a8727444e64047c32`.
- Rama: `worktree-agent-a8727444e64047c32`. Base: `origin/main` `cdb7ff76`.
- SDD: [0548](../../docs/specs/0548-gate-migraciones-host-produccion/spec.md), reservada con
  `sdd:next --reserve gate-migraciones-host-produccion --push` (rama `codex/sdd-reserve-0548`,
  commit `cc783701`, comprobada en el remoto). `sdd:check` después de reservar: PASÓ.

## OBJETIVO ORIGINAL

Sam al Director, literal, el 2026-10-17: «Haz una tarea continua sin detenerte… trata de hacer
todos los trabajos pendientes». El Director encargó comprobar la sospecha NO VERIFICADA del
Worker de la SDD-0546 (`.agents/handoffs/0546-migraciones-servidor-propio.md:185-189`): el
comentario de `scripts/check-migrations-applied.mjs` sobre las esperas está vencido, y el gate
podría medir Supabase Cloud en vez de producción. Si medía Cloud o podía medirlo sin avisar,
había que arreglarlo.

Permisos: commits en la rama, push de la rama y de la reserva, PR en borrador. **No** fusionar,
**no** conectarse a ninguna base (ni al servidor ni a Cloud), **no** leer datos, **no** imprimir
valores de `.env`.

## Conclusión con evidencia (medido en `cdb7ff76`, sin conectarse a nada)

**Hoy no mide Cloud en ningún entorno, pero podía medirlo sin avisar.**

- **Conexión**: `check-migrations-applied.mjs:313-315` toma `NEXT_PUBLIC_SUPABASE_URL` y
  `SUPABASE_SERVICE_ROLE_KEY` de `.env.local` (`:102-117`) o del entorno. Hace un POST a la RPC
  (`:292`) sin validar el host, y los mensajes dicen «ledger de prod» (`:347`, `:405`) sin
  nombrarlo. `verify.mjs:485` lo corre como paso crítico.
- **Local**: no hay `.env.local` en el checkout principal ni en ningún worktree. Lo comprobé por
  existencia de archivo, sin leer valores. El shell tampoco exporta las variables, así que da
  SKIP. Coincide con `.agents/handoffs/c-l05-portal-perfil-privado.md:447`.
- **`.env.example`**: la URL y la clave van vacías (`.env.example:112`, `:118`).
- **CI**: `quality.yml` no lo corre (job «Calidad local sin secretos», `:21`; pasos `:49-96`).
- **Servidor**: no lo corre. `publicar-web.sh:309-315` lee el ledger con psql en el contenedor
  de la base, y `publicable.mjs:44` solo reutiliza `findMissing`. El `.env` del servidor apunta
  a producción (`infra/dtd-cargo/.env.example:67`).
- **El riesgo**:
  - `docs/agents/README.md:61` mandaba poner en `.env.local` la URL de Cloud.
  - Cloud sigue vivo, porque la Fase 4 está pendiente (`servidor-contabo.md:920`), y su ledger
    quedó congelado en el corte.
  - Con esa configuración, el gate daba rojos y verdes falsos etiquetados «prod».
- **Comentario vencido**: decía que las esperas eran «0017 y 0257» (`:41-42`). En el baseline
  hoy son la 0422 y la 0423.

## COMPLETADO

- **`scripts/check-migrations-applied.mjs`**:
  - Dos funciones puras nuevas: `clasificarDestino` y `motivoSinMedir`, además de la constante
    `ORIGEN_PRODUCCION`.
  - Solo mide en `https://supabase.dtdcargo.com`. Cloud, otro host, `http`, un puerto, una URL
    con usuario o clave o una URL ilegible dan SKIP antes de leer el baseline, git o la red.
  - Imprime el origen medido, sin credenciales, en el conteo, los rojos y el OK.
  - Usa `redirect: "manual"`.
  - Se corrigió el comentario de las esperas y se quitó el voseo de los mensajes tocados.
- **`scripts/check-migrations-applied.test.mjs`**: 14 pruebas nuevas.
  - 8 son puras.
  - 6 corren el gate completo con un `fetch` doble (`node --import`) y git sin repositorio.
  - Ninguna toca la red ni una base.
- **Documentos al día**: el comentario del paso en `verify.mjs`, el §11 de
  `docs/runbooks/aplicar-migraciones-prod.md` y `docs/agents/README.md:61`, que ahora dice
  producción, con una nota en su propia línea para no romper el parser del gate.
- **Spec**: 0548 completa e índice regenerado.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run` de `scripts/check-migrations-applied.test.mjs` y `scripts/__tests__/env-example-contract.test.ts` | `5b805cea` | PASÓ · 37/37 |
| 11 mutantes (script en el scratchpad, restaura el archivo) | `5b805cea` | PASÓ · 11/11 muertos, archivo restaurado |
| `node scripts/check-migrations-applied.mjs` sin credenciales | worktree | PASÓ · exit 3, SKIP «sin NEXT_PUBLIC_SUPABASE_URL…» |
| ESLint de los 3 scripts tocados | `5b805cea` | PASÓ |
| `docs:check` | `5b805cea` | PASÓ · 534 specs |
| `sdd:check` | `5b805cea` | PASÓ |
| `git diff --check` | `5b805cea` | PASÓ |
| `pnpm verify`, una sola corrida, 21:17-21:45Z, en una ventana con 3 min sin procesos node grandes | `e2f12db5` | **FALLÓ** solo en `test` (detalle abajo). PASARON harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO · 0 AMARILLO), sql-tests, schema-rebuild, e2e (177 ✓, 20 omitidas, 1 inestable) y build. `migrations-applied`: NO DISPONIBLE (SKIP sin credenciales; crítico sin medir) |
| `verify` · `test`, primer intento | `e2f12db5` | FALLÓ 2: `env-example-contract`, que es **mío** (el doble leía `process.env.DOBLE_*`), y `TransportistasPanel.test.tsx › ante un error conserva lo escrito…`, que es ajeno |
| `verify` · `test`, reintento | `e2f12db5` | FALLÓ 1: solo `env-example-contract`. 11.160 ✓ y 1 omitida. `TransportistasPanel` pasó: inestable bajo carga |
| Corrección del doble | `5b805cea` | Lee `doble-config.json` en vez de variables, sin tocar el contrato; las dos suites afectadas, 37/37. `verify` completo no se repitió: el encargo pide una sola corrida |
| Merge de `origin/main` `811659b2` (PR #267: registro de la 0546 y la 0547), sin conflictos | `dd8f4366` | `docs:check` PASÓ (534 specs), `sdd:check` PASÓ, las dos suites afectadas 37/37 |
| Gate contra Cloud o contra producción reales | — | NO EJECUTADO: prohibido por el encargo; cubierto con dobles |

## COMMITS

- `cc783701` reserva SDD-0548 (stub, de la rama de reserva).
- `026b9d9d` el gate mide solo producción, pruebas, runbook, docs y spec.
- `e2f12db5` espacio del conteo y prueba de la línea entera.
- `5b805cea` el doble de `fetch` lee su configuración de un archivo (rojo de `verify`).
- `4658d476` handoff y evidencia de `verify` en la spec.
- `dd8f4366` merge de `origin/main` `811659b2`.
- Commit que contiene este documento: registro del merge.

## PR / BRANCH

- Rama `worktree-agent-a8727444e64047c32` → `main`, PR en borrador (URL en el informe del Worker).
- Worktree: la ruta de arriba.

## PENDIENTES DE ESTA TAREA

- Fusionar: lo decide el Director. La SDD queda `in-progress` hasta entonces.

## FUERA DE ALCANCE DETECTADO

1. **SDD-0540, «Opcional (Fase 4)»** (`docs/specs/0540-entorno-prueba-staging/spec.md:253`):
   propone correr este gate contra el ledger de prueba cambiando el entorno. Desde esta SDD eso
   da SKIP. Hace falta una opción explícita que cambie el origen esperado y la etiqueta. Además,
   la cita `check-migrations-applied.mjs:313-318` de esa spec quedó corrida.
2. **Citas viejas de líneas de este script**: `docs/architecture/decisions/0002-merge-semantico-registros-generados.md:244`
   (`:351-355`) y `docs/specs/0247-torre-de-control-externa/spec.md:83`. Son evidencia fechada;
   no se tocaron.
3. **Documentos que todavía nombran Cloud como producción**:
   - `docs/engineering/project-rules.md:129` (MCP con `project_ref` de Cloud);
   - `docs/architecture/stack-tecnico.md:21`, `:94`;
   - los runbooks de Kommo, `setup-portal-auth.md` y `deploy-orden-venta-0072.md`.

   Van con la Fase 4, paso 4 (`servidor-contabo.md` §4).
4. **`app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx`**:
   «ante un error conserva lo escrito, enfoca el aviso y permite reintentar» falló en el primer
   intento de `verify` y pasó en el reintento. Es inestable bajo carga; no tiene relación con
   este diff.
5. **Voseo en mensajes del gate que no toqué**: «sacalo», «Buscá», «Llevá», «declaralo»,
   «Aplicala», «agregala», «subí», «querés». Son las instrucciones de los rojos.

## Impacto documental

- Documentos canónicos actualizados: `docs/runbooks/aplicar-migraciones-prod.md` §11 y
  `docs/agents/README.md`. Spec 0548 nueva e índice regenerado.
- Graphify estructural: NO EJECUTADO. El worktree no tiene `graphify-out/graph.json`, y
  `knowledge:status` da `structural INVALID` por eso. Lo actualiza el Director al integrar.
- Piloto semántico: ninguno de los archivos tocados está en las 16 fuentes del piloto
  (comprobado contra `knowledge:status`). No hay recibo que emitir.
- Archify: PENDING. Falta el runtime (`ARCHIFY_RUNTIME_MISSING`) en el worktree; no se construyó
  el mapa.
- Obsidian: sin publicar. La bóveda la publica el Director desde main.

## HANDOFF AL DIRECTOR

- Revisa la PR en borrador. Es un cambio de harness sin migraciones y sin código de la app.
- Al fusionar, un `.env.local` que apunte a Cloud da SKIP con el motivo, en vez de medir la
  copia congelada.
- Si se quiere el gate en verde en algún equipo, ese `.env.local` tiene que apuntar a
  `https://supabase.dtdcargo.com`, con la clave del servidor. Copiarla es decisión de Sam: no se
  copió nada.
- Ownership liberado al terminar (ver abajo).
