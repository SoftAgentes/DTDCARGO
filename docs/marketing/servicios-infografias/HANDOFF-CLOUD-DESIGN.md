# Brief a Cloud Design — servicios DTD: arquitectura, dependencias, infografías y flujo del portal

Instrucciones completas para Cloud Design (que rediseña la web y el portal). Fuente de datos interna:
[CATALOGO-MAESTRO.md](CATALOGO-MAESTRO.md) (anclado a `lib/shared/service-catalog.ts`).
**Este brief manda sobre cualquier otra fuente** (incluido lo que se vea hoy en la web o el portal).

> **Estado:** v3.1 · 2026-07-19 · auditado (4 lentes + síntesis) + las 5 decisiones del founder CERRADAS:
> (1) Bodegaje = regla dentro del HOLD; (2) Seguro/Terrestre/Cursos = visibles
> con badge "próximamente"; (3) LCL/FCL con **entrada propia** en el portal junto a la pre-alerta;
> (4) **Shipping Mark en todas las superficies** (BD-022 enmienda BD-021);
> (5) **Documentos de importación FUSIONADO dentro del Tránsito de aduana** (19-jul) → el set queda en
> **22 piezas + mapa**; sin nodo propio en el mapa general. Brief definitivo.

---

## §0 · Objetivo y entregables (numerados)

| # | Entregable | Cantidad | Formatos |
|---|---|---|---|
| A | **Infografía GENERAL**: mapa de todos los servicios con sus dependencias | 1 | Web + PDF (+ versión presentación para el asesor) |
| B | **Infografías individuales** (una por servicio) | **22** (20 canónicos + pre-alerta + HOLD + inspección al recibir, − Documentos de importación que se fusionó dentro del Tránsito de aduana; el Bodegaje extra NO es pieza — es la regla de cobro dentro del HOLD) | Ficha web responsive en `/servicios` + PDF vertical apto WhatsApp |
| C | **Arquitectura de `/servicios`**: portada solo títulos, 4 momentos, clic → detalle | 1 | Web |
| D | **Flujo del portal de pre-alertas** (modalidad → compra → servicios de llegada → link proveedor) | 1 flujo (3 actores) | Portal |

**Estado del copy:** 5 fichas ancla ya redactadas (Puerta a Puerta, Pre-alerta, Validación, HOLD,
Consolidado LCL); el resto llega por tandas desde el repo. **PROHIBIDO que Cloud Design redacte copy de
servicios** — solo microcopy de UI (labels, botones, estados), siempre en tuteo venezolano.

## §1 · Naming canónico (esta tabla manda)

| id técnico | Nombre de cara al cliente | Aclaración permitida | PROHIBIDO |
|---|---|---|---|
| `puerta-a-puerta-ddp` | **Puerta a Puerta** ⭐ | "(todo pagado)" | "DDP" como título; "LCL" |
| `lcl-consolidado` | **Consolidado LCL** | "hasta puerto, con tu propio BL" | presentarlo como modalidad del Puerta a Puerta |
| `fcl-bodega` + `fcl-directo` | **FCL — Contenedor completo** (UNA tarjeta, selector de 2 modalidades) | directo: "el BL sale a nombre de DTD — tu proveedor no puede desviar el contenedor" | tratarlos como 2 servicios sueltos |
| (portal `verificacion`) | **Validación · verifica y valida al recibir** | "conteo contra tu factura" | "Verificación al recibir" (colisiona con Verificación de proveedores) |
| (portal `inspeccion_recepcion`) | **Inspección de calidad al recibir** (en bodega) | "incluye la Validación" | confundirla con la inspección EN FÁBRICA |
| `inspeccion-calidad` | **Inspección de calidad en fábrica** (antes del embarque) | "PSI" | confundirla con la de bodega — es la confusión #1 del cliente: tratamiento visual DISTINTO |
| `reempaque-defectuosas` | **Re-Empaque** | "unificamos tus compras pequeñas de Alibaba en un solo packing list" | el encuadre viejo "cajas defectuosas" |
| (portal `hold_consolidar`) | **HOLD — retener para consolidar** | "el descuento aplica solo si ambas cargas van en el MISMO contenedor" | — |
| resto de canónicos | nombre del CATALOGO-MAESTRO | — | inventar sinónimos |

