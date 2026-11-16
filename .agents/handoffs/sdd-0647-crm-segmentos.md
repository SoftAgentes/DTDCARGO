# Handoff · SDD-0647 — CRM › Embudos: Clientes, Leads y Leads con código

Fecha: 2026-11-16 · Rama `claude/sdd-0647-crm-segmentos` (PR #621) · Reserva `refs/dtd/reservations/0647`.

## Hecho

- Regla aceptada por Sam (2026-11-16, preguntas cerradas; texto en la spec §0 y §3).
- Tres vistas en `CRM_VISTAS` (`lib/studio/crm-tablero.ts`): Clientes (segmento `cliente` de la 0506),
  Leads con código (con Shipping Mark, sin carga) y Leads (sin ficha o sin código). Disjuntas, extensibles.
- Pestañas con su conteo en `CrmEmbudosClient.tsx`; `?embudo=` acepta `leads_con_codigo`.
- Migración **0553** (en espera): `crm_alta_tarjetas_clientes(tenant)` (solo service_role) y un alta inicial
  que corre una vez al aplicar. Fecha de actividad 2000-01-01 y asesor heredado si está activo. Fuente nueva
  `carga_erp`. La vista no escribe. Desarme `supabase/desarmes/0553_desarme.sql`.
- Revisión independiente del DG (CHANGES_REQUESTED sobre f29d95a4f), atendida: (1) actividad baja fija;
  (2) alta inicial en la 0553 y sin escritura desde la vista; (3) el `console.warn` ya no aplica porque la
  llamada se quitó; (4) caso de ficha fusionada viva. La prueba con `crm_puede_usar()` de la 0539 ya no
  aplica: la función no lo usa, es solo de service_role; (5) asesor heredado.
- `CrmTarjetaTablero` suma `fuente` y `utmSource`, pedidos por la sesión de la visual.

## Evidencia

- Vitest local (antes de la renumeración 0645→0647 / 0551→0553 y de los campos `fuente`/`utmSource`):
  PASÓ, 254 pruebas en 17 archivos (crm-tablero, crm-tablero-queries, migración en PGlite con mutantes,
  `app/studio/(app)/crm`). Después del cambio: NO EJECUTADO localmente, porque el `node_modules` del
  checkout principal apunta a otro worktree que cambió a las 17:30. Lo cubre el CI.
- Cambios de la revisión (alta inicial, fecha baja, asesor, fusionada viva, vista sin escritura): prueba
  local NO EJECUTADA. Este worktree no tiene install propio y el `node_modules` compartido está roto; el DG
  decidió (2026-11-16) publicar sin correr nada local para no hacer cola en la PC. El portón es el CI de
  GitHub (Vitest y PGlite completos). Si sale rojo, el DG da turno.
- La corrida 43969569049 (cabeza 396422331) cayó en ESLint: tres mutantes tenían un salto de línea real
  dentro de la cadena. Corregido con `
`; vitest local NO EJECUTADO, porque el turno de PC era de otro
  Worker. Sí corrió `pnpm install` en este worktree, antes de que el DG retirara el turno.
- CI de 44837fcf8: 18 906 pruebas pasaron y 2 fallaron en la prueba de la 0553. Faltaba subir el conteo
  de 14 a 16 aserciones, y la prueba PREFLIGHT caía en un insert del escenario de prueba (no en la
  migración, que no tiene lock), porque ese insert tocaba crm_tarjetas antes de la 0553. Corregido: el
  insert solo corre si la tabla existe. Vitest local de ese archivo con turno del DG: PASÓ, 14/14. ESLint
  de ese archivo: PASÓ.
- `check-pending-migration-symbols`: la medición local (0 rojo, 1 amarillo) era de la cabeza f29d95a4f, cuando el tablero llamaba a la RPC. Desde 396422331 no hay código que llame a un símbolo de la 0553 ni declaración; la medición sobre la cabeza nueva es NO EJECUTADA en local (sin turno de PC) y la hace el CI. `check-numbering`: PASÓ. Índice
  de specs regenerado.
- `pnpm verify`: NO EJECUTADO (requiere turno del DG). Lint y tipos: los mide el CI.
- `/ui-check`: OK para commit (control segmentado del sistema, sin tokens nuevos; pills con wrap).

## Costo de aplicar la 0553 (para el OK de Sam)

- El `ALTER TABLE … drop/add constraint` toma **ACCESS EXCLUSIVE sobre `crm_tarjetas`** y lo mantiene hasta
  el COMMIT. Como el alta inicial corre en la misma transacción, el lock dura lo que tarda el alta.
- Mientras dura: el tablero Embudos, la ficha de tarjeta y la entrada de leads de Chatwoot (0513), que leen o
  escriben `crm_tarjetas`, **esperan**. No fallan salvo que su propio timeout se cumpla antes. Los webhooks
  que no entran se reintentan por el cron de reintentos (0504).
- Duración: un recorrido por tenant de las fichas vivas sin tarjeta y su segmento (`crm_segmento_clientes`
  compara `upper(btrim(client_markbox))` contra `shipments` y `warehouse_receipts_cn` sin índice de
  expresión). No medido en producción, porque no leí filas. Con unos miles de fichas y envíos se espera
  segundos, no minutos.
- Topes: `lock_timeout 5 s` (si otra sesión tiene la tabla, aborta sin cambiar nada) y `statement_timeout 60 s`
  (si el alta tarda más, **todo** vuelve atrás: ni CHECK, ni función, ni tarjetas). Es seguro reintentar.
- Recomendación: aplicarla en una ventana tranquila, sin carga de contenedores en curso. El conteo previo de
  solo lectura (fichas con segmento cliente sin tarjeta) da el tamaño real del alta.

## Pendiente de esta tarea

- CI verde de la PR; revisión independiente (la lanza el DG).
- Aplicar la 0553 en producción: solo con OK nominal de Sam para el archivo, en el chat del DG, con el runbook.
  Antes, el conteo de solo lectura de fichas cliente sin tarjeta.
- Fichas que ganen carga después de aplicar: no reciben tarjeta sola (spec §7).

## FUERA DE ALCANCE DETECTADO

- Una tarjeta sin ficha (su teléfono no cruzó con una única ficha) y la ficha con carga de la misma
  persona quedan como dos tarjetas: falta ligar a mano o una regla de enlace.
- La carga histórica anterior a los lotes 64-68 no está en el ERP: esos clientes salen como Leads con código.
- `crm_segmento_clientes` compara `upper(btrim(client_markbox))` sin índice de expresión: medir el costo
  con el volumen real si el tablero se pone lento.
