# Handoff · SDD-0561 — candado de las migraciones aplicadas

- **Fecha:** 2026-10-19
- **Owner / sesión:** Worker `worker-candado-migraciones-20261019` (subagente del Director)
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-aff14a24b697af5bb`
- **Rama:** `worktree-agent-aff14a24b697af5bb`. Base `origin/main` `3f3a52cc`, actualizada
  con `origin/main` `03cd4cf8` (merge `c712f340`) y `6c3f0a9f` (merge `a5c5ab37`).
- **SDD:** [0561](../../docs/specs/0561-candado-migraciones-aplicadas/spec.md). Reservada con
  `sdd:next --reserve candado-migraciones-aplicadas --push` (ref `codex/sdd-reserve-0561`, commit
  `a6060c2f`, publicada). `sdd:check` en verde en cada ronda.
- **PR:** https://github.com/hailuwaycom-sketch/DTDCARGO/pull/282 (borrador).
- **Estado de la tarea:** lista-para-revision. Estado SDD: `in-progress`.

## Objetivo

Cerrar el hallazgo MIG-05 de la auditoría de Contabilidad
(`docs/audits/2026-10-18-contabilidad-anexo-hallazgos.md:1927-1931`): nada en el repo
impedía editar una migración ya aplicada en producción. Fijar la identidad de cada
migración aplicada con un candado y una prueba que falle si un archivo sellado cambia,
se borra o se renombra.

## Permisos (encargo del Director, 2026-10-19)

Sam, literal: «trata de avanzar todos los pendientes… todas las tareas que puedas
avanzar». Autorizado: commits en esta rama, push de esta rama y de la reserva de la SDD,
y una PR en borrador. **No** autorizado: fusionar, tocar producción o el servidor,
editar migraciones existentes ni conectarse a la base.

## OBJETIVO ORIGINAL

1. Reservar la SDD y correr `sdd:check`.
2. Candado en el repo con la identidad de cada migración aplicada y una prueba que falle
   si un archivo listado cambia, se borra o se renombra. Una migración nueva entra al
   aplicarse; agregarlo al runbook y, si es simple, a `preparar.mjs` o
   `retirar-espera.mjs`.
3. Decidir y justificar el conjunto; tratar aparte las esperas 0422 y 0423; revisar las
   LEDGER_ONLY.
4. Mecanismo explícito y revisable para las excepciones.
5. Control rojo y mutantes del verificador.
6. Cierre con pruebas, `docs:check`, `sdd:check`, handoff y PR en borrador.

**Ronda 2** (mensaje del Director durante la tarea, 2026-10-19):

1. Corregir la afirmación «el md5 y los bytes son los mismos que compara el ledger» en
   el `$doc`, la spec y el runbook.
2. Registrar el cruce con el ledger en la spec (criterio 8) y en el handoff.
3. Opcional: marcar en el candado las verificadas, con un campo nuevo que no cambie la
   identidad sellada.

Después correr `harness:test`, `docs:check` y `sdd:check`, y hacer push. Sin fusionar.

## COMPLETADO

### Ronda 1

- **`supabase/migrations.lock.json`**: 483 entradas `nombre → { sha256, md5, bytes }`,
  generadas con `crear --hasta 491` sobre los archivos de main `3f3a52cc`.
- **Conjunto**: todo hasta la 0491 menos las esperas 0422 y 0423. Son 250 por encima del
  corte y 233 por debajo, con las 18 LEDGER_ONLY incluidas sin trato aparte.
- **`scripts/migrations-lock.mjs`**: `verificar` (FORMATO, FALTA, CAMBIADA, ESPERA,
  SIN_SELLO, HISTORIA), `sellar --md5`, `excepcion --motivo --autorizacion` y
  `crear`, que corre una sola vez.
- **Prueba del harness** con el repo real y un ancla del conjunto inicial que funciona
  sin git (`10d5eb20…`, 483 entradas).
- **`retirar-espera.mjs`** sella al cerrar y exige `--md5`.
- **Runbook**: §1, §6, §8 y §12.

### Ronda 2 (corrección del Director)

- **Afirmación corregida.** La identidad sellada es la del **archivo del repo**.
  Coincide con la fila del ledger solo en las entradas con `ledger`. Se corrigió en el
  `$doc` del candado (y en `DOC` del script), en la spec (resumen, § El candado, ciclo
  y excepción), en el runbook (§6, §7 y §8) y en la cabecera del script.
- **Campo nuevo `ledger: { fecha, forma }`**, con `forma` = `exacta`,
  `sin-salto-final` o `con-crlf-final`. No cambia la identidad sellada, no entra al
  ancla ni a `HISTORIA`, y no guarda ningún md5 del ledger.
- **Comando nuevo** `migrations-lock.mjs ledger <filas.json> --fecha`. Clasifica un
  volcado `[{ name, md5, bytes }]` (fuera del repo) y marca las coincidencias. Se
  niega (3) si contradice una marca previa o si repite un nombre, y sale con 2 si una
  fila está mal formada. Acepta filas sin texto (`statements` nulo) y las cuenta como
  distintas.
- `sellar` y `retirar-espera` marcan la entrada nueva `ledger` exacta, porque su md5
  es el que la verificación del apply comparó con el ledger.
- **143 entradas marcadas** con la fecha 2026-10-19. Las 483 identidades siguen iguales
  (comparación contra `HEAD` en verde).

## Cruce con el ledger — 2026-10-19, medido por el Director

Lectura `READ ONLY` de `supabase_migrations.schema_migrations` en producción hecha por
el **Director**: `md5` y `octet_length` de `array_to_string(statements,'')`, con la
consulta de este handoff. Resultado en
`…/scratchpad/cruce-candado-ledger-20261019.json`, fuera del repo. Esta sesión no se
conectó a la base.

| Conteo | Fuente |
|---|---|
| 428 filas del ledger con nombre `NNNN_` | Director |
| 95 coinciden en md5 y bytes (de `0026_welcome_email_template_seed` a `0491_freight_carriers_auditoria`) | Director |
| 325 distintas (49 en ±3 bytes) | Director |
| De esas 325, 28 son el archivo **sin su salto final** y 20 el archivo **con un CRLF agregado**: el mismo texto, con las convenciones de Cloud del runbook §7 | Worker, sobre el archivo del Director |
| Quedan 277 distintas: otro texto de la era Cloud. Una tiene `statements` nulo (`0211_revoke_authenticated_rpc_sweep`) y otra difiere en 1 byte sin corresponder a ninguna variante (`0351_operario_rpc_exige_rol`) | Worker |
| 63 selladas sin fila con su nombre, todas ≤ 0238 (por ejemplo `0001_init_tenancy`, `0002_shipments`, `0008_warehouses_cn`) | Director |
| 8 filas del ledger sin archivo en el repo (FUERA DE ALCANCE) | Director |
| Las 250 selladas por encima de 238 tienen fila con su nombre exacto; la 0422 y la 0423 no están en el ledger. Confirma el conjunto | Worker, sobre el archivo del Director |
| **Marcadas `ledger`: 143** (95 exactas, 28 `sin-salto-final` y 20 `con-crlf-final`) | `migrations-lock.mjs ledger` |

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `node --test scripts/tests/migrations-lock.node.mjs` | ronda 2, árbol final | PASÓ 22/22 |
| `pnpm harness:test` (`run-harness.mjs`) | merge `a5c5ab37`, 25 archivos | PASÓ 237/237 |
| `vitest run infra/ops/tests/migraciones.test.mjs` | archivo completo, merge `a5c5ab37` | PASÓ 30/30 |
| `eslint` de los dos scripts y `git diff --check` | ronda 2 | PASÓ |
| Control rojo en disco (ronda 1) | un byte de `0464_reporte_pago_factura_pagada.sql` | PASÓ: la prueba cayó y la CLI dio `CAMBIADA`. Archivo restaurado (sha256 `42792803…`) |
| Mutantes (corredor fuera del repo, TAP) | 58 del verificador y 4 de `retirar-espera` | PASÓ 62/62 tras corregir una fixture: «variantes sobre un archivo cambiado» sobrevivía porque la fila de prueba no era una variante del archivo cambiado. Ninguno muere por error de carga (máximo 15 de 22 rojas) |
| Identidades tras marcar | `migrations-lock.mjs --base HEAD` y comparación de las 483 entradas | PASÓ: 0 identidades cambiadas, `HISTORIA` verde |
| `docs:check` · `sdd:check` | árbol final | PASÓ |
| CI «Calidad continua» | ronda 1, `594878dc` (corrida 39204685427) | PASÓ, todos los pasos. La ronda 2 la vuelve a correr al hacer push |
| `pnpm verify` | — | NO EJECUTADO: cambio de harness, scripts y docs, sin producto ni paso nuevo; los pasos que alcanza se corrieron aparte |
| `pnpm knowledge:status` | ronda 1 | structural y semantic INVALID: el worktree no tiene derivados de Graphify. Archify NO DISPONIBLE |

## COMMITS

- `a6060c2f` reserva de la SDD-0561
- `f73ddb0e` candado, verificador y prueba
- `4cbe7396` `retirar-espera` sella con el md5 aplicado
- `95227895` spec, runbook e índice
- `c712f340` merge de `origin/main` `03cd4cf8`
- `594878dc` handoff de la ronda 1
- `25660cd3` ronda 2: marca `ledger`, comando, pruebas y el candado marcado
- `34075a62` ronda 2: spec y runbook (cruce con el ledger; la identidad es la del archivo)
- `a5c5ab37` merge de `origin/main` `6c3f0a9f`
- El commit que contiene este documento: handoff de la ronda 2

## PR / BRANCH

- https://github.com/hailuwaycom-sketch/DTDCARGO/pull/282, en borrador, rama
  `worktree-agent-aff14a24b697af5bb` → `main`.
- Reserva publicada: `codex/sdd-reserve-0561`. Se borra después de integrar.

## PENDIENTES DE ESTA TAREA

- Ninguno para fusionar. El criterio 8 quedó cumplido con la medición del Director.
- Para investigar, sin bloquear: `0351_operario_rpc_exige_rol`, 1 byte distinto del
  ledger sin variante conocida, y `0211_revoke_authenticated_rpc_sweep`, con
  `statements` nulo en el ledger.

## FUERA DE ALCANCE DETECTADO

- **8 filas del ledger sin archivo en el repo**, todas ≤ 0110:
  `0006b_clients_seed_align`, `0020_operario_pins_fix_search_path`,
  `0020b_grant_service_role_for_pwa`, `0020c_operario_receipt_inline_correlative`,
  `0020e_operario_receipt_drop_and_recreate`, `0042_bug_replays_storage_bucket`,
  `0059b_fix_public_track_rpc_ambiguous` y `0110_financiero_china`. El repo tiene otros
  archivos con esos números (`0006_clients`, `0020_operario_pins`,
  `0020b_operario_pins_post_apply_fixes`, `0042_feature_flags`,
  `0059_public_track_rpc`, `0110_calculator_settings_container_limits`). Falta saber si
  son aplicaciones fuera de banda o archivos que nunca llegaron al repo.
- `infra/ops/web/publicar-web.sh` (`puerta_migraciones`) compara solo nombres. Podría
  comparar también el md5 de las entradas con `ledger`.
- El CI no trae la base de la PR, así que `HISTORIA` no compara allí.
- MIG-03 (cabeceras engañosas): con el candado, corregirlas exige una excepción por
  archivo. La decisión es de Sam y del Director.
- No hay driver de merge para `migrations.lock.json` (ADR 0002).
- `knowledge:status` reporta `missing-link-target` previos en las specs 0148, 0288, 0366
  y 0482.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR #282, ronda 2, y su CI. Fusionar requiere tu
  autorización y publica en el VPS (SDD-0541). La PR no trae migración ni código de
  producto.
- **Cambios compartidos:**
  - `retirar-espera.mjs` **exige `--md5`**; el sello nace marcado `ledger` exacta;
  - editar un `.sql` sellado hace caer `pnpm harness:test`;
  - una migración nueva con número ≤ 0491 sin declararla espera cae por `SIN_SELLO`;
  - para medir el ledger otra vez, guarda el volcado fuera del repo y corre
    `migrations-lock.mjs ledger <archivo> --fecha`.
- **Conocimiento:**
  - impacto documental: spec 0561, runbook `aplicar-migraciones-prod.md`,
    `infra/ops/README.md` y el índice de specs;
  - Graphify estructural NO EJECUTADO en este worktree (corrida pesada, sin
    derivados aquí); Archify NO DISPONIBLE;
  - Obsidian sin cambios desde esta sesión.
- **Ownership:** liberado al cerrar. No se borró la rama ni el worktree.
