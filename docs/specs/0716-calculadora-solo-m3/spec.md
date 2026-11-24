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

El drawer no envía `priceUsdFt3`. El UPDATE omite `price_usd_ft3` cuando falta
esa clave, conservando el valor actual sin leerlo ni reenviar una copia vieja.
Los clientes legacy que envían la clave conservan la validación y escritura
explícitas, incluido vacío para nulo. INSERT conserva nulo por omisión.
No cambia DB, migraciones, parseMaquina ni opción A.

## Allowlist exacta

- `docs/specs/0716-calculadora-solo-m3/spec.md`
- `docs/specs/README.md` (generado)
- `app/studio/(app)/admin/_components/calculator/TariffDrawer.tsx`
- `app/studio/(app)/admin/_components/calculator/TransportistasPanel.tsx`
- `app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx`
- `app/studio/(app)/admin/carrier-actions.ts`
- `app/studio/(app)/admin/__tests__/carrier-actions-escrituras.test.ts`
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

Pruebas focales sintéticas: columna ausente, edición sin clave legacy,
PATCH sin esa propiedad con filtros tenant/transportista/activo intactos,
entradas legacy explícitas válidas, nulas e inválidas y alta con nulo por omisión.
El ejemplo fijo vive en el bloque didáctico, separado del resultado variable.
Pendientes ejecución, render
claro/oscuro y cierre canónico con turno de máquina solicitado al Director.
