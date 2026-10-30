---
sdd: "0589"
title: "Motor de guía propio y liviano en Studio (E9 del programa SDD-0582, paso 9.2)"
status: in-progress
author: "Claude Worker «E9 motor» (Sam)"
created: 2026-10-30
updated: 2026-10-30
supersedes: null
superseded_by: null
related: ["0582", "0233"]
confidencialidad: interno
---

# SDD-0589 — Motor de guía en Studio (E9, paso 9.2)

Programa: [SDD-0582](../0582-chatwoot-piloto/spec.md) · checklist: [fila 9.2](../0582-chatwoot-piloto/checklist.md) · guion aceptado: [`guia-guion.md`](../0582-chatwoot-piloto/guia-guion.md) (9.1, decisión K de la spec del programa).

> Solo código de Studio. No toca producción, el VPS, Meta, Chatwoot ni la base. No trae migración: el estado por usuario es de 9.3.

## 1. Problema

El equipo que hoy atiende en Kommo necesita ver en la pantalla dónde está cada tarea en Studio. El guion de 9.1 fija los textos, las anclas y las claves. Falta el motor que los muestra.

## 2. Qué entrega 9.2

| Pieza | Archivo | Qué hace |
|---|---|---|
| Recorridos como datos | `lib/studio/guia/tipos.ts`, `lib/studio/guia/recorridos.ts` | `GuiaRecorrido { id, ruta, pasos[] }` y `GuiaPaso { id, ancla, clave }`. `GuiaClave` es un tipo derivado del dict: solo admite claves base con `.title` y `.what` en los dos idiomas. `validarRecorrido` comprueba el formato de ancla del guion (`<pantalla>.<elemento>`) y que no se repitan los ids |
| Navegación pura | `lib/studio/guia/motor.ts` | `primerPaso`, `pasoSiguiente`, `pasoAnterior` y `contador`. Consultan `existe(ancla)` en cada movimiento: un paso sin ancla se salta y, si no queda ninguno, el recorrido no abre |
| Colocación pura | `lib/studio/guia/posicion.ts` | Pone la tarjeta debajo del ancla y, si no cabe, arriba, a la derecha o a la izquierda. Si no cabe en ningún lado, o el ancla no está, va libre abajo a la derecha. Nunca se sale del viewport |
| Progreso | `lib/studio/guia/almacen.ts` | Interfaz `GuiaAlmacen`. 9.2 usa `localStorage` con `try/catch` y respaldo en memoria. Solo guarda ids de recorrido y de paso, sin PII. 9.3 reemplaza la implementación sin tocar el motor |
| Motor | `app/studio/_components/guia/GuiaMotor.tsx` | Arranca con `?guia=<id>` o con `iniciarGuia(id)`. Solo abre en la ruta de su recorrido y reintenta 2 s si el ancla se pinta tarde. Al cambiar de ruta, cierra. Dibuja un contorno sobre el ancla con `pointer-events: none` y sigue el scroll, los cambios de tamaño y los del DOM |
| Tarjeta | `app/studio/_components/guia/GuiaTarjeta.tsx` | Tarjeta pequeña de 360 px como máximo, con `role="dialog"` no modal, sin fondo ni trampa de foco. Tiene Siguiente/Anterior/Cerrar; Escape y las flechas funcionan con el foco dentro. Muestra «Antes en Kommo» solo si la tarjeta trae `.before` |
| Textos | `lib/i18n/es-VE/guide.ts`, `lib/i18n/zh-CN/guide.ts`, `lib/i18n/dict.ts` | Dominio `guide` con los controles del guion y el recorrido de demostración. `hasI18nKey` sirve para los sufijos opcionales |
| Montaje | `app/studio/(app)/layout.tsx` | `<GuiaMotor />` dentro de `<Suspense>`, junto a `DeniedToast`. Son 5 líneas |
| Demostración | `app/studio/(app)/dashboard/page.tsx`, `.../dashboard/_components/DashboardClient.tsx` | 4 anclas: `dashboard.bienvenida`, `dashboard.kpis`, `dashboard.configurar` y `dashboard.paneles`. Se ve en `/studio/dashboard?guia=dashboard` |

### Accesibilidad y movimiento (A11Y-01, MOT-01)

- **Foco:** al abrir pasa a la tarjeta. Al navegar se queda en el botón usado; por eso «Anterior» usa `aria-disabled` y no `disabled`. Al cerrar vuelve al elemento que lo tenía antes.
- **Anuncios:** una región `role="status"` / `aria-live="polite"` dice «Guía, paso n de total: título» y, al cerrar, «Guía cerrada».
- **Teclado:** Tab sale de la tarjeta, porque no es modal. Escape cierra y ← → navegan con el foco dentro. El botón de cerrar mide 32×32 y tiene nombre accesible.
- **Movimiento:** la entrada usa `--dur` y el desplazamiento entre anclas `--dur-slow`. Con `prefers-reduced-motion: reduce` solo queda la opacidad (`--dur-fast`), el contorno no se anima y el scroll al ancla es `auto`.
- **Capas:** `z-index` 90. Queda sobre el topbar (70) y debajo de drawers (100), avisos (150) y confirmaciones (200).

### Marca

Usa solo tokens (`--bg-surface`, `--border-strong`, `--shadow-pop`, `--r-lg`, `--s-*`, `--wine-text`, `--info`, `--info-bg`, `--dur*`, `--ease`) y los botones `studio-btn` existentes. No usa glass ni hex. El texto va alineado a la izquierda y con tuteo. Una prueba vigila los 40/140 caracteres del guion, la ausencia de exclamaciones y el voseo.

