---
sdd: "0647"
title: "CRM › Embudos por segmento: Clientes, Leads y Leads con código"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0586", "0587", "0614"]
confidencialidad: interno
---

# SDD-0647 — CRM › Embudos por segmento: Clientes, Leads y Leads con código

> El tablero Embudos del CRM deja de tener dos pestañas («Leads» y «Clientes») y pasa a tres
> segmentos con la definición de Sam: **Clientes** (prueba de haber traído carga), **Leads**
> (sin compra y sin Shipping Mark) y **Leads con código** (con Shipping Mark y sin carga).
> Al pulsar Clientes salen **todos** los clientes con carga, aunque nunca hayan escrito.

**Estado:** `proposed`. Regla y decisiones aceptadas por Sam el 2026-11-16 (§3). Números asignados por el
Director General el 2026-11-16: SDD-0647 y migración 0553 (reserva `refs/dtd/reservations/0647`).

## 0. La definición de Sam, literal

Como la transmitió el encargo de la tarea (2026-11-16):

> 1. **Clientes:** quienes tienen prueba de haber traído carga con DTD alguna vez. Al pulsar Clientes deben
>    salir exactamente esos clientes, con sus conversaciones activas.
> 2. **Leads:** gente nueva que contactó, o que contactó antes, y nunca ha hecho una compra ni tiene Shipping Mark.
> 3. **Leads con código:** quienes en algún momento se registraron y tienen Shipping Mark (DTD-xxxx), pero
>    nunca han traído carga.
>
> Más adelante se agregarán otros filtros; deja la estructura lista para sumar más.

## 1. Lo que había

- La tarjeta no guarda su tablero: sale del segmento calculado en el momento por
  `crm_segmento_tarjetas` (0506), que delega en `crm_segmento_clientes`. `cliente` → tablero Clientes;
  `lead_registrado` y `lead_nuevo` → tablero Leads.
- La regla de `cliente` **ya mide carga** (regla de Sam 0.8, 2026-10-30): envío no borrado y fuera de
  `draft`/`cancelled`, o recibo de China no borrado y no huérfano, con cualquiera de los códigos de la
  ficha (vigente, historial 0367 y fichas fusionadas en ella, hasta 10 saltos), normalizados con
  `upper(btrim())`. Sus casos borde están en `supabase/tests/0506_crm_modelo.test.sql`.
- «Clientes (0)» no venía de una regla equivocada: las tarjetas solo nacían por Chatwoot (0513) o por
  `/registro`, así que un cliente con carga que nunca escribió no tenía tarjeta; y en producción la carga
  histórica entra al ERP contenedor por contenedor (lotes 64-68 en curso).

## 2. La regla

Una tarjeta está en exactamente una vista (`CRM_VISTAS` en `lib/studio/crm-tablero.ts`):

| Vista | Condición | Etapas |
|---|---|---|
| **Clientes** | segmento `cliente` (prueba de carga, §1) | tablero Clientes |
| **Leads con código** | no es cliente y su ficha tiene Shipping Mark (no vacío) | tablero Leads |
| **Leads** | no es cliente y no tiene ficha, o su ficha no tiene Shipping Mark | tablero Leads |

«Leads» y «Leads con código» comparten las etapas del tablero Leads: la vista es un filtro, no otro
embudo guardado. Mover una tarjeta de etapa no cambia su vista.

### 2.1 Casos borde

