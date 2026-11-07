# Handoff · Guion de ejecución de Paperclip 2026.1106.0 (sin ejecutar)

- **Sesión:** Worker `4ec0cdd2…`, la misma de la PR #409. Pedido por el Subdirector
  (`local_61442abe…`) por encargo del Director General, el 2026-11-07.
- **Rama:** `codex/paperclip-1106-guion`, worktree `DTD-worktrees/paperclip-1106-guion`, desde
  `main` `7e75f7708`.
- **Alcance:** escribir el guion. **No se tocó el VPS** ni la base de Paperclip, y la PR #409 no
  cambia.
- **Entregable:** `docs/runbooks/oficina-paperclip-1106.md`.

## Qué lleva el guion

- Punto de partida: los envoltorios de `main` `7e75f7708` con sus huellas (de la nota de la
  reinstalación de las 17:52Z), Hermes 0.23 y los cambios A y B.
- Qué hace Sam y cuándo.
- Comprobaciones previas: issues del día, corridas vivas, próximos disparos, latidos, huellas, la
  base en solo lectura y el estado del puente.
- Respaldo en frío con `SHA256SUMS`.
- `paperclipai update --version 2026.1106.0`, primero con `--dry-run`.
- Migraciones: de 304 a 373.
- `unpricedUsagePolicy = allow` en las 8 políticas.
- Pruebas 5.1 a 5.4 y 5.6.
- Vuelta atrás en 10 pasos.
- La regla de «Upgrade runner».

## Hallazgos al escribirlo [CÓDIGO 1106, sin medir en el VPS]

1. **`paperclipai update` no reinicia nuestro servicio.** Solo reinicia y valida
   `paperclipai.service` (`cli/src/services/service-manager.ts:120`), y el nuestro es
   `paperclip.service`.
   - Sin reinicio, tampoco vuelve solo a la 1012 si algo falla.
   - Eso corrige la §3 del documento de la PR #409, que decía que vuelve solo.
   - El guion reinicia a mano y valida la salud.
2. **El respaldo previo de `update` necesita la base viva.** Con el servicio detenido, el comando
   se niega (`update.ts:51-63`). Por eso el guion vuelve a encender el servicio después del
   respaldo en frío.
3. **Sin terminal, el servidor aplica solo las migraciones pendientes** (`server/src/index.ts:275-278`),
   y `paperclip.env` no define `PAPERCLIP_MIGRATION_PROMPT`.
4. **En la 1106, un campo omitido en el upsert de una política conserva su valor**
   (`budgets.ts:776-779`). En la 1012 no era así. El guion repite todos los valores igual.
5. **Las rutinas usan `catch_up_policy = skip_missed` por defecto**, así que un disparo que caiga
   dentro de la ventana se salta.

## Validación

| Comprobación | Resultado |
|---|---|
| `pnpm docs:check` | PASÓ (596 specs) |
| `pnpm sdd:check` | PASÓ: sin números repetidos |
| `pnpm verify` | NO APLICA: solo hay documentación |
| Búsqueda de IP, correos y llaves en los archivos nuevos | Sin coincidencias, fuera de `127.0.0.1` |
| Correr el guion | NO EJECUTADO: necesita la ventana y el OK de Sam nombrando el VPS |

## Pendientes de esta tarea

1. La revisión y la fusión son del Director General.

## FUERA DE ALCANCE DETECTADO

- **Corregir la §3 de la PR #409** («si el servicio no valida al reiniciar, vuelve solo»). Por el
  hallazgo 1, no aplica a nuestro `paperclip.service`. La #409 está en revisión y no se tocó.
- **El nombre de `dtd-alfred-bridge.service`** viene del README y no se ha comprobado en el VPS.
  La comprobación previa lo mide.
- **La forma de `runtime_config->'heartbeat'`** no se midió. Si la consulta no la muestra, se mira
  en la pantalla.
- **La descripción de la unidad `paperclip.service`** dice `2026.1012.0`. Es solo texto, y se
  cambia al cierre de la ventana.

## Impacto documental

Hay un runbook nuevo en `docs/runbooks/`. No hay SDD, porque no cambia comportamiento. Graphify y
Archify quedan para el Director al integrar.
