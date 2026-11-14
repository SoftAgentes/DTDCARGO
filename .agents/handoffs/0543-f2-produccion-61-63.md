# Handoff 0543 · F2 · Preparar 61, 62 y 63 para producción

- Fecha: 2026-11-13 (Caracas = UTC − 4)
- Worker: sesión `suspicious-davinci-7afcac`, abierta por el Subdirector Portal
- Worktree: `.claude/worktrees/suspicious-davinci-7afcac`
- Rama: `claude/suspicious-davinci-7afcac`, base main `11f90a32e`, con main traído por merge en `19bc732da`
- SDD: [0543](../../docs/specs/0543-consolidados-en-camino/spec.md), sigue `in-progress`
- Permisos:
  - No se escribe en producción.
  - Este Worker no leyó producción. La consulta mínima la corrió el Subdirector Portal con el OK de Sam («Sí, autorizo»).
  - No va PII a Git.
  - Push de la rama y PR autorizados por el Subdirector; el merge no.

## OBJETIVO ORIGINAL

1. Listar las marcas y los remitentes de los lotes 61, 62 y 63 que en producción no resolverían o que traen texto de un nombre.
2. Armar `marcas-mapa.json` en el Desktop.
3. Preparar la consulta mínima de códigos de cliente.
4. Generar la previa de producción sin aplicar y revisar que ningún nombre llegue al SQL.
5. Segunda parte: el camino a producción de `infra/ops/consolidados/aplicar-lote.sh`, en una PR propia.

## COMPLETADO

### Primera parte · marcas y previas

- **Inventario.**
  - Los tres lotes son FCL de un solo dueño, como se cargaron en prueba el 2026-10-17 (spec §Decisiones 9). El encargo decía que el 61 y el 62 eran DDP multicliente; los manifiestos y la spec dicen FCL.
  - Cada lote tiene una sola marca: 61 `MG-0019`, 62 `MG-0020`, 63 `DTD-9038`.
  - Ninguna marca ni código de envío trae texto de un nombre.
- **Fuentes nuevas.** Las hojas «container cost» que llegaron por Telegram son costos del agente en China. No tienen marcas de cliente. Sus números de contenedor coinciden con los lotes (61, 62, 63) y con el 64.
- **Mapas.** En el Desktop, dentro de `DTD-consolidados/<N>/`, quedan `marcas-mapa.json` vacío (`{}`) y `marcas-por-resolver.json`. Probé que `--mapa` acepta la marca del dueño en sus dos formas (`MG-019` y `MG-0019`).
- **Previas de producción.** Están en `DTD-consolidados/<N>/2026-11-13-produccion-v1/`:
  - Se generaron con `--entorno produccion --modalidad fcl`, desde la misma hoja de rastreo de octubre, así que el id de lote es el mismo. No se aplicaron.
  - Frente a la v3 de prueba solo cambian la cabecera y `lote_cab` (`crear_faltantes=false`, `entorno='produccion'`).
  - El único literal de texto en los datos es `Dueño del contenedor <marca>`, que es texto sintético.
  - **Esas previas son anteriores al corte de c3e3be597.** Antes de llevar el 63 a producción hay que regenerarlo desde la cabeza de esta rama.
- **Consulta mínima.**
  - Está preparada en la carpeta de notas compartidas del Subdirector, con copia en `DTD-consolidados/`. Es de solo lectura (`read only` + `rollback`) y usa `resolve_markbox`.
  - El Subdirector la corrió con el OK de Sam:
    - `DTD-9038` resuelve, sin aliado;
    - `MG-0019`/`MG-019` y `MG-0020`/`MG-020` no resuelven;
    - el aliado `MG` no existe.
  - Corregí la columna `vivo`, que daba `t` sin cliente por `null is null`.

### Segunda parte · `aplicar-lote.sh` en producción (PR #534)

- **Destino.**
  - `--project`/`--proyecto dtd-cargo` (el `PROD_COMPOSE_PROJECT`) acepta solo lotes de `--entorno produccion`.
  - Un `*-staging` acepta solo lotes de prueba.
  - Las mayúsculas no cuentan como destino.
- **Autorización en producción.** Cada paso, previa incluida, exige `AUTORIZACION.txt` (en el lote o con `--autorizacion`):
  - no vacío y con el **id completo del lote** (`carga-consolidado:<N>:<hash>`), escrito exacto;
  - un `--autorizacion` que apunte a otro archivo de la carpeta del lote se rechaza;
  - el archivo se copia a la evidencia.
- **`deshacer` y `purgar`** están deshabilitados en producción.
- **Idempotencia.** Un segundo `aplicar` se niega si la evidencia ya tiene un `aplicar` PASÓ del lote. Además queda el preflight del SQL.
- **Candado.** Simulacro, aplicar, deshacer y purgar toman `LOTES_CANDADO` (por defecto `/run/lock/dtd-lotes.lock.d`). Es un `mkdir` atómico, como en `migraciones/aplicar.sh`, y se toma antes de mirar la evidencia.
  - Se pidió `flock`, pero Git Bash no lo trae y migraciones usa `mkdir`.
