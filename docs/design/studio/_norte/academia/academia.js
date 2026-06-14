/* ── Academia DTD · módulo LMS ─────────────────────────────────────
   Cursos → inscritos → asistencia → emitir diplomas.
   Al emitir, precarga la lista en el generador de diplomas vía
   localStorage('dtd-diplomas') (mismo origen) y lo abre. */
(function () {
  'use strict';

  const COURSES = [
    { id:'c1', name:'Asesoría de Compras en China', hours:16, sessions:4, date:'2026-06-20', place:'Valencia, Venezuela', estado:'En curso',
      students:[
        { name:'María Fernanda Rodríguez', ci:'V-18.452.110', att:[true,true,true,false] },
        { name:'Carlos Eduardo Pérez', ci:'V-15.330.921', att:[true,true,true,true] },
        { name:'Andreína Gómez Salazar', ci:'V-20.114.778', att:[true,false,true,true] },
        { name:'José Gregorio Marín', ci:'V-12.876.045', att:[true,true,false,false] },
        { name:'Luisa Carolina Ferrer', ci:'V-19.745.330', att:[true,true,true,true] }
      ] },
    { id:'c2', name:'Importación DDP para Pymes', hours:8, sessions:2, date:'2026-05-12', place:'Online', estado:'Completado',
      students:[
        { name:'Pedro Antonio Liscano', ci:'V-14.221.908', att:[true,true] },
        { name:'Daniela Suárez Mora', ci:'V-21.009.554', att:[true,true] },
        { name:'Rafael Ángel Bracho', ci:'V-16.778.221', att:[true,false] }
      ] },
    { id:'c3', name:'Negociación con proveedores · Feria de Cantón', hours:6, sessions:1, date:'2026-04-18', place:'Guangzhou, CN', estado:'Completado',
      students:[
        { name:'Gabriela Méndez', ci:'V-22.451.667', att:[true] },
        { name:'Héctor Luis Pacheco', ci:'V-13.554.882', att:[true] }
      ] }
  ];

  function attended(s){ return s.att.filter(Boolean).length; }
  function passed(s, sessions){ return attended(s) / sessions >= 0.75; }

  let view = { screen:'list', courseId:null };

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function render(){
    const root = document.getElementById('app');
    if (view.screen==='detail') return renderDetail(root, COURSES.find(c=>c.id===view.courseId));
    renderList(root);
  }

  function kpis(){
    const activos = COURSES.filter(c=>c.estado==='En curso').length;
    const alumnos = COURSES.reduce((a,c)=>a+c.students.length,0);
    const diplomas = COURSES.reduce((a,c)=>a+c.students.filter(s=>passed(s,c.sessions)).length,0);
    return { activos, alumnos, diplomas, cursos: COURSES.length };
  }

  function renderList(root){
    const k = kpis();
    root.innerHTML =
      '<div class="kpirow">'+
        kpi('Cursos', k.cursos, 'totales')+
        kpi('En curso', k.activos, 'activos ahora')+
        kpi('Alumnos', k.alumnos, 'inscritos')+
        kpi('Diplomas listos', k.diplomas, 'para emitir')+
      '</div>'+
      '<div class="sec-h"><h2>Cursos y eventos</h2></div>'+
      '<div class="courses">'+ COURSES.map(c=>{
        const ready = c.students.filter(s=>passed(s,c.sessions)).length;
        return '<button class="course" data-id="'+c.id+'">'+
          '<div class="c-top"><span class="badge '+(c.estado==='En curso'?'wine':'ok')+'">'+c.estado+'</span>'+
            '<span class="c-date">'+fmtDate(c.date)+'</span></div>'+
          '<div class="c-name">'+esc(c.name)+'</div>'+
          '<div class="c-meta">'+c.hours+' h · '+c.sessions+' sesiones · '+esc(c.place)+'</div>'+
          '<div class="c-foot"><span>'+c.students.length+' inscritos</span>'+
            '<span class="ready">'+ready+' aprobados</span></div>'+
        '</button>';
      }).join('') + '</div>';
    root.querySelectorAll('.course').forEach(b=>b.addEventListener('click',()=>{ view={screen:'detail',courseId:b.dataset.id}; render(); }));
  }
  function kpi(k,v,sub){ return '<div class="kpi"><div class="v">'+v+'</div><div class="k">'+k+'</div><div class="sub">'+sub+'</div></div>'; }

  function renderDetail(root, c){
    const ready = c.students.filter(s=>passed(s,c.sessions));
    root.innerHTML =
      '<button class="back" id="back">‹ Volver a cursos</button>'+
      '<div class="d-head">'+
        '<div><div class="d-eyebrow">'+esc(c.estado)+' · '+fmtDate(c.date)+'</div>'+
          '<h2>'+esc(c.name)+'</h2>'+
          '<div class="d-meta">'+c.hours+' horas · '+c.sessions+' sesiones · '+esc(c.place)+'</div></div>'+
        '<button class="emit" id="emit">Emitir diplomas <span class="cnt">'+ready.length+'</span></button>'+
      '</div>'+
      '<div class="sec-h"><h3>Inscritos y asistencia</h3><span class="hint">Marcá la asistencia por sesión. Aprueba con ≥ 75%.</span></div>'+
      '<div class="table">'+
        '<div class="tr th"><div>Alumno</div><div>Documento</div>'+
          Array.from({length:c.sessions},(_,i)=>'<div class="ses">S'+(i+1)+'</div>').join('')+
          '<div class="ses">Asist.</div><div class="st">Estado</div></div>'+
        c.students.map((s,si)=>{
          const ok = passed(s,c.sessions);
          return '<div class="tr">'+
            '<div class="nm">'+esc(s.name)+'</div>'+
            '<div class="ci">'+esc(s.ci)+'</div>'+
            s.att.map((a,ai)=>'<div class="ses"><button class="chk'+(a?' on':'')+'" data-s="'+si+'" data-a="'+ai+'">'+(a?'✓':'')+'</button></div>').join('')+
            '<div class="ses pct">'+Math.round(attended(s)/c.sessions*100)+'%</div>'+
            '<div class="st"><span class="badge '+(ok?'ok':'mute')+'">'+(ok?'Aprobado':'En proceso')+'</span></div>'+
          '</div>';
        }).join('')+
      '</div>';
    document.getElementById('back').addEventListener('click',()=>{ view={screen:'list'}; render(); });
    root.querySelectorAll('.chk').forEach(b=>b.addEventListener('click',()=>{
      const s=+b.dataset.s, a=+b.dataset.a; c.students[s].att[a]=!c.students[s].att[a]; renderDetail(root,c);
    }));
    document.getElementById('emit').addEventListener('click',()=>emit(c));
  }

  function emit(c){
    const ready = c.students.filter(s=>passed(s,c.sessions));
    if (!ready.length){ alert('Aún no hay alumnos aprobados (≥ 75% de asistencia).'); return; }
    // precargar el generador de diplomas (mismo origen)
    let dip = {};
    try { dip = JSON.parse(localStorage.getItem('dtd-diplomas')||'{}'); } catch(e){}
    dip.variant = dip.variant || 'A';
    dip.issuer = 'DTD-Cargo · Academia';
    dip.course = c.name;
    dip.hours = String(c.hours);
    dip.dateISO = c.date;
    dip.place = c.place;
    dip.roster = ready.map(s=>s.name).join('\n');
    try { localStorage.setItem('dtd-diplomas', JSON.stringify(dip)); } catch(e){}
    window.open('../diplomas/Diploma · DTD-Cargo.html', '_blank');
  }

  const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function fmtDate(iso){ const [y,m,d]=iso.split('-').map(Number); return d+' '+MESES[(m-1)%12]+' '+y; }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',render); else render();
})();
