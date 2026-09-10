---
sdd: "0451"
title: "Sonda del emisor de navegación de la ruta móvil ERP"
status: in-progress
author: "Codex"
created: 2026-09-10
updated: 2026-09-10
supersedes: null
superseded_by: null
related: ["0444"]
confidencialidad: interno
---

# SDD-0451 — Observar antes de corregir el bucle móvil

## Síntoma y evidencia previa

El hallazgo H1 de `hallazgos-producto-para-sdd-20260908.md`, recibido del Director,
documenta 75 documentos en 60 s en `/m/erp?tab=expenses` con `next dev --webpack`.
Descartó 22 sitios de navegación dura por eliminación; quedó viva la hipótesis del
interceptor de React Refresh que recarga cuando falta una factory. **No hay una
pila directa histórica que lo confirme.** Los imports de Studio desde
`MobileErpClient.tsx` son pistas, no causas demostradas.

El artefacto fue leído completo (71 líneas). La última condición de lectura del
texto histórico se contradice; prevalece el contrato explícito de esta tarea:
`reload` mantiene la hipótesis y exige seguir la pila; `navigate` en el bucle
refuta ese diagnóstico y requiere identificar el repliegue duro real. La navegación
inicial que ordena el propio runner se distingue de los documentos sucesores.
Producción elimina el runtime candidato, pero no constituye una corrección.

## Alcance y restricciones

Allowlist de implementación inicial:

- `scripts/probes/navigation-emitter.mjs` y su prueba
  `scripts/probes/navigation-emitter.node.mjs`.
- Esta carpeta de SDD-0451 (spec, instrucciones y recibos técnicos sin PII).
- `docs/specs/README.md`, solo regeneración.
- `.agents/handoffs/d1-bucle-modulos-m-erp.md`.

Una corrección queda condicionada a una pila directa y al módulo observado;
entonces se limitaría a `app/m/erp/**` y los módulos mínimos señalados. Nunca
`app/studio/**`, configuración Next/Playwright, package.json, Supabase,
cutoff/baseline/ruleset. La rama de reserva se conserva sin tocar. No hay cambios
de UI/comportamiento propuestos, por lo que las políticas visuales son **no aplica**.

## Instrumento

La sonda lee Navigation Timing primero en cada documento. Un script de inicio
guarda eventos en `sessionStorage` y en un canal CDP hacia Node; se pausa antes
de la aplicación para instalar breakpoints de entrada en las funciones nativas
`reload`, `assign`, `replace` y los setters `href`/`location`. No sustituye métodos
no configurables ni modifica fuentes, runtime servido o configuración de producto.

En la pausa de navegación guarda `new Error().stack`, frames CDP y, si están
disponibles, `moduleObject.id`, `options.id`, tipo de `originalFactory` y factory
del registro webpack. Luego reanuda. `beforeunload` se captura aparte: su pila es
de un observador del ciclo de vida y no basta para atribuir un emisor.

Solo Chromium/CDP y URLs loopback. Recibos sin DOM, cookies, cuerpos de datos ni
credenciales. Las pausas añaden latencia; la tasa instrumentada se reporta con
tiempo de pausa y no se equipara silenciosamente con los 75 documentos históricos.

## Aceptación y decisión

- [x] Instrumento probado con llamadas reales a las cuatro operaciones, navegación
      resultante y persistencia a través del cambio de documento.
- [ ] Corrida de 60 s de la ruta autenticada bajo Webpack; salida cruda en handoff.
- [x] Tipo de navegación en su propia línea, antes de conclusiones; se distingue
      explícitamente el arranque no autenticado de los sucesores del bucle.
- [ ] Emisor observado y, si React Refresh se confirma, módulo/factory/chunk o ciclo
      concreto medido. Si no se confirma, dictamen explícito sin atribución falsa.
- [ ] Corrección mínima solo si se sostiene; medición posterior si hay cambio.
- [ ] Validación canónica, límites, commit selectivo y PR draft.

TIPO DE NAVEGACIÓN: `navigate` inicial (1); sucesores: 0. TIPO DEL BUCLE H1: NO DISPONIBLE.

## Lo que observó la sonda y decisión

Ventana 2026-09-10T20:02:30.344Z a 20:03:30.344Z: 60 000 ms exactos;
1 documento inicial, 1 petición de documento iniciada durante la ventana,
1 llamada nativa a `reload`, 1 `beforeunload`; 491 ms en pausas del depurador.
La petición inicial había empezado antes de la ventana. El documento respondió
HTTP 500: faltan URL/key de Supabase en `proxy.ts:67`. La siguiente respuesta
HTTP 500 llegó a 20:03:33.032Z, fuera de la ventana; ningún sucesor llegó a ser
observado como documento dentro de ella.

La llamada observada tiene stack directo en `performFullReload`,
`webpack-internal:///(pages-dir-browser)/.../hot-reloader-pages.js:412:21`,
desde `handleApplyUpdates:374:13`. Fuente instalada equivalente:
`node_modules/next/dist/client/dev/hot-reloader/pages/hot-reloader-pages.js:443`.
Es el recargador de la pantalla de error de Next. El servidor registró
`Fast Refresh had to perform a full reload due to a runtime error` junto al error
de configuración. **No es observación del ERP autenticado ni identifica H1.**
`modules` quedó vacío; no se observó una factory ausente.

La copia final de sessionStorage falló por destrucción de contexto mientras
navegaba: el proceso salió 2 y conserva todos los eventos externos. La versión
entregada incorpora reintento acotado de la copia y clasificación explícita
`INCONCLUSIVE` para errores HTTP, persistencia, falta de armado o salida de ruta.
El recibo original se preserva sin editar en `assets/unauthenticated-60s.json`,
y se pega íntegro en el handoff.

**H1 no está confirmado ni refutado.** El único `navigate` fue ordenado por el
runner; no es el repliegue duro repetido que refutaría la hipótesis. No se decide
un arreglo a partir del recargador de una pantalla HTTP 500. No hubo cambios de
producto, configuración o Studio ni comparación «75 → 1»; serían escenarios
diferentes. No se ejecutó análisis de ciclos/chunks: falta el módulo observado
que debe guiarlo. SDD permanece `in-progress`, con aceptación autenticada bloqueada.

## Entorno y validación

Base asignada `710a8e0695f416700d75e7bc42e8e5cb889751e8`; Node/Corepack,
Next 16.2.11 y React 19.2.4 del lockfile. Instalación congelada PASÓ.
El worktree empezó limpio y sin `node_modules`, sin `.env.local` ni credenciales
Supabase/E2E heredadas. Los siete servicios locales preexistentes no publican
puertos al host. El fixture histórico fija otro SHA y su contraseña era efímera;
no es autorización para repetir migraciones, seed o modificar esos servicios.

Pruebas focales: PASÓ, 24/24, 0 skips; incluyen operaciones nativas, rearmado,
factory sintética, pérdida real de persistencia, HTTP 500 y redirección al login
con 200. `corepack pnpm verify`: en curso. El ledger sin credenciales se clasifica
NO DISPONIBLE. No se toma verde local como E2E autenticado.
