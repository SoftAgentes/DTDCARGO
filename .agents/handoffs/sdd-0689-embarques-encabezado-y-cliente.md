# Handoff · SDD-0689 — Embarques: peso y «Total sin facturar» en el encabezado, y clic en el cliente

Fecha: 2026-11-20. Datos de la tarea:

- Owner: Worker `worker-0689-embarques`.
- Rama: `codex/sdd-0689-embarques-encabezado-y-cliente`.
- Worktree: `DTD-worktrees/sdd-0689-embarques-encabezado`.
- Base: `origin/main` `2ea18799a`.
- El DG asignó la 0689 (sin migración) y la 0690 (migración 0569, todavía no empezada).

## Estado

- **Spec `proposed`.** Sale de los pedidos de Sam del 2026-11-20: el encabezado, el clic en el cliente y el
  ojo de privacidad. Sam vio la maqueta del encabezado con el ojo en el chat. Falta su aprobación formal.
- **Código y pruebas** en la rama.

## Hecho (spec §6, allowlist)

- `lib/studio/embarques-contenedores.ts`: `MontoAcumulado` suma `borradores` y `sinFacturarUsd`, que son
  los borradores en USD.
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`:
  - el encabezado muestra el peso total;
  - `MontoOculto` muestra «Sin facturar ••••••» con un ojo que enseña el monto 4 segundos. Solo aparece
    con `montos`, y sin borradores dice «Sin precios cargados». El ojo va fuera del botón de la cabecera;
  - en el detalle, el nombre del cliente es un botón. Con un embarque abre su ficha (el panel); con
    varios, abre su bloque y le pasa el foco.
- Pruebas:
  - las fixtures de la 0661 suman los campos nuevos;
  - la prueba de la 0661 que congelaba «sin dinero en la cabecera» se ajustó a la decisión nueva;
  - prueba nueva: `EmbarquesClient.encabezado-cliente.test.tsx`.

## Evidencia

| Comprobación | Resultado |
|---|---|
| docs:check / sdd:check / git diff --check | PASÓ |
| vitest de Embarques y de la 0661 | NO EJECUTADO: espera el turno de PC del DG |
| typecheck / eslint | NO EJECUTADO: espera el turno |
| `/ui-check` | NO EJECUTADO |

## Pendientes de esta tarea

1. El turno de PC: pnpm install, vitest, typecheck y eslint.
2. `/ui-check` del encabezado.
3. Push, PR y la revisión que lanza el DG. Aprobación de Sam.

## FUERA DE ALCANCE DETECTADO

- SDD-0690: cargar los borradores del 64 desde el Excel (solo el 64, con OK nominal de Sam), «Facturar»
  que emite el borrador, «Facturar todo» y el estado «Facturado» sin botón.
- Dos pedidos nuevos de Sam, sin número todavía (el DG decide):
  - historial de contenedores entregados al 100 %, dentro de Embarques;
  - tarifa por cliente en su ficha (precio por m³, precio por kg de exceso y límite de kg/m³, 500 por
    defecto), con alerta de exceso en el embarque y desglose en la factura.
- Las decisiones literales de Sam están en la carpeta de notas del DG
  (`embarques-decisiones-sam-20261120.md`), fuera del repo.
