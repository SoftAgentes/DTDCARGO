---
sdd: "0185"
title: "NUM-01 v1.1 y expresiones decimales"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-30
updated: 2026-07-30
supersedes: null
superseded_by: null
related: ["0104", "0166", "0174", "0183"]
confidencialidad: interno
---

# SDD-0185 — NUM-01 v1.1 y expresiones decimales

## 1. Objetivo

Endurecer el contrato canónico de entrada numérica para que una persona pueda
escribir un total o una operación aritmética directamente en el campo, con
precisión decimal reproducible, validación progresiva y conservación del último
valor válido.

## 2. Hallazgos que abre el gate

| Entrada | Resultado anterior | Clasificación |
|---|---:|---|
| `10+` después de `10` | el valor canónico pasaba de `10` a `null` | no conformidad |
| `0.1 + 0.2` | `0.30000000000000004` | no conformidad |
| `1,5 + 2,5` | `40` | no conformidad |
| `1.200,50 + 2.300,50` | `50` | no conformidad |

La causa era normalizar separadores sobre la expresión completa y evaluarla
con aritmética binaria mediante `new Function`.

## 3. Alcance

- parser decimal seguro de `NumericInput`;
- estados `empty`, `valid`, `incomplete` e `invalid`;
- confirmación en blur, Tab, Enter o submit;
- conservación del último decimal canónico válido;
- error visible y bloqueo HTML5 para una expresión incompleta confirmada;
- registro CMP-01 de `NumericInput` como `canonical`;
- un consumidor R3: base y porcentaje del comprobante de retención fiscal.

No incluye un barrido de inputs legacy, cambios en cálculos fiscales
server-side, base de datos, Cloud, Vercel ni otros módulos.

## 4. Allowlist

- `lib/studio/util/parse-numeric-expression.ts`
- `__tests__/parse-numeric-expression.test.ts`
- `app/studio/_components/ui/NumericInput.tsx`
- `app/studio/_components/ui/NumericInput.test.tsx`
- `app/studio/studio.css`
- `app/studio/(app)/fiscal/_components/WithholdingDrawer.tsx`
- `app/studio/(app)/fiscal/_components/WithholdingDrawer.test.tsx`
- `docs/specs/0185-num-01-expresiones-decimales/spec.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/policies/num-01.md`
- `docs/governance/reviews/num-01-v1-1-numeric-input.md`
- `docs/governance/components/numeric-input.json`
- `docs/governance/BASELINE-2026-07-30-05.md`
- `docs/governance/README.md`
- `docs/governance/generated/component-registry.json`
- `docs/governance/generated/governance-capsule.json`
- `docs/specs/README.md`
- `scripts/__tests__/component-registry.test.ts`

## 5. Contrato técnico

1. Cada literal se normaliza de manera independiente.
2. Coma o punto únicos representan decimal; formatos mixtos usan el último
   separador como decimal y validan grupos de miles.
3. La evaluación usa enteros escalados `BigInt`; no usa `eval`,
   `new Function` ni suma binaria intermedia.
4. La división conserva 30 decimales y usa redondeo half-up.
5. El hidden del formulario recibe el decimal canónico, sin locale ni
   exponente.
6. Una edición incompleta no modifica el callback ni el hidden anterior.
7. El primer error se presenta al confirmar; una vez mostrado, se revalida
   mientras la persona corrige.
8. El servidor continúa validando y recalculando los montos derivados.

## 6. Aceptación

- `10+` conserva `10`, bloquea submit y se marca inválido al confirmar;
- `10 + 5 + 8 + 9` confirma `32`;
- `0.1 + 0.2` produce canónico `0.3`;
- `1,5 + 2,5` produce `4`;
- `1.200,50 + 2.300,50` produce `3501`;
- una agrupación ambigua falla cerrada;
- Retenciones acepta expresiones en base y porcentaje y el servidor mantiene
  la autoridad sobre el monto;
- pruebas focales, typecheck, lint proporcional, build, `governance:check`,
  `components:check`, `docs:check` y `diff --check` verdes.

## 7. Evidencia y cierre

REV-SGE-020 y LB-SGE-080 registran el cierre. El gate local terminó verde con
62 pruebas focales, 4.160 pruebas totales, typecheck, lint proporcional,
registros ejecutables, documentación, build de producción y `diff --check`.
