/* global React, ReactDOM */
const { useState, useMemo } = React;

const CLAIMS = [
  { id:'RC-2026-018', mark:'DTD-5044', cliente:'Bazar Central',     tipo:'dano',     desc:'Caja 12/30 con producto quebrado', monto:340,  estado:'evaluacion', seguro:true,  fecha:'2026-06-09', cont:'DTDU-204815' },
  { id:'RC-2026-017', mark:'DTD-5119', cliente:'Distribuidora JK',  tipo:'faltante', desc:'2 cajas no llegaron al despacho',   monto:560,  estado:'aprobado',   seguro:true,  fecha:'2026-06-07', cont:'DTDU-204815' },
  { id:'RC-2026-016', mark:'DTD-4980', cliente:'Mega Repuestos',    tipo:'retraso',  desc:'Entrega 6 días fuera de ETA',       monto:0,    estado:'resuelto',   seguro:false, fecha:'2026-06-05', cont:'DTDU-201190' },
  { id:'RC-2026-015', mark:'DTD-5277', cliente:'Tienda Aurora',     tipo:'dano',     desc:'Humedad en 3 cajas de textil',      monto:210,  estado:'pagado',     seguro:true,  fecha:'2026-05-30', cont:'DTDU-201190' },
  { id:'RC-2026-014', mark:'DTD-5610', cliente:'Carlos Méndez',     tipo:'faltante', desc:'Unidades faltantes en caja 4',      monto:95,   estado:'rechazado',  seguro:false, fecha:'2026-05-28', cont:'DTDU-198440' },
];

const TIPO = { dano:{l:'Daño', tone:'danger'}, faltante:{l:'Faltante', tone:'warning'}, retraso:{l:'Retraso', tone:'info'} };
const ESTADO = {
  evaluacion:{l:'En evaluación', tone:'warning', step:1},
  aprobado:  {l:'Aprobado',      tone:'info',    step:2},
  pagado:    {l:'Pagado',        tone:'success', step:3},
  resuelto:  {l:'Resuelto',      tone:'success', step:3},
  rechazado: {l:'Rechazado',     tone:'neutral', step:3},
};

function Badge({ tone, children }) {
  const map = {
    info:['#E7EEFB','#2A6FDB'], wine:['var(--wine-bg)','var(--wine)'],
    warning:['#F6EAD2','#B8893A'], success:['#DCF0E5','#1F8A5B'],
    danger:['#F6E1E3','#A8323E'], neutral:['var(--bg-elevated)','var(--ink-soft)'],
  };
  const [bg,fg]=map[tone]||map.neutral;
  return <span style={{background:bg,color:fg,font:'700 10px/1 var(--f-sans)',letterSpacing:'0.04em',textTransform:'uppercase',padding:'5px 9px',borderRadius:'var(--r-pill)',whiteSpace:'nowrap'}}>{children}</span>;
}

function KPI({ k, v, sub, tone }) {
  return (
    <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'18px 20px',boxShadow:'var(--shadow-xs)'}}>
      <div style={{font:'600 10px/1 var(--f-sans)',letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--ink-mute)'}}>{k}</div>
      <div style={{font:'800 30px/1 var(--f-display)',color:tone||'var(--ink)',letterSpacing:'-0.02em',marginTop:8}}>{v}</div>
      {sub&&<div style={{font:'500 11.5px/1.3 var(--f-sans)',color:'var(--ink-soft)',marginTop:5}}>{sub}</div>}
    </div>
  );
}

