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
