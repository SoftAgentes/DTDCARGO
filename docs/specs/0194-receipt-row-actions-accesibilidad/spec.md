---
sdd: "0194"
title: "Almacén CN — menú de acciones de recepción accesible"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0016", "0029", "0072"]
confidencialidad: interno
---

# SDD-0194 — Almacén CN · menú de acciones de recepción accesible

## 1. Propósito

Corregir un slice único del inventario de 175 advertencias de ESLint:
`ReceiptRowActions`. El cambio elimina tres advertencias locales y completa el
contrato de teclado del menú sin alterar resultados de negocio, server actions,
permisos, auditoría ni estilos globales.

## 2. Riesgo y políticas

Riesgo **R2**: el menú dispara cambios operativos de recepción, pago y
verificación de factura, aunque este slice modifica sólo su interacción.

| Política | Evidencia previa | Clasificación |
|---|---|---|
| SGE-00 v1.0 | Las mutaciones y sus resultados permanecen intactos; la accesibilidad del menú era incompleta | no conformidad acotada |
| A11Y-01 v1.1 | Escape cerraba, pero faltaban flechas, Home/End, roving focus, restauración de foco y posicionamiento según viewport | no conformidad |
| BTN-01 v1.1 | `aria-pressed` no es válido en un elemento con `role="menuitem"` y el trigger medía 28 × 28 px | no conformidad |
| CMP-01 v1.1 | No se crea, duplica, promueve ni depreca una primitiva | no aplica |

## 3. Contrato resultante

- ArrowDown/ArrowUp en el trigger abre y enfoca primera/última opción;
- ArrowDown/ArrowUp recorre las opciones habilitadas;
- Home/End salta al primer/último elemento habilitado;
- Escape cierra y restaura el foco al trigger;
- Tab cierra sin secuestrar el recorrido natural;
- click externo cierra sin ejecutar una opción;
- el popup abre arriba cuando no cabe debajo;
- trigger e ítems alcanzan el mínimo interno de 32 × 32 px;
- el flag de facturación conserva un `menuitem` con verbo explícito y elimina
  el estado ARIA incompatible;
- Enter/Space conservan activación nativa de `<button>`;
- las acciones, labels, pending, errores y `router.refresh()` no cambian.

## 4. Gate SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| 01, 03–09, 11 | cumplimiento | No cambian verbos, riesgo, permisos, auditoría, estados ni pasos |
| 02 | cumplimiento | Cerrar conserva el comportamiento previo de descartar sólo estado efímero del menú |
| 10 | cumplimiento esperado | Prueba de teclado, roles y restauración de foco |
| 12 | no aplica | No interviene IA |

## 5. Allowlist exacta

1. `app/studio/(app)/cn/_components/ReceiptRowActions.tsx`
2. `app/studio/(app)/cn/_components/ReceiptRowActions.test.tsx`
3. `docs/specs/0194-receipt-row-actions-accesibilidad/spec.md`
4. `docs/architecture/module-sdd-map.md`
5. `docs/specs/README.md` — generado

## 6. Fuera de alcance

- server actions, Supabase, migraciones, Cloud y Vercel;
- estilos, copy, estados de negocio o acciones disponibles;
- otros componentes del Almacén CN;
- las 172 advertencias restantes del inventario;
- una migración masiva de menús o botones legacy.

## 7. Verificación

- ESLint focalizado con cero advertencias;
- Vitest específico de teclado, semántica y posicionamiento del menú;
- typecheck;
- suite Vitest proporcional;
- `docs:check`, `governance:check`, `components:check`;
- `git diff --check`.

## 8. Resultado

- ESLint focalizado: cero errores y cero advertencias;
- ESLint completo: cero errores y 172 advertencias, tres menos que la línea
  inicial de este slice;
- Vitest específico: 3/3 pruebas verdes;
- typecheck, `docs:check`, `governance:check`, `components:check` y
  `git diff --check`: verdes;
- no hubo cambios en server actions, datos, Cloud, Producción ni Vercel.
