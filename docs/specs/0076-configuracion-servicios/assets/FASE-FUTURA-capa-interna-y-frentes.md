# FASE FUTURA — Capa interna ampliada + frentes operativos

> Extensión de **SDD-0076** (que ya está LIVE: catálogo + módulo `/studio/servicios` + sitio sirviendo desde DB + 19 servicios publicados). Este doc es **diseño, NO implementado** — para abrir como fase posterior, idealmente **después de recoger el homework del equipo** de la reunión R-001 (que llena el contenido operativo real).
>
> **Fecha:** 2026-06-14 · **Origen:** reunión R-001 (el founder pidió qué info interna debe tener cada servicio + cómo organizar el equipo) + 2 análisis (service blueprinting + organización). **Migración futura libre: `0134`** (0130 service_configs, 0131 contabilidad, 0132 expense, 0133 cierre — tomadas).

## Veredicto de la reunión (lo importante)

**NO se reestructura el catálogo público.** Los 5 grupos (Transporte/Bodega/Origen/Trámites/Formación), cortados por el **viaje de la carga**, le sirven al cliente y a la web. La "reestructuración" real es **interna** y ortogonal: dos ejes nuevos que conviven con los 5 grupos —

1. **Frente operativo** (sede + dueño) — quién ejecuta de verdad.
2. **`fulfillment_mode`** — "lo hago yo" vs "lo subcontrato y le pongo margen".

Ambos ya están medio soportados por el modelo (el campo `sede` de `service-catalog.ts`; las tablas `suppliers`/`carriers`/`partner_ledger_entries`). Falta tender el puente.

## 1. Frentes operativos (organización del equipo)

El catálogo se corta por etapa; el equipo trabaja por **sede + función**. 4 frentes, 4 dueños comprimen los 20 servicios:

| Frente (interno) | Dueño | Backup | Cubre |
|---|---|---|---|
| **Origen · CN** | José | Javier | inspección, verif. proveedores, auditoría, lab, compra asistida, asesoría pagos, muestras courier (7) |
| **Bodega/físico · CN** | Javier | José | revisión, etiquetado, reempaque + FCL bodega + FCL directo |
| **Transporte/Aduana · VE** | Alberto | Javier | DDP, LCL, terrestre, tránsito aduana, docs importación + **tarifas de los núcleo** |
| **Trámites & Formación** | Yoli (+ Iris) | Alberto | visado, registro marca, cursos + **el contrato con los terceros** |

- **DDP cruza los 4 frentes** → Alberto = "director de ruta DDP" (hoy nadie es dueño de la costura entre frentes).
- **Choques detectados:** (A) "Transporte" se ejecuta en 2 sedes con 2 dueños; (B) Javier toca 3 grupos (lo físico en ambas bodegas = un frente, no 3); (C) "Origen" (7 servicios) recae casi entero en José.
- **Riesgos top:** José = bus factor (7/20 servicios, conocimiento tácito) → su homework va **primero**. Yoli = cobranza sin respaldo + con DDP "pagas al llegar" el cash-flow es frágil → darle backup. White-label (lab, compra-asistida, asesoría-pagos, cursos) sin dueño interno → gestionar por **SLA del proveedor**, no por ejecutor.
- Debe caber en los 6 roles que el ERP ya enforza (SDD-0024: `commercial/operations/accounting/warehouse/support`): José/Javier = operations+warehouse, Alberto = commercial, Yoli = accounting.

## 2. Capa interna ampliada (campos a sumar a `service_configs`)

Hoy la capa interna tiene 3 campos (`notes_internal`, `internal_price_ref`, `mapeo_contable`). Insuficiente. Agregar (todos internos, **NUNCA** en la whitelist de `public_servicios()`):

| Bloque | Campos |
|---|---|
| **Fulfillment** | `fulfillment_mode` (in_house/tercero/hibrido) · `fulfiller_supplier_id` → `suppliers(id)` (`type='servicio'`) · `fulfiller_carrier_id` → `carriers(id)` (flete) · `auto_request` bool · `auto_request_channel` (email/whatsapp/api/manual) · `auto_request_template` |
| **Costo/margen** (lo define dirección) | `cost_basis_internal` + `cost_unit` · `cost_currency` · `markup_type` (porcentaje/monto/spread/passthrough) · `markup_value` · `margin_floor_pct` · `ledger_entry_type` → `partner_ledger_entries.entry_type` · `fund_class` (local_revenue/third_party, reusa `deriveFundClass()`) |
| **Operación** (lo sabe el equipo) | `owner_role` · `sla_internal_hours` (≠ el público) · `depends_on` text[] · `triggers` text[] (ej. compra-asistida dispara verificacion-proveedores) |
| **Reglas/riesgo** | `business_rules_internal` · `requires_client_docs` (carta poder, RIF, ficha técnica) · `risk_level` + `risk_notes` (ej. asesoría-pagos = compliance) |

