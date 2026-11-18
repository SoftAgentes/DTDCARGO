---
sdd: "0659"
title: "Tracking en vivo por contenedor: mesa de control con mapa centrado en el Pacífico"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0013", "0047", "0101", "0507", "0530", "0531"]
confidencialidad: interno
---

# SDD-0659 — Tracking en vivo por contenedor

> La pantalla `/studio/tracking` deja de listar clientes y pasa a listar contenedores. Quien opera ve por dónde va cada contenedor y abre a sus clientes con un clic.

## Contexto

- Hoy la pantalla (SDD-0013) lista todos los envíos activos a la izquierda: uno por cliente. Con tres contenedores en mar puede haber 150 filas y nadie baja hasta el final.
- El mapa actual dibuja América a la izquierda y China a la derecha con formas simplificadas. Sam lo quiere como se dibuja en China: centrado en el Pacífico, China a la izquierda, Venezuela a la derecha.
- La «velocidad» que muestra (`17.4 kn`) es un valor fijo en `TrackingMap.tsx`, no un dato.
- Sam eligió la **opción A, «Mesa de control»**, el 2026-11-18, entre tres maquetas (Artifact privada; copia en la carpeta de notas de la sesión, fuera del repo). Decisiones suyas del mismo día:
  1. El tracking es **por contenedor primero y por cliente después**.
  2. Un envío con proveedor tercero es un **consolidado parcial**: mismo concepto y misma visual.
  3. El aéreo, cuando se maneje, entra igual, una unidad por guía aérea. Hoy no se maneja.
  4. El buscador debe decir, al buscar un cliente, en qué contenedor viene y todo lo suyo en los distintos embarques.

## Datos que ya existen (leídos en el código, sin consultar producción)

| Dato | Dónde |
|---|---|
| Contenedor y su estado (`consolidando/cerrado/zarpado/arribado`) | `consolidations` (SDD-0047), `container_no` (SDD-0101) |
| Buque, ETD, ETA, puertos | `sailings`, vía `consolidations.sailing_id` |
| Quién viene adentro: cliente, Shipping Mark, m³, kg, bultos | `consolidation_items` (con `shipment_id` opcional) |
| Hitos con fecha real | `shipment_events`; el zarpe y el arribo del contenedor avanzan a sus envíos (SDD-0530) |
| Fechas planificadas | `shipments.planned_*` |
| Capacidad útil por tipo de contenedor | `container_types` (migración 0297) |
| Rastreo de la naviera: hitos, ETA, última latitud y longitud | caché `tracking_snapshots` (SDD-0101), con cuota de consultas |
| Adjuntos por envío | SDD-0507 |

## Alcance

### Fase 1 — Mesa de control por contenedor (sin migraciones)

1. **Lista izquierda de contenedores**, no de clientes. Una tarjeta por consolidado: nombre, estado, clientes, m³, barra de avance y ETA. Filtros: En mar (por defecto), En origen, En destino, Todos, cada uno con su conteo.
2. **Panel derecho del contenedor elegido:** encabezado (número, tipo, buque), aviso si hay alerta, mapa, indicadores, hitos y «Quién viene adentro».
3. **Mapa centrado en el Pacífico.** Contorno real de costas (Natural Earth 110m, dominio público) proyectado de antemano a un `path` SVG; sin librería de mapas en el navegador. Ruta Yiwu → Ningbo → Pacífico → Canal de Panamá → La Guaira. Muestra todos los contenedores activos; el elegido va resaltado y un clic en otro punto lo elige.
4. **Posición:** si el contenedor tiene posición en `tracking_snapshots`, se usa y se rotula con su fecha. Si no, se estima por estado y se rotula «Posición estimada». Nunca se presenta una estimación como real.
5. **Indicadores:** progreso, días restantes, ETA La Guaira, próximo hito y carga (m³ usados de la capacidad útil y número de clientes). **Se quita la velocidad** hasta tener el dato real.
6. **Hitos del contenedor** con fecha real (hechos) o planificada (pendientes).
7. **«Quién viene adentro»**, cerrado por defecto. Al abrir: Shipping Mark, cliente, bultos, m³, ciudad de entrega, adjuntos y enlace al detalle del envío (`/studio/tracking/[id]`, que no cambia).
8. **Buscador** por cliente, Shipping Mark, número de contenedor o BL. Resultado agrupado por cliente; cada fila trae el contenedor, el estado y la fecha, incluido lo ya entregado. Un clic abre el contenedor con el cliente resaltado.
9. **Envíos sin contenedor** (todavía no asignados a un consolidado): un grupo aparte, «Sin contenedor», para que nada desaparezca de la pantalla.
10. La selección persiste en la URL (`?c=<consolidado>&e=<envío>`); `?id=<envío>` sigue funcionando y abre su contenedor.

