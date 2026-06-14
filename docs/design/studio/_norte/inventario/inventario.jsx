/* global React, ReactDOM */
const { useState, useMemo } = React;

const STOCK = [
  { mark:'DTD-5532', cliente:'María Rodríguez',   wh:'CN', ctns:5,  cbm:0.42, kg:62,  status:'recibido',   dias:2,  desc:'Termos acero · cables' },
  { mark:'DTD-5532', cliente:'María Rodríguez',   wh:'CN', ctns:3,  cbm:0.18, kg:24,  status:'listo',      dias:5,  desc:'Accesorios telefonía' },
  { mark:'DTD-5418', cliente:'Importadora El Sol',wh:'CN', ctns:18, cbm:2.10, kg:340, status:'listo',      dias:6,  desc:'Ferretería · herramientas' },
  { mark:'DTD-5610', cliente:'Carlos Méndez',     wh:'CN', ctns:9,  cbm:1.05, kg:180, status:'recibido',   dias:1,  desc:'Repuestos motos' },
  { mark:'DTD-5277', cliente:'Tienda Aurora',     wh:'CN', ctns:12, cbm:0.96, kg:120, status:'consolidando', dias:8, desc:'Textil · ropa' },
  { mark:'DTD-5119', cliente:'Distribuidora JK',  wh:'VE', ctns:22, cbm:2.80, kg:410, status:'transito',   dias:14, desc:'Electrodomésticos' },
  { mark:'DTD-5044', cliente:'Bazar Central',     wh:'VE', ctns:30, cbm:3.40, kg:520, status:'aduana',     dias:3,  desc:'Juguetería · bazar' },
  { mark:'DTD-4980', cliente:'Mega Repuestos',    wh:'VE', ctns:8,  cbm:0.74, kg:140, status:'entrega',    dias:1,  desc:'Repuestos auto' },
];

const STATUS = {
  recibido:     { label:'Recibido',      tone:'info' },
  listo:        { label:'Listo p/ consolidar', tone:'wine' },
  consolidando: { label:'Consolidando',  tone:'warning' },
  transito:     { label:'En tránsito',   tone:'info' },
  aduana:       { label:'En aduana',     tone:'warning' },
  entrega:      { label:'En entrega',    tone:'success' },
};

const CONTAINER_CBM = 68; // 40'HC

function Badge({ tone, children }) {
  const map = {
    info:    ['var(--info-bg, #E7EEFB)', 'var(--info, #2A6FDB)'],
    wine:    ['var(--wine-bg)', 'var(--wine)'],
    warning: ['var(--warning-bg, #F6EAD2)', 'var(--warning, #B8893A)'],
    success: ['var(--success-bg, #DCF0E5)', 'var(--success, #1F8A5B)'],
    neutral: ['var(--bg-elevated)', 'var(--ink-soft)'],
  };
  const [bg, fg] = map[tone] || map.neutral;
  return <span style={{ background:bg, color:fg, font:'700 10px/1 var(--f-sans)', letterSpacing:'0.04em', textTransform:'uppercase', padding:'5px 9px', borderRadius:'var(--r-pill)', whiteSpace:'nowrap' }}>{children}</span>;
}

function KPI({ k, v, sub, tone }) {
  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'18px 20px', boxShadow:'var(--shadow-xs)' }}>
      <div style={{ font:'600 10px/1 var(--f-sans)', letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--ink-mute)' }}>{k}</div>
      <div style={{ font:'800 30px/1 var(--f-display)', color:tone||'var(--ink)', letterSpacing:'-0.02em', marginTop:8 }}>{v}</div>
      {sub && <div style={{ font:'500 11.5px/1.3 var(--f-sans)', color:'var(--ink-soft)', marginTop:5 }}>{sub}</div>}
    </div>
  );
}

function Occupancy({ label, used, cap }) {
  const pct = Math.min(100, Math.round(used / cap * 100));
  const tone = pct > 85 ? 'var(--danger, #A8323E)' : pct > 60 ? 'var(--warning, #B8893A)' : 'var(--success, #1F8A5B)';
  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'18px 20px', boxShadow:'var(--shadow-xs)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
        <span style={{ font:'700 13px/1 var(--f-display)', color:'var(--ink)' }}>{label}</span>
        <span style={{ font:'700 12px/1 var(--f-mono)', color:tone }}>{pct}%</span>
      </div>
      <div style={{ height:10, borderRadius:999, background:'var(--bg-elevated)', overflow:'hidden' }}>
        <div style={{ width:pct+'%', height:'100%', background:tone, borderRadius:999, transition:'width .4s' }}></div>
      </div>
      <div style={{ font:'500 11px/1.3 var(--f-mono)', color:'var(--ink-mute)', marginTop:8 }}>{used.toFixed(1)} / {cap} CBM · contenedor 40'HC</div>
    </div>
  );
}

