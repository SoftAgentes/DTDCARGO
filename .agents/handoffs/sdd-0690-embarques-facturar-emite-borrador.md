# Handoff · SDD-0690 — Embarques: «Facturar» emite el borrador, «Facturar todo» y «Facturado»

Fecha: 2026-11-20.

- Owner: Worker 0689/0690.
- Rama: `claude/sdd-0690-facturar-emite-borrador`.
- Worktree: `DTD-worktrees/sdd-0690-facturar-borrador`.
- Base: `origin/main` `765f3954a`.
- La rama de reserva `codex/sdd-reserve-0690` no se toca: es el candado del número.

## Estado

- **Spec `proposed`**, solo documento. No hay código ni archivo de migración: la 0569 se escribe cuando
  la spec esté aprobada.
- Faltan la aprobación de Sam y sus respuestas a las tres preguntas del §7.

## Hecho

- Medición de la 0564, del cargador, de `emitInvoice`, de `FacturarContenedor` y de los montos de la
  pantalla (spec §2, con archivo:línea).
- Decisión propuesta:
  - `--solo-facturas` para cargar los borradores del 64;
  - el caso del cliente que ya tiene una factura emitida con monto tecleado;
  - la RPC `exc0674_emitir_borradores` en la 0569;
  - la pantalla («Facturar», «Facturar todo», «Facturado»);
  - los rótulos del dinero.

## Evidencia

| Comprobación | Resultado |
|---|---|
| docs:check / sdd:check / git diff --check | ver el commit |
| Pruebas de producto | NO APLICA: cambio solo de docs |

## Pendientes de esta tarea

1. Aprobación de Sam y respuestas del §7.
2. Implementación: 0569 con su prueba SQL y su desarme, `--solo-facturas`, la acción y la pantalla.
3. Ensayo local de la carga del 64 con `rollback`. Después, el OK nominal de Sam para la carga en
   producción y otro aparte para aplicar la 0569.

## FUERA DE ALCANCE DETECTADO

- La cabecera de `0564_exc0674_facturar_contenedor.sql` todavía dice «NO APLICADA», aunque se aplicó el
  2026-11-18. Un archivo aplicado no se edita; el DG decide si se anota en la spec de la 0674.
- La spec y el handoff de la 0674 tienen que anotar que el 64 entró a `exc0674_contenedores`, sin ids,
  en la próxima PR de docs.
- `next_invoice_code` calcula max + 1 sin bloqueo (0077). Fuera de la 0564/0569, dos inserciones a la
  vez podrían chocar con la restricción unique.
