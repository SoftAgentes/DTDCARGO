# Prompt para Claude Code · Diseñar la Calculadora LCL DDP (DTD-Cargo)

> **Contexto:** la calculadora **ya es funcional** (lógica validada). Esta es la
> guía para que **rediseñes la capa visual** respetando el sistema de marca
> DTD-Cargo y **conservando exactamente** la lógica, los límites y los mensajes
> que están más abajo. No inventes números ni textos nuevos: todo se deriva de
> los parámetros. Si algo contradice `CLAUDE.md`, avisá con `BRAND-CHECK`.

---

## 0 · Qué es

Calculadora pública **LCL DDP · China → Venezuela**. El cliente indica su
**volumen (CBM)**, **peso** y un par de opciones; ve un **estimado puerta a
puerta** y un **CTA de WhatsApp** que abre el chat con la cotización ya escrita.
Es la pieza de captación: de WhatsApp el dato va al negocio y al CRM.

---

## 1 · Sistema de marca (NO re-derivar)

- **Tokens:** usar `erp/tokens.css` (variables `var(--*)`). Cero hex inventados.
- **Color:** `--wine #7F0F1A` (acento/CTA/relleno del contenedor), `--ink #0F1E3D`
  (navy, texto y paneles), `--bg-base #FBFAF7`, semánticos `--success/--warning/--danger/--info`.
  Único gradiente permitido: navy → `#1F3055` (panel del total).
- **WhatsApp verde `#25D366`:** SOLO en el botón de WhatsApp (identidad de la
  plataforma; ya hay precedente en `operario/bodeguero.jsx`). En el resto, wine/ink.
- **Tipografía:** sistema → **Nunito Sans** (`--f-sans`, cuerpo) + **Sora**
  (`--f-display`, títulos/KPIs) + **JetBrains Mono** (`--f-mono`, todos los números:
  CBM, kg, $, tarifa). Branding → wordmark **"DTD Cargo"** en **Archivo Black**
  (`--f-brand-display`): "DTD" en wine, "Cargo" en ink.
- **Espaciado/Radius/Sombras:** escala 4px (`--s-*`), `--r-*`, `--shadow-*`. Nada arbitrario.
- **Sin AI slop:** sin gradientes coloridos, sin emoji decorativo, sin glassmorphism,
  sin bordes 24px+, texto **left-align**. Voz: castellano rioplatense/venezolano,
  voseo ("pagás", "indicá", "escribinos"). Tagline: "Con Confianza, de China a tu puerta."

---

## 2 · Layout (el diseño que queremos)

Tarjeta con **2 columnas** (en mobile se apilan) + una **nota al pie a ancho completo**.

**Columna izquierda · ENTRADA**
1. Wordmark "DTD Cargo" + eyebrow `CALCULADORA LCL DDP`.
2. Título (Sora): "Cotizá tu carga China → Venezuela". Subtítulo corto.
3. **Tarifa de CBM** — input con prefijo `$`, sufijo `USD/CBM`, tag **"auto · editable"**
   (la genera el sistema; el cliente puede ajustarla). Hint: "La genera el sistema. Ajustala si tu cotización es distinta."
4. **CBM total** (sufijo `m³`) y **Peso total** (sufijo `kg`) — lado a lado, número grande en mono.
5. Toggles: **Embalaje especial** (badge `+$50`), **Lleva baterías** (badge `×1.5`),
   **Carga especial o de alto valor** (deriva al asesor).
6. **Destino · Casco Central** — select: Valencia / Maracay / Caracas.

**Columna derecha · RESULTADO**
1. **Contenedor 40'HC que se llena** con el CBM: silueta con borde navy, corrugado
   vertical, puerta a la derecha; relleno **wine** proporcional a `cbm/68`
   (animar con `transform: scaleX()`, **no** `width %` — esa transición se traba).
   Muestra el `% lleno`; si pasa de 68 → `100%+`.
2. **Total estimado** en panel navy (gradiente `--ink` → `#1F3055`), número gigante en Sora.
3. **Desglose** (filas): Volumen base → Excedente de peso → Embalaje → Baterías ×1.5
   → Ajuste a mínimo facturable → **Total**.
4. **Alerta de densidad** cuando aplica (ver §4-D).
5. **Badge:** `Financiamiento 100%* · pagás al llegar a Venezuela`.
6. **CTA WhatsApp** (verde, ancho completo).

**Nota al pie (ancho completo, abajo de todo):**
> \* Financiamiento 100%: pagás el flete al llegar a Venezuela. **Aplican restricciones.** Este estimado es aproximado y refleja nuestra tarifa base DDP (puerta a puerta).

---

## 3 · Parámetros (única fuente · todo se deriva de acá)

```
Tarifa por CBM:            $800 USD   (editable por el cliente; default 800)
Mínimo facturable (piso):  $50 USD
Peso incluido sin recargo: 500 kg por m³ (CBM)
Recargo por kilo extra:    $1 USD/kg
Densidad máxima:           600 kg por m³
Embalaje especial:         +$50 USD
Multiplicador baterías:    ×1.5 sobre el flete
CBM máximo:                68 m³
Peso máximo total:         27.000 kg
Destinos:                  Casco Central (Valencia · Maracay · Caracas), sin recargo
WhatsApp destino:          +58 412 166 8021  (wa.me/584121668021)
```
**Regla de oro:** si cambia la tarifa, **todos** los números de los mensajes
(punto de cruce, excedentes, costos) se recalculan solos. Nada hardcodeado.

---