### Fase 2 — Consolidado parcial (requiere migración: OK aparte de Sam)

- Marcar un consolidado como parcial y guardar el proveedor tercero y su referencia (BL). El término no está definido en ninguna spec previa; se define aquí.
- Misma tarjeta y mismo panel, con etiqueta «Consolidado parcial».

### Fase 3 — Avisos (requiere migración: OK aparte)

- Guardar el historial de la ETA para avisar «ETA movida N días».
- Avisos de «sin novedades hace N días» y «N días en aduana».

## No entra

- Aéreo. Rastreo AIS de buques, ETA predictiva, días libres en puerto, congestión, CO₂.
- Cambios en el detalle del envío (`/studio/tracking/[id]`), en Naviera, en el portal del cliente o en los avisos a clientes.
- Escribir datos o aplicar migraciones en producción (cada fase con migración sigue el runbook).

## Reglas que se conservan

- **SDD-0531 (PIPL):** al equipo de China el nombre del cliente no le llega. Se oculta en el servidor en la lista de clientes del contenedor y en el buscador; busca por Shipping Mark o contenedor.
- RBAC: `requireModuleView("tracking")`. **Medido el 2026-11-18:** las policies de `consolidations`, `consolidation_items`, `sailings`, `bookings` y `tracking_snapshots` solo comparan el tenant; la separación por módulo vive en la app. Tracking lo ven `commercial`, `operations`, `accounting`, `warehouse` y `support`; Naviera, solo `operations` y `accounting`. Con esta pantalla, `commercial`, `warehouse` y `support` ven por primera vez qué lleva cada contenedor y buscan en el histórico de cargas. Es consecuencia directa de la decisión 4 de Sam (tracking por contenedor con buscador de clientes); no cambia ninguna policy ni el acceso al módulo Naviera. Sam lo confirmó el mismo día: «Sí, que lo vean».
- Marca y Studio: solo tokens `var(--*)`, modo oscuro y compacto por defecto, botones con las variantes oficiales, Sora y Nunito Sans, códigos en JetBrains Mono. Pasa por `/ui-check`.
- Se dice «contenedor» o «consolidado», nunca «lote».

## Allowlist (Fase 1)

- `app/studio/(app)/tracking/page.tsx`
- `app/studio/(app)/tracking/_components/` (lista, mapa, hitos, clientes, buscador y sus pruebas)
- `app/studio/(app)/tracking/__tests__/tracking-por-contenedor.test.tsx` (nuevo)
- `lib/studio/tracking-contenedores.ts` y `lib/studio/tracking-contenedores-queries.ts` (nuevos)
- `lib/studio/__tests__/tracking-contenedores.test.ts` (nuevo)
- `lib/studio/tracking-mapa/` (nuevo: proyección, ruta y contorno ya proyectado)
- `app/studio/studio.css` (solo el bloque `.studio-tracking-ops-*`)
- `docs/specs/0659-tracking-por-contenedor/`
- `.agents/handoffs/tracking-por-contenedor-0659.md`

## Criterios de aceptación (Fase 1)

1. Con N contenedores en mar, la lista muestra N tarjetas, no los envíos uno por uno.
2. El mapa deja China a la izquierda y Venezuela a la derecha, y la ruta se lee de izquierda a derecha.
3. Ninguna posición estimada aparece sin el rótulo «estimada». La velocidad no aparece.
4. Abrir «Quién viene adentro» lista a todos los clientes del contenedor con su enlace al detalle.
5. Buscar un cliente devuelve todas sus cargas con el contenedor de cada una, incluidas las entregadas.
6. Un usuario de región China no recibe nombres de clientes en la lista ni en el buscador (prueba de servidor).
7. Un envío activo sin contenedor sigue visible en «Sin contenedor».
8. `?id=<envío>` abre el contenedor de ese envío.
9. `pnpm verify` en verde.

## Preguntas abiertas para Sam

1. ¿«Avisar a los clientes» del contenedor entra en esta pantalla o se queda en Naviera?
2. En el consolidado parcial, ¿qué referencia da el proveedor tercero: BL, número de contenedor o ambas?
3. ¿Los contenedores entregados se ven en «Todos» o solo por el buscador?
