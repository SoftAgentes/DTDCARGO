---
sdd: "0076"
title: "Configuración canónica de servicios"
status: done
author: "Sam + Claude Code"
created: 2026-06-13
updated: 2026-06-28
supersedes: null
superseded_by: null
related: ["0063", "0054", "0055", "0068", "0072", "0020"]
confidencialidad: interno
---

# DTD-0076 — Configuración canónica de servicios

> Una fuente de verdad por servicio (descripción, alcance, FAQ, precio, flujo, cobro, método de pago, adicionales, legal), editable en el ERP, que alimenta a la vez la web pública y la operación.

## Contexto

Hoy DTD tiene **dos catálogos de "servicio" desincronizados**:

| | Marketing / público | Operacional / ERP |
|---|---|---|
| Dónde | `lib/servicios-detalle.ts` (19 fichas) + `lib/design-tokens.ts` legacy (16) | enum `ShipmentService` en `lib/shared/shipment-public.ts` (**solo 4**) |
| Qué tiene | descripción, alcance, precio-texto | tarifa real (`rates`), orden de venta (`sales_orders`), factura (`invoices`), cobro (`payment_receipts`), gate legal AUT-04 |

El front muestra 19 servicios; solo 4–5 tienen precio/flujo/cobro reales atrás → el cliente se confunde. No existe una config central que una descripción ↔ alcance ↔ FAQ ↔ precio ↔ flujo ↔ **en qué parte se cobra** ↔ **método de pago** ↔ **adicionales** ↔ legal. Tres campos clave **no existen como dato** hoy: `momento_cobro`, `metodos_pago` por servicio y los **adicionales** (almacenaje, etc.) — viven solo como el label "Pagas al llegar".

**Decisión del founder (2026-06-13):** la Configuración de Servicios es **la Fase 1 del ERP**. Cada servicio se crea con un **asistente** que pregunta por bloques y **NO permite crear/publicar con solo la parte contable** (evita problemas legales y FAQ poco claras). Cada servicio tiene **doble capa** (público que ve el cliente + interno del equipo), **FAQ públicas e internas**, **historial de precios**, **posición en el timeline**, **adicionales modulares** y un **flag de publicación** que el founder controla. Atar el corpus a la IA (ANTHROPIC_API_KEY ya existente, runtime SDD-0020) = fase posterior; acá solo se deja el gancho.

Extiende **SDD-0063** (servicios-detalle público, front-only) elevándolo a modelo canónico front+back+legal.

## Alcance

> **Estado 2026-06-28 (verificado): Fases 1-3 LIVE en prod → spec `done`.** Migr `0130`
> creó las 4 tablas + RPCs públicas (`public_servicios()`/`public_service_faqs()`, anon,
> security definer, whitelist); `/studio/servicios` + `lib/studio/service-catalog/` existen;
> `app/servicios/page.tsx:53` ya lee `getServiciosParaSitio()` (merge DB+estático con fallback)
> vía `lib/public/servicios-queries.ts`. **Fase 4 (gancho IA) = roadmap futuro** (su propia spec
> cuando se haga · no bloquea el cierre del core).

Cuatro fases. **Fases 1-3 entregadas; Fase 4 diferida.**

- **Fase 1 (esta rama `feat/configuracion-servicios`):** catálogo de claves + estructura en código (`lib/shared/service-catalog.ts`) + tests de reconciliación + esta spec. Sin DB, sin tocar el sitio live.
- **Fase 2:** migración (`service_configs` + `service_faqs` + `service_addons` + `service_price_history`) + módulo `/studio/servicios` con asistente + seed del contenido grounded. El sitio sigue leyendo el estático.
- **Fase 3:** RPCs públicas + `lib/public/servicios-queries.ts` + reescribir `app/servicios/page.tsx` (merge código+DB con fallback) + QA. Recién aquí se retira `servicios-detalle.ts`.
- **Fase 4:** gancho IA (corpus público+interno como grounding read-only).

## Diseño

### Modelo en 3 capas

