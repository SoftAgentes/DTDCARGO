---
sdd: "0664"
title: "Clientes migrados: código viejo visible, buscable y enlazable"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0106", "0108", "0246", "0258", "0531", "0543", "0645", "0650", "0662"]
confidencialidad: interno
---

# SDD-0664 — Clientes migrados: código viejo visible, buscable y enlazable

> Un cliente del legado tiene hoy un Shipping Mark nuevo (`DTD-8xxx`), pero su mercancía sigue llegando rotulada con el código de antes. Quien opera debe poder escribir el código viejo en cualquier buscador y llegar al cliente, verlo en la ficha y enlazar la carga con él.

Los ejemplos de esta spec son inventados (`DTD-Z901` como código viejo, `DTD-8901` como nuevo, `DTD-9001` como cliente de la casa). No hay códigos reales.

## Pedido

Del Director General, por encargo de Sam en la reunión del 2026-11-18:

1. Los clientes viejos que entraron por migración recibieron un Shipping Mark nuevo que empieza por 8. Su código anterior no aparece en la ficha y llega mercancía con el código viejo que el sistema no enlaza. Mostrar el código viejo en la ficha y poder buscar y enlazar por él en la búsqueda del Studio, la carga de contenedores y la asignación de embarques.
2. Ningún embarque sin cliente: si no aparece el dueño, va a `DTD-0000`. El buscador de «Asignar cliente» (SDD-0662) debe encontrar por nombre, código nuevo o código viejo: se amplía, no se duplica.

## Lo que se encontró

Todo sale de leer el repositorio. **No se consultó producción.** Cada punto lleva su etiqueta: **[verificado en código]** es lo que el código dice; **[inferencia]** es lo que se deduce y falta confirmar; **[sin medir]** depende del estado de producción.

### El código viejo sí está guardado

- **[verificado en código]** `supabase/migrations/0367_client_markbox_historial.sql` (SDD-0258) crea `client_markbox_history`: una fila por cada Shipping Mark que un cliente tuvo y ya no es el actual (`client_id`, `markbox`, `reason`, `retired_at`, `retired_by`). Tiene índice único `(tenant_id, upper(markbox))` y RLS de lectura por tenant, sin política de escritura: solo escribe `rename_client_markbox()`.
- **[verificado en código]** La misma migración enseña a `resolve_markbox(p_tenant_id, p_markbox)` a buscar en ese historial cuando el código no está en `clients`, y a seguir después la cadena de fusiones. Devuelve el cliente vigente, su código actual y `was_redirected`. La comparación es exacta, sin distinguir mayúsculas.
- **[verificado en código]** `rename_client_markbox()` además reescribe el código en las columnas que lo copian, para que el portal (cuyas políticas comparan por texto con el código vivo) siga viendo la historia del cliente.

### Cómo se generó el `DTD-8xxx`

- **[verificado en código]** `0369_rename_legacy_markboxes.sql` crea `rename_legacy_markboxes(p_batch, p_dry_run, p_reason)`: recorre las fichas con serie de vendedor (una letra tras `DTD-`, mayúscula o minúscula), calcula el código nuevo y delega cada renombrado en `rename_client_markbox()`. Solo admin; arranca en simulacro.
- **[verificado en código]** `0379_legado_al_rango_8000.sql` cambia el destino al rango `DTD-8001…`, separado de la serie viva (`DTD-9xxx`), y define «del legado» como «tiene ahora un código de vendedor o tuvo uno». `0380` hace que la función devuelva el resumen. La pantalla que la ejecuta es `app/studio/(app)/clientes/migrar-legado/`.
- **[inferencia]** Como el lote delega en `rename_client_markbox()`, cada cliente `DTD-8xxx` debería tener su código de vendedor en `client_markbox_history`. Un cliente pudo pasar por dos renombrados (vendedor → `DTD-9xxx` → `DTD-8xxx`); en ese caso tiene dos códigos en el historial.
- **[sin medir]** Si el lote corrió completo en producción, cuántas fichas `DTD-8xxx` hay y si todas tienen historial. La consulta de solo conteos está al final.

