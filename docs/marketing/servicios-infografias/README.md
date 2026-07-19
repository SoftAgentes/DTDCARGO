# Infografías de servicios DTD — copy fuente

Copy con **nuestro proceso** (China→Venezuela) para las infografías/fichas de cada servicio.
Alimenta **Cloud Design** (diseño visual) y el HTML/PDF final. Hilo de **marketing**, separado de la
funcionalidad del portal (SDD-0163).

> **Estado:** borrador · 2026-07-18. Anclas redactadas (tono a validar con el founder); resto pendiente.

## 🔮 Futuro (decisión founder 18-jul — tarea para después, NO en el plan actual)

Estas fichas vivirán en el **módulo Marketing del ERP** (`/studio/marketing/docs`, SDD-0158) como
**documentos vivos**: HTML atado a la configuración de servicios y tarifas — si cambia un precio/tiempo
en el ERP, el documento se actualiza solo, descargable en PDF al momento. Diseño: copy en markdown con
**ranuras de datos** (`{{transito_dias}}`, `{{bodegaje_dias_gratis}}`) resueltas al renderizar desde
`service_configs`. Tendrá su propia spec SDD cuando el founder la active.

## Cómo se usa

- Un archivo `.md` por servicio = una infografía. Cada uno trae el copy estructurado + notas de diseño.
- **Formatos de salida:** ficha en la web pública `/servicios` (indexable) **+** PDF descargable por
  servicio (WhatsApp/redes). Misma fuente de copy para ambos.
- **Cloud Design** toma este copy y lo maqueta con la marca. Aquí NO se diseña, se redacta.

## Patrón por infografía (referencia OneWayCargo, con nuestro proceso)

Estructura tomada del *patrón* de OneWay (NO su copy ni sus imágenes — es competencia, es IP):

1. **Gancho / título** — nombre del servicio + promesa en una línea.
2. **¿Qué es?** — 1–2 frases claras.
3. **¿Cómo funciona?** — pasos numerados de NUESTRO proceso.
4. **¿Por qué te conviene?** — el beneficio.
5. **Reglas / condiciones importantes** — lo que el cliente debe saber (plazos, responsabilidades).
6. **Precio** — sin monto final (es configurable en servicios y tarifas); "consulta la tarifa vigente
   con tu asesor".
7. **Contacto / CTA.**

## Reglas de redacción (no se rompen)

- **Español venezolano neutro, TUTEO** (tú tienes / puedes / quieres). Cero voseo (nada de "cotizá",
  "podés"). Cero anglicismos innecesarios.
- **Puerta a Puerta = servicio principal** (hasta tu puerta, nosotros nacionalizamos). **DDP** = solo
  aclaración "(todo pagado)", jamás título. **LCL Consolidado = servicio APARTE** hasta puerto, para
  empresas que legalizan a su nombre — **NUNCA una modalidad del Puerta a Puerta**. **FCL** = servicio
  propio con 2 modalidades (en bodega / directo fábrica con BL a nombre de DTD).
- **White-label:** los terceros que ejecutan inspecciones **jamás se nombran** en material de cara al
  cliente (ni sus tarifas). Todo va como servicio DTD.
- **Precios en VIDEOS (founder 18-jul):** los videos **jamás mencionan montos** — solo "este servicio
  puede tener un cargo extra". El monto vive en el ERP (servicios y tarifas, editable) y el portal lo
  muestra cuando esté configurado. Aplica a los 5 videos: pre-alerta · Validación · Etiquetado · HOLD ·
  Re-Empaque.
- **Shipping Mark** en todas las superficies (BD-022, 2026-07-18 — deroga el split de BD-021; "MARKBOX"
  ya no es etiqueta visible en ningún lado).
- Sin inventar precios, tiempos de tránsito ni SLA. Lo que no sé va como placeholder **«...»** para que
  el founder lo llene.
- Marca: DTD Cargo. Sello de herencia: DoorTuDoor. BRAND.md manda en lo visual.

## Bloque de contacto (para el pie de cada infografía)

- **WhatsApp:** +58 412 166 8021 · **Fijo:** +58 241 414 7886
- **Web:** dtdcargo.com · **Instagram:** @doortudoor_ · **Correo:** info@dtdcargo.com
- **Atención WhatsApp:** todos los días 8:00–20:00 (GMT-4)
- **Sede Venezuela:** Edificio Kokuy, Calle 151, Valencia, Carabobo.

## Inventario de piezas (alineado 1:1 con [CATALOGO-MAESTRO.md](CATALOGO-MAESTRO.md))

**Pieza A · Infografía GENERAL** — mapa de todos los servicios con dependencias (qué atado a qué, qué
independiente). Ver spec en [HANDOFF-CLOUD-DESIGN.md](HANDOFF-CLOUD-DESIGN.md).
- [ ] Mapa general de servicios

