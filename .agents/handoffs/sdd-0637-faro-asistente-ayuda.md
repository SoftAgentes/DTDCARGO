# Handoff · SDD-0637 Faro, asistente de ayuda del Studio

- **Fecha:** 2026-11-16 · **Owner:** sesión «Lumi» (Claude Worker), a pedido de Sam vía el Director General.
- **Worktree / rama / base:** `.claude/worktrees/lumi-3ff50d` · `claude/lumi-3ff50d` · `origin/main` en `433e1e2aa`.
- **Spec:** `docs/specs/0637-faro-asistente-ayuda/spec.md` (estado `proposed`).
- **Estado de la tarea:** lista-para-revision (solo etapa 0, documento).

## Objetivo
Dejar por escrito el diseño de Faro para que Sam lo apruebe y el Director lo ubique en la cola.

## Hecho en esta tarea
- Spec con arquitectura en cinco capas, minicerebro, recorte por permisos, bloqueo decidido por el servidor,
  alertas, diseño visual, papel de Hermes, fases y decisiones abiertas.
- Dos maquetas en `docs/specs/0637-faro-asistente-ayuda/maqueta/` (datos de ejemplo, sin datos reales).
- Índice de specs regenerado.

## Decisiones de Sam registradas (2026-11-16)
Nombre Faro · alertas «solo lo serio» · modelo de IA por decidir con la evaluación · estilo 1 «Faro clásico»,
con excepción a BRAND.md solo para Faro · Hermes como analista, redactor y vigía · minicerebro cerrado.

## Validación
| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` | PASÓ (622 specs) |
| `pnpm verify` | NO EJECUTADO: cambio solo de documentación, sin código de producto |
| Maquetas en navegador | NO EJECUTADO: no se abrieron en un navegador desde esta sesión |
| Número 0637 libre | Medido: main llega a 0636; ningún otro worktree ni PR abierta usa 0637 |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: sin números repetidos |

## Pendientes de esta tarea
- Aprobación de Sam a la spec y a las decisiones D-1 a D-7.
- Publicar la rama y abrir PR: requiere autorización; no se hizo.

## Dependencias
- SDD-0626 (PR #598, sesión «Hermes VPS y PaperCut»): cliente del runtime de la Oficina. Faro no escribe otra
  cadena de modelos; coordinar con esa sesión (D-1).
- SDD-0589: el motor de guía está en producción; el botón «Guía» no está montado. Faro lanza recorridos por código.
- Migración: el siguiente número libre al crearla (0549 al 2026-11-16).

## FUERA DE ALCANCE DETECTADO
- Anthropic no figura en `docs/legal/privacidad/inventario-terceros.md`, aunque el Studio ya lo usa.
- Las cabeceras de las migraciones 0538 a 0540 dicen «no aplicadas a producción» y, según el Director General,
  lo están desde el 2026-11-15.
