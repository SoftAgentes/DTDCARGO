/* global React */
/* ── DTD ERP · Fiscal · SENIAT · tab de Contabilidad · v1.9.1 ─ */
/* Libro de Ventas · Libro de Compras · Retenciones · Declaración*/

function FiscalTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FiscalData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const [sub, setSub] = React.useState('declaracion');
  const ves = (usd) => R.fmtBs(R.usdToVes(usd));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '11px 16px', background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)', borderRadius: 'var(--r-md)' }}>
        <span style={{ color: 'var(--warning)', display: 'inline-flex' }}>{I.shield(16)}</span>
        <span style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
          Cumplimiento SENIAT · período <b>mayo 2026</b>. Montos en USD funcional y su equivalente en VES a tasa BCV <b>{rates.bcv.toFixed(2)}</b> (la declaración formal se presenta en bolívares).
        </span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <U.Tabs value={sub} onChange={setSub} items={[
          { value: 'declaracion', label: 'Declaración IVA' },
          { value: 'ventas',  label: 'Libro de Ventas', count: F.VENTAS.length },
          { value: 'compras', label: 'Libro de Compras', count: F.COMPRAS.length },
          { value: 'retenciones', label: 'Retenciones', count: F.RETENCIONES.length },
        ]} />
      </div>

      {sub === 'declaracion' && <DeclaracionView ves={ves} />}
      {sub === 'ventas'      && <VentasView ves={ves} />}
      {sub === 'compras'     && <ComprasView ves={ves} />}
      {sub === 'retenciones' && <RetencionesView ves={ves} />}
    </div>
  );
}

// ── Declaración IVA ───────────────────────────────────────────
function DeclaracionView({ ves }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FiscalData;
  const R = window.ERPRates;
  const d = F.declaracionIVA();
  const vt = F.ventasTotals();
  const rt = F.retencionesTotals();

  const Row = ({ label, usd, bold, tone = 'ink', strong, sign }) => (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: 14, padding: bold ? '13px 18px' : '9px 18px',
      borderTop: '1px solid var(--border)', background: bold ? 'var(--bg-elevated)' : 'transparent',
    }}>
      <span style={{ font: `${bold ? '800' : '500'} ${bold ? '13' : '12.5'}px/1.3 var(--f-${bold ? 'display' : 'sans'})`, color: `var(--${tone})` }}>{label}</span>
      <span style={{ textAlign: 'right', font: `${bold ? '800' : '600'} 12.5px/1 var(--f-mono)`, color: `var(--${tone})` }}>{sign && usd > 0 ? sign : ''}{R.fmtUsd(usd)}</span>
      <span style={{ textAlign: 'right', font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{ves(usd)}</span>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, alignItems: 'start' }}>
      <U.Card padded={false}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow eyebrow-wine">FORMA IVA · RESUMEN DE LA DECLARACIÓN</div>
          <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>DTD-Cargo C.A. · RIF J-50648869-8</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: 14, marginTop: 12, font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <span>Concepto</span><span style={{ textAlign: 'right' }}>USD</span><span style={{ textAlign: 'right' }}>VES @ BCV</span>
          </div>
        </div>
        <Row label="Débito fiscal (ventas gravadas 16%)" usd={d.debito} tone="success" />
        <Row label="Crédito fiscal (compras gravadas 16%)" usd={d.credito} tone="warning" />
        <Row label="Cuota tributaria (débito − crédito)" usd={d.cuota} bold />
        <Row label="(−) Retenciones de IVA soportadas (75%)" usd={d.retSoportadas} tone="info" sign="−" />
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: 14, padding: '15px 18px',
          borderTop: '2px solid var(--ink)', background: 'var(--bg-sidebar)', color: '#fff',
        }}>
          <span style={{ font: '900 14px/1 var(--f-display)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>{d.aPagar > 0 ? 'IVA a pagar' : 'Excedente de crédito'}</span>
          <span style={{ textAlign: 'right', font: '900 16px/1 var(--f-mono)', color: d.aPagar > 0 ? 'var(--wine-soft)' : '#7CE3A5' }}>{R.fmtUsd(d.aPagar > 0 ? d.aPagar : d.excedente)}</span>
          <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'rgba(255,255,255,0.7)' }}>{ves(d.aPagar > 0 ? d.aPagar : d.excedente)}</span>
        </div>
        <div style={{ padding: '10px 18px', font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', background: 'var(--bg-elevated)' }}>
          Vencimiento de la declaración: según calendario de contribuyentes especiales SENIAT · presentación en VES.
        </div>
      </U.Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <U.KPI label="Ventas gravadas" value={R.fmtUsd(vt.gravado)} delta={`Exento: ${R.fmtUsd(vt.exento)}`} tone="success" icon={I.invoice(18)} />
        <U.KPI label="Retenciones IVA emitidas" value={R.fmtUsd(rt.iva)} delta={`ISLR: ${R.fmtUsd(rt.islr)}`} tone="wine" icon={I.shield(18)} />
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>OBLIGACIONES DEL PERÍODO</div>
          {[
            { l: 'Declaración IVA', d: 'Forma 00030', done: false },
            { l: 'Retenciones IVA', d: 'Quincenal', done: true },
            { l: 'Retenciones ISLR', d: 'Mensual', done: true },
            { l: 'Libros de compra/venta', d: 'Respaldados', done: true },
          ].map((o, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: o.done ? 'var(--success-bg)' : 'var(--warning-bg)', color: o.done ? 'var(--success)' : 'var(--warning)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{o.done ? I.check(11) : I.clock(11)}</span>
              <span style={{ flex: 1, font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{o.l}</span>
              <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{o.d}</span>
            </div>
          ))}
        </U.Card>

        <ContabilizarFiscal kind="iva" />
      </div>
    </div>
  );
}

// ── Puente Fiscal → Contabilidad (botón de contabilización) ───
function ContabilizarFiscal({ kind }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  if (!C || !C.buildIvaSettlementEntry) return null;
  const isUnlocked = C.isUnlocked ? C.isUnlocked() : true;
  const preview = kind === 'iva' ? C.buildIvaSettlementEntry('2026-05-31') : C.buildRetencionesEntry('2026-05-31');
  const total = preview ? preview.lines.reduce((s, l) => s + (l.debit || 0), 0) : 0;
  const label = kind === 'iva' ? 'Contabilizar declaración IVA' : 'Contabilizar retenciones';
  const post = () => {
    if (!isUnlocked) { alert('Activa "Edición abierta" en Contabilidad (header) para contabilizar.'); return; }
    const entry = kind === 'iva' ? C.buildIvaSettlementEntry('2026-05-31') : C.buildRetencionesEntry('2026-05-31');
    if (!entry) { alert('Sin montos para contabilizar en el período.'); return; }
    C.createEntry(entry);
    alert(`Asiento generado · ${entry.concept} (${R.fmtUsd(total)}).`);
  };
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>PUENTE A CONTABILIDAD</div>
      <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 12 }}>
        {kind === 'iva'
          ? 'Genera el asiento de la cuota: débito IVA débito (2.01.08) · crédito IVA crédito (1.18) · neto a IVA por pagar (2.01.09).'
          : 'Genera el asiento de retenciones: débito a proveedores (2.01.06) · crédito retención IVA (2.01.10) e ISLR (2.01.03).'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ font: '900 16px/1 var(--f-display)', color: 'var(--wine)' }}>{R.fmtUsd(total)}</span>
        <U.Btn variant="primary" size="sm" icon={I.check(13)} disabled={!preview} onClick={post}>{label}</U.Btn>
      </div>
      {!isUnlocked && <div style={{ font: '500 10.5px/1.4 var(--f-sans)', color: 'var(--warning)', marginTop: 8 }}>Requiere "Edición abierta" en Contabilidad.</div>}
    </U.Card>
  );
}

