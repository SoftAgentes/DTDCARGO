---
sdd: "0664"
title: "Clientes migrados: código viejo visible, buscable y enlazable"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0106", "0108", "0246", "0258", "0531", "0543", "0645", "0646", "0647", "0650", "0662", "0668"]
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

- **Fases 1 y 2: en main** (PR #677). La búsqueda se normaliza con y sin «DTD-» y sin distinguir mayúsculas. Además del historial, se siguen las fichas absorbidas por fusión hasta el cliente vivo. Módulo: `lib/studio/client-codigo-viejo.ts`.
- **Lo que sigue: solo documento.** Sam pidió esperar antes de arrancar más código; el Director avisa cuándo.
- **Orden decidido por el Director:**
  1. Una PR con las notas de la revisión de la #677 y las dos de la #674 (SDD-0662). Lo primero, excluir `DTD-0000`.
  2. La fase 3 de esta SDD, con la corrección del código (fase 4) y la regla de qué código se ve.
  3. El portal, en su propia SDD: **SDD-0668**.
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

### Fase 3 — Enlazar al escribirlo, y ningún embarque sin dueño

Decisión de Sam (2026-11-18, por el Director): **un embarque sin dueño va automáticamente a `DTD-0000`**.

- Nuevo embarque y carga del contenedor: si el Shipping Mark escrito es un código retirado, el servidor lo resuelve con `resolve_markbox` y guarda el vigente. La pantalla avisa «DTD-Z901 es el código anterior de DTD-8901; se guardó con el vigente». Guardar el vigente es obligatorio: el portal compara por texto con el código vivo.
- Si el Shipping Mark viene vacío, o no es de ninguna ficha ni de ningún historial, el servidor guarda `DTD-0000` y deja en las notas del embarque lo que se escribió, para que quien lo asigne después tenga la pista. La pantalla lo dice: «No encontramos a ese cliente; el embarque quedó en DTD-0000. Asígnalo cuando sepas de quién es».
- Requisito previo (nota de la revisión de la #677): `DTD-0000` se excluye de forma explícita de la búsqueda por código anterior. Si la ficha comodín se renombrara o se fusionara, buscar «0000» mostraría «antes DTD-0000».
- **[sin medir]** Que la ficha `DTD-0000` exista en producción con ese código exacto. Si no existiera, el guardado automático fallaría: la consulta de conteos lo confirma.
- Embarques: el filtro «Cliente» acepta también el código viejo.

### El portal va aparte: SDD-0668

Sam decidió (2026-11-18) que el cliente sí ve su código viejo en el portal, solo como dato informativo. Por decisión del Director eso sale de esta SDD y va en la **SDD-0668**, porque toca lo que el cliente ve y la frontera público↔ERP. Lo medido (el portal ya lo muestra en Perfil) está allá.

### Fase 4 — Corregir el código de un cliente

Pedido de Sam (2026-11-18, por el Director): los clientes viejos tenían un código de vendedor («DTD-JA…») y en la migración pasaron al 8. Quien maneja clientes debe poder editar el código al correcto; al editarlo, el 8 queda en el historial y el nuevo es el que se usa.

**Ya existe. [verificado en código]**

- La función: `rename_client_markbox()` (0367; redefinida en 0371 y 0552). Mueve el código en todas las tablas que lo copian, en una transacción, y deja el anterior en `client_markbox_history`. Roles: administrador, comercial y operaciones.
- La pantalla: en la ficha del cliente, el Shipping Mark abre un panel con «Cambiar Shipping Mark» y un motivo (`ShippingMarkChip.tsx`, `renombrarMarkboxAction`). La ve quien puede editar Clientes.
- Volver al código de antes: desde la 0552 (SDD-0646) un cliente **puede recuperar su propio código retirado**. La fila del historial no se borra: queda marcada como restaurada. El código retirado de **otro** cliente sigue reservado y se rechaza.

O sea: pasar una ficha de `DTD-8901` a `DTD-Z901` (su código de vendedor) ya se puede hacer hoy desde la ficha, y `DTD-8901` queda en el historial.

**Lo que falta, todo de aplicación:**

- Que se encuentre. «Cambiar Shipping Mark» está dentro de un panel que se abre al oprimir el código. Propuesta: en ese panel, junto a cada código anterior, un botón «Volver a este código» que precarga el cambio; y la ayuda dice que el código actual pasa al historial.
- **Un código recuperado no debe salir como «anterior».** **[verificado en código]** Al recuperar un código, su fila del historial no se borra: queda con `restored_at` (0552). `listMarkboxHistory` no mira esa columna, así que la ficha mostraría «antes DTD-Z901» a un cliente cuyo código vigente es `DTD-Z901`. Se corrige en la consulta de la aplicación: fuera las filas restauradas y cualquier código igual al vigente. La búsqueda de las fases 1 y 2 ya descarta el código vigente; el portal tiene el mismo detalle y va en la SDD-0668.
- Mayúsculas: la función guarda el código nuevo en mayúsculas. Un código de vendedor que estaba en minúscula vuelve en mayúscula. La comparación ya no distingue, así que la carga sigue enlazando.
- **[inferencia]** Las guardas de aliados (0362, 0371) no deberían rechazar un código `DTD-…` con letras; falta probarlo con un caso.
- **[sin medir]** Cuántas fichas del legado se querrían devolver a su código de vendedor. Si son muchas, hacerlo una por una no escala y habría que hablar de un lote (que sería otra función: migración, con número y OK aparte).

### Qué código se ve — propuesta

Sam pidió poder elegir qué código se ve en la pantalla del cliente, en su portal y en las facturas.

**Propuesta: una sola regla. En todas partes se ve el código vigente, y el vigente se elige corrigiéndolo (Fase 4).** No un selector aparte por pantalla.

Por qué:

- **[verificado en código]** El Shipping Mark no es una referencia: es un texto copiado en más de treinta tablas, y las políticas del portal comparan ese texto con el código vivo del cliente. Mostrar en el portal un código distinto del que tienen sus embarques, facturas y pagos no es un cambio de etiqueta: o se muestra un código con el que nada coincide, o hay que tocar esas políticas.
- **[verificado en código]** La factura guarda su propia copia (`invoices.client_markbox`) y `rename_client_markbox` también la actualiza. Si el código «visible» fuera otro, la factura y la ficha dirían cosas distintas.
- Con una sola regla, elegir es editar: quien quiere que el cliente se vea como `DTD-Z901` lo cambia en la ficha, y ese código pasa a verse en la ficha, el portal, las facturas y los embarques, con el anterior en el historial y siempre buscable (fases 1 y 2).

Si Sam quiere de verdad dos códigos a la vez (uno «oficial» y otro «para mostrar»), eso sí pide migración: una columna con el código de presentación y decidir pantalla por pantalla cuál usa. No se propone; si se decide, se pide número al Director.

**Para decidir con Sam:** las facturas ya emitidas. Hoy un cambio de código reescribe también el código en esas facturas. Si un documento ya entregado no debe cambiar, hay que excluir las emitidas del cambio; eso toca la función (migración).

### Fase 5 — Filtros en la búsqueda de clientes

Sam habló de filtros «clientes / aliados / clientes viejos». Lo que ya hay, para no chocar:

- **[verificado en código]** La lista de Clientes filtra por nivel (`tier`), por «pendientes de revisar» (SDD-0046) y por texto (`ClientFilters` en `lib/studio/client-queries.ts`).
- **[verificado en docs]** SDD-0647 define los segmentos del CRM: Clientes (con prueba de carga), Leads y Leads con código. Viven en el tablero del CRM (`crm-tablero*.ts`, `CrmEmbudosClient.tsx`), que son de otra sesión. Su spec pide dejar la estructura lista para sumar filtros.
- **[verificado en código]** Los aliados tienen su módulo (0362) y cada cliente lleva `aliado_id`.
- No se encontró en specs ni handoffs otro filtro «clientes viejos» ya definido.

Propuesta, sin tocar el CRM:

- Un filtro **«Origen»** en la lista de Clientes y en la búsqueda del Studio, con tres opciones además de «Todos»:
  - **De la casa**: sin aliado y sin código de vendedor en su historia.
  - **De un aliado**: `aliado_id` presente.
  - **Del legado**: tiene o tuvo un código de vendedor. Es la misma definición que usa la base en `rename_legacy_markboxes` (0379); no se repite en JavaScript, porque esa copia ya se desincronizó una vez (ver `lib/studio/markbox-legacy-types.ts`).
- «Del legado» necesita leer el historial por cliente. Con la lista paginada, la forma segura es una función de la base que devuelva el origen de cada ficha: **migración**, con número del Director y OK de Sam. Sin migración se puede filtrar «De un aliado» ya, y aproximar «Del legado» por el rango `DTD-8xxx`, que dejaría fuera a los que se corrijan en la Fase 4.
- Palabras: hay que acordar con la sesión del CRM que «Clientes» allá (prueba de carga) y «De la casa» aquí no se confundan. Por eso el filtro se llama «Origen» y no «Tipo».

### Lo que ya está y no se toca

- Almacén CN y el cargador de consolidados ya resuelven el código viejo.
- `resolve_markbox`, `rename_client_markbox` y `rename_legacy_markboxes`: sin cambios en las fases 3 a 5.

### Notas de la revisión de la #677, para la PR siguiente

1. Excluir `DTD-0000` de la búsqueda por código anterior (antes de la Fase 3).
2. El modo `exacto` busca por fragmento con tope de 50 y sin orden: pasar a igualdad, o la URL vieja de un código corto puede dar 404.
3. En `client-search-action`, el resultado por cédula entra sin el código anterior y el descarte de repetidos pierde la marca; y el cliente del código viejo puede quedar fuera de los 8 primeros. Darle prioridad.
4. Pruebas que faltan: el subtítulo «antes …» en la búsqueda del Studio y la redirección de la ficha.
5. `/ui-check` del contador «+N» de la ficha.

## No entra

- Migraciones, columnas o índices nuevos en las fases 3 y 4. Lo que sí pediría migración está señalado en cada fase y no se escribe aquí: se pide número al Director y OK nominal de Sam.
- Cambiar permisos o el rol de alguien.
- Un lote para devolver muchas fichas a su código de vendedor.
- Cambios en el tablero del CRM (SDD-0647).
- El portal del cliente (SDD-0668).

## Preguntas para Sam

Respondidas el 2026-11-18 (por el Director):

- Sin dueño → `DTD-0000`: **automático**.
- ¿El cliente ve su código viejo en el portal?: **sí, informativo** (SDD-0668).
- Rango de los migrados: **`DTD-8xxx`, confirmado.** Los códigos viejos llevaban letras de vendedor después de «DTD-» y en la migración pasaron al 8.
- Cómo llega escrito el código viejo: **puede llegar sin el prefijo**, solo la letra y el número. La búsqueda ya lo acepta; el enlace automático de la fase 3 también debe aceptarlo, probando el texto con «DTD-» delante cuando no lo trae.

Abiertas:

1. **Qué código se ve:** ¿te sirve la regla única (se ve el vigente, y se elige corrigiéndolo en la ficha), o necesitas dos códigos a la vez?
2. **Facturas ya emitidas:** al corregir el código de un cliente, ¿sus facturas emitidas deben cambiar también, o quedarse con el código que tenían? Hoy cambian.
3. **¿Cuántos clientes hay que devolver a su código de vendedor?** Unos pocos (a mano, desde la ficha) o la mayoría (pediría un lote).
4. **Filtro «Origen» (de la casa / de un aliado / del legado):** ¿son esos los tres grupos que querías?

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

Para las fases 3 y 4, dos conteos más (misma regla: sin filas, nombres ni códigos):

```sql
-- ¿Existe la ficha comodín, viva y una sola?
select count(*) as fichas_comodin_vivas
from public.clients
where upper(btrim(markbox)) = 'DTD-0000' and deleted_at is null and merged_into_client_id is null;

-- Fichas 8xxx cuyo historial guarda un código de vendedor (candidatas a corregir).
select count(distinct c.id) as fichas_8xxx_con_codigo_de_vendedor
from public.clients c
join public.client_markbox_history h on h.client_id = c.id
where c.deleted_at is null and c.markbox ~ '^DTD-8\d{3}$' and h.markbox ~ '^DTD-[A-Za-z]';
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

Fases 1 y 2 (en main): criterios 1 a 3 y 5. Fase 3: criterios 4, 7 y 8. Fase 4: criterio 9.

1. Escribir un código retirado en la búsqueda del Studio, en la lista de Clientes o en «Asignar cliente» trae al cliente vigente, con la indicación «antes <código>».
2. Un texto con `%`, `_` o `*` no devuelve el historial entero.
3. La ficha muestra los códigos anteriores sin abrir ningún panel, y la URL con un código viejo lleva a la ficha vigente.
4. Crear un embarque o cargar un ítem con un código retirado guarda el código vigente y lo avisa.
5. El equipo que no ve nombres (SDD-0531) no recibe nada nuevo.
6. Las pruebas de SDD-0258, SDD-0645, SDD-0650 y SDD-0662 siguen pasando.
7. Crear un embarque con el Shipping Mark vacío o con un código de nadie lo guarda en `DTD-0000`, conserva en las notas lo escrito y lo avisa.
8. Un código retirado escrito sin «DTD-» también se resuelve al vigente.
9. Tras recuperar un código, la ficha no lo muestra como «anterior».
