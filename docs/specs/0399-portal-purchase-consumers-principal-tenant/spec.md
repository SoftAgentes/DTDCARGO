---
sdd: "0399"
title: Consumidores de compras Portal por principal y tenant
status: done
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0361", "0398"]
confidencialidad: interno
---

# SDD0399 · Consumidores de compras Portal por principal y tenant

## Evidencia y autoridad

Después de SDD-0398, seis páginas de Compras todavía reducen el principal a
`client` y llaman lecturas que admiten o derivan el tenant usando únicamente el
Shipping Mark. RLS sigue siendo la defensa primaria, pero la consulta de
aplicación pierde una dimensión ya autenticada y el firmador de adjuntos no la
propaga al filtro previo a `service_role`.

Este slice usa sólo fixtures. No autoriza leer compras, proveedores, documentos
ni datos reales; tampoco cambia schema, RLS, Storage, UI o retención. Cloud,
push, `main`, despliegue y limpieza permanecen fuera de alcance.

## Contrato acotado

- Derivar el principal Portal completo en los seis consumidores de Compras.
- Propagar `tenantId + Shipping Mark` a cada lectura que ya dispone de ambos.
- Exigir el mismo tenant en la lectura RLS de metadatos antes de firmar adjuntos.
- Mantener respuestas, navegación, errores y degradación visual actuales.
- No introducir otra construcción de `service_role` ni confiar en parámetros del
  navegador como autoridad.

## Allowlist exacta

- `app/portal/(app)/proveedores/page.tsx`.
- `app/portal/(app)/compras/{page,nueva/page}.tsx`.
- `app/portal/(app)/compras/[code]/{page,detalle/page,etiquetas/page}.tsx`.
- `lib/portal/prealerta-document-signing.ts`.
- `lib/studio/prealertas/queries.ts`.
- Pruebas focales en `lib/portal/__tests__/` y
  `lib/studio/prealertas/__tests__/`.
- Esta spec, índice, auditoría, checklist y handoff del saneamiento.

## Aceptación

- [x] RED reproduce los consumidores que pierden `tenantId`.
- [x] Los seis consumidores derivan el principal completo y fallan cerrados.
- [x] Las lecturas de compras/proveedores/servicios incluyen tenant + Shipping Mark.
- [x] La autorización previa a firmar adjuntos incluye tenant + compra + Shipping Mark.
- [x] Pruebas focales/Portal, tipos, lint y gates quedan verdes.
- [x] Producción permanece no verificada y sin lecturas reales.
- [x] Checklist original sigue 56/106.

## Gobernanza

- `SGE-00.05`: cumplimiento; servidor conserva permiso, tenant y minimización.
- `SGE-00.01/.02/.03/.04/.06-.12`: no aplica; no cambia acción, persistencia,
  auditoría, interfaz ni salida funcional.
