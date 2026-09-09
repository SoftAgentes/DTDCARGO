---
sdd: 0318
title: Presencia documental del Portal en lote
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0057
  - SDD-0308
confidencialidad: interno
---

# SDD-0318 — Presencia documental del Portal en lote

## Problema

`/portal/envios` consultaba `prealerta_documents` una vez por cada compra viva.
Con `N` compras generaba `N` round-trips para pintar tres indicadores booleanos
de documentos. También transfería once columnas aunque la vista sólo necesita
`prealerta_id` y `doc_type`.

## Contrato

1. La presencia documental se resuelve con `listPrealertaDocumentPresence`.
2. La consulta pide sólo `id`, `prealerta_id` y `doc_type`, filtra compras por
   lotes, exige el `client_markbox`, excluye borrados y pagina con orden estable.
3. Se deduplican ids antes de consultar. `fetchAllByIds` cubre tanto el límite
   de URL del filtro `.in(...)` como el máximo de filas de PostgREST.
4. La página agrupa los resultados en memoria y conserva exactamente los chips
   `packing`, `factura` y `foto`; el packing list online sigue combinándose con
   `prealertasConPackingList`.
5. Un fallo del query degrada a ausencia de indicadores, como el comportamiento
   best-effort previo; no revela documentos de otro cliente ni rompe la página.

## Datos y seguridad

- No agrega captura, persistencia ni terceros.
- Reduce los metadatos transferidos al servidor de render.
- `client_markbox` sigue siendo defensa en profundidad además de RLS.
- No usa `service_role` para consultar `prealerta_documents`.

## Aceptación

- Varias compras entran en un lote deduplicado.
- Sólo se seleccionan columnas de presencia.
- El filtro por Shipping Mark es obligatorio.
- Cero ids no toca Supabase.
- Error de PostgREST devuelve `[]` sin lanzar al render.

## Fuera de alcance

- Cambiar políticas RLS o datos Cloud.
- Alterar la interfaz visual de Alertas.
