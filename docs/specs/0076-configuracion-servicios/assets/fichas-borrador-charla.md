# Fichas de servicios — borrador para la charla del equipo

> **Borrador** para llenar en la dinámica del equipo (servicios **11–20**, los que aún no tienen
> ficha). Origen: panel UX + tabla servicios→perfiles, 2026-06-14. El Word fillable equivalente
> está en `Downloads/DTD-Fichas-Servicios-Borrador.docx` (generador: `Downloads/_fichas-build/build.cjs`).
>
> Cada servicio se explica en **dos caras**: lo que ve el **CLIENTE** (alimenta la ficha pública de
> `/servicios` → `lib/servicios-detalle.ts` / `service_configs`) y lo que hacemos **POR DENTRO**
> (alimenta el proceso interno + el `owner_role` de la tabla servicios→perfiles). Lo que está como
> `[ completar ]` lo llena el área que tiene el dato real (precio, tiempos, proceso). Es borrador —
> el equipo corrige libre.

## Plantilla (11 campos por servicio)

**A · Cara al cliente** — 1) qué es en 1 frase sin jerga · 2) qué problema/miedo resuelve ·
3) qué INCLUYE · 4) qué NO incluye (hasta dónde llega) · 5) cuánto tarda · 6) cómo se cobra ·
7) cómo se solicita.

**B · Por dentro** — 8) dueño (rol/persona) · 9) pasos (paso → responsable → acción) ·
10) tercero involucrado · 11) qué cobramos nosotros (tarifa/markup/spread).

---

## 11 · Inspección de calidad
**Dueño:** Operaciones / QA (coord. Sam)

