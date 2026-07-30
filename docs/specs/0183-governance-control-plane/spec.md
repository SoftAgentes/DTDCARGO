---
sdd: "0183"
title: "Control plane ejecutable de gobernanza"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0165", "0174", "0175", "0178", "0180", "0181", "0182"]
confidencialidad: interno
---

# SDD-0183 — Control plane ejecutable de gobernanza

## 1. Objetivo

Conectar la gobernanza aprobada con los puntos de entrada que usan Codex,
Claude Code, Cloud Design y CI. El repositorio continúa siendo la fuente
normativa; la cápsula y el plugin sólo leen y validan esa verdad.

## 2. Flujo obligatorio

```text
política aprobada
→ registro maestro
→ cápsula generada
→ AGENTS / Studio / Norte
→ SDD + allowlist
→ components:check + governance:check + docs:check
→ pnpm verify
```

Ningún agente promueve una política o un componente automáticamente. Un
hallazgo se clasifica como cumplimiento, no aplica, excepción o no conformidad.

## 3. Alcance

- schema CMP-01 v1.1 y caso real `deprecated`;
- cápsula determinista de políticas aprobadas;
- enrutamiento desde los entrypoints del repositorio y del Norte;
- incorporación de los validadores al gate canónico;
- scaffold PLG-P3 read-only después de demostrar P1 y P2.

## 4. Fuera de alcance

- migraciones, Cloud, Auth y datos de negocio;
- Vercel o deploy;
- instalación del plugin, marketplace, MCP, app, hooks o escritura automática;
- implementación D1–D5 y barridos masivos de adopción;
- cambios visuales o de comportamiento del producto.

## 5. Allowlist

La allowlist exacta se conserva en la revisión REV-SGE-018. Cualquier archivo
de producto se limita a prueba accesible y anotación de deprecación, sin cambio
de comportamiento.

## 6. Aceptación

- 27 políticas aprobadas aparecen una vez en la cápsula;
- código, versión, estado y ruta coinciden con cada documento;
- `A11Y-01` es representable por CMP-01;
- el replacement de un deprecated existe y es canonical;
- AGENTS, Studio y Norte apuntan al mismo entrypoint;
- `pnpm verify` ejecuta `components:check` y `governance:check`;
- scaffold PLG-P3 no escribe ni instala capacidades;
- typecheck, lint proporcional, tests, build, docs y `diff --check` verdes.

## 7. Resultado

Gate local aprobado:

- cápsula reproducible con 27 políticas aprobadas;
- CMP-01 v1.1 con 3 componentes, incluido un caso real `deprecated`;
- PLG-P3–P5 validado en modo read-only, sin instalación ni marketplace;
- 309 archivos y 4.115 pruebas Vitest verdes;
- 19 contratos SQL verdes y replay local de 276 migraciones reproducible;
- 19 E2E verdes y 3 omitidos por requerir seed autenticado;
- lint sin errores, typecheck, build de 152 rutas y validadores documentales
  verdes.

La ausencia de credenciales en el worktree impidió consultar
`migrations-applied`; no se copió `.env`, no se leyó PII y no se ejecutó
ninguna operación Cloud.
