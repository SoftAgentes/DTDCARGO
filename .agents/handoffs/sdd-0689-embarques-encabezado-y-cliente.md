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
- Cuidados del DG sobre el ojo: es un botón que alterna (`aria-pressed`, `aria-label`), funciona con Enter
  y Espacio, y al ocultarse solo no le quita el foco a nadie. La spec dice que es privacidad frente a la
  pantalla, no protección de datos.
- La revisión independiente de `240f0a5a5` pidió cambios: un bloqueo y cinco menores. Los corregí así:
  1. El peso y el monto del encabezado sumaban solo lo que dejaba pasar la vista. Ahora
     `GrupoContenedor.completo` trae el contenedor entero y el encabezado suma sobre eso. La spec dice qué
     números son del contenedor y cuáles de la vista.
  2. El nombre del cliente tenía `all: unset` en línea, y eso tapaba el foco. Ahora va en la clase.
  3. El ojo se decide por la suma en USD, así que nunca sale «$0.00».
  4. Los textos «Facturado», «Sin precios cargados» y «Sin monto en USD». El doble sentido de «Sin
     facturar» queda anotado como pendiente de la 0690.
  5. El ojo tiene un `aria-label` fijo con `aria-pressed`, y los «••••••» no se anuncian.
  6. La vista del contenedor zarpado: «En camino» cuando entre la 0682.
- Pruebas:
  - del servidor: a `operations` y a los demás roles no les llega ningún monto (`page-monto-por-rol`);
  - las fixtures de la 0661 suman los campos nuevos;
  - la prueba de la 0661 que congelaba «sin dinero en la cabecera» se ajustó a la decisión nueva;
  - prueba nueva: `EmbarquesClient.encabezado-cliente.test.tsx`, con el caso de dos pestañas.

## Evidencia

| Comprobación | Resultado |
|---|---|
| docs:check / sdd:check / git diff --check | PASÓ |
| Cabeza nueva tras la revisión: vitest, typecheck y eslint locales | NO EJECUTADO: el turno de la PC lo tiene otra tarea. Por orden del DG, el portón es el CI de GitHub de la cabeza nueva |
| `pnpm install --frozen-lockfile` (turno del DG) | PASÓ |
| vitest (`--pool=threads --maxWorkers=1`): `app/studio/(app)/embarques/` y las tres pruebas de `lib` de Embarques y la 0661 | PASÓ: 17 archivos, 202 pruebas |
| `pnpm typecheck` | PASÓ |
| eslint de lo tocado | PASÓ |
| `/ui-check` del encabezado (advisory) | PASÓ: tokens del Studio, ojo de 32 px con foco visible, sin hex nuevos; el respaldo de foco usa `--wine`, como el resto del Studio |

## Pendientes de esta tarea

1. La revisión que lanza el DG y el CI de la PR.
2. La aprobación de Sam de la spec.

## FUERA DE ALCANCE DETECTADO

- SDD-0690: cargar los borradores del 64 desde el Excel (solo el 64, con OK nominal de Sam), «Facturar»
  que emite el borrador, «Facturar todo» y el estado «Facturado» sin botón.
- Dos pedidos nuevos de Sam, sin número todavía (el DG decide):
  - historial de contenedores entregados al 100 %, dentro de Embarques;
  - tarifa por cliente en su ficha (precio por m³, precio por kg de exceso y límite de kg/m³, 500 por
    defecto), con alerta de exceso en el embarque y desglose en la factura.
- Las decisiones literales de Sam están en la carpeta de notas del DG
  (`embarques-decisiones-sam-20261120.md`), fuera del repo.
