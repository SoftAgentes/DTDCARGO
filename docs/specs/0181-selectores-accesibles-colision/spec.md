---
sdd: "0181"
title: "Selectores accesibles y colisión segura"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0108", "0165", "0180"]
confidencialidad: interno
---

# SDD-0181 — Selectores accesibles y colisión segura

## 1. Objetivo

Completar el contrato de teclado del menu button canónico y evitar clipping en
el combobox canónico, sin reemplazar los 246 selects inventariados.

## 2. Alcance

`SplitActionButton` incorpora roving focus, ArrowDown/ArrowUp, Home/End,
Escape con restauración de foco y Tab natural. Conserva la elección de
dirección según viewport.

`ClientCombobox` conserva debounce, resultados, flechas, Enter, Escape y
movimiento reducido; ahora abre arriba cuando el espacio inferior no alcanza.

## 3. Allowlist

- `app/studio/_components/ui/SplitActionButton.tsx`
- `app/studio/_components/ui/SplitActionButton.test.tsx`
- `app/studio/_components/ui/ClientCombobox.tsx`
- `app/studio/_components/ui/ClientCombobox.test.tsx`
- `docs/specs/0181-selectores-accesibles-colision/spec.md`
- `docs/governance/BASELINE-2026-07-29-37.md`
- `docs/architecture/module-sdd-map.md`
- `docs/specs/README.md` generado

## 4. Aceptación

- trigger abre primera/última opción con ArrowDown/ArrowUp;
- menu recorre con flechas y Home/End;
- Escape cierra y devuelve foco; Tab no queda atrapado;
- ambos popups eligen arriba/abajo según espacio;
- `ClientCombobox` conserva búsqueda, selección, vacío y reduced motion;
- tests, typecheck, lint, build, docs y `diff --check` verdes.

## 5. Resultado

Implementado y verificado localmente en las dos primitivas. No declara que
todos sus consumidores ni los selects nativos sean conformes.
