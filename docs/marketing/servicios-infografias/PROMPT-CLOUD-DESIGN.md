# Prompt para Cloud Design — rediseño de servicios + portal de pre-alertas

> **Cómo usarlo (enfoque de ARCHIVO ÚNICO — recomendado):** abre la sesión de Cloud Design,
> **adjunta UN solo archivo**: el consolidado de la fase, generado desde estas fuentes:
>
> - **P1 (ya generado):** `C:\Users\Trabajo\Downloads\DTD-brief-cloud-design-P1.md`
>   (= brief maestro + catálogo + las 5 fichas de P1, concatenados).
> - P2/P3: pedir el consolidado de la tanda cuando toque (mismo formato).
> - (opcional, si el hilo de diseño no tiene la marca cargada) adjuntar además el Brand Book
>   vigente del Norte.
>
> Luego **pega el prompt de abajo como mensaje**. NO le des las 24 fichas de una — se trabaja
> por tandas para mantener el foco.

---

```
Eres el equipo de diseño de DTD Cargo (logística China→Venezuela). Vamos a rediseñar la
presentación de nuestros servicios en la web y el portal del cliente.

Te adjunto:
- HANDOFF-CLOUD-DESIGN.md — el brief maestro. ES LA LEY: naming (§1), arquitectura (§2), mapa
  de dependencias (§3), flujo del portal (§4), specs de piezas (§5-6), estados (§7), reglas
  duras (§8). Si algo contradice otro material, gana este brief.
- CATALOGO-MAESTRO.md — el catálogo completo de servicios (20 canónicos + capas).
- Las 5 fichas de copy de la Fase 1 (P1). El copy YA está redactado y aprobado: tu trabajo es
  DISEÑAR, no reescribir. Solo puedes proponer microcopy de UI (labels, botones, estados).

LOS 4 ENTREGABLES (en orden):
1. Infografía GENERAL — mapa de todos los servicios con dependencias (§3 y §5 del brief).
2. ~23 infografías individuales (§6) — ficha web responsive + PDF vertical apto WhatsApp.
3. Arquitectura de /servicios — portada SOLO títulos por 4 momentos del viaje, clic → detalle,
   banda destacada con los 3 principales (Puerta a Puerta ⭐ · Consolidado LCL · FCL).
4. Flujo del portal de pre-alertas (§4) — TRES entradas: "Nueva compra" (pre-alerta, con
   modalidad marítimo activo / aéreo deshabilitado "próximamente"), "Nueva orden LCL/FCL"
   (entrada propia), y "Escoger otros servicios".

EMPIEZA POR EL GATE 1 (nada de arte final todavía):
a. Wireframe del mapa general (entregable 1) con la jerarquía de 3 niveles del §3.
b. Wireframe de la portada /servicios (entregable 3).
c. La plantilla maestra de infografía individual (§6) aplicada a UNA ficha: Puerta a Puerta.
d. Lista de microcopy de UI que propones (labels/estados) para aprobar el naming.
Cuando yo apruebe el Gate 1, pasamos a arte final por tandas (P1 → P2 → P3, §10).

REGLAS QUE NO SE ROMPEN (§8 del brief — resumen):
- Marca DTD: tokens del sistema, tipografías Archivo/Archivo Black/JetBrains Mono/Noto Sans SC,
  cero AI slop (gradientes coloridos, glassmorphism, emojis decorativos).
- "Puerta a Puerta" es el servicio; "DDP" jamás como título. LCL y FCL son servicios propios.
- Los terceros de inspección son confidenciales: jamás nombres de empresas ni logos.
- Ningún precio ni tiempo que no esté en las fichas. Placeholder «…» = esa pieza no va a arte.
- "Shipping Mark", nunca "MARKBOX". Español venezolano tuteo en todo microcopy.
- Sin logos de couriers (DHL/UPS/FedEx solo en texto plano).
La entrega final será un handoff para el repo (NORTE-SYNC a docs/design/studio/_norte/).
```

---

**Después del Gate 1:** cuando Cloud Design entregue los wireframes, tráelos a esta sesión (o a una
nueva con `/avivar`) para revisarlos contra el brief antes de aprobar arte final.
