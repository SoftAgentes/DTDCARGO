---
sdd: "0501"
title: "Detectar el desfase de encabezados del grafo que el sello AST tapa (registro retroactivo de la PR #188)"
status: done
author: "Director (registro retroactivo)"
created: 2026-10-17
updated: 2026-10-17
supersedes: null
superseded_by: null
related: ["0502"]
confidencialidad: interno
---

# SDD-0501 — Desfase de encabezados del grafo (registro retroactivo)

> Esta ficha no diseña nada nuevo. Registra un trabajo ya fusionado que se hizo
> sin SDD y que el cierre de su jornada nombró «SDD-0501». Existe para que el
> número quede ocupado por lo que de verdad se hizo y nadie lo reutilice por error.

## Qué se hizo

La PR #188 («chore(harness): detectar el desfase de encabezados que el sello AST
tapa»), rama `claude/festive-ellis-03485b`, se fusionó el 2026-09-21 a las
18:16:44Z con el merge `0807b69d2f9d2956ca2d0e91412c0c2554469d29`.

- **El problema.** `knowledge:status` informaba `structural: CURRENT` con 0
  pendientes mientras el grafo guardaba los encabezados de una versión anterior
  de `docs/engineering/project-rules.md`. Había 131 líneas de desfase, y otras 23
  en `docs/runbooks/knowledge-graphify-obsidian.md`.
- **La causa.** Dos comportamientos de Graphify 0.9.61 se contradicen:
  - un documento con capa semántica no se vuelve a escanear con el extractor de
    encabezados;
  - el manifest lo sella igual con el md5 vigente.
  Por eso el sello AST no prueba que el grafo coincida con el documento.
- **El arreglo.** Se cambiaron el adaptador `scripts/knowledge-graph.py` y sus
  pruebas para que el desfase se detecte, y el runbook
  `docs/runbooks/knowledge-graphify-obsidian.md` para documentarlo. No cambió el
  comportamiento del producto.

Archivos de la PR:
- `.agents/handoffs/desfase-encabezados-grafo-piloto.md`
- `docs/runbooks/knowledge-graphify-obsidian.md`
- `scripts/knowledge-graph.py`
- `scripts/tests/knowledge-graph.node.mjs`
- `scripts/tests/knowledge-semantic-apply.node.mjs`
- `scripts/tests/knowledge-sync.node.mjs`

La causa medida, la reproducción aislada y los callejones cerrados están en el
handoff `.agents/handoffs/desfase-encabezados-grafo-piloto.md`.

## Por qué hay ficha ahora

- **2026-09-21.** El handoff de la PR dice «Sin SDD», porque era un cambio de
  harness. Pero el cierre de la jornada (`.agents/handoffs/cierre-jornada-20260921.md`)
  la listó como «#188 · SDD-0501 — causa del desfase de encabezados del grafo,
  con su comprobación». El número 0501 quedó usado en un documento canónico, sin
  carpeta de spec.
- **2026-09-23.** Otra tarea («mínimo facturable con batería configurable»)
  reservó el mismo número: rama `codex/sdd-reserve-0501`, commit
  `393aa37dff231ba1e888e03816fb5fb5b6bc563f`. El Director vio el choque y la pasó
  a la 0502 (ver `docs/specs/0502-minimo-bateria-configurable/spec.md`,
  § Incidente de numeración). La reserva 0501 quedó abandonada y preservada, con
  la condición de que su limpieza requiere autorización aparte.
- **2026-10-17.** El Director investigó la reserva y Sam autorizó este arreglo,
  con su texto literal: «sí, hazlo así». Consiste en crear esta ficha para la #188
  y después borrar la reserva abandonada.

## Aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | `docs/specs/0501-*` existe en `main` con un título que no es «RESERVADO» y apunta a la PR #188 y a su handoff | Cumplido con esta ficha |
| 2 | `docs:check` y `sdd:check` sin colisión de números | Ver la PR de esta ficha |
| 3 | La reserva abandonada `codex/sdd-reserve-0501` (`393aa37d`) se borra después del merge, en GitHub y en el registro local, solo si su único archivo sigue siendo el borrador de 2026-09-23 | Pendiente del merge |
