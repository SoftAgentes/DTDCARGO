# Handoff · el comentario vencido de la 0464 y el paso 3.2 de la guía L14

- Fecha: 2026-09-19. Estado de la tarea: **aplicada en local**; falta el `verify` completo, el push
  único y la PR, que va **en ready**: no hay migración ni decisión de Sam.
- Owner/sesión: `worker-docs-0464-l14-20260919` (Claude Opus 5, Worker, sesión «Automatizar la
  prueba de carrera del for update de 0459»). Director: la sesión «Director notificación a workers»,
  que asignó los dos pendientes y pasó los datos de producción.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/docs-comentario-0464-y-guia-l14`,
  creado con `harness-worktree start` desde `main` `dd764c66`.
- Rama: `codex/docs-comentario-0464-y-guia-l14`, sin upstream hasta el push.
- SDD: **ninguna**. Son dos pendientes de documentación que
  [`.agents/handoffs/0464-aplicacion-prod.md`](0464-aplicacion-prod.md) ya había detectado y dejado
  fuera de su alcance, uno por ser código y el otro por ser un handoff fechado.
- Permisos del encargo: commits en esta rama; el push único y la PR en ready, con el aviso del
  Director. **No merge. No producción. No leer filas de producción.**

## OBJETIVO ORIGINAL

1. `lib/portal/payment-report-commands.ts:39`: el comentario quedó vencido tras la 0464. Ajustarlo a
   lo que hace el código hoy, sin cambiar comportamiento.
2. El paso 3.2 de la guía L14: dejar en Git lo que Sam tiene que probar, que estaba sólo en la
   página publicada.

## COMPLETADO

- **El comentario.** La segunda frase decía «Los dos de 0464 (SDD-0484) no llegan hasta aplicar esa
  migración: el mapa va antes», escrita cuando la 0464 estaba pendiente. Ahora dice que esos dos
  códigos llegan **desde que la 0464 se aplicó, el 2026-09-19 a las 01:00:07 UTC (ledger
  `20260919010007`)**, y que el mapa se escribió antes. La primera frase y la regla de no devolver
  `message/details/hint` quedan como estaban. **No cambia una línea de código ejecutable.**
- **El paso 3.2 del guion** (`.agents/handoffs/smokes-app-l14-0454-0472-guion.md`, bloque 3, paso 2)
  con el texto exacto de la página publicada: el motivo de la cancelación **sigue visible después de
  recargar**, con la nota de que antes desaparecía y lo arregló la 0464. Antes el guion decía lo
  contrario y lo llamaba «hallazgo conocido, no una falla»: con la 0464 aplicada, que desaparezca sí
  es una falla.
- Con esto quedan cerrados **los dos puntos del «Fuera de alcance detectado»** de
  `0464-aplicacion-prod.md`.

## VALIDACIÓN

| Comprobación | Resultado |
| --- | --- |
| La 0464 está aplicada | **Confirmado por el Director, del ledger de producción**: version `20260919010007`, name `0464_reporte_pago_factura_pagada`, md5 `44fabe4d2643844fbe489e2ba88fa4fb`, 22.209 bytes. No lo afirmé antes de tenerlo: `migrations-applied` da SKIP en todo worktree |
| El texto del paso 3.2 | **Es el publicado**, no una reconstrucción: lo leí de la página «Pruebas de pagos y clientes» que publicó el Director, y coincide con lo que él mismo me pasó por mensaje |
| Otros pasos del guion vencidos por la 0464 | **Ninguno**: el único lugar que describía el motivo desapareciendo era ese paso. El otro handoff de los smokes no menciona la 0464 |
| Nada más pinchado al viejo texto del comentario | **Comprobado**: la única otra aparición es la cita dentro de `0464-aplicacion-prod.md`, que es evidencia fechada y no se toca |
| `verify` completo | **PENDIENTE**: en el turno del Director |
| CI alojado | **NO EJECUTADO**: GitHub Actions bloqueado por facturación desde las 21:18Z |

## COMMITS

| Commit | Propósito |
| --- | --- |
| este | `docs(SDD-0484)`: el comentario de la 0464 en pasado y el paso 3.2 del guion |

## PR / BRANCH

- Rama `codex/docs-comentario-0464-y-guia-l14`, base `main`. **La PR va en ready.** Va a quedar sin
  CI hasta que se destrabe la facturación de GitHub Actions.

## PENDIENTES DE ESTA TAREA

1. El `verify` completo, el push único y la PR en ready, con el número y el SHA al Director.
2. Liberar el claim.

## FUERA DE ALCANCE DETECTADO

1. **Dónde vive la guía de smokes.** El encargo decía «déjalo donde corresponda según docs/README», y
   `docs/README.md` manda las guías operativas a `docs/runbooks/`. El Director aclaró después que el
   guion ya vive en `.agents/handoffs/`, así que el paso 3.2 se actualizó ahí y **no se movió nada**.
   Queda la decisión de si esa guía —que Sam usa para probar en producción— debería ser un runbook
   en vez de un handoff fechado. Es del Director; mover un handoff no es una corrección de texto.
2. **La SDD-0484 sigue sin su último criterio**, que es la verificación de Sam en producción (bloque
   3.2). Con su OK, una PR de docs la pasa a `done`. Este cambio sólo deja la guía diciendo lo que
   hay que ver.

## IMPACTO DOCUMENTAL

- **Canónico:** ninguno. Se corrigen un comentario de código y un paso del guion.
- **Documentación en código:** el comentario de `payment-report-commands.ts`, ahora en pasado y con
  la fecha y el ledger de la aplicación.
- **No aplica:** `BRAND.md`, `docs/design/**`, `docs/marketing/**` y `revisar-datos-ve`.
- **Graphify, Archify y vista previa de Obsidian: NO EJECUTADOS.**

## HANDOFF AL DIRECTOR

- **Siguiente acción:** el `verify` completo y el push.
- **Cambios compartidos:** un comentario en `lib/portal/payment-report-commands.ts` y un paso del
  guion de smokes. Sin comportamiento.
- **Dependencias:** ninguna.
- **Sesiones consumidoras:** ninguna. El claim se libera al abrir la PR.
