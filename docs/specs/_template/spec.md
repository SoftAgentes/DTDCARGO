---
sdd: "NNNN"
title: "Título corto del spec"
status: draft               # draft|proposed|approved|in-progress|done|superseded
author: "founder"
created: 2026-MM-DD
updated: 2026-MM-DD
supersedes: null
superseded_by: null
related: []                 # ej: ["0008","0011"]
confidencialidad: interno   # publico|interno|confidencial
# review-by: 2026-MM-DD     # SOLO en docs vivos (runbooks/architecture/índices), NO en specs congelados
---

# DTD-NNNN — <Título>

> Una línea: qué problema resuelve y para quién.

## Contexto
…

## Alcance
…

## Diseño
Referenciar por **texto-código + versión**, NUNCA por link relativo:
`docs/design/<producto>/<version>/.../<archivo>.jsx` (vX.Y)

## Adjuntos
Diagramas, payloads de ejemplo, mockups → `docs/specs/NNNN-slug/assets/` (este mismo folder).
Binarios >1 MB → fuera de git + `assets/EXTERNAL.md` con link a Drive.

---
<!--
Cómo usar: copiar este folder a docs/specs/NNNN-slug/, renombrar, completar el front-matter
(NNNN = siguiente correlativo; fechas reales). Validar con `pnpm docs:check`. El índice en
docs/specs/README.md se regenera con `pnpm docs:index`.
-->
