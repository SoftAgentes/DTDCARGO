# DTD-Cargo · Nómina — Handoff

> Estado del **módulo de nómina** (RRHH · LOTTT · Venezuela). Cubre el ERP web (admin) y la
> app del empleado, más la integración con el dashboard. Hoy es **100% mock en el navegador**;
> el seam para backend está en `backend/API-CONTRACT.md` (sección 10).

---

## 1 · Qué está construido

### Admin — ERP → Finanzas → Nómina
| Función | Detalle |
|---|---|
| **Reglas de cálculo** | Única fuente de verdad de los parámetros LOTTT (frecuencia de pago, método de días, SML, cestaticket, bono de guerra, %s de deducción, topes IVSS/RPE, recargos, provisiones, prestaciones). Editas → recalcula toda la nómina. Cada corte **congela** las reglas usadas. |
| **Nómina del período** | Estados **borrador → confirmado → pagado**, subir comprobante, **exportar Excel** (CSV). |
| **Empleados + Expediente** | Ficha, banco, KPIs, préstamos, comunicaciones y línea de tiempo por empleado. |
| **Asistencia + Feriados** | Calendario mensual (trabajado/ausente/libre/feriado + horas extra). Feriados nacionales VE + propios. |
| **Solicitudes** | Auto-registro por link **con aprobación del admin** (asigna sueldo → crea ficha + login + bienvenida). |
| **Préstamos** | Cuota con **descuento automatico** en el recibo. |
| **Liquidación** | **Legal vs contingente** + exposición, por causa (Art. 76/78/79/92), con **finiquito PDF**. |
| **Amonestaciones** | Asistente por pasos (causa Art. 79 → relato → testigos → acta). |
| **Prestadores** | Pagos por sesión a freelance, fuera de la nómina fija. |
| **Comunicaciones + WhatsApp** | Envíos al empleado con acuse de recibo. |

### App del empleado (`App del Empleado.html`)
Auto-registro con aprobación · Inicio (pago, préstamo, asistencia) · **Recibo LOTTT** (salarial /
no salarial, cuota de préstamo, total a cobrar) con **Descargar PDF** y WhatsApp · Mensajes con
acuse · **Perfil editable** (datos + banco).

### Dashboard del ERP
Widget **"Nómina · resumen"** (estado del corte, neto, préstamos, ausencias, solicitudes) + 4 KPIs
de nómina configurables.

### Multi-empresa
Respeta el selector global del ERP (`window.ERPData.currentTenant`). Cada empresa (DTD · Andes ·
Pacífico) ve **solo su nómina**, con aislamiento real (las mutaciones no tocan otros tenants).

---

## 2 · Arquitectura / dónde vive el código
- `erp/modules/nomina-data.jsx` — **capa de datos y cálculo** (`window.NominaData`). Reglas,
  empleados, `calcRecibo`, `calcLiquidacion`, préstamos, asistencia, feriados, solicitudes,
  prestadores, documentos PDF.
- `erp/modules/nomina.jsx` — UI admin (`window.ModuleNomina`).
- `empleado/app.jsx` + `App del Empleado.html` — app del empleado.
- `erp/modules/dashboard.jsx` — widget + KPIs de nómina.
- `backend/API-CONTRACT.md` §10 — **seam para backend** (mismas firmas, otra implementación).

Regla de migración: el **cálculo debe moverse al servidor** (frontera de seguridad y fuente de
verdad fiscal). El prototipo lee/escribe `localStorage` (`dtd_nomina_*`).

---

## 3 · Validación contable — ANTES de producción

### ✅ Ya resueltos (mecánicos)
1. **Prorrateo por frecuencia de pago** (mensual/quincenal/semanal) — regla `frecuenciaPago`.
2. **Topes de cotización** IVSS (5 SM) y RPE (10 SM); FAOV sin tope.
3. **Horas extra monetizadas** en el recibo (valor hora × recargo LOTTT).

### ⚠️ Pendientes — CRITERIO DEL CONTADOR (no cerrar sin él)
4. **Qué bonos son salariales.** Hoy las deducciones se calculan solo sobre el sueldo base.
   Si la empresa paga bonos regulares de carácter salarial, definen la base de cotización.
5. **Salario integral para prestaciones** (Art. 142). La liquidación hoy NO incluye las
   **alícuotas de utilidades + bono vacacional**, así que la cifra "legal" queda subestimada.
   Es el punto más delicado: define el monto de la liquidación.

### Nota sobre los topes
Con los topes legales al pie de la letra, SSO/RPE quedan en centavos (el SM en USD es muy bajo).
Es correcto según la ley, pero muchas empresas VE cotizan sobre el salario real. **Switch:** subir
los topes en *Reglas → Deducciones* (ej. 999 SM) hace que la retención use el salario completo.
Decisión del contador.

---

## 4 · Mejoras opcionales (no urgentes)
- Recibo/finiquito ya exportan a PDF (vía print). Multi-empresa ya implementado.
- Posible: numeración formal de recibos, firma digital del finiquito, histórico de cortes
  por empleado en el expediente.

---

## 5 · Marca / convenciones
Sin colores ni fuentes fuera del sistema (navy/vino · Sora/Nunito/Archivo · JetBrains Mono).
Sin AI slop. Datos mock realistas CN→VE (Shipping Mark, RIF, bancos VE). Tono venezolano neutro, tuteo.
