# SDD-0507 — Adjuntos visibles en el Studio (listados y ficha del cliente)

- **Owner**: Worker Claude, claim `claude-adjuntos-visibles-20261013`
- **Worktree**: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\adjuntos-visibles-studio-20261013`
- **Rama**: `codex/adjuntos-visibles-studio-20261013`, creada con
  `harness-worktree start` desde `origin/main` `221c48f4`.
- **SDD**: 0507 — `docs/specs/0507-adjuntos-visibles-studio/spec.md`. Reserva
  local `codex/sdd-reserve-0507-adjuntos-visibles-studio` (`32e4b66e`),
  incorporada por fast-forward. Sin publicar.
- **Fecha de inicio**: 2026-10-14 (UTC; 2026-10-13 en Caracas).
- **Estado de la tarea**: en-progreso.

## Por qué este worktree y no el que asignó la app

La app abrió la sesión en `.claude/worktrees/modest-chaplygin-c2cdee` (rama
`claude/dreamy-kare-8ccfdb`). Ese árbol tiene un claim ajeno vigente:
`festive-ellis-03485b`, creado el 2026-09-21. Un claim ajeno no se roba ni vence
por tiempo, así que se creó aislamiento propio con el harness. El árbol de la app
quedó intacto.

## Objetivo (pedido de Sam, 2026-10-14, literal)

> «que cuando un cliente tiene algún adjunto, salga algo que se vean todos los
> adjuntos. Igual un embarque, que se vea visible si tiene adjuntos o no tiene»

1. Señal por fila (y cuántos) en los listados de Clientes y de Embarques/Tracking,
   sin cargar archivos, respetando RLS y tenant.
2. En la ficha del cliente, «Todos los adjuntos»: documentos del cliente y de sus
   embarques, con tipo, fecha, tamaño, embarque de origen y botón Ver (URL
   firmada como hoy).
3. Opcional, sólo si Sam lo aprueba: filtro «con adjuntos / sin adjuntos».

## Permisos del encargo

- Commits locales: sí.
- Publicar rama y PR: sí, «PR al final, sin merge».
- Merge, deploy y migraciones en producción: no. Una migración, si hace falta,
  va con su contrato SQL y el OK nominal de Sam.
- `pnpm verify`: pedir turno al Director (una corrida pesada a la vez).
- Diseño: proponerlo en la SDD y validarlo con Sam **antes** de implementar.

## Dependencias y riesgos de coordinación

- **SDD-0506 `bitacora-adjuntos-entidad`** — reserva de Codex del 2026-10-14
  01:01 UTC (`cd828b97`), dos minutos antes de la 0507. Sin worktree ni PR
  visibles en este clon al reservar. El nombre sugiere un trabajo vecino sobre
  adjuntos por entidad. Hay que confirmar con Sam o con el Director si es la
  misma tarea antes de tocar código compartido.

## Bitácora

- 2026-10-14 01:00 UTC — guard OK, claim ajeno detectado en el árbol de la app,
  worktree propio creado, `pnpm install --frozen-lockfile` OK, SDD-0507
  reservada.
