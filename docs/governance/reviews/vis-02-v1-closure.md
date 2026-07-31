# Cierre documental de VIS-02 Gate V1

| Control | Valor |
|---|---|
| Revisión | REV-VIS-003 |
| SDD | [SDD-0175](../../specs/0175-vis-02-tipografia-voz-idioma/spec.md) |
| Decisión de marca | BD-036 |
| Fecha | 2026-07-30 |
| Implementación | `e7be56c6` |
| Resultado | V1 implementado y verificado |

## 1. Alcance comprobado

El Gate V1:

- carga Noto Serif SC mediante `next/font/google`;
- usa `display: "swap"` y `preload: false`;
- declara Noto Sans SC como fallback CJK;
- expone `--f-cn-ui` para interfaz y `--f-cn-document` para documento formal;
- conserva `--f-cn` como alias compatible de `--f-cn-ui`;
- impide que consumidores de UI activen la fuente documental.

La excepción BD-036 sigue limitada a documento formal `lang="zh-CN"`.
Noto Sans SC continúa siendo la fuente de UI china.

## 2. Evidencia

| Control | Evidencia |
|---|---|
| Carga no bloqueante | `app/layout.tsx` |
| Tokens globales | `app/globals.css` |
| Tokens Studio | `app/studio/tokens.css` |
| Aliases compatibles | `app/prealertas.css` · `app/recursos.css` |
| Contrato automatizado | `__tests__/vis-02-font-tokens.test.ts` |
| Commit publicado | `e7be56c6245f23703703ff93026757c753e091f3` |

La prueba verifica carga, fallbacks, orden de familias, aliases y ausencia de
`--f-cn-document` en consumidores de UI.

## 3. Gates de reconciliación

| Gate | Resultado |
|---|---|
| Prueba VIS-02 | 1 archivo · 8 pruebas aprobadas |
| TypeScript | verde |
| Documentación | `docs:check` verde |
| Gobernanza | 27 políticas aprobadas · cápsula vigente |
| Componentes | 3 fuentes válidas · agregado reproducible |
| Diff | `git diff --check` verde |

Lint y build no se repiten porque la allowlist es exclusivamente documental y
la implementación `e7be56c6` no cambia en este gate.

## 4. Límites

Esta revisión no modifica ni autoriza:

- renderers o plantillas de correo;
- PDF o incrustación de glifos;
- documentos vivos;
- adopción visual transversal;
- Cloud, Vercel o datos;
- CMP-01 v1.1, deprecated, D1, D2–D5, nuevos slices o PLG-P3.

V2 correo, V3 PDF y V4 visual permanecen cerrados y requieren allowlist,
pruebas y publicación independientes.

## 5. Veredicto

REV-VIS-003 aprueba el cierre documental de V1 y corrige el drift entre la
implementación publicada, SDD-0175 y BD-036. SDD-0175 pasa a `in-progress`
porque conserva V2–V4 pendientes; no pasa a `done`.
