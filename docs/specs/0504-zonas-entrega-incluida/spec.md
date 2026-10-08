---
sdd: "0504"
title: "Entrega incluida desde Editar ciudad"
status: done
author: "Codex"
created: 2026-10-08
updated: 2026-10-08
supersedes: null
superseded_by: null
related: ["0055", "0236", "0237", "0257", "0502"]
confidencialidad: interno
---

# SDD-0504 — Entrega incluida desde Editar ciudad

## Objetivo y autoridad

Sam administra la inclusión de la entrega desde Administración > Calculadora pública > Ciudades > Editar ciudad, sin editar código. El control original ya permitía guardar `casco`: esta tarea corrige que la calculadora pública ignoraba un `false` persistido cuando el respaldo traía `true`. Caracas, Valencia y Maracay conservan entrega incluida; Acarigua queda excluida. Las demás ciudades y tarifas se conservan.

El 2026-10-08 Sam eligió explícitamente conservar una sola opción «Entrega incluida, sin costo adicional» dentro de Editar ciudad y retirar el panel duplicado de la primera implementación. Reutilizar SDD-0504, la rama y PR #193. Publicación de esta rama/PR autorizada. Sam también autorizó integración/producción, operaciones a cargo del Director; el Worker no mergea ni despliega. Sin migraciones ni escrituras de datos productivos en este Worker.

## Contrato

Reutilizar `calculator_cities.casco`, `CityDrawer`, `updateCityAction`, RPC pública y tarifario existentes. La bandera persistida manda, incluido `false`; el fallback sólo decide cuando no hay catálogo persistido. No segunda lista/panel ni acción sin consumidores. La acción original conserva el CRUD de ciudad y exige admin activo, tenant/ciudad viva y respuesta de fila guardada; cero filas nunca confirma éxito. Auditoría por trigger existente. No RPC ni schema nuevos.

El formulario original carga la casilla desde `city.casco`, conserva el borrador ante error, bloquea doble envío y permite cancelar sin mutar. El éxito se anuncia después de guardar. Usa controles/componentes canónicos y tokens existentes. Una ciudad no incluida usa la tarifa pública vigente de transportista, después el respaldo confirmado; sin precio confirmado deriva al asesor. No cambia la fórmula mínimo/batería/descuento de SDD-0502.

## Allowlist exacta de la simplificación (registrada antes de editar producto)

- `docs/specs/0504-zonas-entrega-incluida/spec.md`
- `docs/specs/README.md` (generador únicamente)
- `.agents/handoffs/calculadora-zonas-entrega-incluida-20261008.md`
- `app/studio/(app)/admin/_components/calculator/CalculatorSection.tsx`
- `app/studio/(app)/admin/_components/calculator/CiudadesPanel.tsx`
- `app/studio/(app)/admin/_components/calculator/CityDrawer.tsx`
- `app/studio/(app)/admin/_components/calculator/ZonasEntregaPanel.tsx` (eliminar componente duplicado de esta tarea)
- `app/studio/(app)/admin/_components/calculator/__tests__/ZonasEntregaPanel.test.tsx` (eliminar pruebas exclusivas del componente retirado)
- `app/studio/(app)/admin/calculator-actions.ts` (retirar `saveDeliveryZoneAction`; ajuste mínimo del recorrido original de guardado, sin cambiar create/delete)
- `app/studio/(app)/admin/__tests__/delivery-zone-action.test.ts` (pruebas significativas de `updateCityAction` original, persistencia y cálculo)
- `app/studio/(app)/admin/_components/calculator/__tests__/CityDrawer.test.tsx` (UI real del recorrido original)
- `lib/studio/rbac-actions-guard.test.ts` (restaurar inventario 428 → 427 al retirar la acción; conservar scanner, guards, excepciones y deuda)
- `lib/public/__tests__/combinar-destinos.test.ts` (sólo si se necesita cobertura adicional real)
- `app/tarifas/embed/page.tsx` (mismas RPC públicas y combinación de destinos que `/tarifas`)
- `app/tarifas/embed/page.test.tsx` (página RSC real, tarifa vigente/respaldo/sin precio)
- `lib/geo-zonas.ts` (sólo bandera/mensaje de Acarigua y comentario de conteo actual)
- `app/importar-de-china/[ciudad]/page.tsx` (sólo precisión del FAQ de Acarigua, misma fuente `notaEntrega`, layout/otras respuestas intactos)
- `app/importar-de-china/[ciudad]/page.test.tsx` (render RSC real y mensaje comercial por ciudad)
- `docs/marketing/README.md` (entrada SDD-0504; no cambiar otros frentes)
- `docs/marketing/seo.md` (entrada fechada nueva; conservar historia)
- `docs/marketing/calculadora-explicada.html` (lista/conteo actual de siete inclusiones sin Acarigua)
- `docs/marketing/servicios-infografias/PROMPT-CLOUD-DESIGN.md` (lista/conteo actual de siete inclusiones)

