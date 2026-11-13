# Handoff 0543 · F2 · Preparar 61, 62 y 63 para producción

- Fecha: 2026-11-13 (Caracas = UTC − 4)
- Worker: sesión `suspicious-davinci-7afcac`, abierta por el Subdirector Portal
- Worktree: `.claude/worktrees/suspicious-davinci-7afcac`
- Rama: `claude/suspicious-davinci-7afcac`, base main `11f90a32e`
- SDD: [0543](../../docs/specs/0543-consolidados-en-camino/spec.md), sigue `in-progress`
- Permisos:
  - No se escribe en producción.
  - No se lee producción: la consulta queda preparada y espera el OK nominal de Sam.
  - No va PII a Git.

## OBJETIVO ORIGINAL

Listar las marcas y los remitentes de los lotes 61, 62 y 63 que en producción no resolverían o que traen texto de un nombre. Armar `marcas-mapa.json` en el Desktop. Preparar la consulta mínima de códigos de cliente. Generar la previa de producción sin aplicar y revisar que ningún nombre llegue al SQL.

## COMPLETADO

- **Inventario.**
  - Los tres lotes son FCL de un solo dueño, como se cargaron en prueba el 2026-10-17 (spec §Decisiones 9). El encargo decía que el 61 y el 62 eran DDP multicliente; los manifiestos y la spec dicen FCL.
  - Cada lote tiene una sola marca: 61 `MG-0019`, 62 `MG-0020`, 63 `DTD-9038`.
  - Ninguna marca ni código de envío trae texto de un nombre. Hay 3 marcas pendientes de resolver contra producción.
- **Fuentes nuevas.** Las hojas «container cost» que llegaron por Telegram son costos del agente en China. No tienen marcas de cliente. Sus números de contenedor coinciden con los lotes (61, 62, 63) y con el 64.
- **Mapas.** En el Desktop, dentro de `DTD-consolidados/<N>/`, quedan `marcas-mapa.json` vacío (`{}`) y `marcas-por-resolver.json`. Probé que `--mapa` acepta la marca del dueño en sus dos formas (`MG-019` y `MG-0019`).
- **Previas de producción.** Están en `DTD-consolidados/<N>/2026-11-13-produccion-v1/`:
  - Se generaron con `--entorno produccion --modalidad fcl`, desde la misma hoja de rastreo de octubre, así que el id de lote es el mismo. No se aplicaron.
  - Frente a la v3 de prueba solo cambian la cabecera y `lote_cab` (`crear_faltantes=false`, `entorno='produccion'`).
  - El único literal de texto en los datos es `Dueño del contenedor <marca>`, que es texto sintético.
  - `purgar.sql` sigue negándose fuera de prueba.
- **Consulta mínima.** Quedó preparada en la carpeta de notas compartidas del Subdirector y copiada en `DTD-consolidados/`:
  - Es de solo lectura (`read only` + `rollback`) y usa `resolve_markbox`.
  - Devuelve candidato, canónico, redirigido, vivo y aliado. Sin nombres ni ids.
  - **No se corrió.**

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Generar las tres previas de producción (tsx) | PASÓ (exit 0) |
| Literales de texto en `insert into lote_*` | PASÓ: 1 por lote, sintético |
| Diff contra la v3 de prueba | PASÓ: solo cabecera y `lote_cab` |
| `--mapa` con la marca del dueño en sus dos formas | PASÓ (prueba ad hoc fuera del repo) |
| Consulta mínima contra una base | NO EJECUTADO (sin OK de Sam; sin turno de Docker) |
| `pnpm verify` | NO APLICA (sin cambios de código) |

## COMMITS

- Este handoff, solo local. Sin push: no hubo código.

## PR / BRANCH

- Sin PR.

## PENDIENTES DE ESTA TAREA

1. Que Sam dé el OK nominal para correr la consulta mínima en producción.
2. Si una marca no resuelve: Sam da el Shipping Mark real, se llena `marcas-mapa.json` y se regenera con `--mapa`.
3. Que Sam diga quién es el dueño del 63: la hoja de costo nombra otro código, distinto de `DTD-9038` (detalle en la nota compartida, fuera de Git).
4. ETA del 61 vencida (2026-10-25): regenerar con la ETA del rastreo nuevo que Sam pidió a la oficina.
5. Para producción hay que definir un procedimiento de aplicación, porque `aplicar-lote.sh` solo acepta `-staging`. Además, cada lote va con el OK nominal de Sam.

## FUERA DE ALCANCE DETECTADO

- En un lote **DDP** de producción, `aplicar.sql` y `manifiesto.json` siguen llevando el `nombre_excel` de cada cliente. Ese texto solo sirve para crear clientes en prueba, pero viaja al servidor. Para el 64, conviene vaciarlo cuando `entorno = produccion`.
- Si Sam quiere los envíos DDP de los clientes de MG dentro del 61 y el 62 (modalidad mixto), los packing de esos contenedores solo están en PDF y el generador lee Excel.
