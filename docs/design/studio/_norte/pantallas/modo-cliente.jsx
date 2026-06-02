/* @iife */ (function(){
/* ── Modo cliente · vista previa del portal como un cliente ──────── */
/* Wrapper delgado: barra superior + iframe al Portal del Cliente.    */
/* Estilos INLINE para ser self-contained (funciona standalone Y como */
/* overlay dentro del ERP). Expone window.ModoCliente.                */
const PORTAL = 'Portal del Cliente.html';

function ModoCliente({ markbox: pid, embedded } = {}) {
  const D = window.ERPData;
  const I = window.Icon;
  const clients = D.CLIENTS.filter(c => c.status !== 'inactive');
  const startId = React.useMemo(() => {
    if (pid && D.CLIENTS.find(c => c.markbox === pid)) return pid;
    try { const a = new URLSearchParams(location.search).get('as'); return a || clients[0].markbox; }
    catch (e) { return clients[0].markbox; }
  }, []);
  const [markbox, setMarkbox] = React.useState(startId);
  const me = D.CLIENTS.find(c => c.markbox === markbox) || clients[0];
  const src = `${PORTAL}?as=${encodeURIComponent(markbox)}`;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--ink)' }}>
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', background: 'var(--ink)', color: '#fff', borderBottom: '2px solid var(--wine)' }}>
        <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.eye ? I.eye(15) : '👁'}</span>
        <div>
          <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wine-soft)' }}>Modo cliente · vista previa</div>
          <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>Estás viendo el portal exactamente como <strong style={{ color: '#fff' }}>{me.name}</strong></div>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ font: '600 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)' }}>Cliente:</span>
        <select value={markbox} onChange={(e) => { setMarkbox(e.target.value); if (!embedded) history.replaceState(null, '', `?as=${e.target.value}`); }}
          style={{ padding: '8px 30px 8px 12px', appearance: 'none', cursor: 'pointer', background: "rgba(255,255,255,0.08) url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23ffffff' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>\") no-repeat right 11px center", border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--r-md)', font: '700 13px/1 var(--f-sans)', color: '#fff', outline: 'none' }}>
          {clients.map(c => <option key={c.markbox} value={c.markbox} style={{ color: 'var(--ink)' }}>{c.markbox} · {c.name}</option>)}
        </select>
        {embedded
          ? <button onClick={() => window.__erpCloseOverlay && window.__erpCloseOverlay()} style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer', font: '700 12.5px/1 var(--f-sans)', border: '1px solid var(--wine)', background: 'var(--wine)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 7 }}>{I.arrowL ? I.arrowL(13) : '←'} Salir del modo</button>
          : <a href="DTD Studio · ERP.html" style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer', font: '700 12.5px/1 var(--f-sans)', border: '1px solid var(--wine)', background: 'var(--wine)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none' }}>{I.arrowL ? I.arrowL(13) : '←'} Salir del modo</a>}
      </div>
      <iframe src={src} title="Portal del cliente" key={markbox} style={{ width: '100%', flex: 1, border: 0, display: 'block', background: 'var(--bg-base)' }}></iframe>
    </div>
  );
}

window.ModoCliente = ModoCliente;
})();
