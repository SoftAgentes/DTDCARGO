---
sdd: 0441
title: Colores semánticos de marca y avisos de calculadora
status: in-progress
author: Codex · autorizado por Sam
created: 2026-09-05
updated: 2026-09-05
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
Prealertas: tonos de display en types.ts y badge. La ampliación autorizada del
2026-09-06 incluye el cuerpo de errores del packing list y upload público;
sin crear compras, proveedores ni modificar contratos de enlaces/documentos.
No se retira el arnés ni se modifica AGENTS.md: tarea independiente.

## Fuentes y derivados

Editables: BRAND.md, CLAUDE.md y tokens/componentes/data del Norte, estilos y
componentes de producción. Cápsulas de gobernanza y catálogo CMP son generados:
se verifican sin editar a mano. Índice SDD se regenera con docs:index.
El Brand Book standalone y la copia alojada en Storage son artefactos distribuidos;
no se resube una copia antigua ni se atribuye a producción este cambio local.

## Evidencia

Ver audit.md para clasificación por superficie, pruebas y límites de verificación.

## Allowlist exacta

Se enumera en allowlist.txt junto a esta spec. Cualquier archivo fuera de esa
lista requiere revisar el alcance antes del commit.

## Ampliación de QA combinada · 2026-09-06

Director autoriza corregir dos no conformidades preexistentes reproducidas al
combinar 0441 y 0443: texto de errores en vino y overflow móvil por spans sr-only
sin contenedor posicionado. El cuerpo de los errores pasa a text-ink, con borde
local border-status-danger; se conservan mensajes, live region y lógica de envío.
La tabla conserva su scroll local y sus etiquetas accesibles, con position:relative.
Clasificación: remediación hacia cumplimiento de BRAND/ERR-01/A11Y-01, pendiente
de validar el nuevo SHA. No aplica a contratos SQL, datos, permisos o fórmulas.
Contraste de ES/Copiar y servicios de recepción siguen fuera de este delta.