**A · Cara al cliente**
1. **Qué es:** Revisamos tu mercancía en la fábrica o bodega en China, antes de embarcar, con fotos y reporte en español.
2. **Problema:** Que no embarques producto defectuoso, incompleto o equivocado.
3. **Incluye:** Inspección visual, conteo, fotos y reporte en español.
4. **No incluye:** Pruebas de laboratorio (servicio 14). No reparamos defectos.
5. **Tarda:** `[ completar ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** Por WhatsApp, con los datos de tu orden.

**B · Por dentro**
8. **Dueño:** Operaciones / QA — coordina Sam.
9. **Pasos:** Se agenda → un inspector va a la fábrica en China → reporte con fotos → tú decides si embarcas.
10. **Tercero:** Empresa / inspector de inspección en China.
11. **Cobramos:** `[ completar ]`

**Para la charla:** ¿AQL o revisión simple? ¿Quién agenda con la fábrica?

---

## 12 · Verificación de proveedores
**Dueño:** Comercial / Sourcing (José)

**A · Cara al cliente**
1. **Qué es:** Confirmamos que tu proveedor en China es real y serio antes de que le pagues.
2. **Problema:** Evita estafas y fábricas fantasma.
3. **Incluye:** Existencia legal (licencia comercial china), antigüedad, datos de contacto reales y señales de alerta. Reporte en español.
4. **No incluye:** La calidad del producto (eso es Inspección, servicio 11). No es un seguro contra incumplimiento.
5. **Tarda:** `[ completar ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** Por WhatsApp, con el nombre o el enlace del proveedor.

**B · Por dentro**
8. **Dueño:** Comercial / Sourcing — José.
9. **Pasos:** José recibe los datos → consulta registros oficiales (+ tercero si aplica) → arma el reporte → te lo entrega.
10. **Tercero:** `[ completar — ¿plataforma de verificación o agente en China? ]`
11. **Cobramos:** `[ completar ]`

**Para la charla:** ¿Usamos una plataforma de verificación o un agente en China? ¿Tarifa por proveedor?

---

## 13 · Auditoría y control de calidad
**Dueño:** Operaciones / QA (coord. Sam)

**A · Cara al cliente**
1. **Qué es:** Auditamos a fondo la fábrica de tu proveedor (capacidad, sistemas), no solo un lote.
2. **Problema:** Saber si la fábrica es confiable para producir en serie.
3. **Incluye:** `[ completar ]`
4. **No incluye:** `[ completar ]`
5. **Tarda:** `[ completar ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** `[ completar ]`

**B · Por dentro**
8. **Dueño:** Operaciones / QA — coordina Sam.
9. **Pasos:** `[ completar ]`
10. **Tercero:** Empresa auditora en China.
11. **Cobramos:** `[ completar ]`

**Para la charla:** ¿En qué se diferencia de Inspección (servicio 11)? (alcance: fábrica vs lote)

---

## 14 · Lab testing y permisología en China
**Dueño:** Operaciones / QA (coord. Sam)

**A · Cara al cliente**
1. **Qué es:** Pruebas de laboratorio del producto + permisos de exportación en China.
2. **Problema:** Cumplir normas y certificaciones para que tu producto entre legal.
3. **Incluye:** `[ completar ]`
4. **No incluye:** `[ completar ]`
5. **Tarda:** `[ completar ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** `[ completar ]`

**B · Por dentro**
8. **Dueño:** Operaciones / QA — coordina Sam.
9. **Pasos:** `[ completar ]`
10. **Tercero:** Laboratorio / agente de permisos en China.
11. **Cobramos:** `[ completar ]`

**Para la charla:** ¿Qué productos lo necesitan? ¿Con qué laboratorios trabajamos?

---

## 15 · Compra asistida / sourcing
**Dueño:** Comercial / Sourcing (José)

**A · Cara al cliente**
1. **Qué es:** Te ayudamos a encontrar y comprar el producto en China (no solo a verificarlo).
2. **Problema:** No sabes dónde comprar ni cómo negociar con la fábrica.
3. **Incluye:** `[ completar ]`
4. **No incluye:** `[ completar — ¿hasta dónde: cotizar vs comprar a nuestro nombre? ]`
5. **Tarda:** `[ completar ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** `[ completar ]`

**B · Por dentro**
8. **Dueño:** Comercial / Sourcing — José.
9. **Pasos:** `[ completar ]`
10. **Tercero:** Proveedores / fábricas en China (nunca acceden a nuestro sistema).
11. **Cobramos:** `[ completar ]`

**Para la charla:** ¿Hasta dónde llega: cotizar vs comprar a nuestro nombre? ¿Comisión?

---

## 16 · Asesoría en pagos a proveedores  ⚠️ riesgo legal
**Dueño:** Contabilidad + Comercial (José)

**A · Cara al cliente**
1. **Qué es:** Te orientamos para pagar a tu proveedor en China de forma segura.
2. **Problema:** No sabes cómo enviar el pago a China sin riesgo.
3. **Incluye:** `[ completar ]`
4. **No incluye:** `[ completar — hasta dónde llega ]`
5. **Tarda:** `[ completar ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** `[ completar ]`

**B · Por dentro**
8. **Dueño:** Contabilidad + Comercial — José.
9. **Pasos:** `[ completar ]`
10. **Tercero:** `[ completar ]`
11. **Cobramos:** `[ completar ]`

**Para la charla:** ⚠️ RIESGO LEGAL — el copy debe sonar a *asesoría / facilitación*, NUNCA a casa de cambio ni "garantizar". Evitar la palabra "responsabilidad" (usar "hasta dónde llega el servicio"). ¿Hasta dónde llega?

---

## 17 · Envío de muestras y documentos (courier)
**Dueño:** Comercial / Sourcing (José)

**A · Cara al cliente**
1. **Qué es:** Traemos tus muestras o documentos urgentes de China por courier express.
2. **Problema:** Necesitas ver o probar la muestra antes de comprar en volumen.
3. **Incluye:** `[ completar ]`
4. **No incluye:** `[ completar ]`
5. **Tarda:** `[ completar ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** `[ completar ]`

**B · Por dentro**
8. **Dueño:** Comercial / Sourcing — José.
9. **Pasos:** `[ completar ]`
10. **Tercero:** Courier (DHL / FedEx / etc.).
11. **Cobramos:** `[ completar ]`

**Para la charla:** ¿Cobramos markup sobre el courier o es passthrough? ¿Tiempos?

---

## 18 · Gestión de visado de negocios chino
**Dueño:** Trámites (coord. Sam)

**A · Cara al cliente**
1. **Qué es:** Gestionamos tu visa de negocios para viajar a China.
2. **Problema:** El trámite consular es complicado y burocrático.
3. **Incluye:** Orientación de requisitos, carta de invitación (si aplica) y coordinación con el consulado o el agente.
4. **No incluye:** El costo consular oficial (va aparte). No garantiza la aprobación (la decide el consulado).
5. **Tarda:** `[ completar ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** Por WhatsApp.

**B · Por dentro**
8. **Dueño:** Trámites — coordina Sam.
9. **Pasos:** Tú entregas tus documentos → Sam coordina con el tercero → seguimiento por hitos → visa.
10. **Tercero:** Agente de visados / consulado chino.
11. **Cobramos:** `[ completar ]`

**Para la charla:** ¿Cobramos solo la gestión y el consular va aparte? ¿Tiempos?

---

## 19 · Registro de marca en China (CNIPA)
**Dueño:** Trámites (coord. Sam)

**A · Cara al cliente**
1. **Qué es:** Registramos tu marca en China (CNIPA) para protegerla.
2. **Problema:** Que no te copien ni registren tu marca en China.
3. **Incluye:** `[ completar — ¿búsqueda previa + solicitud? ]`
4. **No incluye:** `[ completar ]`
5. **Tarda:** `[ completar — suele ser meses ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** `[ completar ]`

**B · Por dentro**
8. **Dueño:** Trámites — coordina Sam.
9. **Pasos:** `[ completar ]`
10. **Tercero:** Agente legal de marcas (CNIPA) en China.
11. **Cobramos:** `[ completar ]`

**Para la charla:** ¿Alcance: búsqueda previa + registro? ¿Tiempos (meses)? ¿Costo oficial passthrough?

---

## 20 · Cursos de importación
**Dueño:** Formación (Alberto)

**A · Cara al cliente**
1. **Qué es:** Aprende a importar de China paso a paso.
2. **Problema:** El miedo y el desconocimiento del que importa por primera vez.
3. **Incluye:** Módulos (cómo comprar, Incoterms, aduana, costos), material, en español.
4. **No incluye:** Asesoría 1-a-1 de tu caso puntual (es otro servicio).
5. **Tarda:** `[ completar ]`
6. **Cobra:** `[ completar ]`
7. **Se solicita:** Por registro en el sitio o WhatsApp.

**B · Por dentro**
8. **Dueño:** Formación — Alberto (contenido). Campaña: Marketing (Fátima). Inscripciones: CRM.
9. **Pasos:** `[ completar ]`
10. **Tercero:** Facilitador (propio o tercero).
11. **Cobramos:** `[ completar ]`

**Para la charla:** ¿El facilitador es propio o tercero? ¿Precio del curso?

---

## Referencia · servicios que ya tienen ficha (1–10)

No entran en la charla (salvo afinar copy). Ver el contenido vivo en `dtdcargo.com/servicios`.

| # | Servicio | Estado |
|---|---|---|
| 1 | Puerta a puerta DDP | núcleo · protagonista |
| 2 | LCL consolidado | núcleo |
| 3 | FCL en bodega | núcleo |
| 4 | FCL directo de fábrica | núcleo |
| 5 | Transporte terrestre nacional | núcleo · próximamente |
| 6 | Tránsito de aduana y desaduanaje | add-on |
| 7 | Documentos de importación | add-on |
| 8 | Revisión de mercancía al recibir | add-on |
| 9 | Etiquetado por pieza | add-on |
| 10 | Cajas defectuosas y reempaque | add-on |