Identificador del cliente en microcopy: **Shipping Mark en TODAS las superficies** (BD-022, decisión
founder 18-jul — deroga el split de BD-021; "MARKBOX" ya no se usa como etiqueta visible).

## §2 · Arquitectura de `/servicios`

- **Portada: SOLO TÍTULOS**, agrupados por los **4 momentos del viaje** (campo `momentoTimeline`):
  1. **Origen** (China) · 2. **Recepción en bodega** (Yiwu) · 3. **Transporte + Aduana** (CN→VE) ·
  4. **En cualquier punto del viaje** (transversales). ⚠️ "Tu puerta" NO es un momento (es el destino) —
  no usarlo como grupo o los transversales (visado, marca, courier, cursos) quedan sin casa.
- **Banda destacada al tope:** los 3 principales — Puerta a Puerta ⭐ (estrella) · Consolidado LCL · FCL.
- Cada tarjeta lleva **flecha (→)**; el detalle sale SOLO al clic. Nada de detalle en portada.
- Tarjetas "próximamente": visibles con badge, sin CTA de cotizar (lista en §7).

## §3 · Mapa de dependencias (Cloud Design lo VISUALIZA, no lo interpreta)

- **Nodo conector central: la PRE-ALERTA** — es la **ORDEN** del envío (no un servicio). De ella cuelgan
  los servicios de la llegada.
- **Cuelgan de la pre-alerta (6):** Validación · Inspección al recibir (⊃ INCLUYE la Validación) ·
  Etiquetado · HOLD · Re-Empaque · Bodegaje extra (ligado al HOLD: gratis «N» días, luego se cobra).
- **Tronco transporte:** Puerta a Puerta incluye aduana+impuestos+entrega; el **FCL incluye el
  tránsito de aduana + documentación** (founder 19-jul — supera el dictado 06-09); en el **LCL** la
  aduana (que trae los documentos de importación DENTRO — no es nodo aparte) es **add-on contratable**,
  igual que el terrestre.
- ⚠️ **Regla de microcopy (founder 19-jul):** en la tarjeta del **LCL** la palabra **"incluido/a" está
  PROHIBIDA** — DTD llega hasta el puerto / almacén fiscal, y de ahí el cliente decide (su propio
  agente aduanal, o pedirle a DTD la gestión como servicio adicional). Chip correcto en LCL:
  **«＋ si lo quieres: tránsito de aduana»**. Las tarjetas del **Puerta a Puerta y del FCL SÍ pueden
  decir "incluido"** (en ambas la aduana lo está). En todo add-on, "incluida" solo puede referirse a lo
  que va dentro de ESE add-on (ej. la documentación dentro del Tránsito de aduana).
- **Independientes (Capa 3, entrada aparte):** Consolidado LCL puntual · Compra asistida · Pago
  asistido · Courier muestras · Visado · Registro de marca.
- Jerarquía visual de 3 niveles: principales dominantes → conector (pre-alerta) → colgantes. Leyenda de
  tipos de conexión (incluido / add-on / independiente). Si no cabe: agrupar por capa, no quitar nodos.

## §4 · Flujo del portal de pre-alertas (entregable D)

**Tres entradas separadas en el portal (decisión founder 18-jul):**
1. **"Nueva compra"** (la pre-alerta = orden del Puerta a Puerta) — pasos:
   1) **Modalidad de envío**: Marítimo (activo) · Aéreo (visible pero **deshabilitado**, badge
      "próximamente") → 2) **Datos de la compra** (proveedor, descripción, cajas) → 3) el sistema genera
      **link al proveedor** + **etiquetas QR** — este link **REEMPLAZA el grupo de WeChat** (no
      reintroducir WeChat en el flujo) → 4) **Servicios de la llegada** como tarjetas de un clic, cada
      una con "tiene costo adicional — lo cotiza tu asesor" → 5) Confirmación → se genera la **orden al
      operario** en China.
2. **"Nueva orden LCL / FCL"** — **entrada propia** junto a la pre-alerta: el cliente inicia una orden
   de Consolidado LCL o FCL (con su selector de modalidad FCL: en bodega / directo fábrica). Cloud
   Design diseña el flujo; el backend puede llegar en una spec posterior (diseñar completo, no ocultar).
