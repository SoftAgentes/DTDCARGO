/* DTD-Cargo · Reportes · datos compartidos (colillas de servicios) */
window.DTD_SERVICIOS = [
  ['pre',  'Inspección Pre-Embarque', 'Verificación AQL del lote terminado antes de despachar.'],
  ['dupro','Inspección Durante Producción', 'Control en línea cuando el 20–60% está producido.'],
  ['fab',  'Inspección de Fábrica', 'Auditoría de planta, legalidad y capacidad productiva.'],
  ['load', 'Supervisión de Carga', 'Conteo y estiba verificada al cargar el contenedor.'],
  ['sample','Muestra de Producción', 'Revisión de la muestra inicial contra especificación.'],
];

window.renderServicios = function(ids, activeKey){
  const arrow = '<span class="svc-active" aria-label="Servicio en curso"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg></span>';
  const html = window.DTD_SERVICIOS.map(s=>{
    const on = s[0]===activeKey ? ' on' : '';
    const flag = s[0]===activeKey ? arrow : '';
    return `<div class="s${on}">${flag}<div class="st">${s[1]}</div><div class="sd">${s[2]}</div></div>`;
  }).join('');
  (Array.isArray(ids)?ids:[ids]).forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=html; });
};
