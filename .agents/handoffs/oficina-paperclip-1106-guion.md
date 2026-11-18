# Handoff · Guion de ejecución de Paperclip 2026.1106.0 (sin ejecutar)

- **Sesión:** Worker `4ec0cdd2…`, la misma de la PR #409. Pedido por el Subdirector
  (`local_61442abe…`) por encargo del Director General, el 2026-11-07.
- **Rama:** `codex/paperclip-1106-guion`, desde `main` `7e75f7708`.
  - Los dos primeros commits se hicieron en el worktree `DTD-worktrees/paperclip-1106-guion`.
  - La corrección del 2026-11-09 se hizo en la rama local `claude/1106-guion`, en el worktree
    `.claude/worktrees/practical-cannon-f13640`, y se publicó en avance rápido sobre la remota.
- **Alcance:** escribir el guion. **No se tocó el VPS** ni la base de Paperclip, y el documento de
  la #409 no cambia.
- **Entregable:** `docs/runbooks/oficina-paperclip-1106.md`.

## Qué lleva el guion

- Punto de partida: los envoltorios de `main` `7e75f7708` con sus huellas (de la nota de la
  reinstalación de las 17:52Z), Hermes 0.23 y los cambios A y B.
- Qué hace Sam y cuándo.
- Comprobaciones previas: issues del día, corridas vivas, próximos disparos, latidos, huellas, la
  base en solo lectura y el estado del puente.
- Respaldo en frío con el servicio detenido, `umask 077` y `SHA256SUMS` de la base, `cli` y la
  configuración.