### Dónde ya se resuelve el código viejo

- **[verificado en código]** Almacén CN: `lib/studio/warehouse-cn-queries.ts` llama a `resolve_markbox` cuando el código rotulado no es de una ficha viva.
- **[verificado en código]** El cargador de consolidados (SDD-0543): `scripts/consolidados/lote-sql.ts` resuelve cada marca con `resolve_markbox` e informa las que quedan `sin_resolver`.
- **[verificado en código]** Correo (`lib/studio/mail/mail-rule-engine.ts`) y la escritura a Kommo (`lib/studio/kommo-writeback.ts`) también la usan.
- **[verificado en código]** La ficha del cliente lee el historial (`listMarkboxHistory`, `app/studio/(app)/clientes/[markbox]/page.tsx`) y, desde SDD-0650, lista los embarques de todos sus códigos (`listCodigosDeLaFicha`).

### Dónde no

| Superficie | Qué pasa hoy | Evidencia |
|---|---|---|
| Ficha del cliente | El historial es un contador «+N» junto al Shipping Mark; el código viejo solo se lee al abrir el panel. | `clientes/_components/ShippingMarkChip.tsx` |
| Ficha por URL | `/studio/clientes/DTD-Z901` da 404: `getClientByMarkbox` solo mira `clients.markbox`. | `lib/studio/client-queries.ts` |
| Búsqueda del Studio (Ctrl K) | Busca clientes con `listClients({ q })`, que compara `rif`, `name`, `markbox`, `email` y `phone` de `clients`. No mira el historial. | `lib/studio/global-search/search-action.ts`, `construirQuery` en `client-queries.ts` |
| Lista de Clientes | La misma consulta. | `construirQuery` |
| «Asignar cliente» y «Pasar a otro cliente» | `ClientCombobox` → `searchClientsAction` → `listClients({ q })`. Tampoco. | `lib/studio/client-search-action.ts` |
| Nuevo embarque | El mismo combobox; además el campo Shipping Mark se guarda tal como se escribe, sin resolver. Un código viejo queda como texto que no es de ninguna ficha viva. | `tracking/nuevo/actions.ts` |
| Carga del contenedor (Naviera) | `consolidation_items.client_markbox` se guarda tal como llega. | `naviera/actions.ts` |
| Embarques | El filtro «Cliente» compara nombre y Shipping Mark de cada embarque, en el navegador. | `lib/studio/embarques-contenedores.ts` (`clienteCoincide`) |

Un solo punto alimenta la búsqueda del Studio, la lista de Clientes y los tres formularios que eligen cliente: `construirQuery`. Ampliarlo ahí cubre los cinco sin duplicar nada.

## Estado (2026-11-18)

- **Fases 1 y 2: implementadas**, con el visto bueno del Director. La búsqueda se normaliza con y sin «DTD-» y sin distinguir mayúsculas, para no depender de la pregunta 2. Además del historial, se siguen las fichas absorbidas por fusión (`merged_into_client_id`) hasta el cliente vivo. Módulo: `lib/studio/client-codigo-viejo.ts`.
- **Fase 3: en espera** de las respuestas de Sam a las preguntas 2 y 3.
- **Portal del cliente:** fuera de esta SDD (pregunta 4).
- **Medición de producción:** no se ejecutó; necesita el OK de Sam.

## Propuesta

**No hace falta migración.** El dato existe, tiene índice para la búsqueda exacta y la RLS ya deja leerlo al equipo. Para la búsqueda por fragmento, el historial tiene a lo sumo unas centenas de filas por tenant **[inferencia, por los conteos que citan las migraciones 0369 y 0379]**: no justifica un índice nuevo.

### Fase 1 — Buscar por el código viejo

