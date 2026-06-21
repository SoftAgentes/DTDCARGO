/* global React */
/* ── Propuesta · Servicios & Tarifas (estilo QuickBooks) ─────── */
/* NO integrada. Mockup de revisión con el sistema real (tokens +  */
/* ERPUI + Icon). Demuestra:                                       */
/*   · 4 tipos: Servicio · No inventario · Inventario · Grupo      */
/*   · Servicio ≠ Tarifa: la tarifa tiene VIGENCIA + HISTORIAL     */
/*   · Selector de tipo al crear (4 tarjetas, como QuickBooks)     */
/* ───────────────────────────────────────────────────────────── */

(function () {
  const { useState } = React;
  const U = window.ERPUI;
  const I = window.Icon;
  const ic = (name, n, alt) => (I[name] || I[alt] || I.box)(n);

  const TODAY = new Date('2026-05-31');
  const fmt = (n, sym = '$') => sym + Number(n).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
  const fdate = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}`; };

  // Label de campo · compartido (NewItemDrawer define el suyo local que lo sombrea)
  const Label = ({ children, hint }) => (
    <div style={{ marginBottom: 6 }}>
      <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</span>
      {hint && <span style={{ font: 'italic 500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginLeft: 7, textTransform: 'none', letterSpacing: 0 }}>{hint}</span>}
    </div>
  );

  // Estado de una tarifa según su fecha de vencimiento
  function tarifaStatus(validTo) {
    const diff = Math.round((new Date(validTo) - TODAY) / 86400000);
    if (diff < 0) return { key: 'vencida', label: 'Vencida', tone: 'danger', diff };
    if (diff <= 21) return { key: 'porvencer', label: `Vence en ${diff}d`, tone: 'warning', diff };
    return { key: 'vigente', label: 'Vigente', tone: 'success', diff };
  }

  const TYPES = {
    servicio:   { label: 'Servicio',      tone: 'wine',    icon: 'ship',      blurb: 'Lo que haces. Sin stock.', long: 'Un trabajo que prestas — no se inventaría. Ej: flete, despacho aduanal, almacenaje, última milla, seguro.' },
    no_inv:     { label: 'No inventario', tone: 'info',    icon: 'doc',       blurb: 'Cobras, no sigues stock.', long: 'Algo que cobras o recargas pero no llevas en stock. Ej: recargos (BAF), gestión documental, servicios de terceros al costo.' },
    inventario: { label: 'Inventario',    tone: 'success', icon: 'warehouse', blurb: 'Con seguimiento de stock.', long: 'Físico, con cantidad que entra y sale. Ej: cajas, pallets, etiquetas QR, film. Avisa cuando baja del punto de reorden.' },
    grupo:      { label: 'Grupo / Paquete', tone: 'neutral', icon: 'box',     blurb: 'Varios ítems en uno.', long: 'Un combo que se vende como una sola línea. Ej: DDP Puerta a Puerta = flete + aduana + transporte + seguro.' },
    tarifa:     { label: 'Tarifa', tone: 'warning', icon: 'clock', blurb: 'Precio con vigencia para un ítem que ya existe.', long: 'Una nueva tarifa (precio + vigencia) para un servicio o ítem existente. El servicio no cambia — solo su precio; la tarifa anterior pasa al historial.' },
  };

  // ── Catálogo · fuente de verdad en ERPData.CATALOG (literal = fallback) ──
  const _CAT = (window.ERPData && window.ERPData.CATALOG) || {};
  const ITEMS = _CAT.ITEMS || [
    { id: 's1', type: 'servicio', code: 'SRV-LCL',     name: 'Flete marítimo LCL · DDP', unit: 'CBM',      desc: 'Consolidado puerta a puerta CN → VE', rate: 185, from: '2026-05-01', to: '2026-06-30',
      supplierRates: [
        { name: 'Evergreen', price: 175, to: '2026-06-10' },
        { name: 'MSC', price: 182, to: '2026-06-20' },
        { name: 'COSCO', price: 178, to: '2026-06-30' },
        { name: 'Maersk', price: 185, to: '2026-07-15' },
        { name: 'Hapag-Lloyd', price: 190, to: '2026-08-01' },
      ],
      history: [{ rate: 172, from: '2026-03-01', to: '2026-04-30' }, { rate: 165, from: '2026-01-01', to: '2026-02-28' }] },
    { id: 's2', type: 'servicio', code: 'SRV-ADU',     name: 'Despacho aduanal',         unit: 'envío',    desc: 'Gestión SENIAT + nacionalización', rate: 120, from: '2026-04-15', to: '2026-07-15', history: [{ rate: 110, from: '2026-01-15', to: '2026-04-14' }] },
    { id: 's3', type: 'servicio', code: 'SRV-ALM-CN',  name: 'Almacenaje en China',      unit: 'CBM/mes',  desc: 'Bodega Yiwu · primeros 15 días libres', rate: 8, from: '2026-05-01', to: '2026-06-12', history: [{ rate: 7, from: '2026-02-01', to: '2026-04-30' }] },
    { id: 's4', type: 'servicio', code: 'SRV-MILLA',   name: 'Última milla · Venezuela', unit: 'envío',    desc: 'Entrega nacional desde Valencia', rate: 35, from: '2026-03-01', to: '2026-05-20', history: [{ rate: 32, from: '2025-11-01', to: '2026-02-28' }] },
    { id: 's5', type: 'servicio', code: 'SRV-SEG',     name: 'Seguro de carga',          unit: '% valor',  desc: 'Cobertura todo riesgo sobre valor CIF', rate: 1.2, from: '2026-01-01', to: '2026-12-31', history: [] },

    { id: 'n1', type: 'no_inv', code: 'REC-BAF',   name: 'Recargo combustible (BAF)', unit: 'CBM',   desc: 'Ajuste por flete · variable mensual', rate: 14, from: '2026-05-01', to: '2026-05-31', history: [{ rate: 11, from: '2026-04-01', to: '2026-04-30' }] },
    { id: 'n2', type: 'no_inv', code: 'DOC-GEST',  name: 'Gestión documental',        unit: 'envío', desc: 'BL, packing list, certificados', rate: 18, from: '2026-01-01', to: '2026-12-31', history: [] },
    { id: 'n3', type: 'no_inv', code: 'INSP-3RO',  name: 'Inspección de terceros',    unit: 'envío', desc: 'Al costo · proveedor externo', rate: 45, from: '2026-02-01', to: '2026-08-01', history: [] },

    { id: 'i1', type: 'inventario', code: 'INV-CAJA',   name: 'Caja master 60×40×40', unit: 'unidad', desc: 'Cartón doble corrugado', rate: 2.5, cost: 1.4, stock: 320, reorder: 100, from: '2026-04-01', to: '2026-09-30', history: [] },
    { id: 'i2', type: 'inventario', code: 'INV-PALLET', name: 'Pallet de madera',     unit: 'unidad', desc: 'Estándar 1.2×1.0 m', rate: 12, cost: 7, stock: 28, reorder: 40, from: '2026-04-01', to: '2026-09-30', history: [] },
    { id: 'i3', type: 'inventario', code: 'INV-QR',     name: 'Etiqueta QR adhesiva', unit: 'unidad', desc: 'Trazabilidad de bultos', rate: 0.3, cost: 0.12, stock: 1500, reorder: 500, from: '2026-01-01', to: '2026-12-31', history: [] },
    { id: 'i4', type: 'inventario', code: 'INV-FILM',   name: 'Film stretch',         unit: 'rollo',  desc: 'Embalaje de pallets', rate: 6, cost: 3.5, stock: 14, reorder: 20, from: '2026-03-01', to: '2026-08-31', history: [] },

    { id: 'g1', type: 'grupo', code: 'GRP-DDP',  name: 'DDP Puerta a Puerta', unit: 'envío', desc: 'El combo estrella · todo incluido', components: ['SRV-LCL', 'SRV-ADU', 'SRV-MILLA', 'SRV-SEG'], from: '2026-05-01', to: '2026-06-30', history: [] },
    { id: 'g2', type: 'grupo', code: 'GRP-ECOM', name: 'Combo e-commerce',    unit: 'envío', desc: 'Para tiendas online · con materiales', components: ['SRV-LCL', 'SRV-MILLA', 'INV-CAJA', 'INV-QR'], from: '2026-05-01', to: '2026-07-31', history: [] },
  ];

  // Plan de cuentas REAL de DTD (de Contactanos.csv · QuickBooks · sin montos)
  const INCOME_ACCTS = _CAT.INCOME_ACCTS || ['Ventas envío marítimo · CBM', 'Ventas envío marítimo · Consolidado China', 'Servicio de transporte · China', 'Servicio de transporte · Nacional', 'Peso extra', 'Ingresos de envío', 'Bodegaje', 'Comisión por envío de dinero', 'Compra asistida', 'Registro de marca', 'Trámite visa China', 'Validación de proveedores', 'Descuento en venta'];
  const EXPENSE_ACCTS = _CAT.EXPENSE_ACCTS || ['Costos fletes · Envío marítimo', 'Costos fletes · Transporte China', 'Costos fletes · Extras en origen China', 'Costos fletes · Encomienda y despacho', 'Comisión envío dinero', 'Costo de inspección', 'Costo compra asistida', 'Costo registro de marca', 'Costo trámite visa China', 'Validación de proveedor', 'Gastos de oficina · Compras', 'Comisiones bancarias'];
  const CATEGORIES = _CAT.CATEGORIES || ['Envío marítimo', 'Transporte China', 'Transporte nacional', 'Peso extra', 'Bodegaje', 'Compra asistida', 'Registro de marca', 'Visa China', 'Validación de proveedores', 'Otros'];
  const AUTHORS = _CAT.AUTHORS || ['Martina Acuña', 'Carlos Vásquez', 'Diego Núñez'];
  const SUPPLIERS_CN = _CAT.SUPPLIERS_CN || ['Yiwu Standard Trading', 'Shenzhen Lights Ltd', 'Guangzhou Textile Mfg', 'Industrial CN Group', 'Yiwu Trade Mall'];

  const PROVIDERS = _CAT.PROVIDERS || ['COSCO', 'Maersk', 'MSC', 'Evergreen', 'Hapag-Lloyd', 'ONE', 'CMA CGM', 'Yiwu Standard Trading'];
  const byCode = (c) => ITEMS.find(x => x.code === c);
  const groupTotal = (item) => (item.components || []).reduce((a, c) => a + (byCode(c)?.rate || 0), 0);
  const displayRate = (item) => item.type === 'grupo' ? groupTotal(item) : item.rate;

  // ════════════════════════════════════════════════════════════
  function ScreenChrome({ module, children, bare }) {
    if (bare) return <div>{children}</div>;
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <span style={{ display: 'inline-flex', gap: 5 }}>
            {['#E06C66', '#E8B84B', '#4FA86A'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.85 }} />)}
          </span>
          <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase', marginLeft: 6 }}>Módulo</span>
          <span style={{ font: '900 13px/1 var(--f-display)', color: 'var(--ink)' }}>{module}</span>
        </div>
        <div style={{ padding: 'var(--s-6)', background: 'var(--bg-base)' }}>{children}</div>
      </div>
    );
  }
  function NotesCard({ title, children }) {
    return (
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{children}</div>
      </U.Card>
    );
  }
  function Bullet({ children }) {
    return (
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wine)', marginTop: 7, flexShrink: 0 }} />
        <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>{children}</div>
      </div>
    );
  }
  const typeBadge = (t) => <U.Badge tone={TYPES[t].tone} size="sm">{TYPES[t].label}</U.Badge>;

  // ── Tarifa cell con vigencia ───────────────────────────────
  function TarifaCell({ item }) {
    const st = tarifaStatus(item.to);
    return (
      <div style={{ textAlign: 'right' }}>
        <div style={{ font: '800 14px/1 var(--f-display)', color: 'var(--ink)' }}>{item.type === 'grupo' ? 'desde ' : ''}{fmt(displayRate(item))}<span style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)' }}> /{item.unit}</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginTop: 5, whiteSpace: 'nowrap' }}>
          <U.Badge tone={st.tone} size="sm">{st.label}</U.Badge>
          <span style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{fdate(item.to)}</span>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  APP
  // ════════════════════════════════════════════════════════════
  // ── Crear regla de precios (reutilizable · QuickBooks + reglas DTD) ──
  function RuleModal({ open, onClose, item }) {
    const [done, setDone] = useState(false);
    const [rname, setRname] = useState('');
    const [cust, setCust] = useState('Todos los clientes');
    const [prod, setProd] = useState('Todos los productos y servicios');
    const [method, setMethod] = useState('Porcentaje');
    const [dir, setDir] = useState('Disminuir en');
    const [val, setVal] = useState('');
    const [round, setRound] = useState('Sin redondeo');
    const [cond, setCond] = useState('Siempre');
    const [condN, setCondN] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    React.useEffect(() => {
      if (open) { setDone(false); setRname(''); setCust('Todos los clientes'); setProd(item ? ('Este · ' + (item.name || 'servicio')) : 'Todos los productos y servicios'); setMethod('Porcentaje'); setDir('Disminuir en'); setVal(''); setRound('Sin redondeo'); setCond('Siempre'); setCondN(''); setFrom(''); setTo(''); }
    }, [open, item]);
    if (!open) return null;

    const isFixed = method === 'Precio fijo';
    const needsN = cond !== 'Siempre';
    const QUICK = [
      ['Cliente Platinum −10%', { cust: 'Segmento · Platinum', dir: 'Disminuir en', val: 10 }],
      ['Temporada alta +8%', { dir: 'Aumentar en', val: 8 }],
      ['Volumen ≥ 10 CBM −12%', { dir: 'Disminuir en', val: 12, cond: 'CBM ≥', condN: 10 }],
      ['Cantidad ≥ 10 ítems −5%', { dir: 'Disminuir en', val: 5, cond: 'Cantidad ≥', condN: 10 }],
      ['Exceso de peso · >500 kg/CBM', { method: 'Monto', val: '', cond: 'Peso/CBM ≥', condN: 500 }],
      ['Precio aliado −15%', { cust: 'Segmento · Aliado', dir: 'Disminuir en', val: 15 }],
    ];
    const applyQuick = (q) => { setRname(q[0]); const p = q[1]; setMethod(p.method || 'Porcentaje'); if (p.cust) setCust(p.cust); if (p.dir) setDir(p.dir); if (p.val !== undefined) setVal(p.val); setCond(p.cond || 'Siempre'); setCondN(p.condN !== undefined ? p.condN : ''); };
    const canSave = rname.trim() && (isFixed ? val !== '' : val !== '') && (!needsN || condN !== '');
    const ib = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '500 13px/1.3 var(--f-sans)', color: 'var(--ink)' };
    const Lab = ({ children, opt }) => <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{children}{opt && <span style={{ color: 'var(--ink-mute)', fontWeight: 500, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>opcional</span>}</div>;

    return (
      <U.Modal open={open} onClose={onClose} width={580} title="Crear una regla de precios"
        actions={done ? <U.Btn variant="primary" onClick={onClose}>Listo</U.Btn> : <React.Fragment>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={ic('check', 14)} disabled={!canSave} onClick={() => setDone(true)}>Guardar y cerrar</U.Btn>
        </React.Fragment>}>
        {done ? (
          <div style={{ padding: 16, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--success)' }}>{ic('check', 18)}</span>
            <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
              Regla <b>{rname}</b> creada · {cust} · {isFixed ? `precio fijo ${fmt(val)}` : `${dir.toLowerCase()} ${val}%`}{needsN ? ` cuando ${cond} ${condN}` : ''}{round !== 'Sin redondeo' ? ` · redondeo ${round}` : ''}. Se aplica sobre la tarifa vigente al estimar.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Plantillas rápidas (reglas DTD)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {QUICK.map(q => <button key={q[0]} onClick={() => applyQuick(q)} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', background: 'var(--wine-tint)', border: '1px solid transparent', borderRadius: 'var(--r-pill)', padding: '7px 11px', cursor: 'pointer' }}>{q[0]}</button>)}
              </div>
            </div>
            <div><Lab>Nombre de la regla</Lab><input value={rname} onChange={(e) => setRname(e.target.value)} placeholder="Ej. Descuento por volumen" style={ib} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lab>Cliente</Lab><U.Select value={cust} onChange={(e) => setCust(e.target.value)} options={['Todos los clientes', 'Segmento · Platinum', 'Segmento · Gold', 'Segmento · Aliado', 'Cliente específico…'].map(x => ({ value: x, label: x }))} /></div>
              <div><Lab>Productos y servicios</Lab><U.Select value={prod} onChange={(e) => setProd(e.target.value)} options={[item ? { value: 'Este · ' + (item.name || 'servicio'), label: 'Este · ' + (item.name || 'servicio') } : null, { value: 'Todos los productos y servicios', label: 'Todos los productos y servicios' }, ...CATEGORIES.map(c => ({ value: 'Categoría · ' + c, label: 'Categoría · ' + c }))].filter(Boolean)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isFixed ? '1fr 120px 1fr' : '1fr 1fr 90px 1fr', gap: 10, alignItems: 'end' }}>
              <div><Lab>Método</Lab><U.Select value={method} onChange={(e) => setMethod(e.target.value)} options={['Porcentaje', 'Precio fijo', 'Monto'].map(x => ({ value: x, label: x }))} /></div>
              {!isFixed && <div><Lab>Ajuste</Lab><U.Select value={dir} onChange={(e) => setDir(e.target.value)} options={['Disminuir en', 'Aumentar en'].map(x => ({ value: x, label: x }))} /></div>}
              <div><Lab>{isFixed ? 'Precio' : (method === 'Monto' ? 'Monto' : '%')}</Lab>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {(isFixed || method === 'Monto') && <span style={{ padding: '9px 9px', border: '1px solid var(--border)', borderRight: 0, borderRadius: 'var(--r-md) 0 0 var(--r-md)', background: 'var(--bg-elevated)', font: '700 13px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>$</span>}
                  <window.ERPUI.CalcInput value={val} onChange={(e) => setVal(e.target.value)} placeholder="0" style={{ ...ib, borderRadius: (isFixed || method === 'Monto') ? '0 var(--r-md) var(--r-md) 0' : 'var(--r-md)', fontFamily: 'var(--f-mono)', fontWeight: 700 }} />
                  {!isFixed && method === 'Porcentaje' && <span style={{ padding: '9px 9px', border: '1px solid var(--border)', borderLeft: 0, borderRadius: '0 var(--r-md) var(--r-md) 0', background: 'var(--bg-elevated)', font: '700 13px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>%</span>}
                </div>
              </div>
              <div><Lab>Redondeo</Lab><U.Select value={round} onChange={(e) => setRound(e.target.value)} options={['Sin redondeo', 'A .00', 'A .50', 'A .99'].map(x => ({ value: x, label: x }))} /></div>
            </div>
            {/* Condición · reglas DTD por cantidad / CBM / monto */}
            <div style={{ padding: '12px 14px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)' }}>
              <Lab>Aplica cuando</Lab>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <U.Select value={cond} onChange={(e) => setCond(e.target.value)} options={['Siempre', 'Cantidad ≥', 'CBM ≥', 'Monto ≥', 'Peso/CBM ≥'].map(x => ({ value: x, label: x }))} />
                {needsN && <window.ERPUI.CalcInput value={condN} onChange={(e) => setCondN(e.target.value)} placeholder={cond === 'CBM ≥' ? 'CBM' : (cond === 'Monto ≥' ? '$' : (cond === 'Peso/CBM ≥' ? 'kg/CBM' : 'ítems'))} style={{ ...ib, width: 120, fontFamily: 'var(--f-mono)', fontWeight: 700 }} />}
              </div>
              <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 7 }}>Ej.: si el cliente lleva <b>≥ 10 CBM</b> (o ítems) → descuento automatico. Con <b>Peso/CBM ≥ 500</b> → si un CBM excede los 500 kg, se cobra la tarifa de <b>exceso de peso</b> (el “Monto” es el precio por el extra).</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lab opt>Fecha de inicio</Lab><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={ib} /></div>
              <div><Lab opt>Fecha de finalización</Lab><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={ib} /></div>
            </div>
          </div>
        )}
      </U.Modal>
    );
  }

  // ── "Más" · categorías · informes · reglas de precios ──────
  function MasModal({ view, onClose }) {
    const [cats, setCats] = useState(CATEGORIES);
    const [newCat, setNewCat] = useState('');
    const [ran, setRan] = useState('');
    const [ruleOpen, setRuleOpen] = useState(false);
    if (!view) return null;
    const titles = { cat: 'Administrar categorías', informes: 'Ejecutar informes', reglas: 'Reglas de precios' };
    const catCount = (c) => ITEMS.filter(i => i.category === c).length;
    const REPORTS = [
      ['Historial de precios', 'Cambios de tarifa por servicio, con autor y fecha.'],
      ['Tarifas por vencer (30 días)', 'Lo que hay que renovar pronto.'],
      ['Servicios por categoría', 'Catálogo agrupado por categoría.'],
      ['Margen por servicio', 'Precio de venta vs costo / proveedor.'],
    ];
    const RULES = [
      ['Cliente Platinum −10%', 'Aplica a todos los servicios de flete', 'success'],
      ['Temporada alta +8%', 'Oct–Dic · flete marítimo', 'warning'],
      ['Volumen > 20 CBM −12%', 'Descuento por escala', 'success'],
    ];
    const row = { padding: '11px 13px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 10 };

    return (
      <U.Modal open={!!view} onClose={onClose} width={520} title={titles[view]}
        actions={<U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>}>
        {view === 'cat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Las categorías agrupan servicios en el catálogo y en los reportes.</div>
            {cats.map(c => (
              <div key={c} style={row}>
                <span style={{ color: 'var(--wine)' }}>{ic('tag', 15, 'box')}</span>
                <span style={{ flex: 1, font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{c}</span>
                <U.Badge tone="neutral" size="sm">{catCount(c)} ítems</U.Badge>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nueva categoría" style={{ flex: 1, padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '500 13px/1.2 var(--f-sans)', color: 'var(--ink)' }} />
              <U.Btn variant="primary" size="sm" icon={ic('plus', 13)} disabled={!newCat.trim()} onClick={() => { setCats(cs => [...cs, newCat.trim()]); setNewCat(''); }}>Agregar</U.Btn>
            </div>
          </div>
        )}
        {view === 'informes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Informes sobre el catálogo y el historial de precios.</div>
            {REPORTS.map(([t, d]) => (
              <button key={t} onClick={() => setRan(t)} style={{ ...row, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--wine)'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
                <span style={{ color: 'var(--wine)' }}>{ic('chart', 16, 'invoice')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{t}</div>
                  <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{d}</div>
                </div>
                <span style={{ color: 'var(--ink-mute)' }}>{ic('chevR', 14)}</span>
              </button>
            ))}
            {ran && <div style={{ padding: '10px 13px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Generaría el informe <b>{ran}</b> (en el ERP abre con filtros de fecha/categoría).</div>}
          </div>
        )}
        {view === 'reglas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Ajustes automaticos de precio por cliente, volumen o temporada — se aplican sobre la tarifa vigente al estimar.</div>
            {RULES.map(([t, d, tone]) => (
              <div key={t} style={row}>
                <span style={{ color: 'var(--wine)' }}>{ic('tag', 15, 'box')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{t}</div>
                  <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{d}</div>
                </div>
                <U.Badge tone={tone} size="sm">activa</U.Badge>
              </div>
            ))}
            <U.Btn variant="soft" size="sm" icon={ic('plus', 13)} style={{ marginTop: 4, alignSelf: 'flex-start' }} onClick={() => setRuleOpen(true)}>Nueva regla</U.Btn>
            <RuleModal open={ruleOpen} onClose={() => setRuleOpen(false)} item={null} />
          </div>
        )}
      </U.Modal>
    );
  }

  function ServiciosTarifasApp({ embedded } = {}) {
    const [tab, setTab] = useState('all');
    const [detail, setDetail] = useState(null);
    const [picker, setPicker] = useState(false);   // type selector
    const [createType, setCreateType] = useState(null);
    const [mas, setMas] = useState(false);
    const [masView, setMasView] = useState(null);

    // Abrir un tipo directo cuando el botón "+ Crear" global lo pide
    React.useEffect(() => {
      const onCreate = (e) => { const k = e.detail; if (TYPES[k]) setCreateType(k); else setPicker(true); };
      window.addEventListener('dtd-create-catalog', onCreate);
      return () => window.removeEventListener('dtd-create-catalog', onCreate);
    }, []);

    const counts = {
      all: ITEMS.length,
      servicio: ITEMS.filter(i => i.type === 'servicio').length,
      inventario: ITEMS.filter(i => i.type === 'inventario').length,
      no_inv: ITEMS.filter(i => i.type === 'no_inv').length,
      grupo: ITEMS.filter(i => i.type === 'grupo').length,
    };
    const rows = tab === 'all' ? ITEMS
      : tab === 'tarifas' ? [...ITEMS].sort((a, b) => new Date(a.to) - new Date(b.to))
      : ITEMS.filter(i => i.type === tab);
    const porVencer = ITEMS.filter(i => ['porvencer', 'vencida'].includes(tarifaStatus(i.to).key)).length;
    const bajoStock = ITEMS.filter(i => i.type === 'inventario' && i.stock <= i.reorder).length;

    const columns = [
      { label: 'Tipo', key: 'type', render: (r) => typeBadge(r.type), width: 104 },
      { label: 'Código', key: 'code', render: (r) => <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.code}</code>, width: 104 },
      { label: 'Nombre', key: 'name', render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Thumb item={r} size={32} />
          <div>
            <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.name}</div>
            <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{r.desc}</div>
          </div>
        </div>
      ) },
      { label: 'Stock', key: 'stock', render: (r) => r.type === 'inventario'
        ? <div style={{ textAlign: 'right' }}><span style={{ font: '700 12.5px/1 var(--f-mono)', color: r.stock <= r.reorder ? 'var(--warning)' : 'var(--ink)' }}>{r.stock}</span><div style={{ font: '500 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>min {r.reorder}</div></div>
        : <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', display: 'block', textAlign: 'right' }}>—</span>, width: 64, align: 'right' },
      { label: 'Tarifa vigente', key: 'rate', render: (r) => <TarifaCell item={r} />, width: 158, align: 'right' },
    ];

    return (
      <div style={{ minHeight: embedded ? 0 : '100vh', background: 'var(--bg-base)' }}>
        {!embedded && <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px var(--s-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ font: '900 10.5px/1 var(--f-sans)', color: '#fff', background: 'var(--ink)', padding: '5px 9px', borderRadius: 'var(--r-sm)', letterSpacing: '0.14em' }}>PROPUESTA</span>
              <span style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Para revisión · todavía no integrada al ERP</span>
            </div>
            <h1 style={{ font: '900 30px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em', margin: '0 0 8px' }}>Servicios y Tarifas</h1>
            <p style={{ font: '500 14px/1.6 var(--f-sans)', color: 'var(--ink-soft)', margin: 0, maxWidth: 760 }}>
              Catálogo de lo que DTD ofrece, con la lógica de QuickBooks adaptada al negocio. Es interactivo: prueba <b>Nuevo</b> (elegir tipo) y clic en una fila para ver la <b>tarifa con su historial</b>.
            </p>
          </div>
        </header>}

        <main style={{ maxWidth: embedded ? 'none' : 1180, margin: '0 auto', padding: embedded ? 'var(--s-2)' : 'var(--s-10) var(--s-8) var(--s-16)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: embedded ? '1fr' : 'minmax(0, 2.4fr) minmax(250px, 1fr)', gap: 20, alignItems: 'start' }}>
            <div>
              <ScreenChrome module="Servicios & Tarifas" bare={embedded}>
                <U.PageHeader
                  title="Servicios & Tarifas"
                  subtitle="Lo que ofrecemos (servicios) y cuánto cuesta (tarifas, que cambian y vencen)."
                  actions={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative' }}>
                        <U.Btn variant="secondary" iconRight={ic('chevD', 12)} onClick={() => setMas(v => !v)}>Más</U.Btn>
                        {mas && <div onClick={() => setMas(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />}
                        {mas && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 224, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', zIndex: 21, overflow: 'hidden', animation: 'erp-pop 160ms var(--ease, ease)' }}>
                            {[['cat', 'Administrar categorías', 'tag'], ['informes', 'Ejecutar informes', 'chart'], ['reglas', 'Reglas de precios', 'tag']].map(([k, l, icn]) => (
                              <button key={k} onClick={() => { setMas(false); setMasView(k); }} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', border: 'none', background: 'transparent', cursor: 'pointer', font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-tint)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}><span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{ic(icn, 15)}</span>{l}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <U.Btn variant="primary" icon={ic('plus', 14)} onClick={() => setPicker(true)}>Nuevo</U.Btn>
                    </div>
                  }
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
                  <U.KPI label="Ítems en catálogo" value={ITEMS.length} delta={`${counts.servicio} servicios`} tone="wine" icon={ic('tag', 18, 'box')} />
                  <U.KPI label="Tarifas por vencer" value={porVencer} delta="revisar / renovar" tone="warning" icon={ic('clock', 18)} />
                  <U.KPI label="Grupos / paquetes" value={counts.grupo} delta="combos vendibles" tone="neutral" icon={ic('box', 18)} />
                  <U.KPI label="Inventario bajo stock" value={bajoStock} delta="bajo punto de reorden" tone={bajoStock ? 'danger' : 'success'} icon={ic('warehouse', 18)} />
                </div>
                <U.Tabs value={tab} onChange={setTab} items={[
                  { value: 'all', label: 'Todos', count: counts.all },
                  { value: 'servicio', label: 'Servicios', count: counts.servicio },
                  { value: 'inventario', label: 'Inventario', count: counts.inventario },
                  { value: 'no_inv', label: 'No inventario', count: counts.no_inv },
                  { value: 'grupo', label: 'Grupos', count: counts.grupo },
                  { value: 'tarifas', label: 'Tarifas', count: ITEMS.length },
                ]} style={{ marginBottom: 'var(--s-5)' }} />
                <U.Table columns={columns} rows={rows} onRowClick={(r) => setDetail(r)} />
              </ScreenChrome>
            </div>

            {!embedded && <aside style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <NotesCard title="SERVICIO ≠ TARIFA">
                <Bullet>El <b>servicio</b> es estable ("Flete LCL DDP"). La <b>tarifa</b> es el precio — cambia y <b>vence</b>.</Bullet>
                <Bullet>Cada ítem tiene una <b>tarifa vigente</b> con fecha de corte y un <b>historial</b> de las anteriores.</Bullet>
                <Bullet>Al vencer se <b>renueva</b> con una nueva versión; la vieja queda en el historial (clic en una fila).</Bullet>
              </NotesCard>
              <NotesCard title="LOS 4 TIPOS">
                <Bullet><b>Servicio</b> — lo que haces, sin stock.</Bullet>
                <Bullet><b>No inventario</b> — cobras, no sigues stock (recargos, terceros).</Bullet>
                <Bullet><b>Inventario</b> — físico, con stock y punto de reorden.</Bullet>
                <Bullet><b>Grupo</b> — varios ítems vendidos como uno (DDP).</Bullet>
              </NotesCard>
            </aside>}
          </div>
        </main>

        <TypePicker open={picker} onClose={() => setPicker(false)} onPick={(t) => { setPicker(false); setCreateType(t); }} />
        <NewItemDrawer type={createType} onClose={() => setCreateType(null)} />
        <DetailDrawer item={detail} onClose={() => setDetail(null)} />
        <MasModal view={masView} onClose={() => setMasView(null)} />
      </div>
    );
  }

  // ── Selector de tipo (estilo QuickBooks) ───────────────────
  function TypePicker({ open, onClose, onPick }) {
    return (
      <U.Modal open={open} onClose={onClose} width={680} title="¿Qué vas a crear?">
        <p style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 16px' }}>
          Elige el tipo. Define cómo se comporta: si se inventaría, si se agrupa, si solo se cobra.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Object.keys(TYPES).map(k => {
            const t = TYPES[k];
            return (
              <button key={k} onClick={() => onPick(k)} style={{
                textAlign: 'left', padding: '16px', borderRadius: 'var(--r-lg)', cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', gap: 13, alignItems: 'flex-start',
                transition: 'border-color 120ms, box-shadow 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--wine-tint)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--wine-tint)', color: 'var(--wine)' }}>{ic(t.icon, 20)}</span>
                <div>
                  <div style={{ font: '800 14px/1.1 var(--f-display)', color: 'var(--ink)', marginBottom: 5 }}>{t.label}</div>
                  <div style={{ font: '500 11.5px/1.45 var(--f-sans)', color: 'var(--ink-soft)' }}>{t.long}</div>
                </div>
              </button>
            );
          })}
        </div>
      </U.Modal>
    );
  }

  // ── Drawer crear ítem (adaptativo por tipo) ────────────────
  // Miniatura de imagen del ítem (placeholder por tipo)
  function Thumb({ item, size = 30 }) {
    const t = TYPES[item.type] || {};
    return (
      <span style={{ width: size, height: size, flexShrink: 0, borderRadius: 'var(--r-sm)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {ic(t.icon || 'box', Math.round(size * 0.55))}
      </span>
    );
  }

  // Buscador de componentes con teclado (paquetes)
  function GroupComposer({ comps, setComps }) {
    const items = ITEMS.filter(i => i.type !== 'grupo');
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [hi, setHi] = useState(0);
    const boxRef = React.useRef(null);
    const avail = items.filter(i => !comps.includes(i.code) && (i.name + ' ' + i.code).toLowerCase().includes(q.toLowerCase()));
    React.useEffect(() => { setHi(0); }, [q]);
    React.useEffect(() => {
      const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, []);
    const add = (code) => { setComps(cs => cs.includes(code) ? cs : [...cs, code]); setQ(''); setHi(0); };
    const onKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, avail.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (avail[hi]) add(avail[hi].code); }
      else if (e.key === 'Escape') setOpen(false);
    };
    const ib = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '500 13px/1.3 var(--f-sans)', color: 'var(--ink)' };
    return (
      <div ref={boxRef} style={{ position: 'relative' }}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} placeholder="Busca y agrega productos/servicios… (↑↓ + Enter)" style={ib} />
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', zIndex: 6 }}>
            {avail.length === 0 ? (
              <div style={{ padding: '10px 12px', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>{q ? `Sin coincidencias para “${q}”.` : 'Ya agregaste todos.'}</div>
            ) : avail.map((i, idx) => (
              <div key={i.code} onMouseDown={(e) => { e.preventDefault(); add(i.code); }} onMouseEnter={() => setHi(idx)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', cursor: 'pointer', background: idx === hi ? 'var(--wine-tint)' : 'transparent' }}>
                <Thumb item={i} size={24} />
                <span style={{ flex: 1, font: '600 12px/1.2 var(--f-sans)', color: idx === hi ? 'var(--wine)' : 'var(--ink)' }}>{i.name}</span>
                {typeBadge(i.type)}
                <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{fmt(i.rate)}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {comps.length === 0 && <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Todavía no agregaste componentes. Escribe arriba o toca el campo para ver todos.</div>}
          {comps.map(c => { const x = byCode(c); if (!x) return null; return (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--wine)', background: 'var(--wine-tint)' }}>
              <Thumb item={x} size={24} />
              <span style={{ flex: 1, font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{x.name}</span>
              {typeBadge(x.type)}
              <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{fmt(x.rate)}</span>
              <button onClick={() => setComps(cs => cs.filter(k => k !== c))} title="Quitar" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-mute)', font: '700 15px/1 var(--f-sans)', padding: '0 2px' }}>×</button>
            </div>
          ); })}
        </div>
      </div>
    );
  }

  function NewItemDrawer({ type, onClose }) {
    const meta = type ? TYPES[type] : null;
    const [name, setName] = useState('');
    const [rate, setRate] = useState('');
    const [unit, setUnit] = useState('envío');
    const [validTo, setValidTo] = useState('2026-12-31');
    const [stock, setStock] = useState('');
    const [reorder, setReorder] = useState('');
    const [cost, setCost] = useState('');
    const [comps, setComps] = useState([]);
    const [targetCode, setTargetCode] = useState('');
    const [sku, setSku] = useState('');
    const [category, setCategory] = useState('');
    const [sellDesc, setSellDesc] = useState('');
    const [incomeAcct, setIncomeAcct] = useState(INCOME_ACCTS[0]);
    const [purchased, setPurchased] = useState(false);
    const [expenseAcct, setExpenseAcct] = useState(EXPENSE_ACCTS[0]);
    const [hasImg, setHasImg] = useState(false);
    const [supplier, setSupplier] = useState('');
    const [newSupps, setNewSupps] = useState([]);
    const [showComps, setShowComps] = useState(false);
    const [ruleOpen, setRuleOpen] = useState(false);
    const [done, setDone] = useState(false);

    React.useEffect(() => {
      if (type) { setName(''); setRate(''); setUnit(type === 'inventario' ? 'unidad' : 'envío'); setValidTo('2026-12-31'); setStock(''); setReorder(''); setCost(''); setComps([]); setTargetCode(''); setSku(''); setCategory(''); setSellDesc(''); setIncomeAcct(INCOME_ACCTS[0]); setPurchased(false); setExpenseAcct(EXPENSE_ACCTS[0]); setHasImg(false); setSupplier(''); setShowComps(false); setDone(false); }
    }, [type]);
    if (!type) return null;

    const resetForm = () => { setName(''); setRate(''); setSku(''); setCategory(''); setSellDesc(''); setStock(''); setReorder(''); setCost(''); setComps([]); setPurchased(false); setSupplier(''); setHasImg(false); };

    const toggleComp = (code) => setComps(cs => cs.includes(code) ? cs.filter(c => c !== code) : [...cs, code]);
    const compTotal = comps.reduce((a, c) => a + (byCode(c)?.rate || 0), 0);
    const isGroup = type === 'grupo';
    const isInv = type === 'inventario';
    const isTarifa = type === 'tarifa';
    const tgt = byCode(targetCode);
    const canCreate = isTarifa
      ? (targetCode && rate !== '' && validTo)
      : (name.trim() && (isGroup ? comps.length > 0 : rate !== ''));
    const inputBox = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.3 var(--f-sans)' };
    const Label = ({ children, hint }) => (
      <div style={{ marginBottom: 6 }}>
        <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</span>
        {hint && <span style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginLeft: 8 }}>{hint}</span>}
      </div>
    );

    return (
      <U.Drawer open={!!type} onClose={onClose} width={540}
        title={done ? 'Ítem creado' : `Nuevo · ${meta.label}`}
        subtitle={done ? null : meta.long}
        actions={done
          ? <U.Btn variant="primary" onClick={onClose}>Listo</U.Btn>
          : isTarifa
            ? <React.Fragment>
                <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
                <U.Btn variant="primary" icon={ic('check', 14)} disabled={!canCreate} onClick={() => setDone(true)}>Aplicar tarifa</U.Btn>
              </React.Fragment>
            : <React.Fragment>
                <U.Btn variant="secondary" disabled={!canCreate} onClick={resetForm}>Guardar y nuevo</U.Btn>
                <U.Btn variant="primary" icon={ic('check', 14)} disabled={!canCreate} onClick={() => setDone(true)}>Guardar y cerrar</U.Btn>
              </React.Fragment>}
      >
        {done ? (
          <div style={{ padding: 16, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'erp-fade 240ms' }}>
            <span style={{ color: 'var(--success)' }}>{ic('check', 18)}</span>
            <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
              {isTarifa
                ? <span>Nueva tarifa de <b>{fmt(rate)}</b>{tgt ? <span> /{tgt.unit}</span> : ''} para <b>{tgt ? tgt.name : ''}</b>, vigente hasta {fdate(validTo)}. La anterior (<b>{tgt ? fmt(tgt.rate) : ''}</b>) pasó al historial.</span>
                : <span><b>{name || meta.label}</b> quedó en el catálogo como <b>{meta.label}</b>{!isGroup && rate !== '' ? <span> a <b>{fmt(rate)}</b> /{unit}</span> : ''}{isGroup ? <span> · desde <b>{fmt(compTotal)}</b> ({comps.length} componentes)</span> : ''}. {!isGroup && type !== 'inventario' ? `Tarifa vigente hasta ${fdate(validTo)}.` : ''}</span>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '10px 13px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10, alignItems: 'center', font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
              <span style={{ color: 'var(--wine)' }}>{ic(meta.icon, 16)}</span>{meta.blurb}
            </div>

            {isTarifa && (
              <React.Fragment>
                <div>
                  <Label>Ítem al que aplica</Label>
                  <U.Select value={targetCode} onChange={(e) => { setTargetCode(e.target.value); const x = byCode(e.target.value); if (x) setRate(x.rate); }}
                    options={[{ value: '', label: 'Elige un servicio o ítem…' }, ...ITEMS.filter(i => i.type !== 'grupo').map(i => ({ value: i.code, label: `${i.code} · ${i.name}` }))]} />
                </div>
                {tgt && (
                  <div style={{ padding: '11px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>Tarifa vigente hoy</span>
                    <span style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{fmt(tgt.rate)} /{tgt.unit} <span style={{ color: 'var(--ink-mute)', fontWeight: 500 }}>· hasta {fdate(tgt.to)}</span></span>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><Label>Nuevo precio</Label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ padding: '9px 10px', border: '1px solid var(--border)', borderRight: 0, borderRadius: 'var(--r-md) 0 0 var(--r-md)', background: 'var(--bg-elevated)', font: '700 13px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>$</span>
                      <window.ERPUI.CalcInput value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" style={{ ...inputBox, borderRadius: '0 var(--r-md) var(--r-md) 0', fontFamily: 'var(--f-mono)', fontWeight: 700 }} />
                    </div>
                  </div>
                  <div><Label>Vigente hasta</Label>
                    <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} style={inputBox} />
                  </div>
                </div>
                <div style={{ padding: '10px 13px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
                  Al aplicar, esta pasa a ser la <b>tarifa vigente</b> del ítem y la actual queda en su <b>historial</b>. El servicio en sí no cambia.
                </div>
              </React.Fragment>
            )}

            {!isTarifa && (
            <React.Fragment>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><Label>Nombre</Label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={isGroup ? 'Ej. DDP Puerta a Puerta' : 'Nombre del ' + meta.label.toLowerCase()} style={inputBox} /></div>
                <div><Label hint="opcional">SKU / código</Label><input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Autogenerado si lo dejas vacío" style={{ ...inputBox, fontFamily: 'var(--f-mono)' }} /></div>
              </div>
              <button type="button" onClick={() => setHasImg(v => !v)} title="Imagen del servicio" style={{ width: 88, height: 88, flexShrink: 0, borderRadius: 'var(--r-md)', border: '1px dashed ' + (hasImg ? 'var(--wine)' : 'var(--border)'), background: hasImg ? 'var(--wine-tint)' : 'var(--bg-elevated)', color: hasImg ? 'var(--wine)' : 'var(--ink-mute)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, font: '600 9px/1.2 var(--f-sans)' }}>
                {ic('image', 22, 'box')}{hasImg ? 'Imagen ✓' : 'Imagen'}
              </button>
            </div>

            <div><Label hint="agrupa en reportes">Categoría</Label>
              <U.Select value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: '', label: 'Seleccionar categoría…' }, ...CATEGORIES.map(c => ({ value: c, label: c }))]} />
            </div>

            {/* (Precio/Tasa de venta se movió a la sección de venta · ver abajo) */}


            {/* Parte contable (estilo QuickBooks) */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ font: '800 9.5px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)' }}>Parte contable</div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <input type="checkbox" checked readOnly style={{ accentColor: 'var(--wine)', width: 15, height: 15, marginTop: 2 }} />
                <span style={{ font: '600 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Lo vendo a clientes <span style={{ color: 'var(--ink-mute)', fontWeight: 500 }}>· aparece en estimados y facturas</span></span>
              </label>
              <div><Label>Descripción de venta</Label><input value={sellDesc} onChange={(e) => setSellDesc(e.target.value)} placeholder="Texto que ve el cliente en la factura" style={inputBox} /></div>
              {!isGroup && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12 }}>
                  <div><Label>Precio/Tasa de venta</Label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <span style={{ padding: '9px 10px', border: '1px solid var(--border)', borderRight: 0, borderRadius: 'var(--r-md) 0 0 var(--r-md)', background: 'var(--bg-elevated)', font: '700 13px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>$</span>
                      <window.ERPUI.CalcInput value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" style={{ ...inputBox, borderRadius: '0 var(--r-md) var(--r-md) 0', fontFamily: 'var(--f-mono)', fontWeight: 700 }} />
                    </div>
                  </div>
                  <div><Label>Unidad</Label>
                    <U.Select value={unit} onChange={(e) => setUnit(e.target.value)} options={['envío', 'CBM', 'CBM/mes', 'kg', 'contenedor', 'unidad', 'rollo', '% valor'].map(u => ({ value: u, label: u }))} />
                  </div>
                </div>
              )}
              <div><Label>Cuenta de ingresos</Label>
                <U.Select value={incomeAcct} onChange={(e) => setIncomeAcct(e.target.value)} options={INCOME_ACCTS.map(a => ({ value: a, label: a }))} />
              </div>
              {isInv ? (
                <div><Label hint="costo de la mercadería vendida">Cuenta de costo (COGS)</Label>
                  <U.Select value={expenseAcct} onChange={(e) => setExpenseAcct(e.target.value)} options={EXPENSE_ACCTS.map(a => ({ value: a, label: a }))} />
                </div>
              ) : !isGroup && (
                <React.Fragment>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <input type="checkbox" checked={purchased} onChange={(e) => setPurchased(e.target.checked)} style={{ accentColor: 'var(--wine)', width: 15, height: 15, marginTop: 2 }} />
                    <span style={{ font: '600 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Lo compro a un proveedor <span style={{ color: 'var(--ink-mute)', fontWeight: 500 }}>(servicio de tercero al costo)</span></span>
                  </label>
                  {purchased && (
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                      <div><Label>Costo</Label>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ padding: '9px 10px', border: '1px solid var(--border)', borderRight: 0, borderRadius: 'var(--r-md) 0 0 var(--r-md)', background: 'var(--bg-elevated)', font: '700 13px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>$</span>
                          <window.ERPUI.CalcInput value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" style={{ ...inputBox, borderRadius: '0 var(--r-md) var(--r-md) 0', fontFamily: 'var(--f-mono)', fontWeight: 700 }} />
                        </div>
                      </div>
                      <div><Label>Cuenta de gasto / costo</Label>
                        <U.Select value={expenseAcct} onChange={(e) => setExpenseAcct(e.target.value)} options={EXPENSE_ACCTS.map(a => ({ value: a, label: a }))} />
                      </div>
                    </div>
                  )}
                  {purchased && (
                    <div>
                      <Label hint="sin efecto contable · solo sugerencia">Proveedor sugerido</Label>
                      <window.ERPUI.SearchSelect value={supplier} placeholder="Busca o crea un proveedor…" createLabel="Crear proveedor"
                        onChange={(v) => setSupplier(v)}
                        onCreate={(name) => { const n = (name || '').trim(); if (!n) return; setNewSupps(x => x.includes(n) ? x : [...x, n]); setSupplier(n); }}
                        options={[...SUPPLIERS_CN, ...newSupps].map(s => ({ value: s, label: s, sub: newSupps.includes(s) ? 'Proveedor nuevo' : 'Proveedor CN' }))} />
                      <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 7 }}>Al crear un gasto/bill con este servicio, el sistema sugiere este proveedor automaticamente. Es solo una referencia — no afecta la contabilidad.</div>
                    </div>
                  )}
                </React.Fragment>
              )}
            </div>

            {/* Servicio / No inventario → vigencia de tarifa */}
            {(type === 'servicio' || type === 'no_inv') && (
              <div>
                <Label hint="cuándo expira esta tarifa">Vigencia de la tarifa</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Vigente hasta</span>
                  <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} style={{ ...inputBox, width: 'auto' }} />
                </div>
                <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 7 }}>Al llegar la fecha, el sistema avisa para renovar. La tarifa anterior pasa al historial.</div>
              </div>
            )}

            {/* Inventario → stock */}
            {isInv && (
              <React.Fragment>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div><Label>Costo unit.</Label>
                    <window.ERPUI.CalcInput value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" style={{ ...inputBox, fontFamily: 'var(--f-mono)', fontWeight: 700 }} /></div>
                  <div><Label>Stock inicial</Label>
                    <window.ERPUI.CalcInput value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" style={{ ...inputBox, fontFamily: 'var(--f-mono)', fontWeight: 700 }} /></div>
                  <div><Label>Punto reorden</Label>
                    <window.ERPUI.CalcInput value={reorder} onChange={(e) => setReorder(e.target.value)} placeholder="0" style={{ ...inputBox, fontFamily: 'var(--f-mono)', fontWeight: 700 }} /></div>
                </div>
                <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>El stock baja al consumir y avisa cuando cae bajo el punto de reorden. (Lo que lo hace "inventario".)</div>
              </React.Fragment>
            )}

            {/* Reglas de precios atadas al servicio */}
            {!isGroup && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ font: '800 9.5px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)', marginBottom: 8 }}>Reglas de precios</div>
                <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 10 }}>Descuentos/recargos atados a este servicio (por cliente, volumen/CBM, temporada). También se pueden vincular a un servicio ya creado.</div>
                <U.Btn variant="secondary" size="sm" icon={ic('plus', 13)} onClick={() => setRuleOpen(true)}>Agregar nuevo</U.Btn>
                <RuleModal open={ruleOpen} onClose={() => setRuleOpen(false)} item={{ name }} />
              </div>
            )}

            {/* Grupo → componentes */}
            {isGroup && (
              <div>
                <Label>Productos / servicios incluidos en el paquete</Label>
                <GroupComposer comps={comps} setComps={setComps} />

                {/* Toggle clave · mostrar desglose al facturar */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, padding: '11px 13px', borderRadius: 'var(--r-md)', border: '1px solid ' + (showComps ? 'var(--wine)' : 'var(--border)'), background: showComps ? 'var(--wine-tint)' : 'var(--bg-surface)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showComps} onChange={(e) => setShowComps(e.target.checked)} style={{ accentColor: 'var(--wine)', width: 16, height: 16, marginTop: 1 }} />
                  <div>
                    <div style={{ font: '700 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Mostrar los componentes al imprimir o enviar transacciones</div>
                    <div style={{ font: '500 11px/1.45 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>Si está <b>desmarcado</b>, en la factura el cliente ve solo el título del paquete. Si lo <b>marcas</b>, ve el desglose línea por línea.</div>
                  </div>
                </label>

                {/* Vista previa de factura */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Así se ve en la factura</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 13px', background: 'var(--bg-surface)' }}>
                      <span style={{ font: '700 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{name || 'Servicio completo'}</span>
                      <span style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{fmt(compTotal)}</span>
                    </div>
                    {showComps && comps.map(c => { const x = byCode(c); return (
                      <div key={c} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 13px 7px 26px', borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                        <span style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>• {x?.name || c}</span>
                        <span style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{fmt(x?.rate || 0)}</span>
                      </div>
                    ); })}
                    {!showComps && <div style={{ padding: '7px 13px', borderTop: '1px solid var(--border)', background: 'var(--bg-base)', font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>Desglose oculto · el cliente ve una sola línea.</div>}
                  </div>
                </div>

                <div style={{ marginTop: 12, padding: '11px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tarifa del paquete · desde</span>
                  <span style={{ font: '900 18px/1 var(--f-display)', color: 'var(--wine)' }}>{fmt(compTotal)}</span>
                </div>
              </div>
            )}
            </React.Fragment>
            )}
          </div>
        )}
      </U.Drawer>
    );
  }

  // ── Drawer detalle · tarifa vigente + historial + renovar ──
  function DetailDrawer({ item, onClose }) {
    const [renew, setRenew] = useState(false);
    const [newRate, setNewRate] = useState('');
    const [newTo, setNewTo] = useState('');
    const [renewed, setRenewed] = useState(null);
    const [provRates, setProvRates] = useState([]);
    const [newSupps, setNewSupps] = useState([]);
    const [npOpen, setNpOpen] = useState(false);
    const [npName, setNpName] = useState('');
    const [npPrice, setNpPrice] = useState('');
    const [npTo, setNpTo] = useState('');
    React.useEffect(() => { if (item) { setRenew(false); setNewRate(''); setNewTo(''); setRenewed(null); setProvRates(item.supplierRates ? [...item.supplierRates] : []); setNpOpen(false); setNpName(''); setNpPrice(''); setNpTo(''); setNewSupps([]); } }, [item]);
    if (!item) return null;
    const st = tarifaStatus(item.to);
    const isGroup = item.type === 'grupo';
    const curRate = displayRate(item);
    const hist = renewed
      ? [{ rate: item.rate, from: item.from, to: item.to }, ...(item.history || [])]
      : (item.history || []);
    const curShown = renewed || { rate: item.rate, from: item.from, to: item.to };

    return (
      <U.Drawer open={!!item} onClose={onClose} width={520}
        title={item.name}
        subtitle={<span><code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{item.code}</code> · {TYPES[item.type].label}</span>}
        actions={<U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Thumb item={item} size={44} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{typeBadge(item.type)}<U.Badge tone="neutral" size="sm">/{item.unit}</U.Badge></div>
          </div>
          <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink-soft)' }}>{item.desc}</div>

          {/* Tarifa vigente */}
          <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 7 }}>Tarifa vigente</div>
                <div style={{ font: '900 26px/1 var(--f-display)', color: 'var(--ink)' }}>{isGroup ? 'desde ' : ''}{fmt(renewed ? renewed.rate : curRate)}<span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}> /{item.unit}</span></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <U.Badge tone={renewed ? 'success' : st.tone} size="sm">{renewed ? 'Vigente' : st.label}</U.Badge>
                <div style={{ font: '500 11px/1.4 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 6 }}>{fdate(curShown.from)} → {fdate(curShown.to)}</div>
              </div>
            </div>

            {isGroup ? (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {item.components.map(c => { const x = byCode(c); return (
                  <div key={c} style={{ display: 'flex', justifyContent: 'space-between', font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
                    <span>{x?.name || c}</span><span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{fmt(x?.rate || 0)}</span>
                  </div>
                ); })}
              </div>
            ) : item.type === 'inventario' ? (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[['Stock', item.stock, item.stock <= item.reorder ? 'var(--warning)' : 'var(--ink)'], ['Reorden', item.reorder, 'var(--ink)'], ['Costo', fmt(item.cost), 'var(--ink)']].map(([l, v, c]) => (
                  <div key={l}><div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div><div style={{ font: '800 15px/1 var(--f-mono)', color: c, marginTop: 5 }}>{v}</div></div>
                ))}
              </div>
            ) : (
              !renew && <U.Btn variant="soft" size="sm" icon={ic('repeat', 13, 'clock')} onClick={() => { setRenew(true); setNewRate(item.rate); }} style={{ marginTop: 14 }}>Renovar tarifa</U.Btn>
            )}
          </div>

          {/* Proveedores y costos por tarifa */}
          {!isGroup && item.type !== 'inventario' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Proveedores y costos</div>
                <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{provRates.length} {provRates.length === 1 ? 'proveedor' : 'proveedores'}</span>
              </div>
              {provRates.length === 0 && !npOpen && (
                <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin proveedores cargados. Agrega uno para comparar costos por tarifa.</div>
              )}
              {provRates.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 10 }}>
                  {provRates.map((p, i) => {
                    const ps = tarifaStatus(p.to);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ flex: 1, minWidth: 0, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        {p.to && <U.Badge tone={ps.tone} size="sm">{fdate(p.to)}</U.Badge>}
                        <span style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)', minWidth: 58, textAlign: 'right' }}>{fmt(p.price)}<span style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)' }}> /{item.unit}</span></span>
                        <button type="button" title="Quitar proveedor" onClick={() => setProvRates(r => r.filter((_, j) => j !== i))}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-mute)', font: '700 15px/1 var(--f-sans)', padding: '0 2px', flexShrink: 0 }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {npOpen ? (
                <div style={{ padding: 14, border: '1px solid var(--wine)', borderRadius: 'var(--r-lg)', background: 'var(--wine-tint)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <Label>Proveedor</Label>
                    <window.ERPUI.SearchSelect value={npName} placeholder="Busca o crea un proveedor…" createLabel="Crear proveedor"
                      onChange={(v) => setNpName(v)}
                      onCreate={(name) => { const n = (name || '').trim(); if (!n) return; setNewSupps(x => x.includes(n) ? x : [...x, n]); setNpName(n); }}
                      options={[...PROVIDERS, ...SUPPLIERS_CN, ...newSupps].filter((s, i, a) => a.indexOf(s) === i).map(s => ({ value: s, label: s, sub: newSupps.includes(s) ? 'Proveedor nuevo' : 'Proveedor' }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <Label>Costo</Label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ padding: '9px 10px', border: '1px solid var(--border)', borderRight: 0, borderRadius: 'var(--r-md) 0 0 var(--r-md)', background: 'var(--bg-surface)', font: '700 13px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>$</span>
                        <window.ERPUI.CalcInput value={npPrice} onChange={(e) => setNpPrice(e.target.value)} placeholder="0" style={{ width: '100%', padding: '9px 11px', borderRadius: '0 var(--r-md) var(--r-md) 0', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }} />
                      </div>
                    </div>
                    <div>
                      <Label>Vigente hasta</Label>
                      <input type="date" value={npTo} onChange={(e) => setNpTo(e.target.value)} style={{ width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '500 12px/1 var(--f-sans)', color: 'var(--ink)' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <U.Btn variant="ghost" size="sm" onClick={() => { setNpOpen(false); setNpName(''); setNpPrice(''); setNpTo(''); }}>Cancelar</U.Btn>
                    <U.Btn variant="primary" size="sm" icon={ic('check', 13)} disabled={!npName || npPrice === ''} onClick={() => { setProvRates(r => [...r, { name: npName, price: Number(npPrice), to: npTo || null }]); setNpOpen(false); setNpName(''); setNpPrice(''); setNpTo(''); }}>Agregar proveedor</U.Btn>
                  </div>
                </div>
              ) : (
                <U.Btn variant="soft" size="sm" icon={window.Icon.plus(13)} onClick={() => setNpOpen(true)}>Agregar proveedor</U.Btn>
              )}
            </div>
          )}

          {/* Form renovar */}
          {renew && !renewed && (
            <div style={{ padding: '14px', border: '1px solid var(--wine)', borderRadius: 'var(--r-lg)', background: 'var(--wine-tint)' }}>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Nueva tarifa</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 5 }}>Precio</div>
                  <window.ERPUI.CalcInput value={newRate} onChange={(e) => setNewRate(e.target.value)} style={{ width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '700 14px/1 var(--f-mono)', color: 'var(--ink)' }} />
                </div>
                <div>
                  <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 5 }}>Vigente hasta</div>
                  <input type="date" value={newTo} onChange={(e) => setNewTo(e.target.value)} style={{ width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '500 12px/1 var(--f-sans)', color: 'var(--ink)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <U.Btn variant="ghost" size="sm" onClick={() => setRenew(false)}>Cancelar</U.Btn>
                <U.Btn variant="primary" size="sm" icon={ic('check', 13)} disabled={newRate === '' || !newTo} onClick={() => setRenewed({ rate: Number(newRate), from: '2026-05-31', to: newTo, by: 'Carlos Vásquez' })}>Aplicar nueva tarifa</U.Btn>
              </div>
            </div>
          )}

          {/* Historial */}
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Historial de tarifas</div>
            {hist.length === 0 ? (
              <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin versiones anteriores. Cuando renueves, la tarifa actual queda registrada acá.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {hist.map((h, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: idx ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink-mute)', flexShrink: 0 }} />
                    <span style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)', minWidth: 62 }}>{fmt(h.rate)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{fdate(h.from)} → {fdate(h.to)}</div>
                      <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>cambió: {h.by || AUTHORS[idx % AUTHORS.length]}</div>
                    </div>
                    <U.Badge tone="neutral" size="sm">anterior</U.Badge>
                    <span title="Solo el admin de la empresa o super admin puede eliminar" style={{ color: 'var(--ink-mute)', opacity: 0.5, display: 'inline-flex', cursor: 'not-allowed' }}>{ic('trash', 14, 'more')}</span>
                  </div>
                ))}
              </div>
            )}
            {hist.length > 0 && (
              <div style={{ marginTop: 12, padding: '9px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, alignItems: 'center', font: '500 11px/1.45 var(--f-sans)', color: 'var(--ink-mute)' }}>
                <span style={{ color: 'var(--ink-soft)' }}>{ic('info', 13)}</span>
                El historial es un registro de auditoría: <b style={{ color: 'var(--ink-soft)', margin: '0 3px' }}>solo el admin de la empresa o un super admin</b> puede eliminar entradas.
              </div>
            )}
          </div>
        </div>
      </U.Drawer>
    );
  }

  window.ServiciosTarifasApp = ServiciosTarifasApp;
  window.ModuleServiciosTarifas = function () { return <ServiciosTarifasApp embedded />; };
})();