// ── Tabla genérica de libro ───────────────────────────────────
function BookTable({ cols, rows, totals }) {
  return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {cols.map((c, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: c.align || 'left', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {cols.map((c, ci) => (
                    <td key={ci} style={{ padding: '10px 14px', textAlign: c.align || 'left', font: `${c.mono ? '600' : '500'} 12px/1.4 ${c.mono ? 'var(--f-mono)' : 'var(--f-sans)'}`, color: c.color || 'var(--ink)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{c.render ? c.render(r) : r[c.key]}</td>
                  ))}
                </tr>
              ))}
              {totals && (
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {cols.map((c, ci) => (
                    <td key={ci} style={{ padding: '12px 14px', textAlign: c.align || 'left', font: '800 12px/1 var(--f-mono)', color: 'var(--ink)', borderTop: '2px solid var(--ink)', whiteSpace: 'nowrap' }}>{totals[ci]}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
  );
}

function VentasView({ ves }) {
  const U = window.ERPUI; const I = window.Icon;
  const F = window.FiscalData; const R = window.ERPRates;
  const t = F.ventasTotals();
  const cols = [
    { label: 'Fecha', key: 'date', mono: true, color: 'var(--ink-soft)' },
    { label: 'Factura', render: (r) => <code style={{ color: 'var(--wine)', fontWeight: 700 }}>{r.factura}</code> },
    { label: 'Nº control', key: 'control', mono: true, color: 'var(--ink-mute)' },
    { label: 'Cliente', render: (r) => <span style={{ fontWeight: 600 }}>{r.cliente}</span> },
    { label: 'RIF', key: 'rif', mono: true, color: 'var(--ink-soft)' },
    { label: 'Base imp.', align: 'right', mono: true, render: (r) => R.fmtUsd(r.base) },
    { label: 'IVA 16%', align: 'right', mono: true, render: (r) => r.iva ? R.fmtUsd(r.iva) : <span style={{ color: 'var(--ink-mute)' }}>exento</span> },
    { label: 'Total', align: 'right', mono: true, render: (r) => <b>{R.fmtUsd(r.total)}</b> },
  ];
  const totals = ['', '', '', '', 'TOTALES', R.fmtUsd(t.base), R.fmtUsd(t.iva), R.fmtUsd(t.total)];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <U.Btn variant="secondary" size="sm" icon={I.download(12)} onClick={() => window.DTDExport && window.DTDExport.csv('libro-ventas-may2026',
          ['Fecha', 'Factura', 'Nº control', 'Cliente', 'RIF', 'Base', 'IVA', 'Total'],
          F.VENTAS.map(v => [v.date, v.factura, v.control, v.cliente, v.rif, v.base, v.iva, v.total]))}>Exportar CSV</U.Btn>
      </div>
      <BookTable cols={cols} rows={F.VENTAS} totals={totals} />
    </div>
  );
}

function ComprasView({ ves }) {
  const U = window.ERPUI; const I = window.Icon;
  const F = window.FiscalData; const R = window.ERPRates;
  const t = F.comprasTotals();
  const cols = [
    { label: 'Fecha', key: 'date', mono: true, color: 'var(--ink-soft)' },
    { label: 'Documento', render: (r) => <code style={{ color: 'var(--wine)', fontWeight: 700 }}>{r.doc}</code> },
    { label: 'Proveedor', render: (r) => <span><span style={{ fontWeight: 600 }}>{r.prov}</span><div style={{ font: '500 10px/1.2 var(--f-sans)', color: 'var(--ink-mute)' }}>{r.concepto}</div></span> },
    { label: 'RIF', key: 'rif', mono: true, color: 'var(--ink-soft)' },
    { label: 'Base imp.', align: 'right', mono: true, render: (r) => R.fmtUsd(r.base) },
    { label: 'IVA 16%', align: 'right', mono: true, render: (r) => r.iva ? R.fmtUsd(r.iva) : <span style={{ color: 'var(--ink-mute)' }}>exento</span> },
    { label: 'Total', align: 'right', mono: true, render: (r) => <b>{R.fmtUsd(r.total)}</b> },
  ];
  const totals = ['', '', '', 'TOTALES', R.fmtUsd(t.base), R.fmtUsd(t.iva), R.fmtUsd(t.total)];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <U.Btn variant="secondary" size="sm" icon={I.download(12)} onClick={() => window.DTDExport && window.DTDExport.csv('libro-compras-may2026',
          ['Fecha', 'Documento', 'Nº control', 'Proveedor', 'RIF', 'Concepto', 'Base', 'IVA', 'Total'],
          F.COMPRAS.map(c => [c.date, c.doc, c.control, c.prov, c.rif, c.concepto, c.base, c.iva, c.total]))}>Exportar CSV</U.Btn>
      </div>
      <BookTable cols={cols} rows={F.COMPRAS} totals={totals} />
    </div>
  );
}

function RetencionesView({ ves }) {
  const U = window.ERPUI; const F = window.FiscalData; const R = window.ERPRates;
  const rt = F.retencionesTotals();
  const cols = [
    { label: 'Fecha', key: 'date', mono: true, color: 'var(--ink-soft)' },
    { label: 'Comprobante', key: 'comprobante', mono: true, color: 'var(--ink)' },
    { label: 'Tipo', render: (r) => <U.Badge tone={r.tipo === 'IVA' ? 'wine' : 'info'} size="sm">{r.tipo}</U.Badge> },
    { label: 'Proveedor', render: (r) => <span style={{ fontWeight: 600 }}>{r.prov}</span> },
    { label: 'RIF', key: 'rif', mono: true, color: 'var(--ink-soft)' },
    { label: 'Base', align: 'right', mono: true, render: (r) => R.fmtUsd(r.base) },
    { label: '%', align: 'right', mono: true, render: (r) => r.pct + '%' },
    { label: 'Retenido', align: 'right', mono: true, render: (r) => <b>{R.fmtUsd(r.monto)}</b> },
  ];
  const totals = ['', '', '', '', '', 'TOTALES', `IVA ${R.fmtUsd(rt.iva)}`, R.fmtUsd(rt.iva + rt.islr)];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14 }}>
        <U.KPI label="Retención IVA emitida" value={R.fmtUsd(rt.iva)} delta="75% sobre IVA de compras" tone="wine" icon={window.Icon.shield(18)} />
        <U.KPI label="Retención ISLR emitida" value={R.fmtUsd(rt.islr)} delta="honorarios y servicios" tone="info" icon={window.Icon.invoice(18)} />
      </div>
      <BookTable cols={cols} rows={F.RETENCIONES} totals={totals} />
      <div style={{ marginTop: 14 }}>
        <ContabilizarFiscal kind="retenciones" />
      </div>
    </div>
  );
}

window.FiscalTab = FiscalTab;
