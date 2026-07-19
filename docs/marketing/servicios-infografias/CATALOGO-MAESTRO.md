# Catálogo maestro de servicios DTD — reconciliado con el código

Fuente única de la lista completa de servicios, para infografías + Cloud Design. **Anclado al código:**
`lib/shared/service-catalog.ts` (20 servicios canónicos, SDD-0076) + fichas públicas
`lib/servicios-detalle.ts` (SDD-0063) + add-ons del portal `prealerta_addons` (SDD-0098).

> **Regla:** NO inventar servicios nuevos ni renombrar los `id` canónicos. Las infografías reusan estos
> datos; el copy editable vive en las fichas y en la config del ERP (`service_configs`).

> **Trabajo previo (NO empezar de cero):** el modelo completo de servicios lo dictó el founder el
> 2026-06-09 en **`docs/specs/0063-servicios-detalle-publico/assets/entrevista-servicios.md`** — incluye
> la familia "Inspección" (4 sub-servicios), el modelo white-label (terceros V-Trust/QIMA/SGS/CIS/
> WEINSPECTION/HQTS, nunca públicos; reporte DTD-branded), compra asistida con tabla de comisión, etc.
> Página dedicada: `app/servicios/inspeccion/`. Módulo de reportes ERP: SDD-0066 (`done`). Lo NO
> versionado (a propósito): precios scrapeados de las inspectoras + correos (confidencial, cost-plus).

> **Estado:** borrador · 2026-07-18.

---

## Los 3 principales (entrada del portal — lo que se ofrece primero)

| # | Servicio | id canónico | Qué es | Construido |
|---|---|---|---|---|
| 1 | **Puerta a Puerta** (DDP, todo pagado) | `puerta-a-puerta-ddp` | Marítimo hasta tu puerta, nosotros nacionalizamos. *Insignia.* | ✅ núcleo (`puerta_a_puerta_DDP`) |
| 2 | **LCL Consolidado** (hasta puerto, BL propio) | `lcl-consolidado` | Carga compartida; para empresas que legalizan a su nombre. | ✅ núcleo (`consolidacion`, SDD-0047) |
| 3 | **FCL — Full Container** (2 modalidades) | `fcl-bodega` + `fcl-directo` | (a) consolidas en nuestra bodega de muchos proveedores; (b) compras directo y nosotros ponemos el contenedor con **BL a nuestro nombre** (seguridad anti-desvío). | ✅ núcleo (`reserva_FCL`, SDD-0047 + calculadora-fcl) |

---

## Catálogo completo (20 canónicos, por grupo del código)

Estado: `activo` · `proximamente` · `a-pedido` · `suspendido`. "Construido" = si tiene módulo/flujo ERP.

### Grupo 1 · Transporte (de China a tu puerta)
| id | Nombre | Sede | Estado | Construido / dónde |
|---|---|---|---|---|
| `puerta-a-puerta-ddp` | Puerta a puerta DDP ⭐principal | ambas | activo | ✅ núcleo · naviera SDD-0047 |
| `lcl-consolidado` | LCL Consolidado (BL propio) | ambas | activo | ✅ núcleo |
| `fcl-bodega` | FCL Consolidado en bodega | cn | activo | ✅ núcleo |
| `fcl-directo` | FCL Directo fábrica | cn | activo | ✅ núcleo |
| `transporte-terrestre` | Transporte terrestre nacional (VE) | ve | **proximamente** | ⚙️ calculadora (SDD-0002) + TMS interno (SDD-0019) listos; comercial al cliente aún `proximamente` |
| `transito-aduana` | Tránsito de aduana y desaduanaje | ve | activo | ✅ módulo SENIAT (SDD-0018). Incluido en DDP **y FCL** (founder 19-jul, supera el dictado 06-09); add-on solo en LCL |
| `documentos-importacion` | **Documentos de importación — FUSIONADO dentro de `transito-aduana`** (founder 19-jul): sin tarjeta pública, sin pieza propia; la gestión documental es un "incluye" de la ficha de aduana. El id queda solo para config ERP/contabilidad | ve | activo | fila `service_configs` (despublicar `is_public`) |

### Grupo 2 · En bodega (Yiwu): revisión y preparación → **servicios de la llegada**
| id | Nombre | Sede | Estado | Construido / dónde |
|---|---|---|---|---|
| `revision-recepcion` | Revisión de mercancía al recibir (= **Validación**/conteo) | cn | activo | ✅ add-on portal (SDD-0098 `verificacion`) |
| `etiquetado-piezas` | **Etiquetado de piezas** (nombre ratificado founder 18/19-jul; el id técnico no cambia). Servicio COMERCIAL: código de barras del cliente o etiqueta física por pieza — NO es el Shipping Mark de las cajas | cn | activo | ✅ add-on portal (SDD-0098 `etiquetado_pieza`) |
| `reempaque-defectuosas` | **Re-Empaque** (REDEFINIDO founder 18-jul: unificar compras pequeñas de Alibaba en un solo packing list; el id técnico NO se renombra) | cn | activo | ✅ add-on portal (SDD-0098 `reempaque_unificar`) |

> ⚠️ **HOLD y Bodegaje extra NO están en el catálogo público (20)** — viven solo como add-ons del portal
> (`prealerta_addons`: `hold_consolidar`). Al reconciliar, hay que decidir si **HOLD sube al catálogo
> público** o se queda como servicio interno de la pre-alerta. También existe `inspeccion_recepcion`
> (inspección de calidad AL RECIBIR en bodega) que es **distinta** de la inspección en fábrica de abajo
> (regla del founder: son dos servicios).