Reusa lo existente: `suppliers` (0088), `carriers` (0096), `partner_ledger_entries` (0114), `deriveFundClass()` (payment-types).

## 3. Patrón "servicio atado a un tercero con auto-solicitud"

```
Cliente pide servicio X → se agrega como línea a su orden (quotes/sales_orders)
   → ¿service_configs.auto_request = true?  (sí)
      → el sistema CREA una tarea "Solicitar X a <tercero>" (asignada a owner_role)
        + genera BORRADOR del mensaje (auto_request_template, con datos del embarque)
        + registra el costo esperado en partner_ledger_entries (ledger_entry_type, fulfiller_supplier_id)
   → un HUMANO revisa y confirma el envío   ← NUNCA se auto-envía dinero ni correo
   → el tercero ejecuta → reporte/resultado se adjunta al embarque
```

- **"Auto" = el sistema lo prepara y lo recuerda, no lo manda solo.** Mover plata o pedir a terceros sin revisión humana queda fuera.
- **Margen:** `precio_cliente = cost_basis × markup`. El costo del tercero se asienta contra `fulfiller_supplier_id`; el ingreso se clasifica con `fund_class`. El cliente solo ve `price_text` público; `markup_value`/`cost_basis_internal` nunca salen.
- Casos: `passthrough` (planillas de aduana que paga el cliente directo) · `spread` (courier de muestras = DHL + spread).

## 4. Reclasificaciones internas (NO tocan el catálogo público)

- `documentos-importacion` → componente `in_house` de `transito-aduana`, no vendible standalone.
- Línea de origen (`inspeccion`, `verificacion`, `auditoria`, `lab`) → **tercero + markup** (orquestación, no trabajo propio). `auditoria`/`lab` son los más "cascarón sobre tercero".
- `transito-aduana` → tercero (agente aduanal) + `passthrough` de impuestos.
- `muestras-courier` → `passthrough/spread` sobre DHL/UPS/FedEx.
- Núcleo `fcl-*`/`lcl` → fulfiller = `carriers` (naviera); flete = `fund_class=third_party` (de la Operadora, NO ingreso propio de DTD Services — distinción que `deriveFundClass()` ya codifica).
- `asesoria-pagos` → `in_house` pero `risk_level=alto` (mueve fondos a China, compliance).
- `compra-asistida` → `triggers: [verificacion-proveedores]` (la ficha pública ya promete "verificación incluida").

> El `tipo` núcleo/add-on NO cambia (es estructural, en código). `fulfillment_mode` es el eje **nuevo** que el founder pidió.

## 5. Plan de migración futura (`0134`)

- `supabase/migrations/0134_service_configs_internal.sql`: `alter table service_configs add column …` (los campos del §2) + enums (`fulfillment_mode`, `markup_type`) + FKs a `suppliers`/`carriers`. **NO** agregar los campos nuevos a la whitelist de `public_servicios()`. Las tablas ya tienen `revoke … from anon` (0130).
- `lib/studio/service-catalog/types.ts`: extender `ServiceConfig`/`ServicioConfigInput` + **guardrail nuevo** en `validateServicioConfigInput()`: no permitir `fulfillment_mode='tercero'` + `auto_request=true` sin `fulfiller_supplier_id`.
- `lib/shared/service-catalog.ts`: opcional, agregar el eje `frente`/`owner_role` por servicio (la org vive en el dato).
- UI: pestaña "Interno/Fulfillment" en el `ServicioDrawer` (ya tiene tabs).
- Confirmar el número `0134` con `git fetch` + todas las ramas al implementar (las colisiones pasan).

## 6. Qué pedir al equipo (R-001) vs qué define dirección

- **Equipo (operativo, lo sabe quien ejecuta):** ¿quién lo hace de verdad (nosotros o un tercero, cuál)? ¿cómo se lo pides hoy al tercero? ¿cuánto tarda real? ¿qué le pides al cliente para arrancar? ¿qué suele salir mal? ¿pedir A siempre arrastra B?
- **Dirección (NO el equipo):** precio/markup/margen, qué se publica, mapeo contable + fund_class, política legal, qué terceros son "oficiales".

> Espejo del guardrail de SDD-0076 ("no publicar con solo lo contable"): **no marcar un servicio como tercero+auto_request sin declarar el fulfiller.**