- `construirQuery` (`lib/studio/client-queries.ts`): cuando hay texto de búsqueda, se consulta antes `client_markbox_history` por ese texto (patrón escapado: `%`, `_` y `*` no son comodines) y los `client_id` encontrados se suman a la condición. Con tope, para que un texto corto no arme una lista enorme.
- El resultado dice por qué apareció: cada cliente encontrado por el historial lleva el código que coincidió. El combobox y la búsqueda del Studio lo muestran como «antes DTD-Z901» junto al código vigente.
- Cubre: búsqueda del Studio, lista de Clientes, «Asignar cliente» / «Pasar a otro cliente» (SDD-0662 y SDD-0645), nuevo embarque y cotizador.
- Privacidad (SDD-0531): el historial son Shipping Marks, no nombres. Quien no ve nombres ya no recibe el combobox; nada cambia para ese equipo.

### Fase 2 — Verlo en la ficha

- La ficha muestra los códigos anteriores a la vista, junto al Shipping Mark («Antes: DTD-Z901»), en vez de solo el contador. El panel con fecha y motivo se conserva.
- `/studio/clientes/<código viejo>` redirige a la ficha vigente: si `getClientByMarkbox` no encuentra, se resuelve con `resolve_markbox`.

### Fase 3 — Enlazar al escribirlo

- Nuevo embarque y carga del contenedor: si el Shipping Mark escrito es un código retirado, el servidor lo resuelve con `resolve_markbox` y guarda el vigente. La pantalla avisa «DTD-Z901 es el código anterior de DTD-8901; se guardó con el vigente». Guardar el vigente es obligatorio: el portal compara por texto con el código vivo.
- Embarques: el filtro «Cliente» acepta también el código viejo. Requiere pasar al navegador el mapa código viejo → vigente de los clientes de esa lista; se mide el tamaño antes de decidir.
- Ningún embarque sin cliente: ver la pregunta 3.

### Lo que ya está y no se toca

- Almacén CN y el cargador de consolidados ya resuelven el código viejo.
- `resolve_markbox`, `rename_client_markbox` y `rename_legacy_markboxes`: sin cambios.

## No entra

- Migraciones, columnas o índices nuevos. Si la medición de producción mostrara que falta historial, sería una tarea aparte con número del Director y OK nominal de Sam.
- Cambiar permisos o el rol de alguien.
- Volver a rotular: el código vigente sigue siendo el `DTD-8xxx`.
- Mostrar el código viejo al cliente en el portal (pregunta 4).

## Preguntas para Sam

1. **¿Confirmas que el rango es `DTD-8xxx`?** El código dice `DTD-8001` en adelante.
2. **¿Cómo llega escrito el código viejo en la mercancía?** Si llega completo (`DTD-Z901`), la búsqueda exacta alcanza. Si llega sin prefijo (`Z901`) o con otra forma, la búsqueda por fragmento lo encuentra, pero el enlace automático de la Fase 3 necesita una regla: ¿se acepta sin el `DTD-`?
3. **Sin dueño → `DTD-0000`: ¿automático o con aviso?** Hoy un embarque puede crearse con el Shipping Mark vacío o con un texto que no es de ninguna ficha. Opciones: (a) el servidor lo manda a `DTD-0000` y guarda en las notas lo que se escribió; (b) no deja guardar sin elegir un cliente o marcar «sin dueño». La primera no frena a nadie; la segunda evita que algo quede en el comodín por un error de tipeo.
4. **¿El cliente debe ver su código viejo en el portal?** Hoy no se le muestra.

## Medición de producción que hace falta (solo conteos)

Para confirmar las dos inferencias. No devuelve filas, nombres ni códigos. La corre quien tenga la autorización de Sam; aquí no se ejecutó.