```
CÓDIGO  lib/shared/service-catalog.ts   →  claves canónicas (id), tipo núcleo/addon, grupo, sede,
                                            momento_timeline, mapeo→ShipmentService. Estable, typesafe, AMBOS lados.
   │ unidos por id (FK lógica, sin constraint)
DB ERP  service_configs + service_faqs   →  CONTENIDO editable público+interno: descripción/alcance/precio/
        + service_addons + price_history    cobro/adicionales/condiciones + FAQ pública/interna + historial +
                                            flag publicado. Editable en /studio/servicios vía asistente, SIN deploy.
   │ RPC public_servicios() / public_service_faqs()  (whitelist de columnas — la capa interna NUNCA sale)
SITIO   app/servicios + lib/public/...    →  consume SOLO lo publicado; fallback al estático si la RPC cae.
```

**Por qué estructura en código + contenido en DB:** la identidad estructural (qué servicios existen, su clasificación, el mapeo operacional) es clave canónica compartida y cambiarla implica deploy igual (un add-on que pasa a núcleo necesita tarifa/OV/factura). El contenido (descripción, FAQ, precio, cobro) es justo lo que el founder quiere editar sin deploy → DB. El puente es `service_key` = `id`.

### Estructura canónica de la ficha (front / back / legal)

| Campo | Capa | Notas |
|---|---|---|
| `id` · `nombre` · `grupo` · `tipo` (núcleo/add-on) · `principal` · `sede` · `activo` | back/público | identidad y clasificación (en código) |
| `momento_timeline` (`todo_recorrido`·`origen`·`recepcion_bodega`·`transporte_aduana`·`transversal`) | público+back | dónde entra en el flujo (en código) |
| `descripcion_corta` · `que_incluye[]` · `que_no_incluye[]` · `como_se_solicita` · `tiempo_estimado` | público | alcance ("hasta dónde llega"); **nunca** la palabra "responsabilidad" |
| `como_se_cobra` + `tabla_precios?` | público | modelo de precio texto + tabla (ej. comisiones de compra asistida) |
| `momento_cobro` (`prepago`·`contra_entrega`·`por_hito`·`a_cotizar`) · `metodos_pago[]` | back+legal | en qué parte se cobra + métodos (enum de SDD-0068) |
| `adicionales[]` (nombre·condición·tarifa·política) | back+público+legal | ADS modulares (almacenaje, entrega fuera de casco) |
| `condiciones_politicas` | legal | T&C base + cláusulas de los adicionales aplicables |
| `historial_precios` | back | núcleo ya en `rates`; add-ons → `service_price_history` |
| `mapeo_contable` | back | categoría de ingreso (a dónde va contablemente) |
| `shipment_service?` | back | enum operacional, **solo núcleo** |
| `faq_publicas[]` + `faq_internas[]` | público / interno | tabla hija `service_faqs` (`audience` + `is_public`) |
| `notas_internas` · `precio_ref_interno` (no se publica) | interno | nunca sale al sitio |
| `doc_legal?` (`tyc`/`operador`) + `gate` (AUT-04) | legal | se liga por servicio |
| `publicado` | back | el founder marca qué sale al sitio |

> Regla de oro (heredada de 0063): **NO INVENTAR**. Campos sin dato = vacíos, no se renderizan ni se inventan. `momento_cobro`, `metodos_pago`, `adicionales` se seedean vacíos (no existen hoy); el founder los llena en el Studio.

### Catálogo final = 20 servicios + adicionales

Los 19 de `servicios-detalle.ts` + **Cursos de importación** (nuevo). Limpieza:
- **Seguro de carga** → fuera por ahora (no hay aseguradora); entrará como **adicional**, no como servicio.
- **Almacenaje / bodegaje** → no es servicio → **adicional (ADS)**: cargo por día tras los días gratis + cláusula en condiciones del servicio padre (ej. FCL Consolidado en bodega).
- **Cursos de importación** → servicio nuevo (formativo), atado al curso Alibaba en otra ventana → ficha reservada (`proximamente`), contenido lo define esa ventana.
- **Last mile** → no es ficha propia → = **Transporte terrestre** (la entrega final va incluida en DDP hasta el casco; fuera del casco / standalone = transporte terrestre). El legacy `last-mile` se mapea vía `LEGACY_SLUG_ALIASES`.
- **registro-marca-coord** → duplicado, fusionado en `registro-marca-cn` (sede "ambas").