| Caso | Resultado |
|---|---|
| Envío entregado (o en cualquier estado salvo borrador/cancelado) | Clientes |
| Solo carga recibida en China (recibo no huérfano, incluso en `incidencia`) | Clientes |
| Carga anulada: envío cancelado, borrador o borrado; recibo borrado o huérfano | no cuenta |
| Solo cotización, sin envío ni recibo | no cuenta → Leads con código si tiene código |
| Registrado con Shipping Mark y sin carga | Leads con código |
| Ficha sin Shipping Mark | Leads |
| Carga con un código del historial o de una ficha fusionada | cuenta para la ficha que queda |
| Dos fichas de la misma persona sin fusionar | cada tarjeta sigue a su ficha; no se adivina. Para unificar, se fusionan las fichas |
| Tarjeta sin ficha (escribió y su teléfono no cruzó con una única ficha) + ficha con carga | dos tarjetas hasta que alguien ligue la tarjeta a la ficha |
| Cliente que pierde su única carga (se cancela el envío) | conserva la tarjeta y baja solo a Leads con código |
| Cliente histórico cuya carga aún no está en el ERP | Leads con código hasta que se cargue su contenedor (decisión 4) |

## 3. Decisiones de Sam (2026-11-16, en la sesión de esta tarea)

Preguntas cerradas; entre comillas, la opción que Sam eligió, literal.

1. Regla de cliente: «Sí, así (Recommended)» — envío no borrado salvo borrador o cancelado (entregado cuenta) o recibo de
   China no borrado y no huérfano; una cotización sola no cuenta.
2. Quiénes salen en Clientes: **«Todos con carga»** (la otra opción era «Solo con tarjeta»), aunque nunca hayan escrito → migración 0553 (§4.2).
3. Leads frente a Leads con código: «Sí, así (Recommended)» (separa el Shipping Mark; dos fichas no fusionadas no se adivinan).
4. Clientes históricos sin carga en el ERP: «Sí, por evidencia (Recommended)» — solo cuenta lo que está en el ERP.

## 4. Diseño

### 4.1 Vistas (sin migración)

- `lib/studio/crm-tablero.ts`: `CrmVista`, `CRM_VISTAS` (registro de vistas con su tablero de etapas y su
  predicado), `vistaDeTarjeta`, `contarPorVista`, `resolverVista` (`?embudo=` acepta `clientes`, `leads` y
  `leads_con_codigo`; lo desconocido abre Leads) y `armarColumnas(…, vista)`. Para sumar un filtro
  después, se agrega una entrada a `CRM_VISTAS`.
- `CrmEmbudosClient.tsx`: el control segmentado muestra las tres vistas con su conteo; el texto de ayuda
  explica la regla. `page.tsx` y `CrmEmbudosSlot.tsx` pasan la vista inicial.

### 4.2 Tarjetas para todos los clientes con carga (migración 0553, en espera)

Diseño ajustado tras la revisión independiente del DG (2026-11-16): **la vista no escribe**.

- `crm_tarjetas.fuente` admite `carga_erp` («Cliente con carga en el ERP»).
- `crm_alta_tarjetas_clientes(tenant)`: SECURITY DEFINER, `search_path` vacío, EXECUTE solo `service_role`.
  Crea la tarjeta que falta a cada ficha viva y no fusionada del tenant con segmento `cliente`. Inserta tenant,
  ficha, fuente, el asesor de la ficha (solo si sigue activo en el tenant, como la 0513) y
  `ultima_actividad_at = 2000-01-01`, para que no aparente actividad ni le quite lugar a un lead real en el tope
  de 2000 tarjetas del tablero. Sin nombre ni teléfono (D6); nace en Clientes › Activo; no toca tarjetas
  existentes; idempotente (`on conflict` sobre `crm_tarjetas_client_uq`).
- **Alta inicial:** la 0553 corre la función una vez por tenant al aplicarse. Aplicarla escribe filas; antes,
  el DG le pide a Sam el conteo de solo lectura de fichas con segmento cliente y sin tarjeta.
- El tablero no llama a la función y funciona igual con o sin la 0553 (sin ella, Clientes muestra solo a quien
  ya tenía tarjeta).
- Aplicarla en producción exige el OK nominal de Sam para el archivo, el runbook
  `docs/runbooks/aplicar-migraciones-prod.md` y el Director General. Desarme: `supabase/desarmes/0553_desarme.sql`.

### 4.3 Datos personales

