# Handoff — SDD-0706 spec de verificación en dos pasos

- Owner: Worker (sesión sdd-0706-dos-pasos) para Dir_DTD · Rama: `claude/sdd-0706-dos-pasos-771d5f`
- Objetivo: escribir la spec SDD-0706 (AAL2/TOTP para el Studio). Solo documentación: sin código ni migración.
- Carril: rápido (solo docs).

## COMPLETADO
- `docs/specs/0706-studio-verificacion-dos-pasos/spec.md` (status `proposed`): inventario de quién la necesita,
  enrolamiento TOTP, recuperación (4 capas), convivencia con la contraseña de 5 min, bocetos, fases 0-5, pruebas
  y seis decisiones A/B para Sam (D-1 a D-6) con recomendación.
- Índice `docs/specs/README.md` regenerado.

## VALIDACIÓN
- `pnpm docs:check`: PASÓ. `pnpm sdd:check`: PASÓ (los choques históricos listados son preexistentes).
- vitest y `pnpm verify`: NO EJECUTADO (tarea solo de docs; sin turno de PC pedido).

## PENDIENTES DE ESTA TAREA
- Revisión independiente y fusión por el tren de Dir_DTD. Respuestas de Sam a D-1..D-6 (dibujar §7 antes de pedirlas).

## FUERA DE ALCANCE DETECTADO
- Ninguno nuevo. Las **NV** de la spec (claims `aal`/`amr` con `totp`, límite de factores, `auth.admin.mfa.deleteFactor`,
  TOTP habilitado en la config de Auth) se miden en la fase 1, en un entorno de prueba.

## Impacto documental
- Spec nueva + índice. Sin cambios en AGENTS ni runbooks (la fase 2 pide el runbook `segundo-paso-recuperacion.md`).

## HANDOFF AL DIRECTOR
- Reservar número de migración solo en la fase 4. Encender TOTP en la Auth de producción pide OK nominal de Sam.

## Actualización 2026-11-22 — decisiones de Sam
- Sam decidió D-1 a D-6: A en las seis (texto textual citado en la spec §10). Estado de la spec: `approved`.
- Rama `claude/sdd-0706-decisiones`, PR del carril rápido (solo docs). La fase 1 (código/medición) NO se arrancó: la asigna Dir_DTD.
- `pnpm docs:check` y `pnpm sdd:check`: ver resultado en la PR.
