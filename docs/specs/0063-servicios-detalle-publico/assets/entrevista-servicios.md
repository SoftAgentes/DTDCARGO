# Entrevista por tandas — datos de servicios (SDD-0063)

> Registro de la entrevista al founder para rellenar las fichas de `/servicios`.
> Por servicio: **✅ grounded** (lo que ya tengo del FAQ/timeline/copy y solo confirmo) ·
> **❓ FALTA** (lo que el founder debe dictar). **No inventar.**
> Estado: `pendiente` hasta que el founder dicte; luego se transcribe a `lib/servicios-detalle.ts`.

## Reglas transversales (aplican a todas las fichas)
- Tiempos marítimo: **60-90 días** (FAQ §3 Kommo) — ❓ confirmar si va explícito en la web.
- Precios: por **CBM** vía calculadora; FCL/carga especial/DDP escalan a asesor. NO hardcodear montos.
- Voz: tuteo VE, sin voseo.

---

## TANDA 1 — Eje de transporte marítimo (DICTADO founder 2026-06-09 · pendiente de confirmar)

> El eje NO se organiza por "familia" sino por **MODALIDAD DE TRANSPORTE**. Las distingue 1
> variable maestra: **hasta dónde llega el servicio de DTD** (+ quién recibe el Bill of
> Lading + si la aduana va incluida). Precios = **ejemplos por CBM, hoy, referenciales — NO se
> publican** (la web va por calculadora/asesor). Reestructura el grupo `maritimo` del scaffold.

### A. DDP Puerta a Puerta (CBM) — **PRINCIPAL** ⭐ (`dtd-services-lcl`)
- Contenedor **compartido** (LCL, ~8 clientes DDP por contenedor); DTD consolida en bodega Yiwu.
- Cliente **no recibe NINGÚN documento** (ni BL): DTD nacionaliza a su nombre. El cliente **solo
  firma la prueba de entrega (POD)**. *(No hay obligación documental → se formaliza en la doc legal.)*
- **El servicio de DTD llega hasta la PUERTA**, **incluido hasta el casco central** de la ciudad;
  **fuera del casco central = cobro adicional** (lógica de zonas ya en `lib/geo-zonas.ts`).
- **Aduana + impuestos INCLUIDOS** (DDP). Paga **al llegar** (Financiamiento 100%).
- Precio ejemplo: **~800 USD/CBM**.

### B. LCL Consolidado — variación más económica, **NO es DDP** (ficha NUEVA, falta slug)
- Contenedor **compartido** (~8 clientes); **cada cliente con su Bill of Lading SEPARADO** dentro
  del **Bill Master**.
- **El servicio de DTD llega hasta entregar el BL** al cliente en Venezuela. El cliente hace el
  resto (o contrata add-ons).
- **Aduana NO incluida.** Si contrata el add-on de aduana (D): el cliente **paga sus planillas
  DIRECTO a la aduana** (DTD no cobra la aduana), da **nombre/empresa + carta poder** para que DTD
  lo represente como agente. De ahí salen **otros gastos**: servicios portuarios, transporte, etc.
  hasta el destino.
- Precio ejemplo: **~550 USD/CBM**.

### C. FCL — contenedor completo (2 modalidades)
- **C1. FCL Consolidado en Bodega** (`consolidacion-bodega-yiwu` ← era "consolidación"): DTD **carga
  el contenedor en su bodega de Yiwu** desde varios proveedores + **despacho de China** + **reserva
  de contenedor y flete**. El cliente **maneja todo en Venezuela** (DTD se desentiende allá).
  Aduana = **add-on sí/no**.
- **C2. FCL Directo Fábrica** (`reserva-contenedores` ← era "reserva FCL"): contenedor cargado **en
  la fábrica del proveedor** (1-2 fabricantes), **NO** en bodega DTD. DTD hace la **reserva del
  contenedor con la naviera**; el **BL sale con la empresa CHINA de DTD como Shipper** y el cliente
  como **Consignatario** — **NUNCA a nombre del proveedor**. Es una **garantía de seguridad**: así
  el proveedor no puede cambiar el destino ni desviar el contenedor. Aduana = **add-on sí/no**.

