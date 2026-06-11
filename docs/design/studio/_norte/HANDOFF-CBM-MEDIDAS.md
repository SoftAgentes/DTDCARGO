# DTD-Cargo · Handoff · CBM por medidas (alto × ancho × largo + cajas)

> **✅ INTEGRADO A PRODUCCIÓN (2026-06-08).** Esta feature ya vive en
> `calc/cbm-variants.jsx` (`window.CalcLCL`, monta en `Calculadora CBM · DTD-Cargo.html`).
> El sandbox (`calc/cbm-medidas.jsx`, `Calculadora CBM · Prueba medidas.html`) **se borró**
> al mergear. Este doc queda como **referencia de la lógica** (fórmula, estado, criterios).
> Para producto real (API), ver `backend/API-CONTRACT.md`.

---

## 1. Qué hace

Forma **alternativa** de obtener el **CBM total** para el cliente que no sabe su CBM
pero sí tiene las medidas de la caja. Oculta por defecto; al desplegarse calcula y
**asigna el CBM total automáticamente**.

- Disparador discreto (link, no botón) **debajo del campo CBM total**, colapsado por defecto.
- Al abrir → panel con **Alto · Ancho · Largo (cm)** + **Cantidad de cajas**.
- Calcula en vivo y **escribe sobre el estado `cbm`**. Mientras está activo, el campo
  CBM total queda **read-only** con tag `auto · medidas` (transparencia de origen del número).
- Cerrar el panel ("Prefiero escribir el CBM a mano") libera el campo; el último CBM calculado queda.

---

## 2. Lógica de cálculo (única fuente)

```
CBM por caja = (alto_cm × ancho_cm × largo_cm) / 1.000.000      // cm³ → m³
CBM total    = CBM por caja × cantidad_de_cajas
```

Helper exacto (ya integrado en `calc/cbm-variants.jsx`):

```jsx
// CBM por medidas (cm). perBox = m³ por caja · total = perBox · cajas
function computeDims(alto, ancho, largo, cajas) {
  const a = Math.max(parseFloat(alto)  || 0, 0);
  const b = Math.max(parseFloat(ancho) || 0, 0);
  const c = Math.max(parseFloat(largo) || 0, 0);
  const n = Math.max(parseFloat(cajas) || 0, 0);
  const perBox = (a * b * c) / 1e6;
  const total  = perBox * n;
  const valid  = a > 0 && b > 0 && c > 0 && n > 0;
  return { a, b, c, n, perBox, total, valid };
}
```

> El resultado se asigna con el helper existente `trimNum(total)` para evitar colas de
> decimales (`0.7199999` → `0.72`). El display del panel usa `perBox.toFixed(3)` para el
> m³/caja y `fmtCBM(total)` para el CBM total (mismas funciones de la calculadora).

**Caso de prueba canónico (verificado):** `40 × 30 × 60 cm × 10 cajas`
→ `0.072 m³/caja` → **`0.72 CBM`** → se autoasigna a CBM total.

---

## 3. Estado a agregar en `CalcLCL`

```jsx
const [showDims, setShowDims] = useState(false);
const [altoStr,  setAltoStr]  = useState('');
const [anchoStr, setAnchoStr] = useState('');
const [largoStr, setLargoStr] = useState('');
const [cajasStr, setCajasStr] = useState('1');

const d = { ...computeDims(altoStr, anchoStr, largoStr, cajasStr),
            altoStr, anchoStr, largoStr, cajasStr };
const dimsDriving = showDims && d.valid;   // el CBM lo manda el panel

// Auto-asigna: panel abierto + medidas válidas → CBM total = total calculado.
React.useEffect(() => {
  if (showDims && d.valid) setCbm(trimNum(d.total));
}, [showDims, altoStr, anchoStr, largoStr, cajasStr]);  // NO depende de cbm → sin loop
```

**Nota de implementación:** el efecto **no** lista `cbm` en sus dependencias (evita
bucle de re-render). Es un flujo de un solo sentido: medidas → `cbm`. Cuando
`dimsDriving` es true, el `NumField` de CBM va con `readOnly` + `tag="auto · medidas"`.

---

## 4. Dónde va en el render

En `calc/cbm-variants.jsx`, dentro del grid de entrada, **envolver** la fila
`CBM total / Peso total` y colgar debajo el disparador + panel:

```jsx
<div>
  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
    <NumField label="CBM total"
      tag={dimsDriving ? 'auto · medidas' : undefined}
      value={cbm} onChange={setCbm} suffix="m³" big
      hint={dimsDriving ? 'Calculado desde las medidas de tu caja.' : cbmHint}
      hintTone={dimsDriving ? 'info' : cbmTone}
      readOnly={dimsDriving} />
    <NumField label="Peso total" value={peso} onChange={setPeso} suffix="kg" big
      hint={pesoHint} hintTone={pesoTone} />
  </div>

  {/* Disparador · oculto por defecto */}
  <button onClick={() => setShowDims(v => !v)} style={{ /* link wine, ver cbm-variants.jsx */ }}>
    <span style={{ transform: showDims ? 'rotate(90deg)' : 'none' }}>▶</span>
    {showDims ? 'Prefiero escribir el CBM a mano' : '¿No sabes tu CBM? Calculalo con las medidas'}
  </button>

  {showDims && <div style={{ marginTop:12 }}>
    <DimPanel d={d} onAlto={setAltoStr} onAncho={setAnchoStr} onLargo={setLargoStr} onCajas={setCajasStr} />
  </div>}
</div>
```

El componente `DimPanel` (3 `NumField` en grid `1fr 1fr 1fr` + 1 de cantidad + readout)
está completo en `calc/cbm-variants.jsx` (producción). Reusa `NumField` (al que
se le agregó la prop `readOnly`), `trimNum`, `fmtCBM`. **Cero tokens nuevos**, todo
`var(--*)` del sistema.

---

## 5. `NumField` — única modificación al componente existente

Agregar prop `readOnly` (default `false`):
- `input` → `readOnly={readOnly}`, `cursor` default, color `--ink-soft`.
- contenedor → fondo `--bg-elevated` cuando `readOnly`.

No cambia ningún uso actual (la prop es opcional).

---

## 6. Reglas de negocio que se mantienen

- El CBM calculado entra al **mismo `computeQuote`** → respeta todo: punto de cruce
  (`MIN_FACT/tarifa`), tope contenedor (`CBM_MAX=68`), densidad (`DENS_MAX=600`),
  excedente de peso, piso `$50`, derivación a asesor. **No tocar `computeQuote`.**
- El mensaje de WhatsApp y el lead al CRM (`pushPortalEvent`) usan `r.cbm` → ya
  reflejan el valor calculado sin cambios.

---

## 7. Decisiones de producto (pendientes de confirmar con el equipo)

1. **Auto-asignar vs. botón "Usar este CBM".** El prototipo **autoasigna en vivo**
   (pedido original). Si el equipo prefiere paso explícito, cambiar el `useEffect` por
   un handler en un `<Btn variant="soft">Usar este CBM</Btn>`.
2. **Voz tuteo vs. voseo.** El copy del disparador está en **voseo** ("Calculalo")
   para igualar el resto de la calculadora, que hoy está en voseo
   ("Cotiza", "Indica", "pagas"). ⚠ `CLAUDE.md` exige **tuteo**. Toda la calculadora
   viola esta regla hoy; **decisión global pendiente**. Si se unifica a tuteo, el copy
   pasa a "¿No sabes tu CBM? Calcúlalo con las medidas".

---

## 8. Criterios de aceptación

- [ ] Panel **oculto** al cargar; el link aparece bajo CBM total.
- [ ] Click despliega Alto/Ancho/Largo (cm) + Cantidad de cajas.
- [ ] `40×30×60 × 10` → panel muestra `0.072 m³/caja` y `0.72 CBM`; CBM total = `0.72`.
- [ ] Con panel activo, CBM total es **read-only** y muestra tag `auto · medidas`.
- [ ] Cerrar el panel libera el campo CBM y conserva el último valor.
- [ ] El total, contenedor 40'HC, alertas y WhatsApp reaccionan al CBM calculado.
- [ ] Sin warnings de React (efecto sin loop), sin colores/fuentes fuera del sistema.

---

## 9. Cierre

Al mergear en `calc/cbm-variants.jsx`:
1. Borrar `calc/cbm-medidas.jsx` y `Calculadora CBM · Prueba medidas.html`.
2. Anotar la entrada en `CHANGELOG.md` (archivo + línea + razón).
3. Registrar la decisión de §7 (auto vs. botón / tuteo vs. voseo) en el mismo commit.
