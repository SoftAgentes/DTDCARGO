---
sdd: "0197"
title: "Recepción móvil CN — snapshot de fotos y render puro"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0016", "0027", "0194", "0196"]
confidencialidad: interno
---

# SDD-0197 — Recepción móvil CN · snapshot de fotos y render puro

## 1. Propósito

Resolver un slice R2 de tres advertencias de ESLint en la nueva recepción
móvil CN sin cambiar la Server Action, el RPC, permisos, payload, Storage ni
estados de negocio.

## 2. Hallazgos y clasificación

| Hallazgo | Riesgo | Clasificación |
|---|---:|---|
| `photosRef.current` se mutaba durante render | R2 | no conformidad `react-hooks/refs` |
| El ID del input se generaba con `Math.random()` durante render | R2 | no conformidad `react-hooks/purity` |
| `Step4Confirm` recibía `clients` sin consumirlo | R2 | no conformidad de minimización local |

La selección de fotos debe quedar congelada en el evento de envío. El input
puede conservar un ID React estable porque su `value` ya se limpia después de
cada selección, incluido el mismo archivo dos veces.

## 3. Contrato resultante

- el snapshot de fotos se escribe una sola vez dentro de `submit`, antes de
  invocar la acción;
- render no lee ni escribe `photosRef.current`;
- el input usa `useId()` y mantiene asociación estable label/control;
- seleccionar dos veces el mismo archivo continúa agregando dos fotos;
- `Step4Confirm` recibe sólo los datos que realmente usa;
- upload, retry offline, pending y payload conservan su contrato anterior.

## 4. Gate SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| 02 y 07 | cumplimiento esperado | snapshot exacto por submit y estados de upload sin cambios |
| 05 | cumplimiento esperado | se elimina un prop innecesario; no cambia la minimización del servidor |
| 10 | cumplimiento esperado | `useId` conserva asociación label/input y selección táctil |
| restantes | no aplica | no cambian verbos, riesgo, auditoría, permisos, pasos ni IA |

## 5. Allowlist exacta

1. `app/m/cn/nueva/_components/NuevaRecepcionClient.tsx`
2. `app/m/cn/nueva/_components/NuevaRecepcionClient.test.tsx`
3. `docs/specs/0197-mobile-cn-receipt-react-safety/spec.md`
4. `docs/architecture/module-sdd-map.md`
5. `docs/specs/README.md` — generado

## 6. Fuera de alcance

- Server Actions, RPC, Supabase, migraciones, Cloud, Producción y Vercel;
- otros warnings de recepción CN o del Studio;
- estilos, copy, navegación y requisitos de fotos;
- cambios a reglas globales o supresiones ESLint.

## 7. Verificación

- ESLint focalizado con cero advertencias;
- prueba funcional de selección repetida y contrato de snapshot;
- typecheck;
- lint completo con reducción esperada de 169 a 166;
- `docs:check`, `governance:check`, `components:check` y `diff --check`.

## 8. Resultado

- ESLint focalizado: cero errores y cero advertencias;
- prueba focalizada: 2/2 casos verdes;
- lint completo: cero errores y 166 advertencias, reducción exacta de tres;
- typecheck, `docs:check`, `governance:check`, `components:check` y
  `diff --check`: verdes;
- no se modificaron Server Actions, RPC, datos, Cloud, Producción ni Vercel.