## 4 · Lógica de cálculo

```
crossPoint   = MIN_FACT / tarifa            // p.ej. 50/800 = 0.0625 m³
base         = cbm × tarifa
pesoIncluido = 500 × cbm
excedenteKg  = max(peso − pesoIncluido, 0)
excedenteCost= excedenteKg × $1
embalajeCost = embalaje ? 50 : 0
fletePre     = base + excedenteCost + embalajeCost
fleteBatt    = baterias ? fletePre × 1.5 : fletePre
total        = max(fleteBatt, 50)           // el piso de $50 crea el punto de cruce
ajusteMin    = total − fleteBatt            // > 0 cuando muerde el piso
density      = peso / cbm
```
**Orden:** `(base + excedente + embalaje) × baterías`, después aplicar piso `$50`.

---

## 5 · Límites y mensajes (texto EXACTO)

### Mensaje bajo el campo **CBM**
- **Mínimo** — `0 < cbm < crossPoint`:
  > Nuestro mínimo de carga es {crossPoint} m³ — por debajo, el envío sale ${MIN_FACT}.
  (sigue cotizando, pero a `$50` fijo. Ej $800: "…es 0.0625 m³ … sale $50.")
- **Máximo** — `cbm > 68`:
  > Eso es más que un contenedor. Consulte a su asesor

### Mensaje bajo el campo **PESO** (3 niveles · prioridad c → b → a)
- **a) Excedente con recargo** — `cbm×500 < peso ≤ cbm×600`:
  > El máximo de peso sin recargo para {cbm} m³ es {cbm×500} kg. Te pasás por {excedenteKg} kg → +${excedenteCost} ($1/kg extra).
  (Ej $800, 0.05 m³, 28 kg → "…es 25 kg. Te pasás por 3 kg → +$3 ($1/kg extra).")
- **b) Demasiado denso (FCL)** — `peso > cbm×600`:
  > Para {cbm} m³, más de {cbm×600} kg es demasiado denso — consultá con tu asesor (FCL).
- **c) Tope de contenedor** — `peso > 27.000 kg`:
  > Esto es más que el peso permitido por contenedor; consulte a su asesor
- (Peso dentro del máximo sin recargo → **sin mensaje**.)

### Estado del RESULTADO
- **F · Vacío** (`cbm ≤ 0` o `peso ≤ 0`): no cotiza → "El CBM total y el peso deben ser mayores a cero."
- **E · Carga especial** (checkbox): deriva → "Para carga especial, peligrosa o que requiere permisos de exportación, consultá con tu asesor — la cotizamos a medida."
- **B · CBM > 68**: deriva → "Eso es más que un contenedor. Consulte a su asesor."
- **C · Peso > 27.000**: deriva → "Esto es más que el peso permitido por contenedor; consulte a su asesor."
- **D · Densidad > 600**: **muestra el estimado** + alerta "DENSIDAD ALTA":
  > Tu carga tiene {density} kg/CBM, supera el máximo de 600 kg/CBM. Necesitas FCL o cotización personalizada — escríbenos por WhatsApp.
- **Normal:** muestra Total + desglose.

Etiqueta del CTA: **"Cotizar por WhatsApp"** en cotización normal; **"Consultar con un asesor"** cuando deriva (E/B/C/D).

---

## 6 · Mensaje de WhatsApp (lo que abre el CTA · wa.me/584121668021)

**A) Cotización normal (hay estimado válido):**
```
Acabo de cotizar en tu calculadora. Esto es lo que estoy calculando:

• CBM total: {cbm} m³
• Peso total: {peso} kg
• Embalaje: {Caja estándar | Caja especial (madera o paleta)}
• Baterías: {Sí | No}
• Destino: {ciudad}
• Estimado web: US${total}

¿Me confirman la tarifa final y los tiempos? (Financiamiento 100%, pago al llegar)
```

**B) Deriva al asesor (E/B/C/D):**
```
Acabo de cotizar en tu calculadora y necesito asesoría con mi carga:

• CBM total: {cbm} m³
• Peso total: {peso} kg
• Embalaje: {Caja estándar | Caja especial (madera o paleta)}
• Baterías: {Sí | No}
• Destino: {ciudad}

{mensaje de la alerta correspondiente del §5}

¿Me ayudan con una cotización a medida?
```
Los `{valores}` se reemplazan por lo que cargó el cliente. El número y la tarifa
viven en una **sola constante editable** arriba del archivo.

---

## 7 · Entrega

- **Standalone** (página pública): un HTML que cargue `erp/tokens.css` + Archivo/Archivo Black,
  React 18 + Babel, y un `.jsx` con el componente. Centrado, responsive, mobile apila columnas.
- **Integrado** (dentro del ERP/Portal): reusar `window.ERPUI` (`Input`, `Select`, `Btn`,
  `Card`, `Badge`) y publicar la cotización al bridge/CRM (`window.DTDData.pushPortalEvent`
  / `pushPortalQuote`) además del WhatsApp.
- Mantener todo **directamente editable**: HTML canónico, estilos con tokens, sin Tailwind
  ni CSS-in-JS.

**Criterio de aceptación:** los totales y mensajes deben coincidir con los ejemplos del §5
(p.ej. 12 CBM/4.800 kg → $9.600; 8 CBM/5.200 kg + embalaje + baterías → $11.475;
0.05 m³/28 kg → piso $50 con "Ajuste a mínimo facturable +$7"). Sin errores de consola,
paleta de marca intacta, verde solo en el CTA de WhatsApp.