### D. Add-on modular — Tránsito de aduana / desaduanaje (`transito-aduana`)
- Se engancha **OPCIONAL** a B (LCL), C1 y C2 (FCL). En A (DDP) ya va **incluido**.
- Cliente **paga planillas directo** a la aduana (DTD no cobra aduana); da nombre/empresa + carta
  poder. Genera gastos extra: servicios portuarios, transporte interno, etc.
- En **LCL/FCL** el **transporte/entrega va DENTRO del servicio de aduana**, como **extra adicional
  opcional** (NO es el last-mile gratis del DDP).

### ✅ CONFIRMADO (founder 2026-06-09)
- **DDP:** el cliente **NO recibe ningún documento**; solo firma la **prueba de entrega (POD)**.
- **Last-mile DDP:** incluido **hasta el casco central**; fuera del casco = **cobro adicional**.
- **LCL/FCL:** el transporte/entrega va **dentro del servicio de aduana** como **extra opcional**.
- **Transporte terrestre = servicio APARTE** (no es el last-mile suelto). Ficha propia.
- **C2:** corrección — era **"reserva de contenedor"** (con la naviera), no "reserva aduanal".
- **DDP no incluye seguro** (se contrata aparte). Carga especial/peligrosa/sobredimensionada =
  **costos extra aparte**, NO es exclusión del DDP base.
- **Tarifa y CBM mínimo del DDP** = atados a la **calculadora** (cruce configurable en
  `/studio/tarifas`, modificable). NO hardcodear en la ficha. **Tarifa especial desde 10 CBM**
  (corrige el "5 CBM" del FAQ/runbook de Kommo).

### ❓ Aún por dictar (TANDA 1)
- **DDP ✅ · LCL Consolidado ✅ · FCL Bodega ✅ · FCL Fábrica ✅** — COMPLETOS.
  - LCL: 60-90 días hasta entregar el BL; precio por CBM con asesor.
  - FCL: **40-55 días aprox** (contenedor completo, sin espera de salida consolidada); precio con
    asesor; **FCL Bodega: 7 días de almacenaje gratis, después costo extra**.
  - **Seguro: NO se menciona en la web** en ninguna modalidad — si preguntan, "no incluye".
- **Aduana ✅** COMPLETO: precio por **valorización de la factura** (no se publica; el asesor da el
  aproximado, muchos factores varían); **nacionalización 5-6 días hábiles**; incluye el paquete completo.
- **Transporte terrestre: "Próximamente"** (founder 2026-06-09) → ficha en `/servicios` con badge
  **Próximamente** (sin detalle aún); la **calculadora-terrestre sigue live**. Detallar al activarlo.
- ✅ **TANDA 1 (eje de transporte): CERRADA.**
- Precios FCL/LCL: referenciales internos, NO se publican.

---

## MINI-SERVICIOS (micro add-ons por tramo · DICTADO founder 2026-06-09)

> Servicios chiquitos que el cliente pide **dentro de un tramo** del viaje. Son **opcionales**,
> tienen **costo propio** y **TODOS generan un mini-reporte con FOTOS**. No se hacen por defecto.

### Tramo: Recepción en bodega Yiwu (E2)
1. **Revisión de mercancía al recibir** — abrir las cajas, revisar la mercancía **y contar/chequear
   la cantidad vs la factura** del proveedor (**es UN solo servicio**). Por defecto **NO se abren las
   cajas**; solo a pedido (al abrir, DTD verifica y deja constancia de faltantes con fotos).
2. **Etiquetado por piezas** — etiquetar las piezas; **se cobra POR PIEZA**. Normalmente va después
   de la revisión.
3. **Cajas defectuosas / reempaque** — reempacar las cajas que llegan defectuosas. Costo mínimo,
   pero es un servicio en sí.

> ⚠️ **NO son inspección.** Son **servicios de captura de recepción en bodega** (al recibir la
> mercancía en Yiwu). NO tienen que ver con la **inspección a productos en fábrica**, que es otra
> línea (terciaria, `/servicios/inspeccion`): esa es **directo a las fábricas, ANTES de fabricar /
> producir** (pre-producción) o inspección al producto. Posible nexo con el flujo del operario de
> bodega CN (SDD-0031).

