# Handoff · SDD-0647 — CRM › Embudos: Clientes, Leads y Leads con código

Fecha: 2026-11-16 · Rama `claude/hungry-proskuriakova-1c7b26` · Reserva `refs/dtd/reservations/0647`.

## Hecho

- Regla aceptada por Sam (2026-11-16, preguntas cerradas; texto en la spec §0 y §3).
- Tres vistas en `CRM_VISTAS` (`lib/studio/crm-tablero.ts`): Clientes (segmento `cliente` de la 0506),
  Leads con código (con Shipping Mark, sin carga) y Leads (sin ficha o sin código). Disjuntas, extensibles.
- Pestañas con su conteo en `CrmEmbudosClient.tsx`; `?embudo=` acepta `leads_con_codigo`.
- Migración **0553** (en espera): `crm_asegurar_tarjetas_clientes()` crea la tarjeta de cada cliente con
  carga que no la tiene, al abrir Embudos. Fuente nueva `carga_erp`. Desarme `supabase/desarmes/0553_desarme.sql`.
  Sin la 0553 el tablero degrada (declarado en `pending-migration-symbol-declarations.json`).
- `CrmTarjetaTablero` suma `fuente` y `utmSource`, pedidos por la sesión de la visual.

## Evidencia

- Vitest local (antes de la renumeración 0645→0647 / 0551→0553 y de los campos `fuente`/`utmSource`):
  PASÓ, 254 pruebas en 17 archivos (crm-tablero, crm-tablero-queries, migración en PGlite con mutantes,
  `app/studio/(app)/crm`). Después del cambio: NO EJECUTADO localmente, porque el `node_modules` del
  checkout principal apunta a otro worktree que cambió a las 17:30. Lo cubre el CI.
- `check-pending-migration-symbols`: PASÓ (0 rojo, 1 amarillo declarado). `check-numbering`: PASÓ. Índice
  de specs regenerado.
- `pnpm verify`: NO EJECUTADO (requiere turno del DG). Lint y tipos: los mide el CI.
- `/ui-check`: OK para commit (control segmentado del sistema, sin tokens nuevos; pills con wrap).

## Pendiente de esta tarea

- CI verde de la PR; revisión independiente (la lanza el DG).
- Aplicar la 0553 en producción: solo con OK nominal de Sam para el archivo, en el chat del DG, con el runbook.

## FUERA DE ALCANCE DETECTADO

- Una tarjeta sin ficha (su teléfono no cruzó con una única ficha) y la ficha con carga de la misma
  persona quedan como dos tarjetas: falta ligar a mano o una regla de enlace.
- La carga histórica anterior a los lotes 64-68 no está en el ERP: esos clientes salen como Leads con código.
- `crm_segmento_clientes` compara `upper(btrim(client_markbox))` sin índice de expresión: medir el costo
  con el volumen real si el tablero se pone lento.
