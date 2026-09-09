---
sdd: "0315"
title: "Las exportaciones CSV no ejecutan fórmulas de terceros"
status: done
author: "Sam (founder) + Codex"
created: 2026-09-01
updated: 2026-09-01
supersedes: null
superseded_by: null
related: ["0039", "0052", "0053", "0146", "0281", "0289"]
confidencialidad: interno
---

# DTD-0315 — CSV sin fórmulas ejecutables

## Problema

Varias exportaciones del Studio escapaban comas y comillas, pero dejaban que un
texto iniciado por `=`, `+`, `-`, `@`, tab o retorno llegara a Excel como una
fórmula. Nombres, notas, ubicaciones, títulos y datos del CRM pueden ser escritos
por clientes, proveedores o remitentes externos; abrir el CSV no debe ejecutar
contenido de esas personas.

El repositorio ya neutralizaba fórmulas en el constructor de Reportes y en la
exportación de auditoría, pero mantenía otras implementaciones locales sin esa
protección.

## Decisión

`lib/studio/export/csv.ts` es la primitiva canónica para celdas CSV del Studio:

- los valores de texto con prefijo peligroso reciben un apóstrofo;
- los números reales, incluidos negativos, conservan su tipo y representación;
- strings numéricos como `-250.5` también se conservan para no romper planillas;
- después de neutralizar se aplica el escape RFC 4180 existente;
- los exportadores dejan de declarar copias locales de `csvCell`.

La exportación de auditoría conserva su serializador propio porque siempre
entrecomilla las celdas y genera además un manifiesto; su neutralización ya era
equivalente.

## Allowlist exacta

- `lib/studio/export/csv.ts`
- `lib/studio/export/__tests__/csv-formula.test.ts`
- `lib/studio/reports/builder-types.ts`
- `lib/studio/costing/ui.ts`
- `app/studio/(app)/admin/_components/ImportExportSection.tsx`
- `app/studio/(app)/bugs/_components/BugsAdminClient.tsx`
- `app/studio/(app)/gastos/actions.ts`
- `lib/studio/kommo-recovery.ts`
- `lib/studio/export/__tests__/csv-implementation-contract.test.ts`
- pruebas existentes que ejercen los exportadores anteriores
- esta spec y el índice generado de specs

## Compatibilidad

- No cambia consultas, RLS, permisos, columnas ni formatos de archivo.
- No modifica números negativos ni strings que representan números válidos.
- No cambia importaciones CSV.
- El apóstrofo sólo aparece en valores de texto que una hoja de cálculo podría
  interpretar como fórmula.

## Gobernanza y privacidad

| Control | Clasificación | Evidencia requerida |
|---|---|---|
| SGE-00.05 · privacidad y minimización | cumplimiento | texto de terceros no se ejecuta al abrir el export |
| SGE-00.06 · prevenir antes de informar | cumplimiento | neutralización en la primitiva, antes de descargar |
| SGE-00.09 · reutilización | cumplimiento | una primitiva compartida y contrato anti-copias |
| CRBV art. 60 / LECDI arts. 20–22 | correcto técnico acotado | el export deja de convertir texto personal en fórmula ejecutable; no declara cumplimiento legal |
| PIPL arts. 5–7 y 51 | correcto técnico acotado | protección preventiva aplicable a datos tratados por el equipo en China; operación alojada no verificada |

## Verificación

- tabla de prefijos peligrosos y casos numéricos;
- export completo con fórmulas, comas, comillas y saltos;
- contrato que impide nuevas funciones `csvCell` fuera de la primitiva;
- pruebas existentes de Bitácora, Reportes, Costing, CRM, Gastos y exports;
- `pnpm docs:check`, `pnpm governance:check`, `pnpm components:check`;
- typecheck, lint y gate proporcional.