function App() {
  const [wh, setWh] = useState('CN');
  const rows = useMemo(() => STOCK.filter(s => s.wh === wh), [wh]);
  const tot = useMemo(() => {
    const f = STOCK.filter(s => s.wh === wh);
    return { ctns: f.reduce((a,s)=>a+s.ctns,0), cbm: f.reduce((a,s)=>a+s.cbm,0), kg: f.reduce((a,s)=>a+s.kg,0), marks: new Set(f.map(s=>s.mark)).size };
  }, [wh]);
  const listo = STOCK.filter(s => s.wh==='CN' && s.status==='listo');
  const listoCbm = listo.reduce((a,s)=>a+s.cbm,0);

  return (
    <div style={{ maxWidth:1180, margin:'0 auto', padding:'var(--s-10) var(--s-8) var(--s-16)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:6 }}>
        <img src="assets/dtdcargo-isologo-primary.png" alt="" style={{ width:34 }} />
        <span style={{ fontFamily:'var(--f-brand-display)', fontWeight:900, letterSpacing:'-0.02em', fontSize:20 }}>
          <span style={{ color:'var(--wine)' }}>DTD</span><span style={{ display:'inline-block', width:'0.15em' }}></span><span style={{ color:'var(--ink)' }}>Cargo</span>
        </span>
      </div>
      <div className="eyebrow eyebrow-wine" style={{ marginTop:14 }}>OPERACIÓN · INVENTARIO</div>
      <h1 style={{ font:'700 32px/1.05 var(--f-display)', letterSpacing:'-0.02em', margin:'8px 0 6px' }}>Inventario de consolidación</h1>
      <p style={{ font:'400 15px/1.5 var(--f-sans)', color:'var(--ink-soft)', margin:'0 0 var(--s-8)', maxWidth:'64ch' }}>
        Existencias reales por bodega, agrupadas por Shipping Mark. Controla qué hay en China, qué está listo para consolidar y qué viaja hacia Venezuela.
      </p>

      {/* tabs bodega */}
      <div style={{ display:'flex', gap:8, marginBottom:'var(--s-6)' }}>
        {[['CN','Bodega China · Yiwu'],['VE','Bodega Venezuela · Valencia']].map(([k,l]) => (
          <button key={k} onClick={()=>setWh(k)} style={{
            cursor:'pointer', font:'600 13px/1 var(--f-sans)', padding:'11px 17px', borderRadius:'var(--r-pill)',
            border:'1px solid '+(wh===k?'var(--ink)':'var(--border)'), background:wh===k?'var(--ink)':'var(--bg-surface)', color:wh===k?'#fff':'var(--ink-soft)'
          }}>{l}</button>
        ))}
      </div>

      {/* Modo del módulo según bodega */}
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:14 }}>
        <span style={{ font:'700 10px/1 var(--f-sans)', letterSpacing:'0.1em', textTransform:'uppercase', color:'#fff', background:wh==='CN'?'var(--wine)':'var(--info, #2A6FDB)', padding:'5px 10px', borderRadius:'var(--r-pill)' }}>{wh==='CN'?'Modo consolidación · entrada':'Modo despacho · salida'}</span>
        <span style={{ font:'500 12px/1.4 var(--f-sans)', color:'var(--ink-mute)' }}>{wh==='CN'?'Carga que entra y se agrupa para el contenedor.':'Carga que llegó a Venezuela y avanza a entrega.'}</span>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:14 }}>
        <KPI k="Shipping Marks" v={tot.marks} sub="clientes con carga" />
        <KPI k="Cajas" v={tot.ctns} sub="bultos en bodega" />
        <KPI k="Volumen" v={tot.cbm.toFixed(2)+' m³'} sub="CBM acumulado" tone="var(--wine)" />
        <KPI k={wh==='CN'?'Peso':'Para entrega'} v={wh==='CN'?(tot.kg.toLocaleString()+' kg'):(STOCK.filter(s=>s.wh==='VE'&&s.status==='entrega').length+' marks')} sub={wh==='CN'?'peso total':'en última milla'} tone={wh==='VE'?'var(--success, #1F8A5B)':undefined} />
      </div>

      {/* CN · consolidación: ocupación + cola auto-derivada */}
      {wh==='CN' &&
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:'var(--s-6)' }}>
        <Occupancy label="Próximo contenedor a consolidar" used={listoCbm + STOCK.filter(s=>s.wh==='CN'&&s.status==='consolidando').reduce((a,s)=>a+s.cbm,0)} cap={CONTAINER_CBM} />
        <div style={{ background:'linear-gradient(135deg, var(--ink), #1F3055)', color:'#F2F0EC', borderRadius:'var(--r-lg)', padding:'18px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ font:'600 10px/1 var(--f-sans)', letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--wine-soft)' }}>Listo para consolidar</span>
            <span style={{ font:'600 9px/1 var(--f-sans)', letterSpacing:'0.04em', textTransform:'uppercase', color:'rgba(242,240,236,0.6)', border:'1px solid rgba(242,240,236,0.25)', borderRadius:'var(--r-pill)', padding:'3px 7px' }}>auto · +3 días</span>
          </div>
          <div style={{ font:'800 30px/1 var(--f-display)', marginTop:8 }}>{listo.length} <span style={{ font:'500 14px var(--f-sans)', color:'rgba(242,240,236,0.7)' }}>partidas · {listoCbm.toFixed(2)} m³</span></div>
          <div style={{ font:'500 11.5px/1.4 var(--f-sans)', color:'rgba(242,240,236,0.7)', marginTop:8 }}>Se deriva solo (recibido + 3 días); el bodeguero puede marcar/desmarcar. Agrupar en el próximo embarque optimiza el contenedor.</div>
        </div>
      </div>}

      {/* VE · despacho: cola de salida (otra semántica, no consolidación) */}
      {wh==='VE' &&
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, marginBottom:'var(--s-6)' }}>
        {[['transito','En tránsito','viajando a VE','var(--info, #2A6FDB)'],['aduana','En aduana','nacionalizando','var(--warning, #B8893A)'],['entrega','En entrega','última milla','var(--success, #1F8A5B)']].map(([st,lab,sub,tone])=>{
          const f=STOCK.filter(s=>s.wh==='VE'&&s.status===st);
          return (
            <div key={st} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderLeft:'3px solid '+tone, borderRadius:'var(--r-lg)', padding:'16px 18px', boxShadow:'var(--shadow-xs)' }}>
              <div style={{ font:'600 10px/1 var(--f-sans)', letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--ink-mute)' }}>{lab}</div>
              <div style={{ font:'800 26px/1 var(--f-display)', color:tone, marginTop:7 }}>{f.length} <span style={{ font:'500 12px var(--f-sans)', color:'var(--ink-soft)' }}>marks</span></div>
              <div style={{ font:'500 11px/1.3 var(--f-sans)', color:'var(--ink-mute)', marginTop:4 }}>{f.reduce((a,s)=>a+s.ctns,0)} cajas · {sub}</div>
            </div>
          );
        })}
      </div>}

      {/* tabla */}
      <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--bg-elevated)' }}>
              {['Shipping Mark','Cliente','Contenido','Cajas','CBM','Peso','Días','Estado'].map((h,i) => (
                <th key={h} style={{ font:'700 10px/1.2 var(--f-sans)', letterSpacing:'0.04em', textTransform:'uppercase', color:'var(--ink-soft)', textAlign:i>=3&&i<=6?'right':'left', padding:'11px 14px', borderBottom:'1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s,i) => (
              <tr key={i} style={{ borderBottom:i<rows.length-1?'1px solid var(--border)':'0' }}>
                <td style={{ padding:'12px 14px', font:'600 12.5px/1 var(--f-mono)', color:'var(--wine)' }}>{s.mark}</td>
                <td style={{ padding:'12px 14px', font:'600 13px/1.2 var(--f-sans)', color:'var(--ink)' }}>{s.cliente}</td>
                <td style={{ padding:'12px 14px', font:'400 12.5px/1.3 var(--f-sans)', color:'var(--ink-soft)' }}>{s.desc}</td>
                <td style={{ padding:'12px 14px', font:'600 12.5px/1 var(--f-mono)', color:'var(--ink)', textAlign:'right' }}>{s.ctns}</td>
                <td style={{ padding:'12px 14px', font:'600 12.5px/1 var(--f-mono)', color:'var(--ink)', textAlign:'right' }}>{s.cbm.toFixed(2)}</td>
                <td style={{ padding:'12px 14px', font:'600 12.5px/1 var(--f-mono)', color:'var(--ink)', textAlign:'right' }}>{s.kg} kg</td>
                <td style={{ padding:'12px 14px', font:'500 12px/1 var(--f-mono)', color:'var(--ink-mute)', textAlign:'right' }}>{s.dias}d</td>
                <td style={{ padding:'12px 14px' }}><Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ font:'400 12px/1.6 var(--f-sans)', color:'var(--ink-mute)', marginTop:'var(--s-6)', borderTop:'1px solid var(--border)', paddingTop:'var(--s-5)' }}>
        Mock de demostración (Slice A · solo lectura). El stock se deriva de las recepciones en bodega (warehouse_receipts CN/VE) y las consolidaciones (Naviera) — no se inventa. <b>CN = consolidación</b> (entrada, agrupa para el contenedor); <b>VE = despacho</b> (salida, avanza a entrega). El botón “agregar al contenedor” entra en Slice B. Contenedor 40'HC ≈ 68 CBM.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