```sql
-- Fichas del legado y si tienen su código viejo guardado.
select
  count(*) filter (where c.markbox ~ '^DTD-8\d{3}$')                         as fichas_8xxx,
  count(*) filter (where c.markbox ~ '^DTD-8\d{3}$' and exists (
    select 1 from public.client_markbox_history h where h.client_id = c.id)) as fichas_8xxx_con_historial,
  count(*) filter (where c.markbox ~ '^DTD-[A-Za-z]\d')                      as fichas_aun_con_codigo_de_vendedor
from public.clients c
where c.deleted_at is null and c.merged_into_client_id is null;

-- Tamaño del historial (decide si la búsqueda por fragmento necesita índice).
select count(*)                                          as codigos_en_historial,
       count(*) filter (where markbox ~ '^DTD-[A-Za-z]\d') as de_vendedor
from public.client_markbox_history;

-- Carga guardada con un código retirado (lo que hoy «no enlaza»).
select
  (select count(*) from public.shipments s
     where s.deleted_at is null and exists (
       select 1 from public.client_markbox_history h
        where h.tenant_id = s.tenant_id and upper(h.markbox) = upper(btrim(s.client_markbox)))) as embarques_con_codigo_retirado,
  (select count(*) from public.consolidation_items i
     where exists (
       select 1 from public.client_markbox_history h
        where h.tenant_id = i.tenant_id and upper(h.markbox) = upper(btrim(i.client_markbox))))  as items_con_codigo_retirado,
  (select count(*) from public.shipments s
     where s.deleted_at is null and coalesce(btrim(s.client_markbox), '') = '')                 as embarques_sin_shipping_mark,
  (select count(*) from public.shipments s
     where s.deleted_at is null and coalesce(btrim(s.client_markbox), '') <> ''
       and not exists (select 1 from public.clients c
                        where c.tenant_id = s.tenant_id and upper(c.markbox) = upper(btrim(s.client_markbox)))
       and not exists (select 1 from public.client_markbox_history h
                        where h.tenant_id = s.tenant_id and upper(h.markbox) = upper(btrim(s.client_markbox)))) as embarques_con_codigo_de_nadie;
```

Qué decide cada número:

- `fichas_8xxx` distinto de `fichas_8xxx_con_historial`: hay fichas del legado sin código viejo guardado. Sería la única razón para una tarea de datos.
- `fichas_aun_con_codigo_de_vendedor` mayor que cero: el lote no terminó.
- `embarques_con_codigo_retirado` o `items_con_codigo_retirado` mayores que cero: carga ya guardada con el código viejo; corregirla es escritura en producción, con OK aparte.
- `embarques_sin_shipping_mark` y `embarques_con_codigo_de_nadie`: el tamaño real de «embarques sin cliente».

## Allowlist

- `lib/studio/client-codigo-viejo.ts` (nuevo), `lib/studio/client-types.ts`
- `lib/studio/client-queries.ts`, `lib/studio/client-search-action.ts`, `lib/studio/global-search/`
- `app/studio/_components/ui/ClientCombobox.tsx`, `app/studio/_components/wiring/GlobalSearchModal.tsx`
- `app/studio/(app)/clientes/[markbox]/page.tsx`, `app/studio/(app)/clientes/_components/ShippingMarkChip.tsx`
- `app/studio/(app)/tracking/nuevo/`, `app/studio/(app)/naviera/actions.ts`
- `app/studio/(app)/embarques/` y `lib/studio/embarques-contenedores.ts` (Fase 3, filtro)
- Pruebas de cada uno, `docs/specs/0664-clientes-migrados-codigo-viejo/`, `docs/specs/README.md`, `.agents/handoffs/clientes-codigo-viejo-0664.md`

## Criterios de aceptación

1. Escribir un código retirado en la búsqueda del Studio, en la lista de Clientes o en «Asignar cliente» trae al cliente vigente, con la indicación «antes <código>».
2. Un texto con `%`, `_` o `*` no devuelve el historial entero.
3. La ficha muestra los códigos anteriores sin abrir ningún panel, y la URL con un código viejo lleva a la ficha vigente.
4. Crear un embarque o cargar un ítem con un código retirado guarda el código vigente y lo avisa.
5. El equipo que no ve nombres (SDD-0531) no recibe nada nuevo.
6. Las pruebas de SDD-0258, SDD-0645, SDD-0650 y SDD-0662 siguen pasando.
