# Handoff · SDD-0586 · El registro de las puertas 4 y 5 y las observaciones bajas de la #567 (solo documentación)

- **Rama:** `claude/docs-puerta5-registro-7d81b0`, desde `origin/main` `42daa3d2c`. Worktree `.claude/worktrees/docs-puerta5-registro-7d81b0`.
- **Quién:** Worker de documentación, por encargo del Subdirector de Chatwoot, pedido por el DG el 2026-11-15, después del encendido de `chatwoot_portal` (2026-11-15T08:12:13Z).
- **Spec:** ninguna. **No hace falta SDD:** son runbooks y un handoff, sin comportamiento de Studio, sin código, sin migraciones y sin tocar `docs/specs/`. No se reservó número.
- **Alcance:** solo `docs/runbooks/chatwoot-portal-p4-puertas.md`, `docs/runbooks/chatwoot-portal-p4-guion-puertas-3-4.md` y los handoffs. No se tocaron scripts, pruebas, migraciones ni `copia-columnas.tsv`.

## Qué cambia

1. **El comando del rolsuper de la puerta 4** (runbook, «prevención del log»; guion, 4.0): lleva `-d chatwoot_production`. Sin él, psql falla con «database "chatwoot" does not exist». `chatwoot_production` es el `PROD_DB` por defecto de `ensayo-portal.sh:74`. El hallazgo es del Subdirector; no lo reproduje (no toco el VPS). **La revisión independiente pidió lo mismo en los otros `psql` de `chatwoot-postgres-1` sin `-d`:** `SHOW logging_collector` (runbook, 4.10, y guion, 4.10) y `SHOW log_directory` (runbook, 4.10, dentro del `sh -c`). Un grep sobre ambos documentos no deja ningún `psql … -U chatwoot` sin `-d chatwoot_production`; los demás comandos de `chatwoot-postgres-1` (`docker logs`, `ls -A /tmp`, `docker inspect`) no usan `psql`.
2. **El registro de las puertas** (runbook, sección nueva «Registro de las puertas (2026-11-15)», antes de «Antes de la primera puerta», y una nota de estado al inicio de la puerta 5 y del guion): puerta 2, 3.0, 3.1, 4, 5a, 5b, la 0542 con la #574, el encendido y el 5c, con hora UTC y ruta de evidencia. Trae lo que informó el Subdirector, lo que dice `main` y lo que midió y pasó el DG (3.0, puerta 4 con su cierre, 5a, 5b, 0542 y encendido), con horas UTC sacadas con `stat` en el VPS. No quedó ninguna celda «pendiente de confirmar por el DG»; el 5c figura como EN CURSO.
3. **La fila «Comando» del 3.1** (runbook): ahora dice el modo completo con los casos provocados, el desarme `R0` a `R4` y la exigencia de la G0 de los cuatro guiones del desarme (`ensayo-portal.sh:262-267`).
4. **Las citas de línea, medidas contra `42daa3d2c`:**

   | Documento | Cita vieja | Cita nueva | Qué es |
   |---|---|---|---|
   | runbook | `ensayo-portal.sh:232-233` | `:239-241` | `BANDEJA` y `AGENTE_SERVICIO` numéricos (`error=numeros`) |
   | runbook | `ensayo-portal.sh:585` | `:676` | `chatwoot_user_id` de `chatwoot_agent_links` |
   | runbook (×3) | `ensayo-portal.sh:269-270` | `:292` | `HECHO lista_md5=` |
   | runbook (×2) | `ensayo-portal.sh:23-25` | `:25-27` | el comando y `--solo-copia`/`--limpiar` |
   | runbook | `ensayo-portal.sh:23` | `:25` | el ensayo completo |
   | runbook | `:131-141` | `:139-154` | el código 6 de `--limpiar` |
   | runbook | `deshacer.sh` `:52`, `:96`, `:98` | `:54`, `:100`, `:102` | sin valor por defecto, `falta_db`, `falta_db_cw` |
   | guion | `ensayo-portal.sh:24` | `:26` | `--solo-copia` |
   | guion | `ensayo-portal.sh:77` (×2) | `:84` | `TIMEOUT_STOP_MIN_S` |
   | guion | `ensayo-portal.sh:27-28` | `:29-30` | «Salida: PASÓ/FALLÓ… solo líneas HECHO» |
   | guion | `ensayo-portal.sh:290-305` | `:311-327` | la unidad y la G1 |
   | guion | `ensayo-portal.sh:318` y `:322` | `:340` y `:344` | los `docker exec` de lectura de producción |
   | guion | `ensayo-portal.sh:10` y `:79` | `:51` y `:86` | el proyecto `portal-ensayo` y el nombre de la evidencia |

   **Revisadas y vigentes** (sin cambio): `extraer.sh:47`, `vincular.sh:51`, `cargar.sh:64`, `deshacer-vinculos.sh:200` y `:44`, `deshacer.sh` `:143-144`, `:164-205`, `:225`, `:227-234`, `:262-270`, `:277-278` y `:305`, `deshacer-carga.rb` `:106`, `:249` y `:274`, `portal.ts` `:79-81`, `:206`, `:251` y `:258`, `config.ts:110` y `:154`, `chatwoot-types.ts:9-16`, `0519` `:117` y `:332-333`, `0289` `:654` y `:890-910`, `0267:306`, `copia-columnas.tsv:32`, `pegar-secretos-web.sh` `:74`, `:79` y `:85` (en `infra/chatwoot/`) y `aplicar-migraciones-prod.md:26`. **No revisé** las citas a `lib/studio/__tests__/` ni las de las especificaciones.
