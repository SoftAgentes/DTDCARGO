# Handoff · SDD-0674 — Botón «Facturar» en Embarques (regla transitoria)

Fecha: 2026-11-18. Datos de la tarea:

- Owner: Worker `worker-0674-facturar`.
- Rama: `codex/sdd-0674-boton-facturar-embarques`.
- Worktree: `DTD-worktrees/sdd-0674-boton-facturar-embarques`.
- Base: `origin/main` `9434cc4f6`.
- Número de SDD asignado por el DG.

Encargo del DG, por pedido de Sam en la reunión del 2026-11-18. Empezó como una spec en borrador con las
preguntas para Sam. Sam contestó las seis preguntas y aprobó las tres decisiones del §7. La spec está
`approved`, y el DG asignó la migración 0564 y pidió implementar.

La revisión independiente (Opus) de la spec en `a166d07fe` dio CHANGES_REQUESTED, con 7 bloqueantes. Las
decisiones del DG del 2026-11-18 están en la spec: §3.1, §7, §8 y la tabla del §9. La que importa: la 0574
se resuelve en esta PR, con el vínculo factura ↔ envío.

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

## Implementación (migración 0564, sin aplicar en ningún entorno)

- `supabase/migrations/0564_exc0674_facturar_contenedor.sql`. Crea:
  - `exc0674_contenedores`: la lista transitoria. Nace vacía; el 64 se agrega después, con el OK de Sam.
  - `exc0674_facturas`: el rastro, con `legal_ack = 'exc_0674'`.
  - La RPC `exc0674_facturar`, security definer. Hace todo o nada: correlativo, factura emitida en USD, aliado raíz, base derivada del total con IVA, líneas repartidas por CBM, asiento en la misma transacción y rastro.
- Va en espera en `migrations-baseline.json` y declarada en `pending-migration-symbol-declarations.json`. Desarme: `supabase/desarmes/0564_desarme.sql`.
- Contrato SQL: `supabase/tests/0564_exc0674_facturar_contenedor.test.sql`. Cubre rechazos, todo o nada, reparto, aliado raíz, no facturar dos veces, roles, privilegios y RLS.
- App:
  - `lib/studio/exc0674.ts`: roles, parseo del monto y mensajes.
  - `lib/studio/exc0674-queries.ts`: lectura de la lista y del rastro, sin tocar `invoices`.
  - `app/studio/(app)/embarques/facturar-actions.ts`: la acción, más el correo `invoice_emitted`.
  - `_components/FacturarContenedor.tsx`: la interfaz y las confirmaciones.
  - `page.tsx` y `EmbarquesClient.tsx`: pasan y pintan la prop solo para operations, accounting y admin.
- Frontera 0357: nota EXC-0674 en el inventario, con +0 llamadas a `invoices`.
- Pruebas nuevas:
  - `lib/studio/__tests__/exc0674.test.ts`;
  - `embarques/__tests__/page-exc0674-por-rol.test.ts`;
  - `embarques/__tests__/facturar-exc0674-action.test.ts`;
  - `_components/__tests__/EmbarquesClient.facturar.test.tsx`.

## Pendientes de esta tarea

- Con turno del DG: `pnpm install`, vitest de lo tocado, typecheck, eslint y el contrato SQL (o CI).
- `/ui-check` de `FacturarContenedor.tsx`.
- Después de fusionar, y solo con el OK nominal de Sam: aplicar la 0564 y agregar el 64 a la lista.

## FUERA DE ALCANCE DETECTADO

- La regla de la 0574 reconoce una factura solo por el primer embarque y el Shipping Mark de la factura. Con aliado raíz o con varios embarques por cliente, quedan embarques en «sin facturar». Pasa igual con la carga de consolidados. Se propone en una PR aparte.
- Facturar de nuevo a un cliente cuya factura EXC-0674 se anuló: la llave única del rastro lo impide. Hoy haría falta service_role con OK de Sam.

- La 0668 está en la PR #680, sin fusionar. Según el DG no cruza con esta spec, salvo que cambie la regla del portal.
