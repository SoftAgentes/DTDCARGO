# Handoff · SDD-0650 F1 — Ficha 360° del cliente

- **Owner:** Claude Worker (sesión «ficha 360», claim `ficha-360-worker`), lanzado por el Director General.
- **Worktree:** `DTD-worktrees/sdd-0650-ficha-360` · **Rama:** `codex/sdd-0650-ficha-360` · **Base:** `origin/main` `be9fe643c`.
- **SDD:** `docs/specs/0650-ficha-360-cliente/spec.md` (`in-progress`). Reserva `codex/sdd-reserve-0650`, publicada. La 0651 (fusión v2) se reserva aparte, y la migración 0554 queda reservada por el DG para la F2.
- **Objetivo:** F1 de la 0650. Reordenar la ficha sin migración e incluir los envíos de los códigos anteriores y de las fichas fusionadas.
- **Alcance:** la lista exacta de la spec §7. Fuera: F2 a F5, la 0651, la cabecera de cuenta (la decisión 14 cambia en la F3) y producción.
- **Permisos:** el DG autorizó la PR. Merge y producción no. Pruebas pesadas solo con turno del DG; el CI es el portón.

## Estado

- **PR:** https://github.com/SoftAgentes/DTDCARGO/pull/629 (lista para revisión, base `main`). Lleva la F1 y las specs 0650 y 0651, esta última solo como spec.
- **Validación local:**
  - `tsc --noEmit`: PASÓ.
  - vitest: PASÓ, 19 archivos y 138 pruebas.
  - Tres mutantes: los tres caen.
  - `docs:check`, `sdd:check`, `governance:check` y `components:check`: PASÓ.
  - `/ui-check`: OK con ajustes, aplicados.
  - `pnpm verify`: NO EJECUTADO; el portón es el CI.
  - Revisión visual en el navegador: NO EJECUTADA.
- **Ronda 2** (revisión independiente del DG, CHANGES_REQUESTED sobre `6e0637344`). Por instrucción del DG no se corrió nada local: el portón es el CI.
  - La prueba del ciclo mira los valores de cada `in`, con un ciclo de dos bajo el tope.
  - Pruebas de la página (`ficha-cliente-page.test.tsx`) y de las reglas puras (`lib/studio/ficha-cliente.ts`).
  - `listShipmentsDeLaFicha` filtra el tenant además de la RLS.
  - CSS: `--sin-panel` ya no queda pisada por la regla de 1440 px, y la de 900 px tiene la misma especificidad.
  - Specs fechadas 2026-11-16.
  - La F2 exige `canSeeClientNames` (SDD-0531).
- **Mutantes, uno por uno:**
  1. Quitar `.eq("tenant_id", …)` en `listCodigosDeLaFicha` → cae la prueba «junta el vigente…» (ficha `c-ajena`). **Corrido** en la ronda 1: cae.
  2. Quitar `.is("deleted_at", null)` en `listShipmentsDeLaFicha` → cae «trae los envíos vivos…» (envío 3). **Corrido** en la ronda 1: cae.
  3. Subir `MAX_SALTOS_FUSION` de 10 a 100 → cae «una cadena larga se corta en 10 saltos». **Corrido** en la ronda 1: cae.
  4. Quitar `if (vistos.has(fila.id)) continue;` → cae «un ciclo corto no vuelve a meter la ficha vigente en la frontera» (las fronteras pasan de 2 a 10). La prueba se escribió para él; en la ronda 1 la prueba vieja lo dejaba vivo. **NO EJECUTADO** en local.
  5. Quitar `.eq("tenant_id", tenantId)` en `listShipmentsDeLaFicha` → cae «trae los envíos vivos…» (envío 5, otro tenant). **NO EJECUTADO** en local.
  6. Quitar el `try/catch` de `codigosConCaida` → caen «cae al vigente si la lectura lanza…» y la prueba de página «si la cadena de códigos falla…». **NO EJECUTADO** en local.
- **Pendiente de esta tarea:** el CI de la PR #629 y la revisión independiente, que lanza el DG.
- **Siguiente:** F2 (migración 0554), F3, F4, F5 y la implementación de la 0651. Las asigna el DG cuando entre la F1.

## Impacto documental

- Spec 0650 nueva, con las decisiones de Sam citadas literal y las personas por su función.
- Índice `docs/specs/README.md` regenerado.
- Las decisiones con nombres de personas quedan fuera del repo, en la carpeta de notas del grupo de sesiones (`ficha-360-decisiones-sam-20261116.md`).

## FUERA DE ALCANCE DETECTADO

- `merge_clients` (0361) no se redefinió después de las tablas 0367, 0466, 0504 y 0506 ni de `documents` (I, NV). Va a la SDD-0651.
- La ficha no sigue la fusión en cotizaciones ni en reportes de pago. Va en la F3 y la F4.
- Los envíos se comparan por código exacto. Normalizar como la 0506 (`upper(btrim())`) cambia qué envíos cuentan y pide su medida.
