---
sdd: "0090"
title: "Motor de oferta al cliente — wizard de intención + matriz de cruce configurable + modo de cobro"
status: done
author: "Claude Code (ventana motor-oferta) + founder"
created: 2026-06-16
updated: 2026-07-14
supersedes: null
superseded_by: null
related: ["0076", "0061", "0063"]
confidencialidad: interno
---

# SDD-0090 — Motor de oferta al cliente

> Dado lo que el cliente pide, decidir **qué núcleo va**, **qué add-ons se le cruzan** y **cómo se
> cobra cada uno** — y que la oferta aceptada **dispare el flujo interno** (SDD-0076, pista N8N).

## Contexto

La **clasificación** de servicios ya está cerrada y viva: 20 servicios en `lib/shared/service-catalog.ts`
(5 núcleo + 15 add-on), con la taxonomía de marketing de 5 niveles, mapeo `ShipmentService` (4 productos
comerciales) y la entrevista del founder en `docs/specs/0063-servicios-detalle-publico/assets/entrevista-servicios.md`.
El **contenido** editable vive en `service_configs` (+ `service_faqs`, `service_addons`, `service_price_history`;
SDD-0076 Fase 2, migr 0130).

Lo que **NO existe** es la *lógica de armado de oferta*: hoy `/servicios` **presenta** los servicios y
`/calculadora` da un estimado de CBM, pero no hay un cerebro que, partiendo de la intención del cliente,
arme una propuesta (núcleo + add-ons cruzados + cómo se cobra). Es la cara comercial que falta para cerrar
el loop con el motor de flujo interno (SDD-0076 / N8N), que consume la oferta como disparador.

**Las 3 capas de clasificación que esta spec asume cerradas** (no las re-litiga):
1. *por dos* — cada servicio es **núcleo** (mueve embarque: tarifa/OV/factura/cobro) o **add-on** (suelto).
2. *ads vs principales* — dentro de núcleo, **DDP = principal/insignia** (~90% de ventas); los 15 add-on cuelgan del viaje.
3. *cuatro* — los 5 núcleo colapsan a **4 productos comerciales** (`ShipmentService`; FCL Bodega + FCL Fábrica = `reserva_FCL`).

## Alcance

**Dentro:**
- **Pieza 1 — Wizard de intención** ("¿Qué necesitas?"): 4 intenciones → ruteo a modo (embarque / origen / suelto / estimar).
- **Pieza 2 — Matriz de cruce CONFIGURABLE en Studio** (decisión founder 2026-06-16): qué add-on se sugiere
  con qué núcleo, editable sin deploy. Columnas nuevas en `service_configs` (migr 0142).
- **Pieza 3 — Modo de cobro** por servicio, determinístico para la UI de oferta (calculadora / tabla comisión /
  valorización / asesor / honorarios). Reusa `price_table`, `charge_moment`, `internal_price_ref` existentes.
- Render de la oferta armada (lista de núcleo + add-ons sugeridos + cómo se cobra cada uno) y CTA (WhatsApp / registro / calculadora).

**Fuera (out of scope):**
- El **motor de flujo interno / N8N** (SDD-0076 FASE-FUTURA) — esta spec lo **dispara**, no lo implementa. La
  oferta aceptada emite un `fireWorkflowEvent` (`oferta_aceptada`) que el motor consume; ese motor es trabajo aparte.
- Cobro real / pasarela de pago / factura (vive en el bloque financiero y `ShipmentService`).
- Cambiar la presentación de `/servicios` (SDD-0063 / explorer) más allá de enchufarle el wizard.
- Definir precios faltantes (mini-servicios bodega, asesoría pagos, courier, visado, marca) — son **datos**, no esta spec.

## Diseño

### Pieza 1 — Wizard de intención
Capa liviana (cliente) sobre `/servicios` o `/cotizar`. Cuatro intenciones → modo:

| Intención del cliente | Modo | Resultado |
|---|---|---|
| "Traer carga de China" | `embarque` | elegir núcleo → cruzar add-ons (Pieza 2) |
| "Conseguir / revisar un proveedor" | `origen` | compra asistida · verificación · inspección |
| "Un trámite puntual" | `suelto` | visado · marca · courier (sin embarque) |
| "¿Cuánto cuesta?" | `estimar` | `/calculadora` (ya live) |

Default del modo `embarque` = **DDP** (principal). El wizard NO inventa: las opciones salen del catálogo
filtrado por `momento`/`sede`/`tipo`.