No se agrega captura ni movimiento de datos personales: la tarjeta nueva liga una ficha que ya existe y no
copia nombre, teléfono ni código (la vista los lee de `clients`, como antes). El conteo por vista no expone
datos. Sin cambios en retención.

## 5. Pruebas

- `lib/studio/__tests__/crm-tablero.test.ts`: vistas disjuntas y completas, cada caso borde de §2.1 que se
  decide en la vista, conteos, columnas filtradas y `?embudo=`.
- `app/studio/(app)/crm/_components/CrmEmbudosClient.test.tsx`: tres pestañas con su conteo, cada tarjeta
  en la suya, URL y vista inicial.
- `lib/studio/__tests__/crm-tablero-queries.test.ts`: con un doble que aplica los filtros, el tablero solo
  lee (la única RPC es `crm_segmento_tarjetas`).
- `supabase/tests/0553_crm_tarjetas_clientes_con_carga.test.sql` +
  `lib/studio/__tests__/crm-tarjetas-clientes.migration.test.ts` (PGlite): el alta inicial de la 0553 real
  sobre el escenario de la 0506, más una ficha fusionada viva, asesores activo, desactivado y de otro tenant,
  y una tarjeta previa con actividad real; control rojo, mutantes (sin alta, fusionada viva, actividad de hoy,
  asesor), reaplicar y preflight. Los casos de carga anulada,
  huérfana, de otro tenant, por historial y por fusión ya tienen mutantes en `crm-modelo.migration.test.ts`.

## 6. Allowlist exacta

- `docs/specs/0647-crm-segmentos-clientes-leads/spec.md` (nuevo) y `docs/specs/README.md` (índice generado).
- `lib/studio/crm-tablero.ts`, `lib/studio/crm-tablero-queries.ts`.
- `lib/studio/__tests__/crm-tablero.test.ts`, `lib/studio/__tests__/crm-tablero-queries.test.ts`,
  `lib/studio/__tests__/crm-tarjetas-clientes.migration.test.ts` (nuevo).
- `app/studio/(app)/crm/page.tsx`, `app/studio/(app)/crm/_components/CrmEmbudosSlot.tsx` (solo el tipo de la
  vista inicial), `app/studio/(app)/crm/_components/CrmEmbudosClient.tsx` (control de vistas, conteo y texto
  de ayuda), `app/studio/(app)/crm/_components/CrmEmbudosClient.test.tsx` y
  `app/studio/(app)/crm/_components/CrmTableroKanban.test.tsx` (solo los dos campos nuevos del doble).
- `CrmTarjetaTablero` suma `fuente` y `utmSource` (de `crm_tarjetas.fuente` y `utm_source`, sin migración),
  pedidos por la tarea de la visual para el logo del canal; esta SDD no los pinta.
- `supabase/migrations/0553_crm_tarjetas_clientes_con_carga.sql` (nuevo),
  `supabase/tests/0553_crm_tarjetas_clientes_con_carga.test.sql` (nuevo),
  `supabase/desarmes/0553_desarme.sql` (nuevo).
- `supabase/migrations-baseline.json` (la espera de la 0553).
- `.agents/handoffs/` (handoff de esta tarea).

La tarjeta, los logos por canal y el layout del tablero son de la tarea «CRM: fichas compactas, logos por
canal y Conversaciones globales»; esta SDD no los toca.

## 7. Fuera de alcance

- Materializar las tarjetas de las fichas que ganen carga **después** de aplicar la 0553. Si hace falta, va con
  su OK: una acción con `crm_puede_editar()` o un proceso de servicio que llame a `crm_alta_tarjetas_clientes`,
  nunca al pintar el tablero.

- Ligar automáticamente una tarjeta sin ficha a la ficha con carga de la misma persona.
- Filtros adicionales (se suman como entradas de `CRM_VISTAS`).
- Cargar en el ERP la carga histórica anterior a los lotes 64-68.
