# Handoff · SDD-0561 — candado de las migraciones aplicadas

- **Fecha:** 2026-10-19
- **Owner / sesión:** Worker `worker-candado-migraciones-20261019` (subagente del Director)
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-aff14a24b697af5bb`
- **Rama:** `worktree-agent-aff14a24b697af5bb` · base `origin/main` `3f3a52cc`, actualizada con
  `origin/main` `03cd4cf8` (merge `c712f340`)
- **SDD:** [0561](../../docs/specs/0561-candado-migraciones-aplicadas/spec.md), reservada con
  `sdd:next --reserve candado-migraciones-aplicadas --push` (ref `codex/sdd-reserve-0561`, commit
  `a6060c2f`, publicada). `sdd:check` en verde después de reservar y después del merge.
- **Estado de la tarea:** lista-para-revision (PR en borrador). Estado SDD: `in-progress`.

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
editar migraciones existentes, conectarse a la base.

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

## COMPLETADO

- **`supabase/migrations.lock.json`**: 483 entradas `nombre → { sha256, md5, bytes }`,
  generadas con `node scripts/migrations-lock.mjs crear --hasta 491` sobre los archivos
  de main `3f3a52cc`, idénticos según `git diff --quiet 3f3a52cc -- supabase/migrations`.
  Tiene el formato canónico `JSON.stringify(…, null, 2)` y un `$doc` con las reglas.
- **Conjunto**: todo hasta la 0491 menos las esperas 0422 y 0423. Son 250 por encima del
  corte y 233 por debajo, incluidas las 18 LEDGER_ONLY, sin trato aparte. La
  justificación está en la spec (§ Qué conjunto entra hoy). Las esperas no se sellan y
  la verificación las informa aparte.
- **`scripts/migrations-lock.mjs`**:
  - `verificar` reporta los errores FORMATO, FALTA, CAMBIADA, ESPERA, SIN_SELLO e
    HISTORIA (esta última contra el merge-base con origin/main);
  - `sellar` exige `--md5`;
  - `excepcion` exige `--motivo` y `--autorizacion`, agrega la entrada y conserva la
    identidad sellada;
  - `crear` corre una sola vez.
- **`scripts/tests/migrations-lock.node.mjs`** (harness, 18 pruebas):
  - el repo real;
  - el **ancla de creación**: sha256 de las 483 identidades, `10d5eb20…`. Protege el
    conjunto inicial también en el CI, que no tiene origin/main;
  - el control rojo en memoria (un byte, un borrado, un renombre);
  - cada regla sobre copias y los códigos de la CLI.
- **`retirar-espera.mjs`**: sella la migración al retirar la espera. Exige `--md5`, el
  `blob_md5` de `IDENTIDAD.txt`; si no coincide con el archivo, sale con 3 sin escribir
  nada. Las 7 pruebas de `retirar-espera` en `migraciones.test.mjs` cubren el sello.
- **Runbook** `aplicar-migraciones-prod.md`: la pieza nueva en §1, el sello al cierre en
  §6, qué hacer si dos cierres chocan en el candado, la excepción explícita en §8 y la
  prueba en §12. Además se tocaron `infra/ops/README.md` y la spec completa.
- `preparar.mjs` **no** se tocó: una guarda para «ya sellada» repetiría la lectura
  previa, que ya se niega si la migración está en el ledger.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `node --test scripts/tests/migrations-lock.node.mjs` | árbol de `95227895` y árbol fusionado `c712f340` | PASÓ 18/18 |
| `node scripts/tests/run-harness.mjs` (`pnpm harness:test`) | árbol que quedó en `95227895` (25 archivos) | PASÓ 233/233 |
| `vitest run infra/ops/tests/migraciones.test.mjs` | archivo completo | PASÓ 30/30 |
| Control rojo en disco | un byte de `0464_reporte_pago_factura_pagada.sql` (sha256 `42792803…` → `6915d99b…`) | PASÓ: la prueba cayó (2 rojas, exit 1) y la CLI dijo `[FALLÓ] CAMBIADA 0464_…` con exit 1. Restaurado con `git checkout`; sha256 de vuelta a `42792803…` |
| Mutantes (corredor fuera del repo, TAP) | 38 en `migrations-lock.mjs` y 4 en `retirar-espera.mjs` | PASÓ: 42/42 muertos, ninguno por error de carga (máximo 12 de 18 rojas). Archivos restaurados y comprobados por sha256 |
| `docs:check` | árbol fusionado | PASÓ (545 specs) |
| `sdd:check` (`check-numbering.mjs`) | tras la reserva y en el árbol fusionado | PASÓ |
| `eslint` sobre los dos scripts nuevos | `scripts/migrations-lock.mjs`, `scripts/tests/migrations-lock.node.mjs` | PASÓ (los de `infra/` los ignora la config) |
| `git diff --check` y búsqueda de espacios finales | archivos nuevos y modificados | PASÓ |
| Cruce con identidades registradas | md5 del candado contra handoffs, specs, pruebas y commits | 55 de 483 aparecen; de 66 menciones «md5 + bytes», 60 coinciden y las 6 restantes no son de migraciones |
| `pnpm verify` | — | NO EJECUTADO. El cambio es de harness, scripts y docs, sin código de producto, y no agrega ningún paso nuevo. Los pasos que alcanza se corrieron aparte (harness, el archivo de vitest tocado, docs:check, numbering, lint de los scripts). `typecheck` no incluye `.mjs` |
| `bash infra/ops/tests/pruebas-linux.sh` | — | NO EJECUTADO: no se tocó ningún script bash y ninguna de esas pruebas llama a `retirar-espera`. Lo corre el CI |
| Comparar el candado con el ledger de producción | — | NO EJECUTADO: el encargo prohíbe conectarse. Pendiente con OK de Sam |
| `pnpm knowledge:status` | este worktree | EJECUTADO: structural y semantic INVALID porque el worktree no tiene derivados de Graphify (3573 missing). Archify NO DISPONIBLE (`ARCHIFY_RUNTIME_MISSING`) |

## COMMITS

- `a6060c2f` chore(sdd): reserva SDD-0561 (stub, hecho por `sdd:next --reserve`)
- `f73ddb0e` chore(db): candado, verificador y prueba del harness
- `4cbe7396` chore(db): `retirar-espera` sella con el md5 aplicado
- `95227895` docs(sdd): spec, runbook e índice
- `c712f340` merge de `origin/main` `03cd4cf8` (solo cambió el índice de specs, resuelto por el driver)
- El commit que contiene este documento: docs(handoff)

## PR / BRANCH

- Rama `worktree-agent-aff14a24b697af5bb` → base `main`, PR **en borrador**. La URL está
  en la descripción del cierre al Director y en `gh pr list --head worktree-agent-aff14a24b697af5bb`.
- Reserva publicada: `codex/sdd-reserve-0561`. El stub va incluido en esta rama; la
  reserva se borra después de integrar, según la regla de reservas cumplidas.

## PENDIENTES DE ESTA TAREA

- **Comparar las 483 entradas con el ledger de producción** (criterio 8 de la spec). Es
  una lectura de solo catálogo, con OK de Sam, que corre el Director en el servidor
  propio:

  ```sql
  begin transaction read only;
  select name,
         md5(array_to_string(statements, '')) as md5,
         octet_length(array_to_string(statements, '')) as bytes
    from supabase_migrations.schema_migrations
   where name ~ '^[0-9]{4}[a-z]?_'
   order by name;
  rollback;
  ```

  Se compara con el candado considerando la variante con y sin salto final de las filas
  de Cloud (runbook §7). Las anteriores a la 0239 con otro `name` no cruzan, y es
  esperable. No pedí el dato por mensaje porque esta sesión no tiene la herramienta
  para escribirle a la sesión principal; usé la regla documentada (MIG-08 y la puerta
  de la publicación).

## FUERA DE ALCANCE DETECTADO

- `infra/ops/web/publicar-web.sh` (`puerta_migraciones`) compara solo **nombres**
  contra el ledger. Podría comparar también el md5 con el candado. Cambia un script
  del VPS y requiere instalarlo.
- El CI (`quality.yml`) hace un checkout superficial sin la base de la PR, así que
  `HISTORIA` dice «no comparada» allí. Traer `github.event.pull_request.base.sha` con
  `fetch --depth=1` permitiría compararla también en el CI.
- MIG-03 (cabeceras engañosas): con el candado, corregirlas exige una excepción por
  archivo. La decisión es de Sam y del Director.
- Driver de merge para `migrations.lock.json` (ADR 0002). Hoy dos cierres en paralelo
  chocan al final del objeto; el runbook explica cómo resolverlo con `sellar`.
- `knowledge:status` reporta `missing-link-target` previos en las specs 0148, 0288, 0366
  y 0482. Son ajenos a esta tarea.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador y el CI de Calidad. Al fusionar,
  `main` publica solo en el VPS (SDD-0541): la PR no trae migración ni código de
  producto, pero la imagen se reconstruye. Fusionar requiere tu autorización.
- **Cambios compartidos:**
  - el procedimiento de cierre de migraciones cambia: `retirar-espera.mjs` ahora
    **exige `--md5`**. El próximo cierre (0422/0423, o la 0492 en adelante) tiene que
    pasarlo;
  - cualquier PR que edite un `.sql` sellado caerá en `pnpm harness:test`. Es lo
    buscado;
  - una PR en curso que agregue una migración con número menor o igual a 0491 sin
    declararla espera también caerá (`SIN_SELLO`).
- **Conocimiento:**
  - impacto documental: spec 0561 nueva, runbook `aplicar-migraciones-prod.md`,
    `infra/ops/README.md` y el índice de specs;
  - Graphify estructural NO EJECUTADO en este worktree: es una corrida pesada y no hay
    derivados aquí. La publica el Director desde main integrado;
  - Archify NO DISPONIBLE (falta el runtime);
  - Obsidian sin cambios desde esta sesión.
- **Ownership:** liberado al cerrar (`harness-worktree.mjs release`). No se borró la
  rama ni el worktree.
