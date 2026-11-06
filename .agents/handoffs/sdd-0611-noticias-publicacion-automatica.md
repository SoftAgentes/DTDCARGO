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
- **Segunda pasada (2026-11-06), con el encargo completo del Subdirector:** tabla de los ocho
  puntos con su prueba (§5.1); requisito previo de bloquear `[VERIFICAR]` en el servidor (§3);
  propuesta de nota para `docs/governance/README.md` (§2.1); aviso a Discord con
  el transporte de SDD-0606 y retiro por enlace (§4.5); puertas del esquema mixto alineadas con
  la salida de SDD-0610 (§4.9); temas solo de Search Console en F2; revisor humano después de
  publicar (§4.7); migración sin número, la asigna el Director General (§3).

- **Tercera pasada (2026-11-06), decisión de Sam en esta sesión:** «Vamos a empezar esta semana
  una diaria, por lo menos esta semana y la otra para hacer pruebas. Ya después se convertiría en
  una semanal o dos semanales». Registrada en §1.1 y en §4.2.1: los topes son una configuración
  que cambia Sam, con un límite duro de una automática por día; las dos semanas de prueba
  (2026-11-06 al 2026-11-15) son **a mano**, porque la vía automática no existe, y sirven de
  ensayo de los filtros. La decisión abierta 3 queda resuelta en parte.

- **Cuarta pasada (2026-11-06), decisiones de Sam en esta sesión:**
  - Canal: «Un canal nuevo que se llame Noticias» → `#noticias` (decisión 1).
  - IA: «la noticia no debe decir que se hizo con IA. La redacción tiene que ser muy humana» →
    decisión 2; pidió analizar herramientas de naturalidad y anexarlo para la gente →
    `anexo-redaccion-natural.md` (fuentes primarias de Google, reseñas marcadas como tales,
    recomendación de no meter humanizadores en el camino automático y prueba a ciegas).
  - Tope: «Sí, cuenta solo las automáticas. El sistema publica sus dos noticias y avisa que
    también las de nosotros» → decisión 3; dos automáticas por semana y aviso también de las
    manuales en `#noticias`.
  - Retiro: «no me apagues la automatización» y que detecte cada noticia que sale y diga el
    porqué «para entrenar a la gente» → se quitó el apagado automático (§4.6) y se agregó §4.11
    (motivo obligatorio, detección de toda salida, motivo de vuelta a la oficina).
  - Revisores: «el humano va a ser Sam y va a ser Alejandro», más un agente crítico → decisión 5
    (§4.7). Alejandro necesita cuenta propia en el Studio.
  - Fecha de revisión: «60 días» → decisión 4, 60 días después de la primera publicación
    automática. **Las cinco decisiones quedaron resueltas.**
  - Ícono del webhook en `assets/discord/`, recomendada la «N». Sam respondió «listo» el
    2026-11-06 después de las instrucciones para crear `#noticias`, el webhook «DTD Cargo · Noticias»
    y subir la foto. **No verificado desde aquí** (no hay acceso a Discord). La dirección del webhook
    no se copió a ningún lado; `DISCORD_WEBHOOK_NOTICIAS` se carga cuando exista la implementación.

## Validación

| Comprobación | Resultado |
|---|---|
| `pnpm docs:index` | PASÓ (590 specs) |
| `pnpm docs:check` | PASÓ |
| `pnpm sdd:check` | PASÓ (solo choques históricos conocidos) |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO APLICA: solo documentos; el encargo pidió correr solo `docs:check` y `sdd:check` |
| Segunda pasada: `docs:index`, `docs:check`, `sdd:check`, `git diff --check` | PASÓ |
| `pnpm knowledge:status` | NO DISPONIBLE: «Respuesta inválida del adaptador Graphify» en este worktree; estructural y semántico `UNAVAILABLE` |
| Hallazgo de la marca vacía | Comprobado con node sobre la expresión de `lib/news/score.ts`: `[VERIFICAR]` y `[VERIFICAR: ]` cuentan 0 |

## Pendientes de esta tarea

1. Spec `approved` por Sam el 2026-11-06, texto literal: «yo aprobé el PR (aprobado), pero que
   él tome la decisión». No es autorización de merge: el merge lo decide el Director. Aviso
   enviado al Subdirector «SEO, GEO y AEO».
2. PR en borrador abierta. Autorización recibida por mensaje del Subdirector «SEO, GEO y AEO»
   el 2026-11-06, texto literal: «publica la rama y abre la PR en borrador; eso está autorizado,
   fusionarla no». No cubre el merge.
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

- Canal del aviso: el encargo pidió `#actividad-oficina`; Sam decidió el 2026-11-06 «Un canal
  nuevo que se llame Noticias». La spec usa `#noticias` (decisión 1 resuelta). En el mismo
  mensaje Sam mencionó llamar «Para aprobar decisiones» a un canal; queda por confirmar si
  quiere renombrar el `#decisiones` actual. Un cambio de nombre no rompe webhooks ni bot porque
  usan el ID (`docs/runbooks/oficina-corte-discord.md:63`), pero el plan maestro §7.6 y ese
  runbook nombran el canal.
- Índice de specs: la PR #388 (SDD-0610) agrega su fila en el mismo bloque; quien integre la
  segunda regenera el índice.

- La sesión del resumen del CRM (`local_2e23f385…`, SDD-0610) preguntó si esta SDD define la
  puerta de salida. Respuesta enviada: no; queda fuera de alcance, puede seguir con su propuesta.