function App() {
  const [filtro, setFiltro] = useState('todos');
  const [sel, setSel] = useState(null);
  const rows = useMemo(()=> filtro==='todos'?CLAIMS:CLAIMS.filter(c=>c.estado===filtro || (filtro==='abiertos'&&['evaluacion','aprobado'].includes(c.estado))), [filtro]);
  const abiertos = CLAIMS.filter(c=>['evaluacion','aprobado'].includes(c.estado)).length;
  const expuesto = CLAIMS.filter(c=>['evaluacion','aprobado'].includes(c.estado)).reduce((a,c)=>a+c.monto,0);
  const conSeguro = CLAIMS.filter(c=>c.seguro).length;
  const pagadoMes = CLAIMS.filter(c=>c.estado==='pagado').reduce((a,c)=>a+c.monto,0);

  return (
    <div style={{maxWidth:1180,margin:'0 auto',padding:'var(--s-10) var(--s-8) var(--s-16)'}}>
      <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:6}}>
        <img src="assets/dtdcargo-isologo-primary.png" alt="" style={{width:34}} />
        <span style={{fontFamily:'var(--f-brand-display)',fontWeight:900,letterSpacing:'-0.02em',fontSize:20}}>
          <span style={{color:'var(--wine)'}}>DTD</span><span style={{display:'inline-block',width:'0.15em'}}></span><span style={{color:'var(--ink)'}}>Cargo</span>
        </span>
      </div>
      <div className="eyebrow eyebrow-wine" style={{marginTop:14}}>OPERACIÓN · POST-VENTA</div>
      <h1 style={{font:'700 32px/1.05 var(--f-display)',letterSpacing:'-0.02em',margin:'8px 0 6px'}}>Reclamos y siniestros</h1>
      <p style={{font:'400 15px/1.5 var(--f-sans)',color:'var(--ink-soft)',margin:'0 0 var(--s-8)',maxWidth:'66ch'}}>
        Gestión de incidencias de carga — daños, faltantes y retrasos — atadas a la orden y al Shipping Mark, con seguimiento de la cobertura de seguro.
      </p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:14,marginBottom:'var(--s-6)'}}>
        <KPI k="Reclamos abiertos" v={abiertos} sub="en evaluación o aprobados" tone="var(--warning, #B8893A)" />
        <KPI k="Monto expuesto" v={'$'+expuesto.toLocaleString()} sub="reclamos abiertos" tone="var(--wine)" />
        <KPI k="Con seguro" v={conSeguro+' / '+CLAIMS.length} sub="cubiertos por póliza" />
        <KPI k="Pagado (mes)" v={'$'+pagadoMes.toLocaleString()} sub="indemnizaciones" tone="var(--success, #1F8A5B)" />
      </div>

      {/* filtros */}
      <div style={{display:'flex',gap:8,marginBottom:'var(--s-5)',flexWrap:'wrap'}}>
        {[['todos','Todos'],['abiertos','Abiertos'],['evaluacion','En evaluación'],['aprobado','Aprobados'],['pagado','Pagados'],['rechazado','Rechazados']].map(([k,l])=>(
          <button key={k} onClick={()=>setFiltro(k)} style={{cursor:'pointer',font:'600 12.5px/1 var(--f-sans)',padding:'9px 14px',borderRadius:'var(--r-pill)',border:'1px solid '+(filtro===k?'var(--ink)':'var(--border)'),background:filtro===k?'var(--ink)':'var(--bg-surface)',color:filtro===k?'#fff':'var(--ink-soft)'}}>{l}</button>
        ))}
      </div>

      <div style={{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'var(--bg-elevated)'}}>
              {['Reclamo','Shipping Mark','Cliente','Tipo','Descripción','Monto','Seguro','Estado'].map((h,i)=>(
                <th key={h} style={{font:'700 10px/1.2 var(--f-sans)',letterSpacing:'0.04em',textTransform:'uppercase',color:'var(--ink-soft)',textAlign:i===5?'right':'left',padding:'11px 14px',borderBottom:'1px solid var(--border)'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c,i)=>(
              <tr key={c.id} onClick={()=>setSel(sel===c.id?null:c.id)} style={{borderBottom:i<rows.length-1?'1px solid var(--border)':'0',cursor:'pointer',background:sel===c.id?'var(--wine-bg)':'transparent'}}>
                <td style={{padding:'12px 14px',font:'600 12px/1 var(--f-mono)',color:'var(--wine)'}}>{c.id}</td>
                <td style={{padding:'12px 14px',font:'600 12px/1 var(--f-mono)',color:'var(--ink)'}}>{c.mark}</td>
                <td style={{padding:'12px 14px',font:'600 13px/1.2 var(--f-sans)',color:'var(--ink)'}}>{c.cliente}</td>
                <td style={{padding:'12px 14px'}}><Badge tone={TIPO[c.tipo].tone}>{TIPO[c.tipo].l}</Badge></td>
                <td style={{padding:'12px 14px',font:'400 12.5px/1.3 var(--f-sans)',color:'var(--ink-soft)',maxWidth:200}}>{c.desc}</td>
                <td style={{padding:'12px 14px',font:'600 12.5px/1 var(--f-mono)',color:'var(--ink)',textAlign:'right'}}>{c.monto?('$'+c.monto):'—'}</td>
                <td style={{padding:'12px 14px'}}>{c.seguro?<Badge tone="success">Sí</Badge>:<Badge tone="neutral">No</Badge>}</td>
                <td style={{padding:'12px 14px'}}><Badge tone={ESTADO[c.estado].tone}>{ESTADO[c.estado].l}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* detalle con flujo */}
      {sel && (()=>{ const c=CLAIMS.find(x=>x.id===sel); const step=ESTADO[c.estado].step; const flow=['Reportado','Evaluación','Resolución']; return (
        <div style={{marginTop:'var(--s-6)',background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'22px 24px',boxShadow:'var(--shadow-sm)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
            <div>
              <div style={{font:'700 16px/1.2 var(--f-display)',color:'var(--ink)'}}>{c.id} · {c.cliente}</div>
              <div style={{font:'500 12.5px/1.5 var(--f-mono)',color:'var(--ink-soft)',marginTop:4}}>{c.mark} · Contenedor {c.cont} · {c.fecha}</div>
              <div style={{font:'400 13px/1.5 var(--f-sans)',color:'var(--ink)',marginTop:8,maxWidth:'52ch'}}>{c.desc}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{font:'600 10px/1 var(--f-sans)',letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--ink-mute)'}}>Monto reclamado</div>
              <div style={{font:'800 26px/1 var(--f-display)',color:'var(--wine)',marginTop:6}}>{c.monto?('$'+c.monto.toLocaleString()):'Sin monto'}</div>
              <div style={{marginTop:6}}>{c.seguro?<Badge tone="success">Cubierto por seguro</Badge>:<Badge tone="neutral">Sin cobertura</Badge>}</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',marginTop:20}}>
            {flow.map((f,i)=>(
              <React.Fragment key={f}>
                <div style={{flex:1,textAlign:'center'}}>
                  <div style={{width:30,height:30,borderRadius:999,margin:'0 auto',background:i+1<=step?'var(--wine)':'var(--bg-elevated)',color:i+1<=step?'#fff':'var(--ink-mute)',font:'700 13px/30px var(--f-display)',textAlign:'center'}}>{i+1}</div>
                  <div style={{font:'600 11.5px/1.2 var(--f-sans)',color:i+1<=step?'var(--ink)':'var(--ink-mute)',marginTop:7}}>{f}</div>
                </div>
                {i<flow.length-1&&<div style={{flex:'0 0 50px',height:2,background:i+1<step?'var(--wine)':'var(--border)'}}></div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      ); })()}

      <p style={{font:'400 12px/1.6 var(--f-sans)',color:'var(--ink-mute)',marginTop:'var(--s-6)',borderTop:'1px solid var(--border)',paddingTop:'var(--s-5)'}}>
        Mock de demostración. En producción, un reclamo nace desde la orden o el despacho, dispara el flujo de evaluación y, si aplica, la gestión con la aseguradora (ver brief de seguro en <b>legal/</b>). Toca una fila para ver el detalle y el flujo.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
