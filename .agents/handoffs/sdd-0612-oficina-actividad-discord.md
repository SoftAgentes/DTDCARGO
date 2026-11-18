# Handoff — SDD-0612 · Avisos de Paperclip a `#actividad-oficina` y resumen diario

Fecha: 2026-11-06. Task ID: `sdd-0612-oficina-actividad-discord`.
Owner / sesión escritora: `local_interesting-swartz-oficina-actividad` (Worker Claude Code, la sesión
que antes hizo el ícono de ALFRED).

Estado: **spec propuesta, con PR en borrador contra `main`.** Solo spec: sin código, sin migración,
sin tocar el VPS de la oficina ni Discord.

- **Worktree:** `DTD-worktrees/oficina-actividad-discord-sdd`, sin `node_modules`.
- **Rama:** `codex/oficina-actividad-discord-sdd`, desde `main` `3d17292a4`.
- **SDD:** `docs/specs/0612-oficina-actividad-discord/spec.md`, estado `proposed`. Reservada con
  `sdd:next --reserve oficina-actividad-discord`: rama `codex/sdd-reserve-0612-oficina-actividad-discord`
  y ref `refs/dtd/reservations/0612`, las dos solo locales (la rama de reserva no se publicó; la PR
  lleva la spec). Inventario al reservar: 666 refs y worktrees, spec siguiente 0612, migración
  siguiente 0518; 0603–0611 tomados.
- **Permisos:** el encargo llegó de la sesión coordinadora «SEO, GEO y AEO»
  (`local_61442abe-3b66-423e-9af4-8008d5457aa3`), no de Sam directo. Texto literal del encargo, el
  2026-11-06: «Publicar la rama y abrir la PR en borrador está autorizado; fusionarla, no.». Cubre
  publicar esta rama y abrir la PR en borrador. No cubre sacarla de borrador, fusionarla, publicar
  la rama de reserva, el VPS, Discord ni producción.

## OBJETIVO ORIGINAL

SDD nueva, solo spec: «Avisos de Paperclip a `#actividad-oficina` y resumen diario de la oficina».
Decidir cómo engancharse a Paperclip (v2026.1012.0), comparar extensión contra proceso aparte con
llave de lectura y recomendar uno, definir qué lleva cada aviso (A1), la cola y la entrega incierta
con el criterio de `discord_sender` (SDD-0607), el resumen diario y el runbook con Sam presente.

## COMPLETADO

- Spec con seis decisiones: proceso aparte en vez de extensión; llave de un agente «Vigía» pausado
  con cliente solo `GET`; detección por fotos del estado cada 60 s; contenido A1 con lista cerrada
  de campos; envío con el criterio de la 0607 y prueba cruzada de emisores; resumen diario a las
  18:00 de Venezuela, generado por código.
- Runbook propuesto (medición, webhook, Vigía, instalación, ida, vuelta, vuelta atrás) y tabla de
  decisiones de Sam D1–D6.
- Evidencia de Paperclip leída el 2026-11-06 en la documentación pública: guía de extensiones
  («Treat plugin workers and plugin UI as trusted code», UI del mismo origen sin aislamiento,
  runtime en alfa), referencia de la API (sin llaves de solo lectura; rutas y estados de tareas,
  agentes, aprobaciones y actividad) y notas de la versión v2026.1012.0 (2026-10-12).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm docs:index` | PASÓ: índice regenerado, 590 specs (fila 0612 nueva) |
| `pnpm docs:check` | PASÓ: exit 0, «índice sincronizado con 590 specs» |
| `pnpm sdd:check` | PASÓ: exit 0, «sin números repetidos» (los choques históricos de migraciones son conocidos y no se renumeran) |
| `git diff --check` | PASÓ |

Las tres se corrieron con `node scripts/…` directo (mismo comando que el script de `package.json`),
porque el worktree no tiene `node_modules`.
| `pnpm verify`, `harness:test` | NO APLICA: solo documentación |
| Graphify / Archify / knowledge | NO EJECUTADO: el encargo pidió correr solo `docs:check` y `sdd:check` |

## PENDIENTES DE ESTA TAREA

- Decisiones de Sam D1–D6 (tabla en la spec).
- Después de las decisiones: PR del código (`infra/oficina/dtd-actividad/`, harness, runbook) y
  corregir la línea del plan maestro que dice «extensión propia de Paperclip» si Sam aprueba D1.
- Paso 0 del runbook (medición en la instancia): qué lee una llave de agente pausado y si coincide
  la API con la documentación actual.

## FUERA DE ALCANCE DETECTADO

- `docs/organizacion/plan-maestro-oficina.md` (§ canales) dice que `#actividad-oficina` se alimenta
  con una extensión propia de Paperclip; contradice la recomendación D1. No se tocó aquí.
- El script del VPS `/usr/local/sbin/dtd-guardar-llave-discord` no está en el repositorio
  (ya anotado en el runbook del corte).

## HANDOFF AL DIRECTOR

Spec lista para revisión de Sam. Sin conflictos esperados: solo agrega una carpeta de spec, este
handoff y la fila del índice. El número 0612 está reservado solo en esta máquina; la PR lo publica.