Los cambios anteriores autorizados y ya implementados en `lib/public/rates-queries.ts`, `lib/data/destinos-nacionales.ts`, `lib/calculadora.ts` y `__tests__/calculadora.test.ts` se conservan sin nuevas ediciones: precedencia persistida, Acarigua `false` con respaldo 123,60 USD/m³ y otras siete inclusiones intactas. No cambios de fórmulas, selector/carrusel ni otros módulos.

## Aceptación

1. Una sola casilla «Entrega incluida, sin costo adicional» en Editar ciudad; sin panel duplicado ni acción huérfana. Sólo admin edita; carga y errores visibles.
2. El formulario original carga `city.casco`, guarda marcado/desmarcado y conserva el borrador ante error. Cancelar no muta. El cálculo final refleja inclusión/exclusión y conserva tarifa interna.
3. Caracas, Valencia y Maracay incluidas; Acarigua excluida en fallback. Director comprobó el catálogo productivo ya correcto (Acarigua `false`, otras siete `true`), por lo que no requiere escritura de datos.
4. Resto de ciudades/coberturas, mínimos, batería y descuentos se preservan.
5. Tests significativos de acción, UI y cálculo; revisión visible local con datos sintéticos.
6. Validar SDD/docs/gobernanza/componentes y `pnpm verify`, declarando SKIPs y fallas ajenas.
7. `/tarifas/embed` combina las mismas fuentes públicas de ciudades/precios que `/tarifas`; la página de Acarigua y material comercial actual dejan de prometer entrega incluida. Otras ciudades y layout se conservan.

Ampliaciones coordinadas por Director antes de editar: el baseline productivo del embed no cruzaba tarifas y derivaba al asesor para ciudades con recargo; `geo-zonas` y cuatro fuentes comerciales seguían incluyendo Acarigua. Ambos contradicen la exclusión autorizada. Se corrigen puntualmente dentro de esta misma SDD, sin otra lista ni nueva política.

El FAQ genérico describe DDP y coordinación de la entrega dentro de la cotización final: su «Sí» no demuestra gratuidad, pero puede resultar ambiguo junto a la exclusión de Acarigua. Director autorizó precisar sólo esa respuesta y su JSON-LD, usando la nota comercial de Acarigua; no revisión global de FAQ.

## Corrección del catálogo persistido y release

No requiere schema nuevo, migración ni ajuste de datos: Director verificó por lectura de configuración que Acarigua ya está `false` y las otras siete inclusiones están `true`. El defecto está en el OR del adaptador público, retirado en esta tarea. Director valida SHA integrado, CI, deployment READY y recorrido público real. No afirmar código publicado con pruebas locales ni atribuir al nuevo SHA resultados anteriores.

## Gobernanza

Cumplimiento del slice comprobado en acción/UI reales con clientes y datos simulados: gate admin activo (`disabled_at`), filtros tenant/deleted, formulario explícito sin autosave, labels accesibles, error con role alert/foco, guardando visible y cancelación reversible. Trigger/RLS existentes comprobados por metadata entregada por Director; no ejecución de una escritura real ni auditoría before/after de casco inventada. No aplica: cambios de schema, nuevas tarifas, IA y datos personales. Evidencia y clasificación final en handoff.

Implementación local terminada y criterios propios cumplidos: slice 573/573, suite general 8.961 aprobadas/1 omisión del corpus real ausente, E2E 177 aprobadas + 1 flaky aprobado al reintentar/20 omisiones, build y TypeScript PASÓ. `pnpm verify` conserva FALLÓ/INCOMPLETO por su primera falla TS del test, corregida y comprobada después, y sus tres omisiones SQL/schema/ledger cubiertas por evidencia independiente del Director sin cambios SQL. Estado done de implementación; CI del nuevo SHA, integración y evidencia productiva siguen pendientes para Director y se registran por separado en [PR #193](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/193). La autorización de Sam sigue vigente; no se presenta código local como publicado.
