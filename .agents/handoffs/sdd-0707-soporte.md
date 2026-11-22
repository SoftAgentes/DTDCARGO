# Handoff · SDD-0707 «Conversaciones» → «Soporte» (solo spec)

- Owner: Worker (Claude) · Rama: `claude/sdd-0707-soporte-8b7d6c` · Base: `main` 33ef3ad82
- Objetivo: spec `docs/specs/0707-conversaciones-a-soporte/spec.md` (inventario, rutas, Chatwoot, lo que no cambia, fases, decisiones D-1..D-6).
- COMPLETADO: spec escrita; índice `docs/specs/README.md` regenerado.
- VALIDACIÓN: `pnpm docs:check` PASÓ · `pnpm sdd:check` PASÓ (solo choques históricos ya conocidos) · vitest NO EJECUTADO (pedido) · `pnpm verify` NO APLICA (solo docs).
- Número 0707: libre (sin carpeta, rama ni `refs/dtd/reservations/0707` en origin).
- Impacto documental: spec nueva + índice. Runbooks de Chatwoot y de oficina solo se leen, no se editan.
- PENDIENTES: que Sam conteste D-1..D-6; luego Worker de producto para la fase 1; Ofi_Hermes la fase 2; fase 3 Chatwoot con OK nominal.
- FUERA DE ALCANCE DETECTADO: (1) la bandeja de Chatwoot «Conversaciones del portal» se cruza por nombre en `cargar.sh`/`ensayo-portal.sh`; renombrarla a ciegas rompe el cruce. (2) «Soporte» ya es un rol (`support`).
- NV: inventario real de bandejas/equipos/etiquetas de Chatwoot y plantillas de Meta (no se consultó producción).
