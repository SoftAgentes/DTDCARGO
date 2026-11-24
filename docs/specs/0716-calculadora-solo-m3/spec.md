---
sdd: "0716"
title: "Calculadora y ayudas solo en m³"
status: draft
author: "Codex"
created: 2026-11-24
updated: 2026-11-24
supersedes: null
superseded_by: null
related: []
confidencialidad: interno
---

# SDD-0716 — Calculadora y ayudas solo en m³

## Objetivo y aceptación

Mostrar volumen en m³/CBM sin venta, referencia ni equivalentes en ft³ en el
tarifario y las ayudas públicas. Conservar medidas físicas en cm, m y pulgadas,
resultados CBM, tarifa USD/m³, redondeos, funciones legacy y contrato de datos.
La guía explica largo × ancho × alto × cantidad con ejemplo ficticio:
0,6 × 0,4 × 0,5 m × 2 = 0,24 m³.

La edición conserva `priceUsdFt3` mediante campo oculto; la creación envía vacío
según contrato vigente. No cambia acciones, DB, migraciones, parseMaquina ni opción A.

## Allowlist exacta

- `docs/specs/0716-calculadora-solo-m3/spec.md`
- `docs/specs/README.md` (generado)
- `app/studio/(app)/admin/_components/calculator/TariffDrawer.tsx`
- `app/studio/(app)/admin/_components/calculator/TransportistasPanel.tsx`
- `app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx`
- `components/CbmExplicador.tsx`
- `lib/faqs.ts`
- `.agents/handoffs/sdd-0716-calculadora-solo-m3.md`

`lib/calculadora.ts` se inspeccionó: no hay consumidores públicos que activen
`conPiesCubicos`; se preserva su API legacy sin modificaciones.

## Gobernanza y validación

Superficie Studio Administración y ayuda pública; slice de formulario y copy.
Cumplimiento: FRM-01, VIS-01, A11Y-01, componentes existentes y tokens conservados.
No aplica: permisos nuevos, migraciones, datos personales e integraciones.
Sin excepciones nuevas. Frontera público/ERP conservada.

Pruebas focales sintéticas: columna ausente, edición conserva legacy al cambiar
venta, creación sin legacy, fixtures sin mutación. Pendientes ejecución, render
claro/oscuro y cierre canónico con turno de máquina solicitado al Director.
