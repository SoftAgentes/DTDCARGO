# Handoff · SDD-0669 — Ficha del cliente: reorganizar la presentación

- **Rama:** `claude/0669-ficha-reorganizar` · **PR:** #681 · **Base:** `main` `9434cc4f6`
- **Spec:** `docs/specs/0669-ficha-cliente-reorganizar/spec.md` (`in-progress`)
- **Encargo:** Director General, 2026-11-18, por pedido de Sam en la reunión con la oficina («Sí, pásalo»). OK del DG para implementar con las decisiones de §8: solo la columna de conversaciones (sin pestaña aparte) y el asesor de solo lectura en la franja.

## Objetivo

Repartir la ficha del cliente del Studio (`/studio/clientes/<código>`) en una franja fija, avisos arriba, cuatro pestañas (Resumen, Envíos, Documentos y Configuración), un solo bloque de documentos y las conversaciones a la derecha. Es solo presentación: sin datos nuevos, sin migración y sin cambios de permisos.

## Qué quedó

- `page.tsx` arma la franja (vía `ClientDetailClient`, prop `encabezado`), la cabecera de cuenta de la 0558, los avisos (solicitud de cambio y `NotaDeLaFicha`), `FichaPestanas` y la columna de conversaciones.
- `FichaPestanas`: patrón de pestañas WAI-ARIA con `.studio-tabs`; la activa en `?pestana=` con `history.replaceState`; `pestanaDeLaFicha` solo acepta las pestañas que llegan.
- `DocsPanel`: prop opcional `formularioPlegado` (por defecto igual que antes); el foco va al primer campo al abrir y vuelve al botón al cancelar.
- `TodosLosAdjuntos`: prop opcional `soloEmbarques`, para no repetir los de la ficha.
- `studio.css`: la rejilla de tres columnas de la 0650 F1 se reemplaza por franja, cuerpo con columna de 360 px y resumen de dos columnas.
- Desvíos de la propuesta, anotados en la spec y aceptados por el DG: los cuatro indicadores quedan bajo la franja, sin fijar; el perfil incompleto sigue en su tarjeta; bajo 1024 px, las conversaciones van debajo de las pestañas.

## Validación

| Comprobación | Estado | Evidencia |
|---|---|---|
| `docs:check` y numeración | PASÓ | Local |
| Pruebas por rol (mismas tarjetas que en `9434cc4f6`, una vez cada una, mismos permisos) | NO EJECUTADO en local | `ficha-cliente-page.test.tsx`; corre en el CI |
| Pestañas (URL, teclado, `hidden`, pestaña ajena) | NO EJECUTADO en local | `ficha-pestanas.test.tsx`; corre en el CI |
| `pestanaDeLaFicha` | NO EJECUTADO en local | `lib/studio/__tests__/ficha-cliente.test.ts`; corre en el CI |
| `DocsPanel` plegado y foco | NO EJECUTADO en local | `DocsPanel.test.tsx`; corre en el CI |
| install, tsc, eslint, vitest completo, build | NO EJECUTADO en local | Sin turno de PC; el DG pidió que el CI sea el portón de la #681 |
| `/ui-check` a 1440, 1512, 1024 y teléfono | NO EJECUTADO | Necesita dev server (PC) |
| Captura con datos de prueba en `assets/` | NO EJECUTADO | Necesita dev server (PC); nunca con una ficha real |
| Revisión independiente | Opus sobre `692074063`: código bien; CHANGES_REQUESTED por proceso (este handoff, CI sin terminar) y tres ajustes, atendidos en el commit siguiente | Mensaje del DG |

## Pendientes de esta tarea

1. Ver el CI de la #681 en verde sobre la cabeza nueva.
2. `/ui-check` a 1440, 1512, 1024 y teléfono, y la captura con `DTD-0000` o datos de prueba (§7 de la spec), con turno de PC.
3. Traer `main` antes de fusionar si entró la #679 (CBM).

### No bloqueantes (revisión de Opus, para después)

- «Atrás» del navegador no recorre las pestañas (`replaceState`). Con `pushState` cada pestaña sería un paso del historial.
- `NotaDeLaFicha` usa `Aviso` con `role="status"`: el lector la anuncia al cargar la ficha.
- «Ver nota completa» no lleva `aria-expanded` (lo pinta `Aviso`, que no lo acepta hoy).

## Impacto documental

- La spec 0669 describe el diseño y los desvíos. La 0650 §4 («Diseño de la ficha») queda superada en la disposición (tres columnas) por la 0669; no se reescribe, porque es evidencia fechada.

## Coordinación

- SDD-0664 (sesión Tracking en vivo): de acuerdo, esta entra primero. Lo que tocará después: el contenido de `ShippingMarkChip.tsx`, `listMarkboxHistory`, `client-codigo-viejo.ts` y una prueba de la redirección en `page.tsx`. Avisará antes de abrir rama.

## FUERA DE ALCANCE DETECTADO

- `ClientAccountHeader` (0558) no tiene versión compacta: sus tarjetas miden 260 px. Si se quiere en la franja fija, es una tarea de la 0558.

## Handoff al DG

PR #681 lista para revisión una vez el CI esté verde. Sin migraciones ni puertas de producción: fusionar despliega solo presentación del Studio.
