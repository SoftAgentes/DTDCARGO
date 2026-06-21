# Conectar el Portal al Norte — qué falta construir en el ERP

> **Estado:** análisis (founder 2026-06-20). El portal del cliente ya **apunta al Norte**
> (rediseño + modo oscuro, formalizado para todos — `NORTE_PORTAL_LIVE`). Pero varios
> elementos del Norte hoy se muestran **DEGRADADOS** porque el ERP todavía no tiene la
> data. "Conectar a Norte" = construir esa data/capacidad para reemplazar las degradaciones.
> Este doc es el mapa de huecos, priorizado. Cada hueco → futura SDD.

## Cómo leer esto

El Norte (diseño de Cloud Design) asume un ERP más rico que el actual. Donde la data no
existe, el portal **degrada honestamente** (lo verás en los comentarios del código:
"Tier 1 Naviera no construido", "advisor_id no existe", "ETA heurística"). Esos son los
puntos de conexión. No es deuda de la web — es trabajo de **backend/ERP** que la web ya
está lista para consumir.

---

## P0 · El corazón (lo más visible del Norte está degradado acá)

### 1. Naviera Tier 1 — datos reales del embarque
- **El Norte muestra:** buque + viaje + contenedor, ETD/ETA reales, **progreso real**, mapa.
- **Hoy degrada a:** progreso DERIVADO del status (`computeProgress`), ETA ESTIMADA por
  heurística (`estimatePortalEta`), sin buque/contenedor (héroe del dashboard + detalle).
- **Construir en el ERP:** enriquecer `shipments` con columnas naviera (`vessel`, `voyage`,
  `container_no`, `pol`, `pod`, `carrier`, `etd`, `eta`) + un flujo que las puebla — manual
  al inicio, luego scraping/EDI/AIS. *(SDD-0047 hizo Slice A/B de consolidación; el Slice C
  — scraping + BL PDF + bin-packing — está DIFERIDO. Esto es lo que lo cierra.)*
- **Desbloquea:** héroe "Próximo arribo" con progreso/ETA reales, detalle con buque/ETD/ETA,
  tracking público fiel.

### 2. Calendario de zarpes / consolidado (la cuenta regresiva del Norte)
- **El Norte muestra:** "Próxima salida de TU puerto" con cuenta regresiva al **cut-off**
  (cierre de carga) + espacio disponible (`NextSailingCard`). Lo primero que ve el cliente.
- **Hoy degrada a:** no existe (lo omití del dashboard Norte por falta de data).
- **Construir en el ERP:** tabla `sailings` (`pol`, `pod`, `carrier`, `vessel`, `cutoff`,
  `etd`, `eta`, `space`) + la lógica "próximo zarpe del puerto del cliente".
- **Desbloquea:** la card de cut-off (dashboard), el eco "tu mercancía debe llegar antes
  del …" en la prealerta, organizar compras contra el calendario real.

---

## P1 · La relación con el cliente

### 3. Asesor asignado (el "agente" del Norte)  ← QUICK WIN
- **El Norte muestra:** el account director ASIGNADO (nombre, foto, contacto, chat).
- **Hoy degrada a:** contacto PÚBLICO (CRM WhatsApp), porque `clients.advisor_id` no existe.
- **Construir en el ERP:** columna `clients.advisor_id` → `user_tenants` + UI de asignación
  en el Studio (cliente → asesor). **Barato, alto impacto visible.**
- **Desbloquea:** card "Tu agente" real (dashboard/Mensajes) + ruteo de Mensajes al asesor
  correcto + firma del asesor en comunicaciones.

### 4. Feed de eventos / hitos reales (timeline)
- **El Norte muestra:** stream de actividad real ("cruzó el Canal de Panamá", "factura
  emitida", "entregado · POD adjunto") con fecha/hora reales.
- **Hoy degrada a:** "Actividad reciente" derivada del `updatedAt` de los envíos (pobre);
  el seguimiento del detalle deriva los pasos del status, sin fechas por hito.
- **Construir en el ERP:** tabla `shipment_events` (`shipment_id`, `milestone`, `at`,
  `payload`) que la operación/automatización puebla a medida que la carga avanza.
- **Desbloquea:** actividad real (dashboard), stepper del detalle con FECHAS por paso,
  notificaciones de hito por mail/WhatsApp.

### 5. Mensajería en vivo (Mensajes / Soporte)
- **El Norte muestra:** chat con el agente, hilo en vivo.
- **Hoy:** existe el backend de **Conversaciones (SDD-0056** F1+F2, email inbound) pero el
  Mensajes del portal no está atado al hilo real ni al asesor.
- **Construir/conectar:** enganchar el Mensajes del portal a Conversaciones + el asesor
  asignado (#3); WhatsApp del cliente (F3 de SDD-0056, diferida).

---

## P2 · Documentos y dinero

### 6. Generación + auto-publicación de documentos (BL / Packing List / POD / Factura PDF)
- **El Norte muestra:** descargar BL, Packing List, factura comercial, POD; factura en PDF.
- **Hoy degrada a:** el hub de Documentos (**SDD-0049**) existe pero los docs se suben a
  mano; la factura PDF dice "Descargar PDF · próximamente".
- **Construir en el ERP:** generación de docs + auto-publicación en hitos (BL al embarcar,
  POD al entregar) + render de factura a PDF.

### 7. Aceptación legal fundida en el flujo (estimado → orden → factura)
- **El Norte muestra:** la aceptación de T&C con evidencia (hash, IP, versión) DENTRO del
  detalle del envío; el ciclo estimado→orden→factura visible.
- **Hoy:** existe la **capa legal (SDD-0054)** en `/portal/facturas/[code]/aceptar`, pero no
  fundida en el detalle como el Norte.
- **Conectar:** traer la aceptación al detalle del envío + exponer el ciclo (ya tenemos la
  card "ciclo" en Facturas/Finanzas).

---

## Ya conectado (poco/nada que construir)
Fidelización (**SDD-0051**), Referidos, Estimados (calculadora→portal, **SDD-0061**), Costing
(**SDD-0053**), Reportes (**SDD-0052**). Estos ya tienen su data en el ERP y el portal los
consume.

---

## Recomendación de orden (impacto / costo)

1. **⭐ Asesor asignado (#3)** — barato (1 columna + UI), desbloquea agente + Mensajes. Empezá acá.
2. **Naviera Tier 1 (#1)** — el grande; desbloquea el héroe + el detalle con data real. El que más mueve la aguja.
3. **Calendario de zarpes (#2)** — desbloquea la cuenta regresiva del cut-off (la firma del Norte que hoy falta).
4. **Eventos/hitos (#4)** — actividad + stepper con fechas reales; habilita notificaciones de hito.
5. **Docs + factura PDF (#6)** — cierra "descargar todo".
6. **Mensajes en vivo (#5)** y **aceptación fundida (#7)** — conectar lo que ya existe.

> El patrón: casi todo es **enriquecer `shipments` + 2-3 tablas nuevas** (`sailings`,
> `shipment_events`) + 1 columna (`advisor_id`). La web ya está lista para consumirlo —
> cada vez que el ERP tenga el dato, se reemplaza la degradación correspondiente (buscar en
> el código los comentarios "DEGRADADO" / "Tier 1 Naviera" / "heurística").
