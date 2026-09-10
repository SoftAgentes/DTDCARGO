---
sdd: 0441
title: Colores semánticos de marca y avisos de calculadora
status: in-progress
author: Codex · autorizado por Sam
created: 2026-09-05
updated: 2026-09-10
supersedes: null
superseded_by: null
related: [0165, 0257, 0275]
confidencialidad: interna
---

# SDD-0441 · Colores semánticos de marca

## Problema y decisión aprobada

Sam autoriza el 2026-09-05 cambiar BRAND.md y propagar la semántica a web,
Portal, Studio, móvil y Back. El recargo de peso y la derivación al asesor no
son errores de entrada. Las esperas normales no deben parecer fallos.
La matriz normativa está en BRAND.md, sección Estados y mensajes.

## Criterios de aceptación

- Información y pendientes usan tinta neutra; atención usa dorado localizado.
- Éxito requiere confirmación; errores conservan rojo localizado y explicación.
- Calculadora mantiene precios, límites y derivación. Avisos se asocian al campo.
- Tokens canónicos, fuentes del Norte y componentes reutilizables son coherentes.
- Validar claro/oscuro y móvil/escritorio; distinguir revisión local de producción.
- Entrega por PR a main; no merge, despliegue ni escritura de datos.

## Gobernanza y alcance

VIS-01, FRM-01, ERR-01, A11Y-01 y CMP-01. Cambio de presentación: ningún enum,
permiso, validación, fórmula, contrato SQL ni transición cambia.
Prealertas: sólo tonos de display en types.ts y badge. Sin crear compras,
proveedores ni modificar enlaces, packing list o documentos.
No se retira el arnés ni se modifica AGENTS.md: tarea independiente.

### Rescate del portal público del proveedor · 2026-09-10

Sam autoriza ampliar este slice únicamente a la presentación de
`app/p/[token]/PackingListFormSection.tsx` y `SupplierUploadSection.tsx`:
los errores de campos, envío y adjuntos usan texto neutro con rojo localizado
en el borde; la tabla posicionada contiene los textos `sr-only` y conserva
el scroll horizontal interno. No cambia mensajes, fórmulas, validaciones,
datos, enlaces, documentos, acciones ni contratos. Las dos rutas se agregan
a la allowlist; el handoff de rescate es un artefacto de control autorizado.

Revalidación contra `origin/main` en `13facbada82da3f09e295e90bbcccbfc10ed165c`:
ambos componentes conservaban exactamente los blobs de `c8c79298^`, anteriores
a las cuatro correcciones de clases de `c8c79298`. Las PR #33 y #46 ya estaban
integradas; no resolvieron este delta. Se porta solo ese cambio de producto,
sin los handoffs ni las notas de QA históricas del commit fuente.
La evidencia y los límites de validación actuales quedan en
[el handoff de rescate](../../../.agents/handoffs/rescate-dtd-0441-proveedor.md).

## Fuentes y derivados

Editables: BRAND.md, CLAUDE.md y tokens/componentes/data del Norte, estilos y
componentes de producción. Cápsulas de gobernanza y catálogo CMP son generados:
se verifican sin editar a mano. Índice SDD se regenera con docs:index.
El Brand Book standalone y la copia alojada en Storage son artefactos distribuidos;
no se resube una copia antigua ni se atribuye a producción este cambio local.

## Evidencia

Ver audit.md para clasificación por superficie, pruebas y límites de verificación.

### Cierre de la aritmética histórica del merge de PR #31

La allowlist quedó congelada con 76 rutas de implementación. El delta neto del
merge incorporó una ruta editorial adicional,
`.agents/handoffs/pr31-publication-review-20260907.md`, creada durante la revisión
de publicación posterior al congelamiento: `76 + 1 = 77`. Ese handoff no cambió
producto, CSS ni comportamiento, pero fue una no conformidad literal de alcance.
Queda registrado aquí como evidencia de entrega fuera de la allowlist de producto
para que no se vuelva a interpretar como una ruta funcional omitida.

El correctivo del 2026-09-10 mantiene la allowlist honesta para toda ruta de
producto o prueba que modifica, incluido el consumidor indirecto
`app/portal/(app)/reclamos/_components/PortalClaims.tsx` y su prueba focal. Los
handoffs de cierre siguen siendo artefactos de control de la tarea, no
consumidores de los estilos ni parte del barrido visual.

## Allowlist exacta

Se enumera en allowlist.txt junto a esta spec. Cualquier archivo fuera de esa
lista requiere revisar el alcance antes del commit.