### Pieza 2 — Matriz de cruce (el corazón), CONFIGURABLE en Studio
Modelo: dos columnas estructuradas nuevas en `service_configs` que expresan el grafo de oferta entre servicios
(distinto de `service_addons`, que son recargos *dentro* de un servicio — almacenaje, fuera de casco):

- `suggests_keys text[]` — service_keys de otros servicios a **cruzar/ofrecer** cuando este es el núcleo elegido.
- `includes_keys text[]` — service_keys ya **plegados** en este servicio (NO se ofrecen; ej. DDP incluye aduana).

La matriz inicial (seed por el founder en Studio, no hardcode) refleja las reglas dictadas:

| Add-on | DDP ⭐ | LCL | FCL Bodega | FCL Fábrica | Suelto |
|---|---|---|---|---|---|
| Aduana / desaduanaje | incluido | ⊕ | ⊕ | ⊕ | — |
| Revisión · Etiquetado · Reempaque (bodega) | ⊕ | ⊕ | ⊕ | ✕ (no pasa por bodega DTD) | — |
| Inspección (umbrella 4) | ⊕ | ⊕ | ⊕ | ⊕ | ✅ |
| Compra asistida · Asesoría pagos · Courier | ⊕ | ⊕ | ⊕ | ⊕ | ✅ |
| Visado · Registro de marca | transversal (se ofrecen siempre) | | | | ✅ |
| Seguro · entrega fuera de casco | ⊕ recargo | ⊕ | ⊕ | ⊕ | — |

Regla derivable que documenta el seed (no es lógica hardcodeada, es la guía de quien configura):
**origen + inspección aplican a todo · bodega NO aplica a FCL Fábrica (no pasa por bodega DTD) · aduana se
ofrece solo donde NO va incluida (todos menos DDP).**

### Pieza 3 — Modo de cobro
Columna nueva `charge_mode text` en `service_configs` (check), para que la UI de oferta sepa cómo presentar el precio:

| `charge_mode` | Servicios | Fuente del precio |
|---|---|---|
| `calculadora` | DDP | RPC de calculadora (CBM, mín. 10 CBM) — ya live |
| `tabla_comision` | Compra asistida | `price_table` (regresiva, B = mitad de A, mín $50) — ya cargada |
| `valorizacion` | Aduana | valorización de factura, cliente paga planillas directo |
| `asesor` | LCL · FCL · Inspección · mini-bodega | stand-by, lo cierra el asesor |
| `honorarios` | Visado · Marca | honorarios + tasas oficiales |

### Conexión con N8N (fuera de alcance, pero es el porqué)
La oferta aceptada → `fireWorkflowEvent('oferta_aceptada', { servicios })` (gemelo de `fireMailEvent`,
SDD-0076). El motor de flujo interno arranca los pasos del/los servicio(s). Esta spec deja **el disparador y
el payload**; los pasos los define SDD-0076.

## Migración 0142 (descrita, NO aplicada — la aplica coordinación)

`supabase/migrations/0142_service_offer_matrix.sql` — idempotente, sobre `service_configs`:
- `add column if not exists suggests_keys text[] not null default '{}'`
- `add column if not exists includes_keys text[] not null default '{}'`
- `add column if not exists charge_mode text` + `check (charge_mode is null or charge_mode in
  ('calculadora','tabla_comision','valorizacion','asesor','honorarios'))`
- Sin RPC nueva en esta migración (las columnas las proyecta la RPC pública vía whitelist explícita, patrón 0130 —
  ojo: `suggests_keys`/`includes_keys` SÍ son públicas para armar la oferta; `charge_mode` puede ser pública).
- **Skills Supabase (seguridad + postgres-best-practices) invocados antes de tocar schema.** No hay función nueva
  con `EXECUTE` que blindar en esta migración; si se agrega RPC en implementación → `revoke execute … from public, anon`.

## Decisiones del founder (2026-06-16)
- Clasificación de 3 capas + 20 servicios = **confirmada**.
- Matriz de cruce = **configurable en Studio** (no regla fija en código).
- Arrancar por **oferta al cliente** (esta spec) antes que el motor N8N.

## Pendientes (datos, no diseño)
- Precio/condición de: **mini-servicios de bodega** (¿publicable o asesor?) · **asesoría de pagos** · **courier de
  muestras** · **visado** · **registro de marca**. Son `charge_mode='asesor'/'honorarios'` hasta que el founder dicte.
- Seed real de `suggests_keys`/`includes_keys` por tenant (lo carga el founder en Studio tras migrar).

## Adjuntos
La matriz completa y el catálogo de 20 viven en `lib/shared/service-catalog.ts` + la entrevista
`docs/specs/0063-servicios-detalle-publico/assets/entrevista-servicios.md`. Sin binarios.