### Grupo 3 · Calidad y proveedores en origen (China) → **"Verificación e inspección de fábricas"**
| id | Nombre | Sede | Estado | Construido / dónde |
|---|---|---|---|---|
| `inspeccion-calidad` | Inspección de calidad (en fábrica, PSI) | cn | activo | ficha SDD-0063 + reporte ERP SDD-0066 |
| `verificacion-proveedores` | Verificación de proveedores (online + física) | cn | activo | ficha SDD-0063 + SDD-0066 |
| `auditoria-calidad` | Auditoría y control de calidad en el fabricante | cn | activo | ficha SDD-0063 + SDD-0066 |
| `lab-permisologia` | Lab testing y permisología en China | cn | activo | ficha SDD-0063 + SDD-0066 |
| `compra-asistida` | Compra asistida / sourcing (personal shopper) | cn | activo | ✅ módulo SDD-0144 |
| `asesoria-pagos` | Asesoría en pagos a proveedores (= **Pago asistido**) | cn | activo | ficha pública; sin módulo (por WhatsApp) |
| `muestras-courier` | Envío de muestras y documentos (courier express, DHL) | cn | activo | ficha pública; sin módulo. **NO es flete aéreo** |

> ⚠️ **White-label (regla dura, ya en `lib/inspeccion.ts` + SDD-0066):** la inspección/verificación/
> auditoría/lab las ejecutan **terceros** (V-Trust, QIMA, SGS, CIS, WEINSPECTION, HQTS). Sus **nombres y
> tarifas NUNCA se muestran al cliente** — DTD revende en marca blanca, con reporte DTD-branded. Las
> infografías van 100% marca DTD, sin nombrar al tercero.

### Grupo 4 · Trámites y legal
| id | Nombre | Sede | Estado | Construido / dónde |
|---|---|---|---|---|
| `visado-chino` | Gestión de visado de negocios chino | ve | activo | ficha pública; sin módulo (por WhatsApp) |
| `registro-marca-cn` | Registro de marca en China (CNIPA) | ambas | activo | ficha pública; sin módulo. *(No confundir con `app/marca/` = brand-book DTD.)* |

### Grupo 5 · Formación
| id | Nombre | Sede | Estado | Construido / dónde |
|---|---|---|---|---|
| `cursos-importacion` | Cursos de importación | ambas | **proximamente** | sin construir |

---

## Cómo se cruza con las 3 capas del portal (para Cloud Design)

- **Capa "principales"** (entrada): Puerta a Puerta · LCL · FCL (los 3 de arriba).
- **Capa "servicios de la llegada"** (dentro de la pre-alerta): Grupo 2 (Validación, Etiquetado,
  Re-Empaque) + HOLD/Bodegaje (add-ons del portal) + `inspeccion_recepcion` (calidad al recibir).
- **Capa "otros servicios"** (opción aparte, antes/fuera de la carga): Grupo 3 (inspección en fábrica,
  verificación, auditoría, lab, compra asistida, pago asistido, courier) + Grupo 4 (visado, marca) +
  el LCL/FCL cuando se piden puntualmente.

## No aplican
Compactación (no se maneja) · Pick-up en origen (no por ahora). *(No están en el catálogo canónico.)*

## Decisiones del founder (18/19-jul) — cerradas
1. ✅ **HOLD e Inspección al recibir** entran como piezas propias del set de infografías; **Bodegaje
   extra NO** — es la regla de cobro dentro del HOLD. (Subirlos al catálogo canónico de código es tarea
   futura de SDD, no de marketing.) Con la fusión de la decisión 5, el set queda en **22 piezas +
   mapa general**.
2. ✅ **Estados**: Terrestre, Cursos y **Seguro de carga** se muestran **visibles con badge
   "próximamente"** (revoca el "no se menciona" del 06-09 para el Seguro). Aéreo = visible-deshabilitado.
3. ✅ **LCL/FCL tienen entrada propia en el portal** junto a la pre-alerta ("Nueva orden LCL/FCL");
   Cloud Design la diseña ya, el backend puede llegar en spec posterior.
4. ✅ **Shipping Mark en todas las superficies** (BD-022 en BRAND.md, deroga el split de BD-021);
   sweep del sitio público pendiente como deuda.
5. ✅ **Documentos de importación FUSIONADO dentro del Tránsito de aduana** (19-jul): sin tarjeta en
   `/servicios`, sin pieza de infografía, sin nodo propio en el mapa general — aparece como "incluido"
   dentro de la pieza de aduana. Código barrido (servicios-detalle, design-tokens, brochure, offer);
   falta despublicar la fila `documentos-importacion` en `/studio/servicios` (is_public → off).

## Pendientes reales
- Los servicios **sin módulo ERP** (visado, marca, courier, pago asistido) hoy se operan por WhatsApp —
  ¿las infografías dirigen a WhatsApp o se construye flujo? (fuera del MVP).
- La **investigación de las inspectoras + script de scraping + correos** no está en este repo (buscar en
  carpetas hermanas de `Developer/` si se necesita).
- Compra asistida: ratificar si la tabla de comisión pública sobrevive como excepción de precio.