### Reconciliación de ids ↔ núcleo ↔ enum (el corazón)

> **Landmine:** `id → shipment_service` es **N:1, no 1:1**: `fcl-bodega` y `fcl-directo` comparten `reserva_FCL`. Hay **5 núcleo**, 4 valores de enum.

| `id` | legacy slug | tipo | `shipment_service` | `momento_timeline` |
|---|---|---|---|---|
| puerta-a-puerta-ddp ⭐ | dtd-services-lcl | núcleo | `puerta_a_puerta_DDP` | todo_recorrido |
| lcl-consolidado | lcl-consolidado | núcleo | `consolidacion` | transporte_aduana |
| fcl-bodega | consolidacion-bodega-yiwu | núcleo | `reserva_FCL` | recepcion_bodega |
| fcl-directo | reserva-contenedores | núcleo | `reserva_FCL` ← comparte | transporte_aduana |
| transporte-terrestre (absorbe `last-mile`) | transporte-terrestre | núcleo | `transporte_terrestre` | transporte_aduana |
| transito-aduana · documentos-importacion | (igual) | add-on | `null` | transporte_aduana |
| revision-recepcion · etiquetado-piezas · reempaque-defectuosas | (igual) | add-on | `null` | recepcion_bodega |
| inspeccion-calidad (`chequeo-etiquetado`) · verificacion-proveedores · auditoria-calidad · lab-permisologia · compra-asistida · asesoria-pagos | (igual) | add-on | `null` | origen |
| muestras-courier | (igual) | add-on | `null` | transversal |
| visado-chino · registro-marca-cn (absorbe `registro-marca-coord`) | (igual) | add-on | `null` | transversal |
| cursos-importacion (nuevo, dep. otra ventana) | — | add-on | `null` | transversal |

### Adicionales (ADS) + políticas por servicio

Un servicio puede tener **adicionales modulares**: nombre + condición ("tras 7 días gratis en bodega") + tarifa ("$X/CBM/día") + **texto de política** que se inyecta en "Políticas y condiciones" del servicio padre. Ejemplos: Almacenaje/bodegaje (FCL bodega y otros), Entrega fuera del casco (DDP), y a futuro Seguro de carga.

### Asistente de creación (Fase 2) — guardrail anti "solo contable"

Crear un servicio en `/studio/servicios` corre un asistente por bloques; `validateServicioConfigInput()` **bloquea terminar/publicar con solo lo contable**:
1. Base: nombre · grupo · tipo · sede · `momento_timeline`.
2. Descripción y alcance: `descripcion_corta` · `que_incluye` / `que_no_incluye`.
3. Cómo se cobra: `como_se_cobra` · `momento_cobro` · `metodos_pago` → inicia `historial_precios`.
4. Adicionales: cargos modulares + su política.
5. FAQ: públicas + internas.
6. Contable + legal: `mapeo_contable` · `doc_legal`/`gate` · `condiciones_politicas`.
7. Publicar: toggle `publicado` (deshabilitado si falta lo descriptivo).

### Modelo de datos (DDL de referencia — se materializa en Fase 2)

Singleton por `(tenant_id, id)`, RLS por tenant, soft-delete. Patrón espejo de `calculator_settings` (0103) + `rates.is_public` / `public_cbm_rate` (0101). **service_role no requiere grant manual** (cerrado por `0033` default privileges); lo crítico es el `revoke from anon` para que la capa interna sea inalcanzable salvo por la RPC con whitelist.