3. **"Escoger otros servicios"** (Capa 3) — para lo que va ANTES o FUERA de la carga.

**Tres actores:** cliente (portal) → proveedor (link público, bilingüe 中文/ES, packing list online +
etiquetas) → operario (recibe escaneando y ve los servicios pedidos como checklist).

## §5 · Spec pieza A (mapa general)

El grafo del §3 en una sola pieza. Formatos: web + PDF + versión presentación (asesor). Debe poder
explicarse en 30 segundos: "esto es todo lo que DTD hace, esto va junto, esto es aparte".

## §6 · Spec pieza B (plantilla individual)

- Plantilla maestra con variantes por capa (principal / llegada / origen / trámites).
- Las 7 secciones del patrón: gancho → qué es → cómo funciona (pasos) → por qué conviene → reglas →
  precio → contacto (bloque estándar del [README](README.md)).
- Medidas: ficha web responsive + PDF A4 vertical (apto para compartir por WhatsApp).
- **Regla dura:** una pieza con placeholder «…» sin dato del founder **NO pasa a arte final**.

## §7 · Estados y tratamiento visual (tabla cerrada — cero decisiones delegadas)

| Servicio | Estado | Tratamiento |
|---|---|---|
| Puerta a Puerta, LCL, FCL, y todos los `activo` del CATALOGO | activo | tarjeta completa + CTA |
| Envío aéreo | próximamente | visible-deshabilitado, badge "próximamente", sin CTA |
| Transporte terrestre · Cursos de importación · **Seguro de carga** | próximamente | **visibles con badge "próximamente"**, sin CTA (decisión founder 18-jul — revoca el "no se menciona" del 06-09 para el Seguro) |
| `compactar` · `cotizar_medir` (add-ons del portal) | **APAGADOS** | **NO diseñar** — no existen para el cliente aunque el portal actual los muestre |

## §8 · Reglas duras (no negociables)

1. **BRAND.md manda:** solo tokens `var(--*)`, tipografías Archivo/Archivo Black/JetBrains Mono/Noto
   Sans SC, cero AI slop (gradientes coloridos, glassmorphism, emojis decorativos).
2. **White-label:** las inspecciones las ejecutan terceros **confidenciales** (lista interna en el
   CATALOGO — no está en este brief a propósito). **Jamás** nombrarlos ni mostrar sus tarifas. Todo es
   servicio DTD con reporte DTD.
3. **OneWayCargo = solo el patrón**, nunca su copy ni su arte. Los videos de competencia citados en las
   fichas son **REFERENCIA INTERNA — nunca publicar, embeber ni citar**.
4. **Sin handling fee** — no existe cargo base por paquete; no inventarlo.
5. **Sin WeChat** en el flujo — el link al proveedor lo reemplaza.
6. **Ningún precio ni tiempo inventado** en las piezas. Única excepción candidata: la tabla de comisión
   de Compra Asistida (⚠️ PENDIENTE founder ratificar; si va, se renderiza desde config del ERP).
7. **Tuteo venezolano, cero voseo**, en todo microcopy.
8. **Shipping Mark**, nunca "MARKBOX", en todas las superficies (BD-022).

## §9 · Assets y referencias

- Brand Book vigente: el de mayor versión en `docs/design/studio/_norte/` (ver tope de `_norte/HANDOFF.md`).
- Isologo: 4 variantes en `public/brand/dtdcargo-isologo-{primary|reverse|mono-light|mono-dark}.png`,
  siempre vía componente/uso aprobado.
- Tokens y tipografías del sistema; capturas de la `/servicios` actual en prod como referencia del patrón
  (solo títulos + flecha), NO como límite creativo.

## §10 · Entrega, fases y aprobación

- **P1 ⭐:** 3 principales + pre-alerta + mapa general (borrador) → **Gate 1: el founder aprueba naming +
  estados + wireframe del mapa ANTES de arte final.**
- **P2:** los 6 servicios de la llegada. **P3:** origen + trámites + transversales.
- **Gate 2:** arte final por tanda.
- Entrega vía **NORTE-SYNC** a `docs/design/studio/_norte/` con la versión registrada al tope del
  `HANDOFF.md` del Norte.