5. **El guion `:124`** (3.0, «Lo que se mira en el VPS»): `ls migraciones` pasa a `ls /srv/ops/portal-historial/migraciones`. **El runbook `:49`** dice «siguiendo el orden de ejecución del guion».
6. **El journal de systemd** entra en la tabla «Datos personales» del runbook, como un lugar más donde queda la salida del ensayo (contenido sin datos de personas; la retención del journal en el VPS es NO VERIFICABLE desde el repo).
7. **Los pendientes de una PR de pruebas** (G8, R4, el resto tras un KILL) quedan en «Lo que falta confirmar» del runbook y en la sección FUERA DE ALCANCE de `0586-desarme-ensayo.md`.

## La huella de los OK nominales

- **El procedimiento** (reproducido, porque ni el documento ni un script lo traían escrito): `grep 'OK nominal' <archivo> | md5sum | cut -c1-8`, sobre las líneas completas que contienen esas dos palabras.
- **Antes** (en `origin/main`, `42daa3d2c`): runbook `79131b41` (21 líneas), guion `693fb4f3` (3 líneas). Coincide con lo del encargo.
- **Después** (en este árbol): runbook `79131b41` (21 líneas), guion `693fb4f3` (3 líneas). **Iguales.** Ninguna línea «OK nominal» cambió, y el texto nuevo no usa esas dos palabras (usa «OK propio» o «OK de Sam»).
- **La lista de columnas:** `copia-columnas.tsv` no se tocó; su md5 sigue `cc1534a8a223e37ab9485451d5ee922c`.
- **Ojo para la próxima edición:** la huella cubre líneas enteras. Editar otra frase de una línea que contenga «OK nominal» (por ejemplo, en el runbook, el párrafo «Este runbook no corre nada», el OK del 3.0 o el de la puerta 4) también la cambia.

## Pruebas

| Comprobación | Resultado |
|---|---|
| `docs:check` (`node scripts/build-docs-index.mjs --check`, sin `pnpm install`) | PASÓ: «índice sincronizado con 618 specs» |
| `sdd:check` (`node scripts/check-numbering.mjs`) | PASÓ: «sin números repetidos». El diff no toca specs; se corrió igual |
| `pnpm verify`, vitest, build, Docker | NO EJECUTADO (tarea solo de documentación; la PC está justa de memoria) |
| Las citas de línea | PASÓ, a mano: cada cita nueva se leyó en `42daa3d2c` |
| Los comandos de los runbooks | NO EJECUTADO (no se toca el VPS ni producción). El `-d chatwoot_production` es lo que informó el Subdirector |

## Pendientes de esta tarea

- **El resultado del 5c:** ya está registrado en [`0586-registro-5c.md`](0586-registro-5c.md) (PR aparte, 2026-11-15).
- **La revisión y la fusión de la PR,** que hace el DG.

## FUERA DE ALCANCE DETECTADO

- **Una PR de pruebas** para las tres observaciones bajas de la #567: G8 cubre una sola de las cuatro condiciones de la guarda del desarme; R4 solo cuenta archivos; y puede quedar algún resto tras un KILL (`.hecho` o contenedores de `portal-ensayo`).
- **El 5c,** el smoke con un cliente real: HECHO el 2026-11-15; ver [`0586-registro-5c.md`](0586-registro-5c.md).
- **Citas de línea en otros documentos** que apunten a `ensayo-portal.sh` o `deshacer.sh` no se revisaron fuera de los dos runbooks (por ejemplo la spec 0586 y los handoffs, que son evidencia fechada).

## Impacto documental

- Cambian el runbook de las puertas y el guion de las puertas 3 y 4. Los dos siguen cumpliendo «si no dicen lo mismo, vale el runbook».
- **Conocimiento nuevo que sirve a otros agentes:** el procedimiento de la huella de los OK nominales no está escrito en ningún documento del repo. Propongo anotarlo en el runbook o en `docs/engineering/` y se lo dejo al DG (destino y justificación: evita que el próximo Worker lo reconstruya adivinando). No lo convertí en regla.
- No hay cambios en Obsidian ni en Graphify desde esta rama (están retirados, SDD-0632).