## 3. Decisiones

- **D1 · Sin dependencia nueva.** El motor es propio (decisión K del programa).
- **D2 · Arranque sin botón.** El botón «Guía» y la primera vez automática son de 9.3 (preguntas S-6 y S-7). 9.2 deja `?guia=` para la capacitación de 8.1 e `iniciarGuia()` para 9.3.
- **D3 · zh-CN traducido de forma provisional.** La pregunta S-3 (traducir u ocultar en zh-CN) sigue abierta para Sam. Las claves tienen que existir en los dos idiomas, así que se tradujeron. Si Sam decide ocultar, basta con filtrar el locale en el motor.
- **D4 · Demostración en el Dashboard.** Es una pantalla general que no edita ninguna sesión de E2, E3 ni E6. No se pusieron anclas en Bandeja, CRM, Usuarios ni Actualizaciones: eso es de 9.5.
- **D5 · Claves agregadas al guion.** `guide.chrome.done` («Terminar»), `close_aria`, `card_aria`, `announce` y `closed` hacían falta para el último paso y el lector de pantalla.
- **D6 · Sin registro CMP todavía.** `GuiaTarjeta` queda como componente nuevo sin entrada en `docs/governance/components/`. Se propone registrarlo como `proposed` en 9.6, después de la prueba con la persona que atiende, para no regenerar `component-registry.json` mientras otras ramas lo tocan.

## 4. Aceptación

| # | Criterio | Evidencia |
|---|---|---|
| A1 | Motor con pasos anclados a `data-guia` | `GuiaMotor.test.tsx` «arranque» |
| A2 | Tarjeta pequeña, sin modal que bloquee | prueba «no hay fondo ni trampa de foco» (`aria-modal="false"`, clic en la pantalla con la tarjeta abierta) |
| A3 | Siguiente / Anterior / Cerrar | prueba «siguiente / anterior / terminar» y «botón Cerrar» |
| A4 | Foco, teclado y `aria-live` | prueba «flechas navegan y Escape cierra devolviendo el foco» y anuncios en `role="status"` |
| A5 | `prefers-reduced-motion` | prueba «con prefers-reduced-motion la tarjeta no se desplaza» |
| A6 | Marca e i18n es-VE y zh-CN | `/ui-check` (§5); pruebas «mismas claves», «en zh-CN usa los textos chinos» y tono |
| A7 | Recorridos como datos tipados | `tipos.ts` + prueba «todo recorrido del catálogo es válido» |
| A8 | Ancla inexistente: se salta sin romper | pruebas «salta el paso…», «sin ninguna ancla…» y «si el ancla se va con la tarjeta abierta…» |
| A9 | Demostración en una pantalla que nadie más edita | Dashboard (D4) |
| A10 | Pruebas unitarias y de componente | `lib/studio/guia/__tests__/guia.test.ts` (19) y `app/studio/_components/guia/GuiaMotor.test.tsx` (16) |

## 5. Validación local (2026-10-30)

- `vitest run lib/studio/guia app/studio/_components/guia`: **PASÓ**, 35/35. También `app/studio/(app)/dashboard`: **PASÓ**, 9/9.
- Mutantes a mano sobre `GuiaMotor.tsx`: «toda ancla existe» lo matan 3 pruebas, «sin restaurar foco» 1 y «no cierra al cambiar de ruta» 1. Se restauró el archivo.
- `tsc --noEmit` del proyecto: **PASÓ**.
- ESLint de los archivos tocados: **PASÓ**, 0 avisos.
- `/ui-check`: **OK con ajustes menores**. Se aplicó el foco visible de la tarjeta. Queda la revisión visual en vivo (claro, oscuro, móvil y zoom al 200 %) para 9.6.
- `pnpm verify`: **NO EJECUTADO**. Hay cola de corridas pesadas; el turno lo da el Director.

## 6. Allowlist exacta

- `lib/studio/guia/tipos.ts`, `motor.ts`, `posicion.ts`, `almacen.ts`, `recorridos.ts`, `__tests__/guia.test.ts`
- `app/studio/_components/guia/GuiaMotor.tsx`, `GuiaTarjeta.tsx`, `GuiaMotor.test.tsx`
- `lib/i18n/es-VE/guide.ts`, `lib/i18n/zh-CN/guide.ts`, `lib/i18n/dict.ts`, `lib/i18n/index.ts`
- `app/studio/(app)/layout.tsx` (montaje), `app/studio/(app)/dashboard/page.tsx` y `app/studio/(app)/dashboard/_components/DashboardClient.tsx` (solo los atributos `data-guia`)
- `docs/specs/0589-guia-motor-studio/spec.md`, `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 9.2), `docs/specs/README.md` (índice), `.agents/handoffs/0589-e9-motor.md`

## 7. Fuera de alcance

- El estado por usuario, el botón «Guía», «No volver a mostrar», reanudar y reiniciar, con su migración: **9.3**.
- La guía dentro de Chatwoot (`DASHBOARD_SCRIPTS`, `postMessage` y archivo de selectores): **9.4**.
- Los recorridos por rol y las anclas en Bandeja, Embudo, Ficha DTD, IA, Usuarios y Actualizaciones: **9.5**.
- La prueba con la persona que atiende, el `/ui-check` en vivo y el registro CMP: **9.6**.
