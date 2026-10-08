---
sdd: "0504"
title: "Zonas con entrega incluida administrables"
status: in-progress
author: "Codex"
created: 2026-10-08
updated: 2026-10-08
supersedes: null
superseded_by: null
related: ["0055", "0236", "0237", "0257", "0502"]
confidencialidad: interno
---

# SDD-0504 — Zonas con entrega incluida

## Objetivo y autoridad

Sam administra la inclusión de la entrega desde Administración > Calculadora pública, sin editar código. Caracas, Valencia y Maracay conservan entrega incluida; Acarigua deja de estar incluida. Las demás ciudades y tarifas se conservan. Trabajo autorizado: aislamiento, implementación, pruebas y commits locales. No publicación, merge, despliegue ni acceso a datos de producción.

## Contrato

Reutilizar `calculator_cities.casco`, RPC pública y tarifario existentes. La bandera persistida manda, incluido `false`; el fallback sólo decide cuando no hay catálogo persistido. La nueva acción modifica exclusivamente `casco` de una ciudad viva del tenant activo, con gate admin, filtro tenant y detección de cero filas. Auditoría por trigger existente. No RPC ni schema nuevos.

La interfaz permite cambiar una ciudad por vez, guardar o cancelar y muestra guardado/error. Usa controles/componentes canónicos y tokens existentes. Una ciudad no incluida usa la tarifa pública vigente de transportista, después el respaldo confirmado; sin precio confirmado deriva al asesor. No cambia la fórmula mínimo/batería/descuento de SDD-0502.

## Allowlist final exacta (antes de producto)

- `docs/specs/0504-zonas-entrega-incluida/spec.md`
- `docs/specs/README.md` (generador únicamente)
- `.agents/handoffs/calculadora-zonas-entrega-incluida-20261008.md`
- `app/studio/(app)/admin/_components/calculator/CalculatorSection.tsx`
- `app/studio/(app)/admin/_components/calculator/CiudadesPanel.tsx`
- `app/studio/(app)/admin/_components/calculator/CityDrawer.tsx`
- `app/studio/(app)/admin/calculator-actions.ts`
- `lib/studio/calculator-cities-types.ts`
- `lib/studio/calculator-cities-queries.ts`
- `lib/studio/__tests__/calculator-cities-types.test.ts`
- `lib/data/destinos-nacionales.ts`
- `lib/calculadora.ts`
- `lib/public/rates-queries.ts` — ampliación necesaria: quitar OR que anula una exclusión administrativa. Contrato público existente, sin imports ERP nuevos.
- `lib/public/__tests__/combinar-destinos.test.ts` — ampliar pruebas de precedencia persistida y cálculo final.
- `__tests__/calculadora.test.ts` — ampliación previa a editar este test: reemplazar expectativa histórica de ocho zonas por las siete conservadas y comprobar Acarigua con tarifa.
- `app/studio/(app)/admin/_components/calculator/ZonasEntregaPanel.tsx` — sección de edición enfocada sin CRUD ni cambio de tarifas.
- `app/studio/(app)/admin/_components/calculator/__tests__/ZonasEntregaPanel.test.tsx` — interacción guardar/cancelar, carga/error y no-admin.
- `app/studio/(app)/admin/__tests__/delivery-zone-action.test.ts` — persistencia, gate y filtros usando cliente simulado; sin producción.
- `lib/studio/rbac-actions-guard.test.ts` — ampliación antes de editar: registrar una acción nueva en inventario congelado (427 → 428); conservar scanner, guards, excepciones y deuda intactos.

## Aceptación

1. Sección «Zonas con entrega incluida», estado por ciudad, guardar/cancelar, sólo admin; carga y errores visibles.
2. Toggle persiste `casco`; cálculo final refleja inclusión/exclusión y conserva tarifa interna.
3. Caracas, Valencia y Maracay incluidas; Acarigua excluida en fallback y plan de corrección persistida.
4. Resto de ciudades/coberturas, mínimos, batería y descuentos se preservan.
5. Tests significativos de acción, UI y cálculo; revisión visible local con datos sintéticos.
6. Validar SDD/docs/gobernanza/componentes y `pnpm verify`, declarando SKIPs y fallas ajenas.

## Corrección del catálogo persistido y release

No requiere schema nuevo ni migración para usar el toggle. Preparar en handoff una corrección puntual de Acarigua mediante la acción admin (sólo bandera); confirmar tenant/ciudad y estado previo, guardar y verificar RPC/cálculo final tras autorización específica de producción. Si Director exige corrección vía migración, coordinar número antes de crear archivo; 0472 no está reservado. No afirmar corrección productiva con pruebas locales.

## Gobernanza

Cumplimiento previsto: gate admin activo (`disabled_at`), filtros tenant/deleted, trigger de auditoría existente; formulario explícito sin autosave, labels accesibles, error con role alert, guardando visible, cancelación reversible. No aplica: borrado, cambios de tarifas, IA y datos personales. Evidencia y clasificación final en handoff.
