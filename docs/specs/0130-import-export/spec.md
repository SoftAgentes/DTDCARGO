---
sdd: "0130"
title: "Importar / Exportar — export CSV del dominio admin (import por implementar)"
status: done
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-15
supersedes: null
superseded_by: null
related: ["0120", "0127"]
confidencialidad: interno
---

# SDD-0130 · Importar / Exportar

> Última sección PRO de Administración. V1: **export CSV real**; import queda
> por implementar. Sin migración.

## Alcance

- **Exportar (CSV)** — generación **client-side** (sin dependencias, con BOM
  para Excel) de los catálogos del dominio admin: feriados & ferias
  (SDD-0127), oficinas y cuentas bancarias (SDD-0120). Datos ya disponibles vía
  sus queries; el botón arma el CSV y lo descarga.
- **Importar (CSV/XLSX)** — **por implementar**: la carga masiva necesita
  validación por entidad, mapeo de columnas y control de duplicados, cada
  entidad con su lógica. Spec dedicada.

## Superficie de código

- `app/studio/(app)/admin/_components/ImportExportSection.tsx` — CSV
  client-side.
- `app/studio/(app)/admin/page.tsx` — fetch (calendar + company) + render.

## Estado

Código listo; build en verde. Sin migración.
