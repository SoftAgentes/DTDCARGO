# Handoff 0543 · `--correlativo-origen` (D1) y empaque mínimo

- Fecha: 2026-11-14 (Caracas = UTC − 4)
- Worker: la sesión de la #534, la #538 y la #545, abierta por el Subdirector Portal
- Worktree: `.claude/worktrees/0543-f2-seg538`, rama `claude/0543-correlativo-origen`, desde `origin/main` en `375adebfb`
- SDD: [0543](../../docs/specs/0543-consolidados-en-camino/spec.md), sigue `in-progress`; notas en «Correlativo de China en el título del packing» y «Empaque mínimo»
- Permisos:
  - D1 aprobado por el DG el 2026-11-14; empaque mínimo autorizado por el DG como regla del 64 en adelante.
  - Push y PR lista autorizados; sin merge.
  - Nada en producción, en el VPS ni en Docker.
  - Turnos de vitest y de WSL dados por el DG.

## OBJETIVO

1. **D1.** `generar-lote` acepta `--correlativo-origen N` cuando el título del packing trae el correlativo de China (el #64 dice «#61»).
2. **Empaque mínimo.** Al servidor sube solo lo que `aplicar-lote.sh` necesita.

## COMPLETADO

- **D1** (`5aaaae927`):
  - `--correlativo-origen N`: el título tiene que decir exactamente N, o el generador se niega sin escribir. Sin la bandera, el rechazo de siempre queda igual, y su mensaje sugiere la bandera.
  - El mapeo «N (China) → M (DTD)» queda en `manifiesto.json` (`contenedor.correlativoOrigen`), en `resumen.md` y como aviso. No cambia el SQL ni el id del lote.
  - `--ignorar-titulo-packing` se niega con `--entorno produccion` y no se combina con la bandera nueva.
- **Empaque mínimo** (`458b183aa`):
  - `--salida` es el paquete: los `.sql`, `manifiesto.json` sin `clientes`, `embarques` ni `avisos`, y `SHA256SUMS` solo de esos archivos.
  - `<salida>-local/` lleva `resumen.md` y `manifiesto-completo.json`, y no sube.
  - En producción, `lote_clientes.nombre_excel` va vacío: solo lo usan los clientes que se crean en prueba.
  - Con `--sin-facturas` no se emiten las filas de `lote_lineas` (descripción y precio).
  - `aplicar-lote.sh` rechaza (3), en producción, un paquete con `resumen.md` o con `"nombreExcel"` en el manifiesto, antes de tocar docker. En prueba no.
  - El generador se niega si la carpeta de salida ya trae `resumen.md` o `manifiesto-completo.json`.
- Runbook `cargar-consolidados.md` y spec 0543 actualizados.

## VERIFICACIÓN

| Comprobación | Resultado |
|---|---|
| vitest de `scripts/__tests__/consolidados-*.test.ts`, después de D1 (turno del DG) | **PASÓ**: 39/39 |
| vitest de los mismos tres archivos, después del empaque (turno del DG) | **PASÓ**: 44/44 |
| `prueba-aplicar-lote.sh` en WSL Ubuntu-24.04 (turno del DG; la distro estaba detenida y se apagó al terminar) | **PASÓ**: 78/0, sin OMITIDAS |
| `prueba-aplicar-lote.sh` en Git Bash | **PASÓ**: 74/0 · 4 OMITIDAS, que Linux cubre |
| Mutantes de las guardas nuevas (Git Bash) | **PASÓ**: sin la de `resumen.md` caen 4 casos; sin la de `nombreExcel`, 3 |
| `bash -n` de los guiones | **PASÓ** |
| `node scripts/build-docs-index.mjs --check` y `node scripts/check-numbering.mjs` | **PASÓ** |
| `pnpm verify` | **NO EJECUTADO**, por regla: el portón es el CI y la revisión independiente |
| CI de GitHub | pendiente al abrir la PR |

## PENDIENTES DE ESTA TAREA

- **CI verde sobre la cabeza final**, y la revisión independiente.
- **Reinstalar `aplicar-lote.sh` en `/srv/ops/consolidados/` después del merge, con el OK de Sam.** Es el mismo procedimiento que el paso 0 del 63. Sin la reinstalación, el servidor no rechaza un paquete con `resumen.md`. El generador nuevo igual deja de ponerlo en el paquete.

## FUERA DE ALCANCE DETECTADO

- **Lote 64: no se generó.** Sam confirmó DDP multicliente. Siguen en cola:
  - la consulta de marcas (Sam dio el OK de la v1; la corre el DG);
  - el código de MG;
  - montos o solo seguimiento.
- **MG en el 64.** El generador lo lee como `MG-xxx` bajo un aliado MG. Según Sam es el cliente MG: hay que mapearlo con `marcas-mapa.json` al código real cuando se conozca.
- **Huérfanas (posible D2).** Sam quiere que la fila sin código entre como recepción huérfana. Hoy `agruparLote` la rechaza. El esquema lo admite: en `warehouse_receipts_cn`, `client_markbox` y `shipment_id` pueden ser nulos y existen `is_orphan` y `orphan_*`; en `consolidation_items`, `shipment_id` y `client_markbox` también pueden ser nulos. Haría falta tocar el modelo, el cuerpo de `aplicar.sql`, `verificar.sql`, deshacer y purgar, el manifiesto y las pruebas. No cabe en esta PR. La medición está en las notas del Subdirector.
- **Códigos de remitente con nombre de pila.** En el 64, 2 remitentes traen un nombre de pila en su código. Viajan en `shipments.code` y en los códigos derivados. El DG decidió no tocarlos: queda como posible regla de producto para la oficina, sin acción ahora.
- **El modo normal de `validar-lote-local.sh` deja su evidencia dentro del paquete.** Viene de la #545 y sigue igual.
- **Consulta de marcas v2.** Suma el aliado raíz y si el cliente a facturar tiene Shipping Mark. Está preparada en las notas, fuera del repo, y no se ejecutó en ninguna base.
