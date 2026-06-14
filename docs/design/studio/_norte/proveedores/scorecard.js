/* ── Scorecard de Proveedores + Reclamos · DTD-Cargo ──────────────
   KPIs por proveedor (puntualidad, calidad, rechazos, rating) + reclamos. */
(function () {
  'use strict';

  const SUP = [
    { id:'s1', name:'Yiwu Star Trading', city:'Yiwu', cat:'Hogar', orders:42, onTime:96, quality:94, defect:1.8 },
    { id:'s2', name:'Ningbo Best Tools', city:'Ningbo', cat:'Ferretería', orders:35, onTime:92, quality:96, defect:1.1 },
    { id:'s3', name:'Guangzhou Lihua Electronics', city:'Guangzhou', cat:'Electrónica', orders:28, onTime:88, quality:90, defect:3.2 },
    { id:'s4', name:'Foshan Hua Furniture', city:'Foshan', cat:'Muebles', orders:14, onTime:90, quality:92, defect:2.5 },
    { id:'s5', name:'Shenzhen Wells Tech', city:'Shenzhen', cat:'Electrónica', orders:19, onTime:78, quality:85, defect:5.4 }
  ];
  const CLAIMS = [
    { id:'R-2026-031', sup:'s3', order:'DTD-5532-2', type:'Daño', status:'Abierto', date:'2026-06-09', amount:420 },
    { id:'R-2026-030', sup:'s5', order:'DTD-5510-1', type:'Calidad', status:'En revisión', date:'2026-06-05', amount:880 },
    { id:'R-2026-028', sup:'s5', order:'DTD-5498-3', type:'Faltante', status:'Abierto', date:'2026-05-30', amount:240 },
    { id:'R-2026-025', sup:'s1', order:'DTD-5471-1', type:'Daño', status:'Resuelto', date:'2026-05-21', amount:150 },
    { id:'R-2026-022', sup:'s3', order:'DTD-5455-2', type:'Faltante', status:'Rechazado', date:'2026-05-12', amount:90 }
  ];

  function score(s){ return Math.round(s.onTime*0.4 + s.quality*0.4 + Math.max(0,100 - s.defect*6)*0.2); }
  function grade(sc){ return sc>=90?'A':sc>=82?'B':sc>=72?'C':'D'; }
  function gradeTone(g){ return g==='A'?'ok':g==='B'?'info':g==='C'?'warn':'danger'; }
  function openClaims(supId){ return CLAIMS.filter(c=>c.sup===supId && (c.status==='Abierto'||c.status==='En revisión')).length; }
  function statusTone(st){ return st==='Resuelto'?'ok':st==='Rechazado'?'mute':st==='En revisión'?'info':'wine'; }

  let view = { screen:'sup', id:null };
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function fmtDate(iso){ const [y,m,d]=iso.split('-').map(Number); return d+' '+MESES[(m-1)%12]+' '+y; }
  const nameOf = id => (SUP.find(s=>s.id===id)||{}).name || id;

  function render(){
    const root = document.getElementById('app');
    if (view.screen==='detail') return renderDetail(root, SUP.find(s=>s.id===view.id));
    renderMain(root);
  }

  function bar(label, val, tone){
    return '<div class="mb"><div class="mb-h"><span>'+label+'</span><span class="mb-v">'+val+'%</span></div>'+
      '<div class="mb-t"><div class="mb-f '+tone+'" style="width:'+val+'%"></div></div></div>';
  }

  function renderMain(root){
    const avg = Math.round(SUP.reduce((a,s)=>a+score(s),0)/SUP.length);
    const onT = Math.round(SUP.reduce((a,s)=>a+s.onTime,0)/SUP.length);
    const oc = CLAIMS.filter(c=>c.status==='Abierto'||c.status==='En revisión').length;
    root.innerHTML =
      '<div class="tabs"><button class="tab on" data-v="sup">Proveedores</button><button class="tab" data-v="claims">Reclamos <span class="cnt">'+oc+'</span></button></div>'+
      '<div id="pane"></div>';
    root.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
      root.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===b));
      b.dataset.v==='claims' ? paneClaims() : paneSup(avg,onT,oc);
    }));
    paneSup(avg,onT,oc);
  }

  function paneSup(avg,onT,oc){
    const pane = document.getElementById('pane');
    pane.innerHTML =
      '<div class="kpirow">'+
        kpi('Proveedores', SUP.length, 'activos')+
        kpi('Rating prom.', avg, 'sobre 100')+
        kpi('On-time prom.', onT+'%', 'entregas a tiempo')+
        kpi('Reclamos', oc, 'abiertos / revisión')+
      '</div>'+
      '<div class="table sup">'+
        '<div class="tr th"><div>Proveedor</div><div>Categoría</div><div class="r">Órdenes</div><div class="r">On-time</div><div class="r">Calidad</div><div class="r">Defectos</div><div class="c">Rating</div></div>'+
        SUP.slice().sort((a,b)=>score(b)-score(a)).map(s=>{ const sc=score(s),g=grade(sc); return '<button class="tr row" data-id="'+s.id+'">'+
          '<div class="nm">'+esc(s.name)+'<span class="sub">'+esc(s.city)+' · CN</span></div>'+
          '<div>'+esc(s.cat)+'</div>'+
          '<div class="r mono">'+s.orders+'</div>'+
          '<div class="r mono">'+s.onTime+'%</div>'+
          '<div class="r mono">'+s.quality+'%</div>'+
          '<div class="r mono">'+s.defect.toFixed(1)+'%</div>'+
          '<div class="c"><span class="grade '+gradeTone(g)+'">'+g+'</span><span class="scn">'+sc+'</span></div>'+
        '</button>'; }).join('')+
      '</div>';
    pane.querySelectorAll('.row').forEach(b=>b.addEventListener('click',()=>{ view={screen:'detail',id:b.dataset.id}; render(); }));
  }

  function paneClaims(){
    const pane = document.getElementById('pane');
    pane.innerHTML =
      '<div class="table claims">'+
        '<div class="tr th"><div>Reclamo</div><div>Proveedor</div><div>Orden</div><div>Tipo</div><div class="r">Monto</div><div>Fecha</div><div>Estado</div></div>'+
        CLAIMS.map(c=>'<div class="tr">'+
          '<div class="mono nm">'+c.id+'</div>'+
          '<div>'+esc(nameOf(c.sup))+'</div>'+
          '<div class="mono">'+c.order+'</div>'+
          '<div>'+c.type+'</div>'+
          '<div class="r mono">$'+c.amount+'</div>'+
          '<div>'+fmtDate(c.date)+'</div>'+
          '<div><span class="badge '+statusTone(c.status)+'">'+c.status+'</span></div>'+
        '</div>').join('')+
      '</div>';
  }

  function kpi(k,v,sub){ return '<div class="kpi"><div class="v">'+v+'</div><div class="k">'+k+'</div><div class="sub">'+sub+'</div></div>'; }

  function renderDetail(root, s){
    const sc=score(s), g=grade(sc);
    const cl = CLAIMS.filter(c=>c.sup===s.id);
    root.innerHTML =
      '<button class="back" id="back">‹ Volver al scorecard</button>'+
      '<div class="d-head">'+
        '<div><div class="d-eyebrow">'+esc(s.cat)+' · '+esc(s.city)+', China</div><h2>'+esc(s.name)+'</h2>'+
          '<div class="d-meta">'+s.orders+' órdenes históricas · '+cl.length+' reclamos</div></div>'+
        '<div class="big-grade '+gradeTone(g)+'"><span class="bg">'+g+'</span><span class="bs">'+sc+' / 100</span></div>'+
      '</div>'+
      '<div class="metrics">'+
        bar('Puntualidad de entrega', s.onTime, s.onTime>=90?'ok':s.onTime>=80?'info':'warn')+
        bar('Calidad / conformidad', s.quality, s.quality>=92?'ok':s.quality>=85?'info':'warn')+
        '<div class="mb"><div class="mb-h"><span>Tasa de rechazo</span><span class="mb-v">'+s.defect.toFixed(1)+'%</span></div>'+
          '<div class="mb-t"><div class="mb-f '+(s.defect<=2?'ok':s.defect<=4?'warn':'danger')+'" style="width:'+Math.min(100,s.defect*12)+'%"></div></div></div>'+
      '</div>'+
      '<div class="sec-h"><h3>Reclamos del proveedor</h3></div>'+
      (cl.length ? '<div class="table claims">'+
        '<div class="tr th"><div>Reclamo</div><div>Orden</div><div>Tipo</div><div class="r">Monto</div><div>Fecha</div><div>Estado</div></div>'+
        cl.map(c=>'<div class="tr">'+
          '<div class="mono nm">'+c.id+'</div><div class="mono">'+c.order+'</div><div>'+c.type+'</div>'+
          '<div class="r mono">$'+c.amount+'</div><div>'+fmtDate(c.date)+'</div>'+
          '<div><span class="badge '+statusTone(c.status)+'">'+c.status+'</span></div></div>').join('')+
       '</div>' : '<div class="empty">Sin reclamos registrados. Buen historial.</div>');
    document.getElementById('back').addEventListener('click',()=>{ view={screen:'sup'}; render(); });
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',render); else render();
})();