### ✅ CONFIRMADO (founder 2026-06-09)
- **Otros tramos:** no hay mini-servicios por ahora (solo recepción de bodega).
- **Se EXPONEN en la web** y se ofrecen como servicio.
- **Separados de la inspección** (recepción de bodega ≠ inspección en fábrica pre-producción).

### ❓ Aún por dictar
- Precios (¿por pieza? ¿mínimo de reempaque?) — ¿stand-by/asesor, o publicable?

---

## TANDA 2 — Calidad, proveedores y origen (DICTADO founder 2026-06-09)

> Agrupación dictada: los **4 de inspección son UNA familia** (umbrella "Inspección");
> **compra asistida, asesoría de pagos y courier van SUELTOS** (standalone).

### A · INSPECCIÓN — umbrella de 4 sub-servicios (deep-dive `/servicios/inspeccion`)
> En **fábrica / sobre el producto**, antes o durante la producción y pre-embarque.
> ⚠️ Distinto de los mini-servicios de **recepción de bodega** (sección anterior).
1. **Verificación de proveedores** (`verificacion-proveedores`) — auditoría de legitimidad de la
   fábrica (validez legal, capacidad, instalaciones). (FAQ §7)
2. **Inspección de calidad** (`chequeo-etiquetado` → **renombrar**; el "etiquetado" se muda a los
   mini-servicios de bodega) — verificación física del producto vs ficha técnica (PSI / pre-embarque).
3. **Auditoría y control de calidad** (`auditoria-calidad`) — auditorías de fábrica online/presenciales + QC.
4. **Lab testing y permisología** (`lab-permisologia`) — ensayos RoHS/CE/FDA/SGS + permisos de exportación.
- ❓ Por sub: incluye/no-incluye · precio (¿stand-by → asesor?) · entregable (reporte) · tiempos.

### B · Servicios sueltos
5. **Compra asistida / sourcing** (`compra-asistida`) — depto. de compras en China
   (ubicar/negociar/gestionar/pagar). ⚠️ proveedor = **red propia DTD, NUNCA se revela**; **modelo
   comercial sin definir**. (FAQ §9)
6. **Asesoría en pagos a proveedores** (`asesoria-pagos`) — transacciones seguras en Yuan
   (Alipay/WeChat/transferencia/efectivo). (FAQ §6)
7. **Courier de muestras y documentos** (`muestras-courier`) — DHL/UPS/FedEx desde Yiwu. ⚠️ **NO es
   flete aéreo de carga** (suspendido); el courier de muestras/docs **sí está activo**.
- ❓ Por servicio: incluye/no-incluye · precio/condición · tiempos.

---

## TANDA 3 — Trámites y legal (DICTADO founder 2026-06-09)

> Estructura: **visado y registro de marca van SUELTOS** (trámites independientes, no dependen de
> importar con DTD). **Documentos de importación NO se vende solo → va DENTRO del servicio de
> aduana** (`transito-aduana`).

### 11. `visado-chino` — Visado de negocios chino
- ✅ Asesoría documental, formularios, coordinación consulado, foto en oficina; todo desde Valencia.
- ❓ FALTA: incluye/no incluye · precio/honorarios · tiempos · requisitos del cliente.

### 12. `registro-marca-cn` / `registro-marca-coord` — Registro de marca en China (CNIPA)
- ✅ Gestión de PI ante CNIPA; coordinación + documentos desde Venezuela.
- ❓ FALTA: incluye/no incluye · honorarios + tasas oficiales · tiempos (meses) · qué entrega.

### 13. `documentos-importacion` — Documentos de importación → **SUB de aduana** (no suelto)
- ✅ Elabora/revisa/tramita facturas de embarque, declaraciones, certificados, normativa.
- ✅ CONFIRMADO: **va dentro del servicio de aduana** (`transito-aduana`), no es un producto aparte.
- ❓ FALTA: qué NO cubre · tiempos.

---

## Pendiente de coherencia global (no por servicio)
- Año 2008 en todos lados (en curso, esta sesión).
- ¿`/faq` (`lib/faqs.ts`) debe pasar a decir "60-90 días" como el FAQ de Kommo? (decisión founder).
- Seguro de carga: ¿se ofrece? ¿se menciona? (aparece en FAQ §17 como "según condiciones del servicio").
