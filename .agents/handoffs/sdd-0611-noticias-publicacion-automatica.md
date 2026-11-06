# Handoff — SDD-0611 · Publicación automática de noticias (solo spec)

| Campo | Valor |
|---|---|
| Owner | Worker `worker-sdd-0611-inspiring-elion` (claim con el id `worker-sdd-0610-inspiring-elion`, el número que se intentó primero) |
| Sesión que encargó | Subdirector «SEO, GEO y AEO» (`local_61442abe-3b66-423e-9af4-8008d5457aa3`) |
| Ruta | `.claude/worktrees/inspiring-elion-0ce8c8` |
| Rama | `claude/inspiring-elion-0ce8c8`, base `main` `5373e6c81` |
| Fecha | 2026-11-06 |
| SDD | 0611 — `docs/specs/0611-noticias-publicacion-automatica/spec.md`, `status: proposed` |

## Objetivo

SDD nueva, solo spec, sin código ni migraciones, para que las noticias de `/noticias` se
publiquen solas con filtros: la excepción a IA-01 que Sam decidió el 2026-11-05.

## Hecho

- Reserva: `refs/dtd/reservations/0611` y `codex/sdd-reserve-0611-noticias-publicacion-automatica`
  (`0fb26d40e`), **solo locales**, sin publicar. Primero se intentó la 0610 y falló: otra sesión
  (resumen semanal del CRM) la reservó durante la corrida. La reserva fallida no dejó refs.
- Spec con: registro de la excepción (política, motivo, alcance, responsable, fecha de revisión,
  vigencia), estados del borrador, diez filtros con códigos de motivo, control determinista de
  líneas rojas, puntaje mínimo, auditoría, aviso y retiro, interruptor con apagado automático,
  firma, identidad y permisos, privacidad, gate de pruebas de IA-01, criterios de aceptación,
  decisiones abiertas y dependencias.
- Índice de specs regenerado.

## Validación

| Comprobación | Resultado |
|---|---|
| `pnpm docs:index` | PASÓ (590 specs) |
| `pnpm docs:check` | PASÓ |
| `pnpm sdd:check` | PASÓ (solo choques históricos conocidos) |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO APLICA: solo documentos |
| `pnpm knowledge:status` | NO DISPONIBLE: «Respuesta inválida del adaptador Graphify» en este worktree; estructural y semántico `UNAVAILABLE` |
| Hallazgo de la marca vacía | Comprobado con node sobre la expresión de `lib/news/score.ts`: `[VERIFICAR]` y `[VERIFICAR: ]` cuentan 0 |

## Pendientes de esta tarea

1. Que Sam revise la spec y conteste las cinco decisiones abiertas de su §7.
2. Publicar la rama y abrir la PR: **no autorizado** en el encargo.
3. Publicar la reserva 0611 en `origin` si se quiere que otras máquinas la vean (el comando lo
   imprimió `sdd:next`).

## Impacto documental

- Canónico nuevo: la spec 0611. Índice `docs/specs/README.md` regenerado.
- **No tocados a propósito** (el encargo era solo spec): `docs/marketing/agente-seo-noticias.md`,
  `06-noticias.md`, `02-reglas-de-la-oficina.md`, plan maestro §7.8 y `docs/governance/README.md`.
  La spec (§9) lista qué cambia en cada uno al aprobarla.
- Graphify, Archify y Obsidian: sin cambios en fuentes de código; no se regeneraron derivados.

## FUERA DE ALCANCE DETECTADO

- `publishPost` (`app/studio/(app)/marketing/noticias-web/actions.ts`) no exige en el servidor
  que no queden marcas `[VERIFICAR]`: una llamada directa publica un texto con marcas.
- `verifyMarkers` (`lib/news/score.ts`) no cuenta la marca vacía.
- `lib/news/writers.ts` firma con escritores invitados; choca con la decisión «firma DTD Cargo».
- `docs/marketing/agente-seo-noticias.md` dice que publicar lo aprueba una persona; seguirá siendo
  cierto hasta que la 0611 se apruebe y se construya.
- Ya anotado por la SDD-0605: `lib/news/prompts.ts:468` sobre el marcado de preguntas frecuentes.

## Coordinación

- La sesión del resumen del CRM (`local_2e23f385…`, SDD-0610) preguntó si esta SDD define la
  puerta de salida. Respuesta enviada: no; queda fuera de alcance, puede seguir con su propuesta.