**Piezas B · Individuales — Los 3 principales + la orden**
- [x] [Envío marítimo Puerta a Puerta](envio-maritimo-puerta-a-puerta.md) — *ancla* ⭐
- [x] [Consolidado (LCL) hasta puerto](consolidado-lcl.md) — *ancla* (empresas; BL propio)
- [x] [FCL — Contenedor completo](fcl.md) (1 pieza, 2 modalidades: en bodega / directo fábrica con BL a nombre DTD)
- [x] [Pre-alerta de compra (la ORDEN — nodo conector, no un servicio)](prealerta-compra.md) — *ancla*
- [x] [Envío aéreo](envio-aereo.md) — *próximamente (visible-deshabilitado)*

**Servicios de la llegada** (cuelgan de la pre-alerta; lista canónica de 6 — decisión founder 18-jul)
- [x] [Validación al recibir](validacion.md) — *ancla*
- [x] [Inspección de calidad al recibir](inspeccion-al-recibir.md) (INCLUYE la Validación; requiere ficha técnica)
- [x] [Etiquetado de piezas](etiquetado-piezas.md) (2 opciones: código de barras / etiqueta física)
- [x] [HOLD — retener para consolidar](hold.md) — *ancla*
- [x] [Re-Empaque](reempaque.md) (unificar compras pequeñas de Alibaba, un solo packing list)
- Bodegaje extra — **NO es pieza propia**: es la regla de cobro dentro del HOLD (decisión founder 18-jul).
- [x] [Seguro de carga](seguro-carga.md) — *próximamente (visible con badge — decisión founder 18-jul,
  revoca el "no se menciona" del 06-09)*

**En bodega / transporte (canónicos restantes)**
- [x] [Tránsito de aduana y desaduanaje](transito-aduana.md) (incluido en DDP; add-on en LCL/FCL)
- [x] [Documentos de importación](documentos-importacion.md)
- [x] [Transporte terrestre nacional](transporte-terrestre.md) — *próximamente*

**Origen / calidad en China (familia Inspección — white-label, sin nombrar terceros)**
- [x] [Verificación de proveedores (online + física)](verificacion-proveedores.md)
- [x] [Inspección de calidad en fábrica (PSI)](inspeccion-calidad-fabrica.md)
- [x] [Auditoría y control de calidad en el fabricante](auditoria-calidad.md)
- [x] [Lab testing y permisología](lab-permisologia.md)

**Otros servicios (Capa 3 — opción aparte, NO en la pre-alerta)**
- [x] [Compra asistida / sourcing](compra-asistida.md) (2 modalidades; tabla de comisión — pendiente ratificar si se publica)
- [x] [Pago asistido](pago-asistido.md) (asesoría en pagos a proveedores)
- [x] [Courier de muestras y documentos](courier-muestras.md) (DHL — NO es flete aéreo)

**Trámites y formación (transversales)**
- [x] [Gestión de visado de negocios chino](visado-chino.md)
- [x] [Registro de marca en China (CNIPA)](registro-marca-cn.md)
- [x] [Cursos de importación](cursos-importacion.md) — *próximamente*

**Videos (5 · en [videos/](videos/GUIA-PRODUCCION.md))**
- [x] [Guía de producción](videos/GUIA-PRODUCCION.md) (formato, marca, §6b grabación de pantalla del portal, reglas: JAMÁS montos — "puede tener un cargo extra")
- [x] [Pre-alerta](videos/brief-prealerta.md) · [Validación](videos/brief-validacion.md) ·
  [Etiquetado](videos/brief-etiquetado.md) · [HOLD](videos/brief-hold.md) · [Re-Empaque](videos/brief-reempaque.md)
- [x] [Entrega al productor](videos/ENTREGA-PRODUCTOR.md) → **entregable: HTML interactivo offline**
  `../assets/produccion-videos-dtd.html` (progreso por etapa + teleprompter)
- [x] [Prompt + paquete para Cloud Design](PROMPT-CLOUD-DESIGN.md) → consolidado P1 en
  `C:\Users\Trabajo\Downloads\DTD-brief-cloud-design-P1.md`

**No aplican (no diseñar):** Compactación · Pick-up · add-ons apagados del portal (`compactar`,
`cotizar_medir`).

## Placeholders a llenar por el founder

- ~~Tiempos de tránsito~~ → **60–90 días PP · 40–55 días FCL · aduana 5–6 días hábiles** (RATIFICADOS
  18-jul; si cambian, se editan en configuración de servicios del ERP).
- ~~Días de bodegaje gratis~~ → **15 días** (confirmado 18-jul). Falta el monto del cargo por día vencido
  (vive en el ERP).
- ~~Re-Empaque y bodegaje~~ → **exime bodegaje**: el conteo empieza al terminar el empaque (18-jul).
- ~~Videos~~ → cara a cámara = **Fiorella**, se graba en **Venezuela** (18-jul).
- Umbrales/mínimos de consolidación y del descuento por CBM.
- Tarifas de cada servicio de llegada (van en servicios y tarifas del ERP).
- Compra asistida: ¿la tabla de comisión pública (10%→…, según dictado 06-09) sobrevive como excepción
  renderizada desde config del ERP, o pasa a "consulta con tu asesor"?
- Courier: ¿logos de DHL/UPS/FedEx en el arte o solo texto?
