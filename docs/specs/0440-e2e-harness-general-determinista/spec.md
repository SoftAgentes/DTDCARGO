---
sdd: "0440"
title: "Harness E2E general determinista en Supabase efímero"
status: in-progress
author: "Codex"
created: 2026-09-05
updated: 2026-09-05
supersedes: null
superseded_by: null
related: ["0168", "0172", "0243"]
confidencialidad: interna
---

# SDD-0440 — Harness E2E general determinista en Supabase efímero

## Problema

La corrida general de 168 E2E abrió hasta 16 workers sobre un único branch de
Supabase. Los logins agotaron su margen por contención y las calculadoras
leyeron los defaults históricos sembrados por `0103_calculator_settings`
(`500 kg/CBM` y `USD 50` de descuento), no los defaults vigentes del código
(`1000 kg/CBM` y descuento `0`). El resultado mezcló ruido de infraestructura
con tres expectativas de negocio desalineadas.

## Decisión

- CI y cualquier entorno declarado `ephemeral` usan un worker por defecto.
- Una corrida local no efímera usa ocho workers; `E2E_WORKERS=1..32` permite
  ajustar la concurrencia de forma explícita y validada.
- WebKit móvil se serializa en Windows para que su cierre no cuelgue el gate.
- `seed-e2e.ts`, protegido por los guards de entorno ya existentes, actualiza
  únicamente `calculator_settings` del tenant público `dtd` con
  `DEFAULT_PARAMS` y verifica la postcondición antes de ejecutar Playwright.
- No se cambian expectativas para aceptar precios históricos: el branch se
  normaliza al contrato vigente que el producto declara como fallback.

## Seguridad y datos

La normalización requiere `E2E_ENVIRONMENT_KIND=ephemeral`, project ref
confirmado y URL coincidente. El guard existente prohíbe Producción. No crea
PII, no lee datos de negocio y no introduce una migración.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento | El harness falla ante workers inválidos o una postcondición de seed distinta. |
| AUD-01 | no aplica | No cambia eventos de producto ni auditoría de negocio. |
| MP-01 | no aplica | Los datos son fixtures efímeros y no se modifica su ciclo de retención. |

## Allowlist exacta

- `docs/specs/0440-e2e-harness-general-determinista/spec.md`
- `docs/specs/README.md` (generado)
- `playwright.config.ts`
- `scripts/e2e/sdd-0168-fixture.ts`
- `scripts/seed-e2e.ts`
- `scripts/__tests__/playwright-config.test.ts`
- `scripts/__tests__/sdd-0168-fixture.test.ts`
- `e2e/README.md`

## Criterios de aceptación

- [x] El mapper del seed contiene las diez reglas vigentes de calculadora.
- [x] El preflight exige las columnas que se van a actualizar.
- [x] El seed verifica que la fila pública quedó normalizada.
- [x] CI y Supabase efímero usan un worker por defecto.
- [x] `E2E_WORKERS` acepta sólo enteros entre 1 y 32.
- [x] Las pruebas unitarias, documentación, gobernanza y TypeScript pasan.
- [ ] Una corrida hospedada de los 168 E2E confirma el contrato completo.

## Fuera de alcance

- aplicar migraciones o modificar Supabase Producción;
- crear otro branch efímero sin autorización de costo;
- fusionar las PR #21, #22, #23 o #24;
- cambiar precios, límites o comportamiento de la calculadora de Producción.

## Estado

Implementación local completa: 23/23 pruebas focalizadas, TypeScript, lint del
alcance, documentación, gobernanza, componentes, numeración y `diff --check`
verdes. El inventario de Playwright conserva exactamente 168 pruebas en 14
archivos. La prueba hospedada completa mantiene un gate de costo separado porque
requiere crear un nuevo branch efímero.
