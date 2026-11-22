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

## v0.2 (revisión CHANGES_REQUESTED de Dir_DTD sobre 4a7ea257e)
- Merge de origin/main (8c15a4bb0), sin rebase.
- §3.1: la carpeta no se mueve; label/slug en modules.ts + rewrite /studio/soporte → carpeta + 308 desde la vieja. Medición pendiente en la fase 1 (bucle, revalidatePath, ítem activo). Alternativa con la lista de lo que se rompe si se mueve.
- Inventario: alert-routing.ts:53/:66 a clase A; bandeja.ts:266 y discord/channels.ts:40 a clase A′ (atados a nombre externo); comentarios a clase C; bug-email-notify.ts:485 a clase F; catalogo.ts:78 precisado; proxy.ts verificado, no cambia. Conteos re-medidos (docs/design 27).
- docs:check PASÓ · sdd:check PASÓ.

## v0.3
- Sam (2026-11-22, en esta sesión, textual): «Con todas las recomendadas». D-1..D-6 = A; status approved; índice regenerado. docs:check y sdd:check PASÓ.
- Siguiente: Worker de producto para la fase 1 (lo asigna Dir_DTD).

## v0.4
- Sam cambió D-3, D-4 y D-6 a B en el chat de Dir_DTD (después del «Con todas las recomendadas»); la última vale. §9 registra las dos citas.
- Nuevo §2.1 (barrido chat/caso, inventario y lo que queda fuera), §2.2 (rol «Atención al cliente», id support igual), §4.1 (idioma propio de Chatwoot, costo y orden con la #776) y fases 1 a 5.
- Queda fuera del barrido (propuesta, Sam puede sumar): Bitácora, Bugs, privacidad, contenido.

## v0.5
- Merge de origin/main 471ea1d0b sin rebase; el merge entró limpio (cambios de main en la 0706 y el índice).
- §2.1: conteos marcados como mínimos y completados (Pantalla 10, Oficina 15); pruebas que afirman las cadenas viejas.
- §2.2: las firmas de correo guardan el rótulo (role_label); nueva D-7 para Sam (A recomendada: actualizar solo las que dicen exactamente «Soporte», con OK nominal).
- Fases: la 3 va después de la 1 y de la 2; su criterio excluye la clase A′. §4.1: imagen en GHCR privado, etiqueta y digest; enmienda de chatwoot-versiones.md en la fase 5.
- Pendiente de Sam: D-7.