```sql
-- service_configs (contenido editable público+interno). PK (tenant_id, id). RLS por tenant.
--   capa PÚBLICA: title_public, description_public, includes_public[], excludes_public[],
--                 price_text, price_table jsonb, how_to_request, timelines_public, note_public,
--                 charge_moment (enum), payment_methods (enum[]), mapeo_contable, condiciones_politicas
--   capa INTERNA: notes_internal, internal_price_ref
--   control:      shipment_service (nullable, solo núcleo), is_public bool, service_state, soft-delete
--   revoke all on service_configs from anon;   -- anon SOLO via RPC

-- service_addons: id_servicio, nombre, condicion, tarifa, politica_texto, aplica_a[], is_public
-- service_faqs:   id_servicio, pregunta, respuesta, audience('public'|'internal'), is_public, sort_order
--                 CHECK (audience='public' OR is_public=false)   -- una FAQ interna nunca se publica
-- service_price_history: id_servicio, monto/condicion, moneda, valid_from, nota, created_by  (núcleo ya en `rates`)

-- RPCs public_servicios() / public_service_faqs(): security definer, search_path=public,
--   whitelist de columnas (NO proyecta notes_internal/internal_price_ref), filtro
--   is_public=true AND tenant='dtd'; revoke from public + grant to anon.  (patrón public_cbm_rate)
```

Enums nuevos: `charge_moment` (`prepago`·`contra_entrega`·`por_hito`·`a_cotizar`), `payment_method` (`efectivo`·`transferencia`·`zelle`·`pago_movil`·`usdt` — reusa los de SDD-0068). El número de migración se confirma al ejecutar Fase 2 (`0130` libre al 2026-06-13).

## Lo entregado en Fase 1 (esta rama)

- `lib/shared/service-catalog.ts` — tipos (`ServicioId`, `ServicioTipo`, `ServicioGrupo`, `ServicioSede`, `MomentoTimeline`, `ServicioEstado`, `ServiceCatalogEntry`) + `SERVICE_CATALOG` (20) + `SERVICE_CATALOG_BY_ID` + `SERVICE_GROUPS` + `LEGACY_SLUG_ALIASES` + `NUCLEO_SERVICES` + `serviceIdsForShipment()`.
- `lib/shared/__tests__/service-catalog.test.ts` — reconciliación: 20 entradas, 5 núcleo → enum válido, add-ons → null, los 4 enums cubiertos, `reserva_FCL` N:1, los 19 slugs de `servicios-detalle.ts` reconciliados, aliases fusionados consistentes.
- Esta spec.

**No** en Fase 1: migración, tocar `app/servicios/page.tsx` ni `servicios-detalle.ts`, ni UI Studio.

## Inconsistencias detectadas (deuda — corregir en Fase 2/3, no acá)

- `transporte-terrestre` aparece "próximamente" en `/servicios` pero su calculadora está **live**.
- `/estimacion` y `/calculadora` no avisan que son **solo DDP/LCL** (FCL requiere asesor).
- **"Financiamiento 100%"** residual en `app/brochure/page.tsx` + FAQ aunque la regla de marca lo retiró; contradicción "pagas pocos días antes de la entrega" vs Acuerdo/FAQ "contra entrega". Copy correcto = "Pagas al llegar".
- `registro-marca` slug desalineado y `last-mile` huérfano en `design-tokens` → ambos reconciliados vía `LEGACY_SLUG_ALIASES`.

## Dependencias cross-ventana

- **Cursos de importación** ↔ ventana del curso Alibaba: ficha `cursos-importacion` reservada (`proximamente`); el contenido/precio lo define esa ventana. Coordinar antes de publicar.

## Verificación

- Fase 1: `node scripts/verify.mjs` (lint → rsc-boundary → typecheck → test → docs:check) en verde. Los tests de reconciliación (`lib/shared/__tests__/service-catalog.test.ts`) cubren la integridad del catálogo y el empate con `servicios-detalle.ts`.
- Fase 2+: tests de `validateServicioConfigInput()` (guardrail), del seed (todo `service_key` en DB ∈ `SERVICE_CATALOG`), y de la RPC pública (no proyecta columnas internas).

## Adjuntos

Sin adjuntos por ahora. El DDL completo y el diseño de la UI del asistente se detallan al abrir Fase 2.
