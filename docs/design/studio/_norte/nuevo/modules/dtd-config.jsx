/* global React */
/* ── DTD ERP · Config de negocio (IVA/SENIAT, etc.) ─────────── */
/* Preferencias que el Admin activa. IVA/SENIAT está OFF por      */
/* defecto: a DTD-Cargo hoy no le interesa manejar IVA.           */

const _DTD_CFG_KEY = 'dtd_cfg_v1';
function _cfgRead() { try { return JSON.parse(localStorage.getItem(_DTD_CFG_KEY) || '{}'); } catch (e) { return {}; } }
function _cfgGet(k) {
  const c = _cfgRead();
  if (k === 'iva') return c.iva === true;   // default OFF
  return c[k];
}
function _cfgSet(k, v) {
  const c = _cfgRead(); c[k] = v;
  try { localStorage.setItem(_DTD_CFG_KEY, JSON.stringify(c)); } catch (e) {}
  try { window.dispatchEvent(new CustomEvent('dtd-cfg-changed', { detail: { key: k, value: v } })); } catch (e) {}
}
function _useCfg(k) {
  const [v, setV] = React.useState(() => _cfgGet(k));
  React.useEffect(() => {
    const f = () => setV(_cfgGet(k));
    window.addEventListener('dtd-cfg-changed', f);
    return () => window.removeEventListener('dtd-cfg-changed', f);
  }, [k]);
  return v;
}
window.DTDConfig = { get: _cfgGet, set: _cfgSet, useCfg: _useCfg };

// ── Export CSV real (descarga blob) ───────────────────────────
function _csvExport(filename, headers, rows) {
  const esc = (v) => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [headers.map(esc).join(',')].concat((rows || []).map(r => r.map(esc).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
window.DTDExport = { csv: _csvExport };

// ── Toggle reutilizable ───────────────────────────────────────
function CfgSwitch({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} style={{
      width: 46, height: 26, borderRadius: 999, padding: 3, flexShrink: 0,
      background: on ? 'var(--success)' : 'var(--border-strong)',
      transition: 'background var(--dur) var(--ease)', cursor: 'pointer',
      display: 'inline-flex', justifyContent: on ? 'flex-end' : 'flex-start', alignItems: 'center',
    }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow-sm)' }} />
    </button>
  );
}

// ── Sección de Administración · Impuestos ─────────────────────
function AdminFiscalConfig() {
  const U = window.ERPUI;
  const I = window.Icon;
  const ivaOn = window.DTDConfig.useCfg('iva');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <U.Card padded>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <span style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: ivaOn ? 'var(--success-bg)' : 'var(--bg-elevated)', color: ivaOn ? 'var(--success)' : 'var(--ink-mute)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.shield(22)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)' }}>Gestión de IVA · SENIAT</div>
              <CfgSwitch on={ivaOn} onChange={(v) => window.DTDConfig.set('iva', v)} />
            </div>
            <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
              Activá esto solo si DTD-Cargo debe llevar el cumplimiento fiscal venezolano (IVA, libros de
              compra/venta, retenciones, declaración SENIAT). <b>Desactivado por defecto.</b> Cuando está apagado,
              la Contabilidad funciona en USD sin la capa fiscal y el tab <b>Fiscal · SENIAT</b> queda oculto.
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--r-md)', background: ivaOn ? 'var(--success-bg)' : 'var(--bg-elevated)', font: '600 12px/1.4 var(--f-sans)', color: ivaOn ? 'var(--success)' : 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {ivaOn ? I.check(14) : I.info(14)}
              {ivaOn ? 'IVA/SENIAT activo · el tab Fiscal y los reportes de IVA están visibles.' : 'IVA/SENIAT desactivado · sin capa fiscal (modo actual de DTD-Cargo).'}
            </div>
          </div>
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>QUÉ CAMBIA AL ACTIVAR</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { l: 'Contabilidad → tab "Fiscal · SENIAT"', d: 'Libro de Ventas, Compras, Retenciones y Declaración IVA' },
            { l: 'Reportes → "Posición IVA"', d: 'En la categoría Contables & financieros' },
            { l: 'Facturación con IVA 16%', d: 'Las nuevas facturas discriminan base + IVA' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <span style={{ color: ivaOn ? 'var(--success)' : 'var(--ink-mute)', display: 'inline-flex' }}>{ivaOn ? I.check(15) : I.close(13)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.l}</div>
                <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{r.d}</div>
              </div>
              <U.Badge tone={ivaOn ? 'success' : 'neutral'} size="sm">{ivaOn ? 'visible' : 'oculto'}</U.Badge>
            </div>
          ))}
        </div>
      </U.Card>
    </div>
  );
}

window.AdminFiscalConfig = AdminFiscalConfig;
