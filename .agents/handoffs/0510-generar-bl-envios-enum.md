# Handoff 0510 · El selector de «Generar Bill of Lading» filtra con las etiquetas reales del enum

- Fecha: 2026-10-14 03:12Z → 03:35Z (2026-10-13 noche, Caracas). Estado de tarea:
  **lista-para-revision**, con `pnpm verify` **NO EJECUTADO** (el turno pedido al Director expiró
  sin entregarse) y smoke en la UI **NO EJECUTADO** (depende del deploy).
- Owner/sesión: `claude-modest-chaplygin-generar-bl` (Claude Opus 5.5, Worker). Sesión de la app:
  «Arreglar el filtro de estado del modal Generar BL».
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/generar-bl-envios-enum`,
  creado con `harness-worktree.mjs start generar-bl-envios-enum`. Claim con
  `claim --owner claude-modest-chaplygin-generar-bl`; `guard --owner` revalidado antes de cada
  commit.
- Rama: `codex/generar-bl-envios-enum`, desde `origin/main` = `c80eea64`.
- SDD: [0510](../../docs/specs/0510-generar-bl-envios-enum/spec.md), reservada en local con
  `sdd:next --reserve generar-bl-envios-enum` (rama `codex/sdd-reserve-0510-generar-bl-envios-enum`,
  commit `5782a2e2`, **sin push**; incorporada aquí por cherry-pick como `a81d84fd`). Sin
  migración (la siguiente libre sigue siendo 0475).
- Permisos del encargo (Sam): worktree propio, SDD reservada, **PR al final, sin merge**.
  Confirmar el defecto con un doble o un Postgres local efímero, **nunca producción**.

## OBJETIVO ORIGINAL

Hallazgo de SDD-0509 (INFERIDO del código): `GenerateBLModal.tsx` filtra
`.not("status", "in", "(entregado,cancelado)")`, pero `shipment_status` sólo tiene etiquetas en
inglés; Postgres rechazaría el valor y el selector de embarques quedaría siempre vacío. 1) Confirmar
el comportamiento; 2) corregir a `(delivered,cancelled)` y agregar `.is("deleted_at", null)`;
3) prueba que muera con el mutante; 4) cierre con las comprobaciones del runbook y este handoff.

## COMPLETADO

### Diagnóstico: CONFIRMADO en local

- **Enum**: `0002_shipments.sql:15-29`, 13 etiquetas en inglés. Ninguna migración tiene
  `alter type … shipment_status` ni cambia el tipo de la columna (`alter column status`), ni lo
  borra o renombra (grep sobre `supabase/migrations/*.sql`).
- **Reproducción con PostgREST real** (`docs/specs/0510-generar-bl-envios-enum/evidencia/reproducir-postgrest.mjs`):
  `postgres:17` en red `--internal` y `postgrest/postgrest:v16.1` en `127.0.0.1`, enum copiado de la
  0002, supabase-js del repo. La cadena de main devuelve **HTTP 400, `22P02`,
  `invalid input value for enum shipment_status: "entregado"`, `data: null`**; la corregida
  devuelve sólo el embarque vivo y abierto. Salida completa en la spec, § Evidencia. Sin residuos
  de contenedores ni redes.
- **Efecto en la UI**: el modal hace `if (error || !data) setShipments([])` y muestra «No hay
  embarques activos. Crea uno desde Embarques primero.». Desde SDD-0034 (`596763ef`,
  2026-05-26) nadie pudo elegir un embarque en ese modal.
- **Producción: NO VERIFICADO.** No leí el enum ni filas en producción; que el enum vivo coincida
  con las migraciones es inferencia.

### Arreglo

`app/studio/_components/wiring/GenerateBLModal.tsx`:

- `const ESTADOS_SIN_BL: ShipmentStatus[] = ["delivered", "cancelled"]`, tipada con el espejo del
  enum: una etiqueta inexistente no compila (comprobado: TS2322, y TS2352 si se fuerza con `as`).
- `.not("status", "in", `(${ESTADOS_SIN_BL.join(",")})`)` y `.is("deleted_at", null)`.
- Se conserva el criterio original (sólo entregados y cancelados fuera; `draft` sigue ofrecido).
  No se toca `lib/studio/shipment-queries.ts`, que modifica la PR abierta de SDD-0509.

### Prueba

`app/studio/_components/wiring/__tests__/GenerateBLModal.test.tsx`, 6 casos. El doble lee las
etiquetas del enum de las migraciones (`create type` + `add value`/`rename value` posteriores) y
responde 400/22P02/`data: null` ante un valor fuera del enum en `status`, con el mensaje que dio
el PostgREST local. Aplica `eq/in/not.in/is`, ordena, corta, proyecta columnas, devuelve copias y
lanza si se filtra antes de `select()`. Fixture infeliz: cerrados y eliminado son los más
recientes.

## VALIDACIÓN

SHA observado: árbol de trabajo sobre `a81d84fd` (= `origin/main` `c80eea64` + reserva), antes de
los commits de esta tarea; los commits no cambian contenido respecto de lo validado.

| Comprobación | Resultado |
|---|---|
| Reproducción en Postgres + PostgREST efímeros (03:17Z) | PASÓ: main da 400/22P02; corregida, sólo `BL-VIVO`. Exit 0 |
| `vitest run` de la prueba nueva | PASÓ: 6/6 |
| Control rojo: la prueba contra el `GenerateBLModal.tsx` de `origin/main` | **FALLÓ como se esperaba**: 2 rojos, 4 verdes |
| Mutantes M1-M5 (etiquetas en español, sin `deleted_at`, sólo `delivered`, sólo `cancelled`, sin `.not`) | 5/5 **mueren** (2 rojos cada uno). Control sin mutar: 6 verdes; archivos restaurados byte a byte |
| Mutante del doble (sin validar el enum) + código de main | La prueba aislada **sobrevive**, como se esperaba: la validación del enum es la que ve el defecto; el control del doble se pone rojo |
| `vitest related --run` sobre `GenerateBLModal.tsx` | PASÓ: 1 archivo, 6 pruebas (ningún otro test importa el modal) |
| `pnpm typecheck` | PASÓ (dos veces; la segunda sobre la versión final de la prueba) |
| `eslint --max-warnings=0` sobre el modal y su prueba | PASÓ. El script de evidencia está ignorado por la config de eslint (`docs/**`) |
| `git diff --check` | PASÓ |
| `docs:check` · `sdd:check` · `governance:check` · `components:check` | PASÓ · PASÓ · PASÓ (28 políticas) · PASÓ |
| `check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 0 AMARILLO |
| `scripts/__tests__/spec-migration-refs.test.ts` | PASÓ: 5/5 |
| `pnpm verify` completo | **NO EJECUTADO**: pedí turno a «Revisión de tareas en progreso» entre las 03:17Z y las 03:23Z; el mensaje quedó retenido y **expiró sin entregarse** (otro modo de permisos). No lo lancé sin turno |
| Smoke en la UI (Documentos → Generar BL) | **NO EJECUTADO**: depende del deploy |
| `/ui-check` | NO APLICA: no cambia la presentación, sólo los datos que llegan al selector |
| `revisar-datos-ve` | NO APLICA: no captura, mueve ni borra datos personales; lee las mismas columnas que antes |

Gobernanza (AGENT-BRIEF): cambio de comportamiento con SDD y allowlist exacta → **cumplimiento**.
ERR-01 sobre el mensaje de error del modal → **no conformidad preexistente**, fuera de alcance
(abajo).

## COMMITS

- `a81d84fd` chore(sdd): reserva SDD-0510 — generar-bl-envios-enum
- fix(studio): SDD-0510 — el selector de Generar BL filtra con las etiquetas del enum (modal y prueba)
- docs(sdd): SDD-0510 — spec, reproducción, índice y handoff: el commit que contiene este documento

## PR / BRANCH

`codex/generar-bl-envios-enum` contra `main`, worktree de arriba. PR en **draft** mientras falten
`pnpm verify` y el smoke. Sin merge.

## PENDIENTES DE ESTA TAREA

1. **Turno de `pnpm verify`** con el Director (una corrida pesada a la vez). Sam: si la sesión
   Director sigue en otro modo de permisos, los mensajes no le llegan; hay que darle el turno a
   mano o igualar los modos.
2. **Smoke después del deploy** (lectura): Documentos → «Generar BL» con al menos un embarque
   abierto. El selector debe listarlo; un entregado, cancelado o eliminado no debe aparecer.
3. Pasar la spec a `done` y la PR a lista cuando 1-2 den PASÓ.

## FUERA DE ALCANCE DETECTADO

- **El modal se traga el error** (`GenerateBLModal.tsx`, `if (error || !data) setShipments([])`):
  ante un fallo de red o permisos sigue diciendo «No hay embarques activos. Crea uno», que es
  falso y manda a crear un embarque. Es lo que escondió este defecto desde mayo. No conformidad
  con ERR-01 (nivel Sistema: mensaje recuperable). Propuesta: un estado de error propio con
  reintento.
- **No hay red contra etiquetas de enum inventadas en filtros de texto.** `.not("status", "in",
  "(…)")` recibe un string y supabase-js no lo valida contra el tipo. Un grep de
  `"\((entregad|cancelad|en_transito|pendiente)` en `app/` y `lib/` (sin tests) sólo encontró este
  sitio. Los `.eq/.neq/.in("status", <español>)` encontrados son de otras tablas
  (`warehouse_receipts_cn`, `qr_print_orders`, `nomina_employee_registrations`,
  `nomina_employee_bank_changes`, `documents`, `supplier_charges`); sólo comprobé el dominio de
  `supplier_charges` (check en español, correcto). Los demás quedan sin revisar. Propuesta: una
  prueba estática que lea los enums y checks de las migraciones y valide los literales de `status`
  por tabla.
- **`draft` admite BL** en este modal, mientras `listActiveShipments` excluye `draft` del tracking.
  Si un borrador debe poder tener BL es decisión de producto; no lo cambié.
- **El BL sigue simulado** (código aleatorio y `alert` en lugar de PDF, V1 de SDD-0034).

## Conocimiento

- Impacto documental: spec nueva 0510 con su script de evidencia; índice `docs/specs/README.md`
  regenerado con `docs:index` (494 specs; los huecos 0508/0509 son las PR #200 y #203 aún
  abiertas). Ningún documento del piloto semántico cambió.
- `knowledge:status` (03:2xZ): `structural INVALID` y `semantic INVALID` porque este worktree nuevo
  no tiene `graphify-out/`. Graphify **no se corrió** (corrida pesada; la publica el Director desde
  main): NO DISPONIBLE aquí.
- `knowledge:visual:check`: `PENDING — ARCHIFY_RUNTIME_MISSING`; no descargué el runtime. NO
  DISPONIBLE. Obsidian: `PENDING` (lo publica el Director).

## HANDOFF AL DIRECTOR

Diff de producto de +11/−1 líneas en un componente, con reproducción contra PostgREST real,
control rojo contra main y mutantes, incluido uno del doble. Con #203 (SDD-0509) y #200
(SDD-0508) sólo comparte `docs/specs/README.md` (comprobado con
`git diff --name-only origin/main...<rama>`). Al integrar, el índice de specs choca con esas PR: usar el
driver de main y regenerar con el script. Falta el turno de `verify` y el smoke después del deploy.
Ownership: claim liberado al terminar la escritura.
