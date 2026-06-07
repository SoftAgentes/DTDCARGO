/* global React, window */
/* ── ERPUI.CatalogLines · líneas de servicio/tarifa desde el catálogo ──
   Cada línea referencia un ítem de ERPData.CATALOG y toma su TARIFA VIGENTE.
   Editable: cantidad + precio (override). Calcula subtotal y lo informa via
   onChange(lines, subtotal). Lo usan Factura y Estimado. */
(function () {
  const { useState, useEffect, useRef } = React;

  function CatalogLines({ onChange, title = 'Líneas de servicio', addLabel = 'Agregar línea', emptyHint }) {
    const U = window.ERPUI;
    const D = window.ERPData;
    const CAT = (D && D.CATALOG) || { byCode: () => null, displayRate: () => 0, lineOptions: () => [] };
    const [lines, setLines] = useState([]);
    const [adderKey, setAdderKey] = useState(0); // remonta el SearchSelect para resetearlo
    const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const subtotal = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
    const lastSent = useRef('');
    useEffect(() => {
      const sig = JSON.stringify(lines) + '|' + subtotal;
      if (onChange && sig !== lastSent.current) { lastSent.current = sig; onChange(lines, subtotal); }
    });

    const addLine = (code) => {
      const it = CAT.byCode(code);
      if (!it) return;
      setLines(ls => [...ls, { code: it.code, name: it.name, unit: it.unit, qty: 1, rate: CAT.displayRate(it) }]);
      setAdderKey(k => k + 1);
    };
    const upd = (i, patch) => setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l));
    const rm = (i) => setLines(ls => ls.filter((_, j) => j !== i));

    const lbl = { font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' };
    const numIn = { width: '100%', padding: '7px 9px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 12.5px/1 var(--f-mono)', textAlign: 'right' };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={lbl}>{title}</span>
          {lines.length > 0 && <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{lines.length} {lines.length === 1 ? 'línea' : 'líneas'}</span>}
        </div>

        {lines.length === 0 && (
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 10 }}>
            {emptyHint || 'Agregá servicios del catálogo. Cada línea toma su tarifa vigente; podés ajustar cantidad y precio.'}
          </div>
        )}

        {lines.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 84px 78px 24px', gap: 8, padding: '0 0 7px', alignItems: 'center' }}>
              {['Servicio', 'Cant.', 'Precio', 'Importe', ''].map((h, i) => (
                <span key={i} style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : i === 4 ? 'center' : 'right' }}>{h}</span>
              ))}
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 56px 84px 78px 24px', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '600 12.5px/1.25 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                  <div style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)' }}>{l.code} · /{l.unit}</div>
                </div>
                <input type="number" value={l.qty} min="0" onChange={(e) => upd(i, { qty: e.target.value })} style={numIn} />
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ padding: '7px 6px', border: '1px solid var(--border)', borderRight: 0, borderRadius: 'var(--r-sm) 0 0 var(--r-sm)', background: 'var(--bg-elevated)', font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>$</span>
                  <window.ERPUI.CalcInput value={l.rate} onChange={(e) => upd(i, { rate: e.target.value })} style={{ ...numIn, borderRadius: '0 var(--r-sm) var(--r-sm) 0' }} />
                </div>
                <span style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>{fmt((Number(l.qty) || 0) * (Number(l.rate) || 0))}</span>
                <button type="button" title="Quitar línea" onClick={() => rm(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-mute)', font: '700 15px/1 var(--f-sans)', padding: 0 }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 0', borderTop: '2px solid var(--border)', marginTop: 2 }}>
              <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Subtotal servicios</span>
              <span style={{ font: '900 16px/1 var(--f-display)', color: 'var(--ink)' }}>{fmt(subtotal)}</span>
            </div>
          </div>
        )}

        <U.SearchSelect key={adderKey} placeholder={addLabel + '…'} createLabel="Crear servicio nuevo"
          onChange={(v) => addLine(v)}
          onCreate={() => { window.__erpGoTo && window.__erpGoTo('rates', null, 'create'); }}
          options={CAT.lineOptions ? CAT.lineOptions() : []} />
      </div>
    );
  }

  window.ERPUI = window.ERPUI || {};
  window.ERPUI.CatalogLines = CatalogLines;
})();