- **Generador.** En producción, `previa.sql` termina con un corte (`do $corte$`) que aborta si alguna marca no resuelve a un cliente vivo. Cita solo el conteo y las etiquetas. El lote de producción nunca crea clientes ni aliados.
- **Pruebas.**
  - La prueba bash pasa de 23 a 53 casos, y el piso de `pruebas-linux.sh` sube a 53.
  - Vitest: un caso nuevo en `consolidados-sql.test.ts` y `consolidados-previa-corte.test.ts` en PGlite (tres casos).
- **Spec y runbook.**
  - Spec 0543 con la sección «Extensión F2».
  - Runbook §2b de producción: id completo en la autorización, candado, y borrar `/srv/ops/paquetes/lote-N` después de `verificar`, con `ls` vacío, porque el `deshacer.sql` de producción no trae la guarda de base de prueba.
- **Revisión independiente** sobre 6bd5a592f: APPROVED con observaciones (1 MEDIA, 5 BAJA y 2 de forma). Atendidas en esta cabeza.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Generar las tres previas de producción (tsx) | PASÓ (exit 0) |
| Literales de texto en `insert into lote_*` | PASÓ: 1 por lote, sintético |
| Diff contra la v3 de prueba | PASÓ: solo cabecera y `lote_cab` |
| `--mapa` con la marca del dueño en sus dos formas | PASÓ (prueba ad hoc, fuera del repo) |
| `bash infra/ops/tests/prueba-aplicar-lote.sh` | PASÓ: 40/40 sobre 6bd5a592f y 53/53 tras la revisión |
| `vitest run` consolidados-sql/modelo/excel | PASÓ: 51 sobre 6bd5a592f; tras la revisión, ver fila siguiente |
| `vitest run --maxWorkers=1` consolidados-previa-corte + sql + modelo + excel + `pruebas-linux.test.mjs` + `ci-workflow-contract`, tras la revisión | PASÓ: 6 archivos, 152 pruebas. Con varios workers, Vitest no pudo arrancar dos forks por la carga de la PC; con uno, todo verde |
| `vitest run infra/ops/tests/pruebas-linux.test.mjs` | PASÓ, 13 |
| `vitest run scripts/__tests__/ci-workflow-contract.test.mjs` | PASÓ, 85 |
| `tsc --noEmit` completo | PASÓ (exit 0) sobre aac8e1ea8 |
| `eslint` sobre los TS tocados | PASÓ |
| `pnpm docs:check`, `pnpm sdd:check`, `git diff --check` | PASÓ |
| Consulta mínima en producción | Corrida por el Subdirector, no por este Worker |
| `pnpm verify` | NO EJECUTADO: el portón es el CI de GitHub más la revisión independiente (indicación del Subdirector) |

## COMMITS

- `0fc916127` handoff de las marcas.
- `556e2f4af` `aplicar-lote.sh` en producción.
- `c3e3be597` corte de la previa de producción.
- `6bd5a592f` docs: spec, runbook y handoff.
- `aac8e1ea8` handoff: 61 y 62 estacionados.
- `19bc732da` merge de origin/main.
- Después vienen los commits de la revisión independiente; la cabeza va en el reporte.

## PR / BRANCH

- Rama `claude/suspicious-davinci-7afcac`, publicada.
- [SoftAgentes/DTDCARGO#534](https://github.com/SoftAgentes/DTDCARGO/pull/534), sin merge. Fusionar lo deciden el DG o Sam.

## PENDIENTES DE ESTA TAREA

**Estado al 2026-11-13, decisión de Sam dicha al Subdirector Portal.**

- **61 y 62: estacionados.** MG es un CLIENTE, no un aliado. `MG-019` y `MG-020` son proveedores de ese cliente: grupos de WeChat que se consolidan en un FCL. Sam no conoce el código de cliente de MG en producción y pidió avanzar sin él. Quedan así hasta que exista el cliente MG en producción:
  - sin `marcas-mapa.json` (sigue `{}`);
  - sin cambio en el generador;
  - sin previa en producción, porque la previa los cortaría.

  Cuando haya código, queda por decidir con Sam cómo se llama el envío: `<código de MG>-FCL-6N` (`--dueno <código>`) o `MG-019-FCL-61` (la referencia del proveedor, con el mapa). El generador usa hoy el texto de `--dueno` como código del envío.
- **63 (`DTD-9038`): el único candidato a producción por ahora.** Resuelve a un cliente sin aliado. Falta:
  - aclarar la duda de la hoja de costo, que nombra otro código de dueño (detalle en la nota compartida, fuera de Git);
  - regenerar el paquete desde esta rama, para que traiga el corte;
  - el OK nominal de Sam citando el id del lote.
- ETA del 61 vencida (2026-10-25): regenerar con la ETA del rastreo nuevo que Sam pidió a la oficina.

## FUERA DE ALCANCE DETECTADO

- En un lote **DDP** de producción, `aplicar.sql` y `manifiesto.json` siguen llevando el `nombre_excel` de cada cliente. Ese texto solo sirve para crear clientes en prueba, pero viaja al servidor. Para el 64, conviene vaciarlo cuando `entorno = produccion`.
- Si Sam quiere los envíos DDP de los clientes de MG dentro del 61 y el 62 (modalidad mixto), los packing de esos contenedores solo están en PDF y el generador lee Excel.
- El `deshacer.sql` y el `purgar.sql` de un paquete de producción se generan igual aunque el guion los niegue. Hoy lo cubre el runbook (borrar el paquete). Una opción más fuerte es que el generador no los emita para `--entorno produccion`.
