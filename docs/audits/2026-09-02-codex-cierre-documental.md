---
title: "Codex: cierre documental de tres specs ya integradas"
tipo: auditoria-operativa
autor: Codex
estado: verificado-local-y-git
created: 2026-09-02
updated: 2026-09-02
review-by: 2026-09-09
confidencialidad: interno
---

# Reconciliación de pendientes · primer lote

Se cierran sólo SDD-0280, SDD-0303 y SDD-0304. No se interpreta que todas las
specs `in-progress` estén incompletas, ni que tener código baste para cerrar
una migración, integración o decisión de operación.

## Plan ejecutado y límites

1. Leer completas las tres specs y su evidencia histórica.
2. Demostrar que los commits de implementación pertenecen a
   `origin/main@2a2e81bf554dbe7bd4f05170847e8f02e988d320`.
3. Comprobar el contrato vigente contra el árbol actual y los gates ejecutados.
4. Actualizar estado/fecha con una nota de cierre; regenerar índice y checklist.

Alcance exclusivamente documental. Sin nueva SDD, migración, código runtime,
deploy, permisos, PII ni eliminación de archivos. Las pruebas por mutación
descritas en las specs se conservan como evidencia histórica, no se atribuyen
a esta sesión.

| Spec | Evidencia en main | Verificación actual | Resultado |
|---|---|---|---|
| 0280 · build del gate | `b842f2f8`; paso build y distDir presentes | Wrapper sin cambios funcionales respecto a main; build de 158 páginas, postbuild, tsconfig restaurado y salida efímera ausente | `done` técnico |
| 0303 · JSON-LD | `5ad3429f`, `e097a366` | Cuatro componentes usan el helper; contrato con ambas raíces aprobado 4/4 e incluido en 5.961 unitarios; helper escapa `<` como `\u003c` | `done` técnico |
| 0304 · poda | `20064ed1`, `3477a483` | Lista exacta de 14 bajas aún ausente en main y checkout; FclCalculator vivo en sus dos rutas; TS/build aprobados | `done` técnico |

Se corrigió además un error de representación en el texto de SDD-0303: el
escape había quedado escrito como `<`, contradiciendo el helper y el test.
No se modificó ninguno de ellos.

## Inventario después del lote

352 specs: 261 `done`, 1 `superseded`, 75 `in-progress`, 8 `proposed`,
4 `approved` y 3 `draft`. Quedan **90 sin cierre documental**, no 90 features
confirmadas como faltantes. SDD-0326 y SDD-0328 permanecen abiertas por sus
gates alojados; tampoco se cierran masivamente las demás.

El [checklist único](2026-09-02-codex-arranque-checklist.md) conserva prioridades,
dependencias y decisiones. El siguiente lote documental debe escoger un dominio,
leer sus criterios completos y repetir este método; si necesita evidencia
Cloud, se mantiene abierto hasta obtenerla.

## Allowlist exacta del lote

- `docs/specs/0280-build-en-el-gate/spec.md`
- `docs/specs/0303-el-escape-a-medias/spec.md`
- `docs/specs/0304-la-poda-que-nunca-aterrizo/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-cierre-documental.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-cierre-documental-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

Este lote no cambia el contrato de SDD-0360 ni afirma que el PR, Cloud o el
objetivo completo estén cerrados.
