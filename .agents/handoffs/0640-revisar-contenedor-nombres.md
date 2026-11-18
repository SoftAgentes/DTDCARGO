# Handoff — SDD-0640: enmienda de nombres («Revisar contenedor»)

- **Fecha:** 2026-11-16
- **Rama:** `docs/0640-revisar-contenedor`, desde `origin/main` en `e21416bc8`
- **Encargo:** el DG, por pedido de Sam del mismo día. En lo visible se dice «contenedor 64» o «consolidado 64»
  y no «lote»; un FCL se dice «FCL 66».

## Hecho

- `docs/specs/0640-revisar-lote-studio/spec.md`:
  - el título y el H1 pasan a «Revisar contenedor»;
  - §0 nuevo con los nombres visibles: consolidado (`ddp` y `mixto`), FCL fuera de la pantalla y nombres
    internos sin cambios;
  - textos de §3 y §8: «Revisar contenedor» y «Revisar contenedores», «Clientes del contenedor», «Aprobar
    contenedor»; la confirmación y «Copiar respuestas» llevan el número del contenedor y la huella corta;
  - §12.2 con el pedido literal de Sam (transmitido por el DG) y una pregunta abierta sobre los FCL.
- La maqueta `maqueta/revisar-lote.html` ya no tiene ningún «lote» visible.
- `docs/specs/README.md`: índice regenerado (solo cambió la fila 0640).

## Evidencia

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ |
| `git diff --check` | PASÓ |
| `pnpm verify` | NO APLICA: solo docs |

## Pendiente de esta tarea

- La pregunta abierta de §12.2 para Sam: si la carga de un FCL en producción necesita otra revisión además de su
  OK nominal.

## FUERA DE ALCANCE DETECTADO

- Ninguno.
