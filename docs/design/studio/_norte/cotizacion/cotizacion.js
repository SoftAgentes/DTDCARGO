/* ── Generador de Cotización DDP · DTD-Cargo ──────────────────────
   Documento editable A4 vertical. Ítems + totales auto. PDF.
   Persistencia localStorage('dtd-cotizacion'). */
(function () {
  'use strict';

  function isoToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function emptyItem() { return { srv:'', desc:'', qty:'1', unit:'', price:'' }; }

  const DEFAULTS = {
    folio: 'COT-2026-0001', fecha: isoToday(), validez: '15',
    cliente: '', rif: '', contacto: '', email: '', tel: '',
    moneda: 'USD',
    ivaOn: false, iva: '16',
    items: [
      { srv:'Flete marítimo DDP', desc:'China → La Guaira · consolidado', qty:'1', unit:'CBM', price:'' },
      { srv:'', desc:'', qty:'1', unit:'', price:'' },
      { srv:'', desc:'', qty:'1', unit:'', price:'' }
    ],
    notas: 'Tarifa puerta a puerta (DDP): incluye flete, seguro, nacionalización y entrega. No incluye impuestos de productos restringidos ni almacenaje por demoras del cliente.'
  };

  let state = load();
  function load() { try { const r = localStorage.getItem('dtd-cotizacion'); if (r) return Object.assign({}, DEFAULTS, JSON.parse(r)); } catch(e){} return JSON.parse(JSON.stringify(DEFAULTS)); }
  function save() { try { localStorage.setItem('dtd-cotizacion', JSON.stringify(state)); } catch(e){} }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function num(v){
    if (v==null||v==='') return 0;
    const s = String(v).trim();
    if (/[+\-*/]/.test(s.replace(/^[-+]/,'')) && /^[-+]?[\d.\s+\-*/]+$/.test(s)) { try { const r=Function('"use strict";return ('+s+')')(); if(isFinite(r)) return r; } catch(e){} }
    const f = parseFloat(s.replace(/,/g,'.')); return isFinite(f)?f:0;
  }
  const money = n => n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  function lineTotal(it){ return num(it.qty) * num(it.price); }
  function calc(){
    let sub = 0; state.items.forEach(it => sub += lineTotal(it));
    const iva = state.ivaOn ? sub * num(state.iva)/100 : 0;
    return { sub, iva, total: sub + iva };
  }

  function renderItems(){
    const tb = document.getElementById('items');
    tb.innerHTML = state.items.map((it,i) => {
      const inp = (f,cls)=> '<input class="cell '+(cls||'')+'" data-i="'+i+'" data-f="'+f+'" value="'+esc(it[f])+'">';
      return '<tr>'+
        '<td class="c-idx">'+(i+1)+'</td>'+
        '<td>'+inp('srv','b')+'</td>'+
        '<td>'+inp('desc')+'</td>'+
        '<td>'+inp('qty','num')+'</td>'+
        '<td>'+inp('unit','c')+'</td>'+
        '<td>'+inp('price','num')+'</td>'+
        '<td class="lt" data-lt="'+i+'">'+money(lineTotal(it))+'</td>'+
        '<td class="c-del"><button class="rowdel" data-del="'+i+'" title="Quitar">×</button></td>'+
      '</tr>';
    }).join('');
    bindCells(); renderTotals();
  }
  function renderTotals(){
    const c = calc();
    document.getElementById('t-sub').textContent = state.moneda+' '+money(c.sub);
    const ivaRow = document.getElementById('iva-row');
    if (state.ivaOn) { ivaRow.style.display=''; document.getElementById('t-iva').textContent = state.moneda+' '+money(c.iva); document.getElementById('iva-pct').textContent = num(state.iva)+'%'; }
    else ivaRow.style.display='none';
    document.getElementById('t-total').textContent = state.moneda+' '+money(c.total);
  }
  function bindCells(){
    document.querySelectorAll('#items .cell').forEach(el=>{
      el.addEventListener('input',()=>{ const i=+el.dataset.i,f=el.dataset.f; state.items[i][f]=el.value; save();
        const t=document.querySelector('[data-lt="'+i+'"]'); if(t) t.textContent=money(lineTotal(state.items[i])); renderTotals(); });
    });
    document.querySelectorAll('#items .rowdel').forEach(b=>{
      b.addEventListener('click',()=>{ const i=+b.dataset.del; if(state.items.length<=1) state.items=[emptyItem()]; else state.items.splice(i,1); save(); renderItems(); });
    });
  }

  function bind(id,key){
    const el=document.getElementById(id); if(!el) return;
    if (el.type==='checkbox'){ el.checked=!!state[key]; el.addEventListener('change',()=>{ state[key]=el.checked; save(); renderTotals(); }); }
    else { el.value=state[key]; el.addEventListener('input',()=>{ state[key]=el.value; save(); if(key==='moneda'||key==='iva') renderTotals(); }); }
  }

  // ── Cotizador interno rápido (LCL DDP) ──
  function quoterTariff() {
    try { const t = window.DTDData && window.DTDData.getCbmTariff && window.DTDData.getCbmTariff(); if (t && t.rate) return t.rate; } catch(e){}
    return 800;
  }
  function quoterCalc() {
    const cbm = num(document.getElementById('q-cbm').value);
    const peso = num(document.getElementById('q-peso').value);
    const tarifa = num(document.getElementById('q-tarifa').value) || quoterTariff();
    const emb = document.getElementById('q-emb').checked;
    const bat = document.getElementById('q-bat').checked;
    const base = cbm * tarifa;
    const exc = Math.max(peso - 500 * cbm, 0) * 1;   // $1/kg sobre 500 kg/CBM incluidos
    const embCost = emb ? 50 : 0;
    const pre = base + exc + embCost;
    const total = Math.max(bat ? pre * 1.5 : pre, 50); // piso $50
    return { cbm, peso, tarifa, emb, bat, base, exc, embCost, total };
  }
  function renderQuoter() {
    const q = quoterCalc();
    const lines = ['Flete: ' + q.cbm + ' CBM × $' + q.tarifa + ' = $' + money(q.base)];
    if (q.exc > 0) lines.push('excedente +$' + money(q.exc));
    if (q.embCost > 0) lines.push('embalaje +$' + money(q.embCost));
    if (q.bat) lines.push('baterías ×1.5');
    document.getElementById('q-lines').innerHTML = lines.join(' · ');
    document.getElementById('q-total').textContent = ' $' + money(q.total);
  }
  function addQuoterToDoc() {
    const q = quoterCalc();
    const desc = q.cbm + ' CBM · ' + q.peso + ' kg' + (q.emb ? ' · embalaje especial' : '') + (q.bat ? ' · baterías' : '');
    state.items.push({ srv: 'Flete LCL DDP', desc: desc, qty: '1', unit: 'global', price: (Math.round(q.total * 100) / 100).toString() });
    save(); renderItems();
    const note = document.getElementById('q-note'); if (note) { note.textContent = 'Agregado ✓ · $' + money(q.total); setTimeout(() => { note.textContent = ''; }, 2400); }
  }

  function init(){
    [['f-folio','folio'],['f-fecha','fecha'],['f-validez','validez'],['f-cliente','cliente'],['f-rif','rif'],
     ['f-contacto','contacto'],['f-email','email'],['f-tel','tel'],['f-notas','notas'],['f-iva','iva']]
      .forEach(([id,k])=>bind(id,k));
    const mon=document.getElementById('f-moneda'); if(mon){ mon.value=state.moneda; mon.addEventListener('change',()=>{ state.moneda=mon.value; save(); renderTotals(); }); }
    const ivaT=document.getElementById('f-ivaOn'); if(ivaT){ ivaT.checked=!!state.ivaOn; ivaT.addEventListener('change',()=>{ state.ivaOn=ivaT.checked; save(); renderTotals(); }); }
    document.getElementById('add-row').addEventListener('click',()=>{ state.items.push(emptyItem()); save(); renderItems(); });
    document.getElementById('btn-print').addEventListener('click',()=>window.print());
    document.getElementById('btn-reset').addEventListener('click',()=>{ if(confirm('¿Vaciar la cotización?')){ state=JSON.parse(JSON.stringify(DEFAULTS)); save(); location.reload(); } });
    // Cotizador interno rápido
    const qTar = document.getElementById('q-tarifa'); if (qTar && !qTar.value) qTar.value = quoterTariff();
    ['q-cbm','q-peso','q-tarifa','q-emb','q-bat'].forEach(id => { const el = document.getElementById(id); if (el) { el.addEventListener('input', renderQuoter); el.addEventListener('change', renderQuoter); } });
    const btnQ = document.getElementById('btn-quoter'); if (btnQ) btnQ.addEventListener('click', () => { const p = document.getElementById('quoter'); p.hidden = !p.hidden; if (!p.hidden) renderQuoter(); });
    const qAdd = document.getElementById('q-add'); if (qAdd) qAdd.addEventListener('click', addQuoterToDoc);
    renderItems();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
