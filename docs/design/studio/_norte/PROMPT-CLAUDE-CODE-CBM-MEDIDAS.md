# Prompt para Claude Code · Calculadora CBM — "Calcular CBM por medidas"

> Copiá este bloque y pegáselo a Claude Code. Es la instrucción del cambio nuevo en la
> calculadora oficial. Referencias en el repo: `calc/cbm-variants.jsx` (código vivo),
> `HANDOFF-CBM-MEDIDAS.md` (spec técnica detallada), `CLAUDE.md` (guardrails de marca).

---

## Contexto

Archivo: **`calc/cbm-variants.jsx`** (componente `window.CalcLCL`, monta en
`Calculadora CBM · DTD-Cargo.html`). Es la **calculadora oficial**. Respetá `CLAUDE.md`:
solo tokens `var(--*)`, fuentes del sistema, cero AI slop, componentes existentes.

## Qué tiene que hacer (cambio)

Agregar una **forma alternativa de obtener el CBM total**: el cliente que no sabe su CBM
puede escribir las **medidas de su caja** y la calculadora lo calcula y lo **pone arriba**,
en el campo "CBM total".

### Comportamiento exacto

1. **Oculto por defecto.** Debajo del campo "CBM total" hay un link discreto (no botón
   grande): *"¿No sabés tu CBM? Calculalo con las medidas"*. El panel arranca colapsado.
2. **Al hacer clic** se despliega un panel con cuatro campos:
   - **Alto** (cm), **Ancho** (cm), **Largo** (cm)
   - **Cantidad de cajas**
3. **Cantidad de cajas = 1 por defecto.** El campo arranca en `1`. El cliente solo cambia
   ese número a la cantidad real de cajas; no tiene que setearlo desde cero.
4. **Cálculo automático, sin empujar nada.** Apenas hay valores válidos, el CBM se calcula
   y se **asigna solo** al campo "CBM total" — en vivo, sin botón "Calcular" ni "Usar este
   CBM" ni Enter. El cliente escribe y el número de arriba cambia solo.
5. **Origen visible.** Mientras el panel está activo y calculando, "CBM total" queda
   **read-only** con un tag `auto · medidas` para que se vea que el número vino de las medidas.
6. **Cerrar el panel** ("Prefiero escribir el CBM a mano") libera el campo "CBM total" para
   edición manual y conserva el último valor calculado.

### Fórmula (única fuente)

```
CBM por caja = (alto_cm × ancho_cm × largo_cm) / 1.000.000      // cm³ → m³
CBM total    = CBM por caja × cantidad_de_cajas
```

Caso de prueba: `40 × 30 × 60 cm × 10 cajas` → `0.072 m³/caja` → **`0.72 CBM`** arriba.

### Reglas que NO cambian

- El CBM calculado entra al **mismo motor de cotización** (`computeQuote`): respeta punto de
  cruce (`MIN_FACT/tarifa`), tope de contenedor (68 CBM), densidad máx (600 kg/CBM),
  excedente de peso, piso de $50 y la derivación a asesor. **No tocar `computeQuote`.**
- El mensaje de WhatsApp y el lead al CRM ya usan el CBM resultante → no requieren cambios.

## Detalle técnico (ya implementado en el repo, replicá esta lógica)

Estado del panel dentro de `CalcLCL`:

```jsx
const [showDims, setShowDims] = useState(false);
const [altoStr,  setAltoStr]  = useState('');
const [anchoStr, setAnchoStr] = useState('');
const [largoStr, setLargoStr] = useState('');
const [cajasStr, setCajasStr] = useState('1');   // ← cantidad de cajas = 1 por defecto
```

Helper de cálculo:

```jsx
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

Auto-asignado "se empuja solo" (efecto de un solo sentido medidas → cbm, sin botón y sin loop):

```jsx
const d = { ...computeDims(altoStr, anchoStr, largoStr, cajasStr), altoStr, anchoStr, largoStr, cajasStr };
const dimsDriving = showDims && d.valid;

React.useEffect(() => {
  if (showDims && d.valid) setCbm(trimNum(d.total));   // escribe el CBM arriba, automático
}, [showDims, altoStr, anchoStr, largoStr, cajasStr]);  // NO incluir `cbm` → evita bucle
```

Campo "CBM total" cuando el panel manda:

```jsx
<NumField label="CBM total"
  tag={dimsDriving ? 'auto · medidas' : undefined}
  value={cbm} onChange={setCbm} suffix="m³" big
  readOnly={dimsDriving} />
```

El panel (`DimPanel`: 3 NumField en grid `1fr 1fr 1fr` para Alto/Ancho/Largo + 1 NumField
"Cantidad de cajas" + readout del resultado) y la prop `readOnly` agregada a `NumField` ya
están en `calc/cbm-variants.jsx`. Reusá `trimNum`, `fmtCBM`, tokens del sistema. Cero
colores/fuentes nuevos.

## Criterios de aceptación

- [ ] Panel **oculto** al cargar; el link aparece bajo "CBM total".
- [ ] "Cantidad de cajas" arranca en **1**.
- [ ] El cliente cambia las medidas/cantidad y "CBM total" se actualiza **solo**, sin botón.
- [ ] `40×30×60 × 10` → `0.072 m³/caja` y **`0.72 CBM`** arriba.
- [ ] Con panel activo, "CBM total" es **read-only** y muestra tag `auto · medidas`.
- [ ] Cerrar el panel libera el campo y conserva el último valor.
- [ ] Total, contenedor 40'HC, alertas y WhatsApp reaccionan al CBM calculado.
- [ ] Sin warnings de React (efecto sin loop). Sin tokens/fuentes fuera del sistema.

## Pendiente de decisión (anotalo si lo resolvés en este commit)

- **Copy:** hoy en **voseo** ("Calculalo") para igualar el resto de la calculadora.
  `CLAUDE.md` pide **tuteo**. Decisión global; si se unifica, pasa a "¿No sabes tu CBM? Calcúlalo con las medidas".
