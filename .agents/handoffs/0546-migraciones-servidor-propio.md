# Handoff 0546 · Migraciones en la base del servidor propio: scripts y runbook

- Fecha: 2026-10-17 (Caracas = UTC − 4).
- Owner/sesión: `worker-migraciones-vps-267f5ded`, Claude Code Worker, subagente del Director. Claim del harness tomado al empezar.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-a45b365ecf8ef2444`
- Rama: `worktree-agent-a45b365ecf8ef2444`, base `main` `c2fabdcc`.
- SDD: [0546](../../docs/specs/0546-migraciones-servidor-propio/spec.md), `in-progress`.
  - Reservada con `sdd:next --reserve migraciones-servidor-propio --expect 0546 --push`.
  - Refs: `refs/heads/codex/sdd-reserve-0546-migraciones-servidor-propio` (`e5ff9fc3`), publicada como `codex/sdd-reserve-0546`.
  - El stub no se fusiona: la spec entra por esta rama.
- Migración: ninguna.
- Encargo (Director, 2026-10-17): Sam le dijo, literal, «arranca la tarea de las migraciones del VPS».
  - Autoriza: commits en esta rama, push de la rama y de la reserva, y PR en borrador contra `main`.
  - Prohíbe: fusionar, ssh al VPS, conectarse a cualquier base, aplicar migraciones, leer filas e imprimir secretos.
  - Turno: una sola `pnpm verify` al final, sin otra corrida pesada en la máquina.

## OBJETIVO ORIGINAL

Que aplicar una migración en la base de producción del servidor propio
(`dtd-cargo-db-1`, proyecto `dtd-cargo`) sea un procedimiento del repositorio, con
scripts probados y runbook. Hasta ahora eran scripts sueltos del Director. Es
condición de la Fase 4 del plan de retiro (pausa de Supabase Cloud el miércoles
28 de octubre).

## COMPLETADO

- **`infra/ops/migraciones/`** (nuevo). Lleva al repo los cinco scripts del
  scratchpad del Director (`generar-apply.cjs`, `armar-preflight.cjs`,
  `aplicar-en-vps.sh`, `aplicar-lote-239.sh`, `retirar-espera.cjs`). Se leyeron como
  referencia y no se ejecutaron. Cuatro piezas:
  - `preparar.mjs` (checkout): paquete desde el blob exacto del SHA. Contiene:
    - lectura previa de solo lectura: ledger, «ya aplicada», sesiones con locks,
      **deriva** de los cuerpos vivos contra el repo y el `$preflight$` propio
      (rechaza si escribe);
    - el envoltorio de `lib/migracion.sh`, byte a byte;
    - la verificación: una fila, md5 y bytes del ledger, y el cuerpo vivo de cada
      función creada;
    - `IDENTIDAD.txt` y `SHA256SUMS`.
  - `aplicar.sh` (VPS): todas las guardas antes de tocar docker:
    - `--confirm` y la migración esperada;
    - el md5, `SHA256SUMS`, solo lectura de la previa y de la verificación;
    - el envoltorio rehecho y el `created_by` del destino;
    - en producción, una autorización que **nombre el número** de la migración.

    Además: modo en seco, candado, lectura previa obligatoria, apply en una
    transacción, verificación, evidencia con `SHA256SUMS` y psql con
    `VERBOSITY terse` y `SHOW_CONTEXT never`. Códigos 0/2/3/4/5/6/7.
  - `aplicar-remoto.sh` (equipo del operador): exige que el servidor tenga los
    scripts de este checkout (sha256), scp y ssh de a una, para en la primera
    falla y trata el ssh caído (255) como «no se sabe si se aplicó».
  - `retirar-espera.mjs`: quita la espera y sus declaraciones sin reformatear y
    lista las pruebas que la afirman.
- **Runbook** `docs/runbooks/aplicar-migraciones-prod.md` reescrito para el servidor
  propio:
  - antes de pedir el OK, el pedido, aplicar, lote, merge inmediato y cierre;
  - ledger y evidencia, vuelta atrás, deriva y la puerta de `publicar-web.sh`;
  - esperas y gates, cómo probar las piezas, y Cloud como **histórico**, con tuteo.
- **Referencias al flujo viejo, buscadas por valor**
  (`aplicar-migraciones-prod`, `apply_migration`, conector, `xpfuzqombmjmxvprjgmi`):
  - `docs/engineering/project-rules.md`: producción ya no es el `project_ref` de
    Cloud, y escribir usa `infra/ops/migraciones/`;
  - `docs/runbooks/servidor-contabo.md` §4: la condición de la Fase 4 y por qué se
    descartó `supabase migration up`;
  - `docs/runbooks/entorno-prueba.md` §4;
  - `infra/ops/README.md`;
  - el comentario y el mensaje de `infra/ops/migrate/aplicar-migracion.sh` (sin
    cambiar su comportamiento).

  Las cabeceras de migraciones y las specs y handoffs fechados no se tocan.
- **SDD-0546**: contexto medido, alternativas, diseño, límites, decisiones para
  Sam, gobernanza, aceptación y allowlist.

## VALIDACIÓN

Nada se conectó al VPS ni a una base real: dobles de docker, ssh y scp, y
PostgreSQL embebido (PGlite).

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| `infra/ops/tests/prueba-migraciones-produccion.sh` (dobles) | árbol de `70c54b0d` | **PASÓ**: 63 PASÓ · 0 FALLÓ |
| `… --mutantes` (control rojo y mutantes de `aplicar.sh`, `aplicar-remoto.sh` y `preparar.mjs`) | `70c54b0d`, 18:32Z → ~19:00Z, sin otra corrida pesada | **PASÓ**: control rojo con 44 FALLÓ; 30 muertos · 0 vivos |
| `vitest run infra/ops/tests/migraciones.test.mjs` | `db402011` | **PASÓ**: 27/27 (77 s) |
| Cuerpo extraído = `prosrc` en PGlite, migraciones reales ≥ 0400 | `db402011` | **PASÓ**: 123 comparadas, 123 iguales, 6 saltadas (tipos del resto del esquema) |
| Mutantes del SQL generado (lectura previa, deriva, verificación, envoltorio, máscara) contra Vitest | `db402011`, 19:02Z → ~19:17Z | **PASÓ**: 11 muertos · 0 vivos; original restaurado y otra vez 27/27; `preparar.mjs` sin diff contra el commit |
| `preparar.mjs` sobre la 0491 real (identidad) | `HEAD` | **PASÓ**: blob `fe32d0b3…`, md5 `22c72cb6ae0ee8fa85040c8bbc469bd8`, 12175 bytes; iguales a la fila del ledger `20261016081616` que registró el commit `2bb0c817` |
| Barrido de los 485 archivos de `supabase/migrations` | `c2fabdcc` | **PASÓ**: 119 `$preflight$` de nivel superior y ninguno escribe. Los 3 que no se extraen (0286-0288) están dentro de cadenas de reparación del ledger, igual que los 89 `create function` no extraídos |
| `pnpm docs:check` · `pnpm sdd:check` · `git diff --check` | `a7448d6f` | **PASÓ** (532 specs; numbering sin repetidos) |
| `pnpm verify` completo (la única corrida; turno del encargo, sin otra corrida pesada al empezar) | `a7448d6f`, 19:18:06Z → 19:45:24Z (27 min) | **exit 1 por un paso.** El detalle, paso a paso, en la lista de abajo |
| `pnpm verify` › repetición aislada de las 3 pruebas que vencieron | 19:45:58Z | **PASÓ**: 3 archivos, 26/26 en 4,2 s. El rojo fue de tiempos bajo la carga de la propia corrida, no una regresión |
| `pnpm knowledge:status` (al empezar y al cerrar) | `c2fabdcc` / `a7448d6f` | **NO DISPONIBLE** como vigente: este worktree no tiene `graphify-out` (estructura `INVALID`, 3538 faltantes; semántica `INVALID`; Obsidian en `6da8aebc`). No es un efecto de esta rama |
| `pnpm knowledge:visual:check` (Archify) | `a7448d6f` | **NO DISPONIBLE**: `ARCHIFY_RUNTIME_MISSING` (falta el runtime en `graphify-out/archify-package`). No se descargó |
| Prueba efímera con Docker de estos scripts | — | **NO EJECUTADO**: las pruebas de PGlite cubren el SQL. Una prueba con Docker sería otra corrida pesada |

Detalle de `pnpm verify` por paso:

- `harness`: PASÓ, 214/214.
- `lint`: PASÓ, 0 errores y 15 avisos en archivos que esta rama no toca
  (`KommoBoardView.tsx`, `KommoClient.tsx`, `DocumentCalculator.tsx`, pruebas de
  compras y `knowledge-vault.mjs`).
- `rsc-boundary`, `typecheck` y `edge-functions` (4): PASÓ.
- `test`: **FALLÓ** por tiempo.
  - Primera corrida: 1 fallida de 11.066 (785 archivos pasaron). Fue
    `__tests__/fuentes-locales.test.ts`, que recorre `app/`, `lib/` y
    `components/` y tardó 30,6 s con un límite de 20 s.
  - Reintento: 3 por tiempo. Las tres recorren el repo: `fuentes-locales`,
    `lib/db/__tests__/session-cookie.test.ts` y
    `components/AvisoEntornoPrueba.test.tsx`.
- `docs:check`, `numbering`, `feature-constants`, `components:check` y
  `governance:check`: PASÓ.
- `migrations-applied`: **NO DISPONIBLE** (SKIP: sin `NEXT_PUBLIC_SUPABASE_URL` ni
  `SUPABASE_SERVICE_ROLE_KEY`; el worktree no tiene `.env.local` por diseño).
- `pending-migration-symbols`: PASÓ (0 ROJO, 0 AMARILLO).
- `sql-tests` y `schema-rebuild` (467 de 485 migraciones desde cero): PASÓ.
- `e2e`: PASÓ (177 pasaron, 1 flaky en `e2e/auth.spec.ts:81` y 20 omitidas).
- `build`: PASÓ.

No se repitió la `verify`: el encargo daba una sola corrida.

**Impacto documental.**

- Documentos canónicos actualizados:
  - `docs/runbooks/aplicar-migraciones-prod.md`;
  - `docs/engineering/project-rules.md`, fuente del piloto semántico;
  - `docs/runbooks/servidor-contabo.md`;
  - `docs/runbooks/entorno-prueba.md`;
  - `infra/ops/README.md`.
- Spec nueva: 0546.
- Estructura de Graphify, recibo semántico y vista de Obsidian: no se generaron en
  el worktree. Pendientes del Director desde `main` integrado (pendiente 5).

## COMMITS

| Commit | Qué |
|---|---|
| `db402011` | `feat(infra)`: los cuatro scripts de `infra/ops/migraciones/` y sus dos pruebas |
| `5d42f70f` | `docs`: runbook reescrito y referencias al flujo viejo |
| `70c54b0d` | `test(infra)`: mutantes de `preparar.mjs` en la suite bash |
| `b5ccd0ee` | `docs(sdd)`: spec 0546 e índice |
| `a7448d6f` | merge de `origin/main` `05b321de` (PR #114, Portal; sin solape con esta rama) |
| commit que contiene este documento | `docs(handoff)`: este handoff |

## PR / BRANCH

- PR **en borrador** contra `main` desde `worktree-agent-a45b365ecf8ef2444`. Su URL
  queda en la propia PR (`gh pr list --head worktree-agent-a45b365ecf8ef2444`) y
  en el informe al Director. No se agrega un commit después del push solo para
  anotarla.
- Reserva publicada: `codex/sdd-reserve-0546` (`e5ff9fc3`), solo con el stub. Se
  borra cuando la spec esté en `main`.
- Worktree: la ruta de arriba. Base de la rama: `c2fabdcc`, al día con `main`
  `05b321de` por el merge `a7448d6f`.

## PENDIENTES DE ESTA TAREA

1. Revisión del Director y merge, con el OK de Sam. Fusionar en `main` dispara la
   imagen y la publicación automática (SDD-0541). Este diff no toca código de la
   app: solo `infra/ops`, docs y pruebas.
2. Después del merge, **instalar en el VPS** `infra/ops/migraciones/aplicar.sh` y
   `infra/ops/lib/migracion.sh` desde `main`, en `/srv/ops/migraciones/` y
   `/srv/ops/lib/` (runbook §1), y comparar los sha256. Es una escritura en el
   servidor: necesita OK y la hace la sesión de Contabo o el Director. Sin eso,
   `aplicar-remoto.sh` se niega, que es lo que se busca. Si `/srv/ops/lib/migracion.sh`
   ya está instalado por la SDD-0540: NO VERIFICADO.
3. Primera aplicación real con este procedimiento (la próxima migración con OK
   nominal), registrada en su SDD. Recomendado: antes, un ensayo con
   `--proyecto dtd-cargo-staging` sobre la base de prueba.
4. Decisiones para Sam (spec): autorización nominal por archivo, `igual sin
   comentarios` no frena e instalación en `/srv/ops`.
5. **Recibo semántico de `docs/engineering/project-rules.md`.** Es fuente del
   piloto `canonical-16-2026-09-16` y cambió en esta rama. Este worktree no tiene
   `graphify-out` (estructura `INVALID`: 3538 faltantes; Archify sin runtime), y el
   recibo no se emite en un worktree: lo emite el Director al publicar desde `main`
   integrado. Hasta entonces el piloto queda PENDING por esta fuente.

## FUERA DE ALCANCE DETECTADO

1. **Comentario probablemente vencido en `lib/calculadora.ts:236-241`.** Dice que
   la 0255 «todavía NO está aplicada a producción». Pero
   `.agents/handoffs/0478-tarifa-programada-a-futuro.md:172` registra la fila del
   ledger `20260720194914 · 0255_rates_public_calc_modo`. Esta sesión no lo
   comprobó contra producción: NO VERIFICADO.
2. **`scripts/check-migrations-applied.mjs`**: su comentario dice que
   `pendingBelowCutoff` cubre «hoy: 0017 y 0257». Hoy son la 0422 y la 0423. Además,
   el gate lee el ledger en la URL de Supabase configurada. Si en CI o en algún
   equipo `NEXT_PUBLIC_SUPABASE_URL` todavía apunta a Cloud, el gate mediría la
   copia del corte y no producción: NO VERIFICADO.
3. **Runbooks de despliegues viejos** que nombran `apply_migration` o el MCP de
   Cloud: `deploy-kommo-writeback.md:29`, `deploy-orden-venta-0072.md:53` y
   `deploy-kommo-push-client.md:30,77`. El último trata de Edge Functions y
   secretos, no de migraciones. La Fase 4, paso 4 de `servidor-contabo.md`, ya pide
   las notas «desde <fecha> esto vive en el VPS» para otros cinco documentos;
   conviene sumarlos.
4. **Pruebas bash de la 0541 y la 0543 fuera de la suite.** `prueba-publicar-web.sh`
   pide flock de Linux y `prueba-aplicar-lote.sh` se corre a mano: ni Vitest ni el
   CI las ejecutan (`scripts/__tests__/entorno-prueba-scripts.test.mjs` corre otras
   tres). Las de esta SDD sí entran en `pnpm test`, por
   `infra/ops/tests/migraciones.test.mjs`.
5. **El plan del Director**, `.agents/handoffs/plan-retiro-vercel-supabase-20261016.md`
   (:45, :55, :92), sigue con «reescribir el runbook» como pendiente. Lo actualiza
   el Director al integrar.
6. **El `sha256sum` de Git para Windows escribe `hash *archivo`** (modo binario).
   Un script que lea SHA256SUMS con dos espacios fijos falla en Windows y pasa en
   Linux. Aquí ya se acepta `[ *]`; no se revisaron otros scripts.

## HANDOFF AL DIRECTOR

- **Siguiente acción.** Revisar la PR en borrador: diff, spec y runbook. Lo
  normativo nuevo está en el runbook §3-§4 y §9-§10:
  - el archivo de autorización tiene que nombrar el número de cada migración;
  - la deriva frena salvo `--acepta-deriva`;
  - `igual sin comentarios` no frena;
  - no se fusiona una PR con su migración sin aplicar, porque la puerta frena
    toda publicación posterior.
- **Decisiones para Sam** (spec): las tres de arriba. La recomendación es sí a las
  tres.
- **Clasificación de `verify` que propongo:**
  - `test` FALLÓ por tiempo (3 pruebas que recorren el repo, ajenas a esta
    rama), y aisladas PASARON 26/26;
  - `migrations-applied` NO DISPONIBLE (sin `.env`);
  - todo lo demás PASÓ.

  Si no la aceptas, la repetición necesita otro turno.
- **Compartido con otras tareas:**
  - `infra/ops/lib/migracion.sh` (SDD-0540) no cambió: el ejecutor lo reutiliza
    y la paridad está probada.
  - `migrate/aplicar-migracion.sh` cambia solo de texto, y su prueba sigue igual
    (35 PASÓ en el control del principio).
- **Después del merge:**
  - instalar en `/srv/ops` (pendiente 2);
  - recibo semántico de `project-rules.md` y publicación de Graphify, Archify y
    Obsidian desde `main` (pendiente 5);
  - actualizar el plan de retiro (fuera de alcance 5);
  - borrar la reserva `codex/sdd-reserve-0546` (y su ref local) cuando la spec
    esté en `main`.
- **Sesiones consumidoras:** ninguna conocida. Otro Worker del mismo Director
  (`agent-a0f15ba72118d43b0`) corrió dos `pnpm verify` a las 17:48Z y a las
  18:09Z. Pausé mis mutantes durante la segunda y corrí la mía cuando la máquina
  quedó libre.
- **Ownership:** se libera el claim al terminar la escritura, después del push.
