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

## TANDA 1 — Núcleo marítimo (lo que más se cotiza)

### 1. `dtd-services-lcl` — Carga puerta a puerta LCL + DDP / Financiamiento 100%
- ✅ Resumen, incluye (flete+aduana+impuestos), pago al llegar, cobertura toda VE, CBM. (FAQ §22/§24/§26, `lib/faqs.ts`)
- ❓ FALTA: ¿qué NO incluye? (¿seguro de carga? ¿compra de la mercancía? ¿estiba especial?) · ¿condición/umbral de precio? · tiempos exactos a publicar.

### 2. `consolidacion-bodega-yiwu` — Consolidación FCL/LCL en bodega propia
- ✅ Juntar varios proveedores en Yiwu; sale unificado; LCL por CBM / FCL contenedor entero. (FAQ §26)
- ❓ FALTA: ¿qué incluye exactamente (almacenaje gratis X días? reempaque?) · qué NO incluye · costo/condición de almacenaje extra · tiempo de espera de salida (cada 15-21 días?).

### 3. `reserva-contenedores` — Reserva de contenedor FCL
- ✅ Reserva de buque, posiciona contenedor vacío en fábrica, doc de exportación.
- ❓ FALTA: incluye/no incluye · precio o condición · cómo se solicita (escala a asesor) · tiempos.

### 4. `transito-aduana` + `last-mile` — Aduana/desaduanaje + entrega nacional
- ✅ Aduana e impuestos a nombre de DTD (DDP), nacionalización, last-mile a toda VE. (FAQ §23/§24)
- ❓ FALTA: ¿se vende suelto o solo dentro de DDP? · qué NO cubre · tiempos de nacionalización.

---

## TANDA 2 — Calidad y proveedores (origen China)

### 5. `chequeo-etiquetado` — Inspección y etiquetado
- ✅ Verificación física vs ficha técnica + etiquetado/marcado; deep-dive en `/servicios/inspeccion`.
- ❓ FALTA: precio = **stand-by** (no publicar) → confirmar que la ficha solo enlaza a inspección + WhatsApp.

### 6. `verificacion-proveedores` — Verificación de proveedores
- ✅ Auditoría de legitimidad + inspección pre-producción/pre-embarque. (FAQ §7)
- ❓ FALTA: incluye/no incluye · precio (stand-by?) · entregable (reporte) · tiempos.

### 7. `auditoria-calidad` — Auditoría y QC
- ✅ Auditorías online/presenciales, QC, estándares internacionales.
- ❓ FALTA: incluye/no incluye · precio · entregable · tiempos.

### 8. `lab-permisologia` — Lab testing y permisología
- ✅ Coordina ensayos (RoHS/CE/FDA/SGS) + permisos de exportación.
- ❓ FALTA: incluye/no incluye · quién paga el lab · precio/condición · tiempos.

### 9. `compra-asistida` — Compra asistida / sourcing
- ✅ Somos tu depto. de compras en China: ubicar, negociar, gestionar, pagar al proveedor. (FAQ §9)
- ⚠️ El proveedor lo pone DTD (red propia) — **NUNCA revelar contacto**.
- ❓ FALTA: **modelo comercial sin definir** (margen vs comisión, cómo se cobra, hasta dónde se le cuenta al cliente). Mientras no se defina → ficha sin precio, "viabilidad y costo los confirma un asesor".

### 10. `asesoria-pagos` — Asesoría en pagos a proveedores
- ✅ Facilitamos transacciones seguras a proveedores chinos (Yuan: Alipay/WeChat/transfer/efectivo).
- ❓ FALTA: incluye/no incluye · costo/comisión · cómo se solicita.

---

## TANDA 3 — Trámites y legal (mayormente sede Venezuela)

### 11. `visado-chino` — Visado de negocios chino
- ✅ Asesoría documental, formularios, coordinación consulado, foto en oficina; todo desde Valencia.
- ❓ FALTA: incluye/no incluye · precio/honorarios · tiempos · requisitos del cliente.

### 12. `registro-marca-cn` / `registro-marca-coord` — Registro de marca en China (CNIPA)
- ✅ Gestión de PI ante CNIPA; coordinación + documentos desde Venezuela.
- ❓ FALTA: incluye/no incluye · honorarios + tasas oficiales · tiempos (meses) · qué entrega.

### 13. `documentos-importacion` — Documentos de importación
- ✅ Elabora/revisa/tramita facturas de embarque, declaraciones, certificados, normativa.
- ❓ FALTA: ¿suelto o dentro de DDP? · qué NO cubre · precio · tiempos.

### 14. `muestras-courier` — Envío de muestras y documentos (COURIER ACTIVO)
- ✅ Express DHL/UPS/FedEx desde Yiwu para muestras/documentos/lotes pequeños críticos.
- ⚠️ Aclarar: NO es flete aéreo de carga (eso suspendido). Courier de muestras/docs **sí activo**.
- ❓ FALTA: incluye/no incluye · costo/condición · tiempos · límite de tamaño/peso.

---

## Pendiente de coherencia global (no por servicio)
- Año 2008 en todos lados (en curso, esta sesión).
- ¿`/faq` (`lib/faqs.ts`) debe pasar a decir "60-90 días" como el FAQ de Kommo? (decisión founder).
- Seguro de carga: ¿se ofrece? ¿se menciona? (aparece en FAQ §17 como "según condiciones del servicio").