- `paperclipai update --version 2026.1106.0 --no-backup` con `umask 022` (#17208), sin encender el
  servicio entre la copia y la actualización. Antes, un `--dry-run` con el servicio encendido.
- Migraciones: de 304 a 373, y el `engine` de ALFRED y del Auxiliar sin cambios.
- `unpricedUsagePolicy = allow` en las 8 políticas.
- Pruebas 5.1 a 5.4 y 5.6, y criterios de parada (§7.1).
- Vuelta atrás en 8 pasos: detener, comprobar, apartar, restaurar con la 1012 activa y recién
  entonces arrancar; las migraciones vuelven a 304.
- La regla de «Upgrade runner».

**Alineación con la #409 (2026-11-07, pedida por el Subdirector).** El primer commit (`b40c9c4fa`)
es anterior a la revisión del DG de la #409. El segundo (`04e2111eb`) sigue el paso 3 de la #409 en
`fb3504059`. La #409 entró a `main` el 2026-11-09 (`9c5c30d95`).

**Revisión del DG sobre `04e2111eb` (2026-11-09): CHANGES_REQUESTED.** La pasó el Subdirector.
Hay un bloqueante y cinco puntos más, todos en el commit siguiente:

- **Bloqueante.** El «Sigue si» del §3.2 ahora exige que `paperclipai.service` no exista. Si
  existe, se para y no se abre la ventana.
- **El OK de la ventana** incluye por escrito la vuelta atrás que restaura la base (§2).
- **Las lecturas de T-15** van con un OK de Sam nombrando el VPS (§2 y §3.2). El script de Node
  queda literal, con 11 consultas en solo lectura. La 8 dice solo si existen nombres de variables,
  sin valores.
- **La vuelta atrás** guarda la configuración de la 1106 en `config.1106-<sello>.tgz` antes del
  `tar -xzf config.tgz` (§8, punto 4).
- **Skills:**
  - se cuentan por perfil antes y después de 5.3;
  - se respaldan los enlaces de `~agentes/.hermes/skills` (`skills-agentes.tgz`, dentro de
    `SHA256SUMS`) y las skills de los perfiles, como root;
  - en la vuelta atrás se restauran. Las de los perfiles, solo si su número cambió;
  - se agregaron dos criterios de parada: la consulta 8, y un cambio en el conteo o en el arranque
    de 5.3.
- **Este handoff:** las frases vencidas y la numeración de los hallazgos.

## Hallazgos al escribirlo [CÓDIGO 1106, sin medir en el VPS]

1. **`paperclipai update` no reinicia nuestro servicio.** Solo reinicia y valida
   `paperclipai.service` (`cli/src/services/service-manager.ts:120`), y el nuestro es
   `paperclip.service`.
   - Sin reinicio, tampoco vuelve solo a la 1012 si algo falla.
   - La §3 de la #409 ya lo dice así desde `fb3504059`.
   - El guion reinicia a mano y valida la salud. Desde el 2026-11-09, además, no abre la ventana
     si existe `paperclipai.service`.
2. **El respaldo previo de `update` necesita la base viva.** Con el servicio detenido, el comando
   se niega (`update.ts:51-63`).
   - La primera versión volvía a encender el servicio después del respaldo en frío.
   - Tras la revisión del DG se usa `--no-backup` con el servicio detenido, y la copia en frío es
     el respaldo. Así no queda un hueco de escrituras que se perderían al volver atrás.
3. **`update` falla con `umask 0002`** (#17208, abierto y confirmado en la 1106). Por eso corre con
   `umask 022`.
4. **Sin terminal, el servidor aplica solo las migraciones pendientes** (`server/src/index.ts:275-278`),
   y `paperclip.env` no define `PAPERCLIP_MIGRATION_PROMPT`.
5. **En la 1106, un campo omitido en el upsert de una política conserva su valor**
   (`budgets.ts:776-779`). En la 1012 no era así. El guion repite todos los valores igual.
6. **Las rutinas usan `catch_up_policy = skip_missed` por defecto**, así que un disparo que caiga
   dentro de la ventana se salta.
7. **La carpeta de skills de Hermes cambia en la 1106 solo si el agente define `HERMES_HOME`.**
   - En cada corrida Hermes, Paperclip enlaza sus skills en `<HOME>/.hermes/skills`. Con la 1106,
     si el entorno del agente trae `HERMES_HOME`, las enlaza en `$HERMES_HOME/skills`
     (`packages/adapters/hermes/src/server/skills.ts:28-36` y `216-256`; `execute.ts:368-382`).
   - Nuestros GLM llevan solo `DTD_PERFIL`, así que en las dos versiones es
     `~agentes/.hermes/skills`, y las 13 skills de cada perfil no se tocan.
   - Un enlace roto se repara solo en la corrida siguiente: `ensurePaperclipSkillSymlink` es igual
     en las dos versiones.

## Validación

| Comprobación | Resultado |
|---|---|
| `pnpm docs:check` (2026-11-07) | PASÓ (596 specs) |
| `pnpm sdd:check` (2026-11-07) | PASÓ: sin números repetidos |
| Sintaxis de los bloques del guion (2026-11-09) | PASÓ: `bash -n` en los 18 bloques y en los 24 comandos interiores de `A '…'` y `bash -c '…'`; `node --check` en el script de lectura |
| `docs:check`, `sdd:check` y `governance:check` (2026-11-09) | PASARON los tres sobre la corrección, antes de traer `main` (596 specs, sin números repetidos, 28 políticas). Se repiten después de traer `main`, y ese resultado se reporta en la PR |
| `pnpm verify` | NO APLICA: solo hay documentación |
| Búsqueda de IP, correos y llaves en los archivos nuevos | Sin coincidencias, fuera de `127.0.0.1` |
| Correr el guion | NO EJECUTADO: necesita la ventana y el OK de Sam nombrando el VPS |

## Pendientes de esta tarea

1. La revisión y la fusión son del Director General.

## FUERA DE ALCANCE DETECTADO

- **La §3 de la #409** («si el servicio no valida al reiniciar, vuelve solo»): ya no está
  pendiente. Se corrigió en `fb3504059`, que está en `main` desde el 2026-11-09.
- **Alinear el documento de la #409 en `main` con este guion.**
  - Su §6.7 dice que, si existe `paperclipai.service`, «se para antes de seguir». Este guion es
    más estricto: no abre la ventana.
  - Tampoco tiene el respaldo de las skills ni el apartado de la configuración de la 1106.
  - Va en otra PR de documentos. Mientras tanto, el encabezado de este guion dice qué agrega.
- **El nombre de `dtd-alfred-bridge.service`** viene del README y no se ha comprobado en el VPS.
  La comprobación previa lo mide.
- **La forma de `runtime_config->'heartbeat'`** no se midió. Si la consulta no la muestra, se mira
  en la pantalla.
- **La descripción de la unidad `paperclip.service`** dice `2026.1012.0`. Es solo texto, y se
  cambia al cierre de la ventana.

## Impacto documental

Hay un runbook nuevo en `docs/runbooks/`. No hay SDD, porque no cambia comportamiento. Graphify y
Archify quedan para el Director al integrar.
