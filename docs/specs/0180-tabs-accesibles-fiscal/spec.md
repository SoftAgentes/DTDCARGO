---
sdd: "0180"
title: "Tabs accesibles en Fiscal"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0073", "0104", "0166", "0174"]
confidencialidad: interno
---

# SDD-0180 — Tabs accesibles en Fiscal

## 1. Objetivo

Corregir un único tablist R2/R3 del módulo Fiscal/SENIAT conforme a A11Y-01
v1.1 y REV-SGE-014, sin barrer los otros 28 archivos inventariados.

## 2. Alcance

- cuatro tabs URL-driven de `FiscalClient`;
- un solo tab stop;
- activación automática con ArrowLeft/ArrowRight;
- Home/End hacia extremos;
- asociación `tab`–`tabpanel`;
- foco visible distinto de selección;
- overflow horizontal sin wrap.

No incluye mutaciones fiscales, cálculo, PDF, otros tablists, Cloud o Vercel.

## 3. Allowlist

- `app/studio/(app)/fiscal/_components/FiscalClient.tsx`
- `app/studio/(app)/fiscal/_components/FiscalClient.test.tsx`
- `docs/specs/0180-tabs-accesibles-fiscal/spec.md`
- `docs/governance/BASELINE-2026-07-29-36.md`
- `docs/architecture/module-sdd-map.md`
- `docs/specs/README.md` generado

## 4. Contrato

El tab activo usa `tabIndex=0`; los demás, `-1`. Las flechas recorren y
activan, Home/End saltan a extremos, y Tab abandona el grupo de manera nativa.
Cada tab declara `aria-controls`; el panel activo declara `aria-labelledby`.
El estado seleccionado usa el indicador vino existente y el foco usa la
primitiva `studio-btn`, sin color o animación nuevos.

## 5. Aceptación

- cuatro tabs, un único tab stop;
- flechas con wrap y navegación URL;
- Home/End funcionales;
- panel accesible asociado;
- tabs sin wrap y con overflow horizontal;
- tests unitarios, typecheck, lint, build, docs y `diff --check` verdes.

## 6. Resultado

Implementado y verificado localmente. La conformidad se limita a
`FiscalClient`; el inventario transversal permanece como deuda por slices.
