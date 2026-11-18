# Handoff · SDD-0674 — Botón «Facturar» en Embarques (regla transitoria)

Fecha: 2026-11-18. Datos de la tarea:

- Owner: Worker `worker-0674-facturar`.
- Rama: `codex/sdd-0674-boton-facturar-embarques`.
- Worktree: `DTD-worktrees/sdd-0674-boton-facturar-embarques`.
- Base: `origin/main` `9434cc4f6`.
- Número de SDD asignado por el DG.

Encargo del DG, por pedido de Sam en la reunión del 2026-11-18: **solo una spec en borrador, sin código**.
Contiene las cinco preguntas para Sam, cada una con su recomendación.

## Medición (spec §2, en código y migraciones; no se leyó producción)

- **El portal ya muestra los embarques del cliente aunque no tengan factura.** Ni `listMyShipments` ni la
  policy 0416 miran `invoices`. Encima sale el aviso `TRACKING_EN_CONSTRUCCION = true`.
- **Los borradores no se ven en el portal** (0452).
- **El rol de Embarques no puede crear, emitir ni leer facturas**, por la RLS 0407 y la 0414 y por el
  RBAC (`invoices` es solo de accounting y admin).
- **La emisión de una factura DDP choca con el gate legal AUT-04**, que está en bloqueo duro.
- **La carga de consolidados ya calcula una factura por cliente y contenedor** con los precios del Excel.
  Los contenedores montados así no tienen tarifa congelada.

## Hecho

- `docs/specs/0674-boton-facturar-embarques/spec.md` en estado `approved`, con el índice regenerado.

## Evidencia

| Comprobación | Resultado |
|---|---|
| docs:check / sdd:check / git diff --check | PASÓ (649 specs) |
| Pruebas de producto | NO APLICA: cambio solo de docs |
| `pnpm verify` | NO EJECUTADO: es solo docs y el portón es el CI |

## Decisiones de Sam (2026-11-18, por el DG; detalle en la spec §4)

1. Por cliente del contenedor, con un botón en la fila de cada cliente, más un modo para el contenedor completo. La unidad mínima es el cliente.
2. El monto lo escribe la oficina: a mano, mayor que 0, con dos decimales y en USD.
3. Se crea una factura real emitida en USD, no un borrador.
4. «Ve el monto»: el botón lo oprime el rol de Embarques (`operations`, supuesto que confirma el DG), además de `accounting` y `admin`. Va como excepción con nombre, EXC-0674. `commercial` sigue sin ver montos. La lectura entra en el inventario 0357 en la PR de implementación, porque hoy la prueba congela solo las llamadas que existen.
5. Solo el contenedor 64. Los demás se agregan después por configuración.
6. La doble aprobación la da la misma persona, con dos confirmaciones seguidas.

7. Las tres del §7, aprobadas por Sam en el chat del DG («Sí, las tres»):
   - AUT-04 con una excepción explícita y auditada, solo para la lista;
   - el monto tecleado es el total con IVA;
   - si el cliente tiene aliado raíz, se le factura al aliado.

Spec `approved`. Migración asignada por el DG: 0564.

## Pendientes de esta tarea

- Implementar la migración 0564 (RPC transaccional y lista), la acción, la interfaz y las pruebas. Las corridas pesadas, con turno del DG.

## FUERA DE ALCANCE DETECTADO

- La 0668 está en la PR #680, sin fusionar. Según el DG no cruza con esta spec, salvo que cambie la regla del portal.
