/* ── DTD ERP · Marca · Estudio de Redes v1.0 ─────────────────── */
/* Calendario de contenido operativo (datos del ERP) + registro   */
/* pieza→campaña. Seam: localStorage 'dtd-piezas-log' (lo escribe */
/* el Generador Redes al descargar cada PNG).                     */

const { useState: _srState, useMemo: _srMemo } = React;

const _SR_LOG_KEY = 'dtd-piezas-log';
const _SR_GEN = 'Generador Redes · DTD-Cargo.html';

// ── Etiquetas de contenido · seam compartido con Master Data ───
// Dos ejes: ESTADO del flujo (idea→publicado) y TIPO de contenido.
// Editable en Administración → Master data → Etiquetas de contenido;
// en producción va a la API (ver backend/API-CONTRACT.md).
const _CT_KEY = 'dtd-etiquetas-contenido';
const CT_DEFAULTS = {
  flow: [
    { id: 'idea',       label: 'Idea',           tone: 'neutral', active: true },
    { id: 'produccion', label: 'En producción',  tone: 'info',    active: true },
    { id: 'revision',   label: 'En revisión',    tone: 'warning', active: true },
    { id: 'aprobado',   label: 'Aprobado',       tone: 'success', active: true },
    { id: 'programado', label: 'Programado',     tone: 'wine',    active: true },
    { id: 'publicado',  label: 'Publicado',      tone: 'success', active: true },
    { id: 'archivado',  label: 'Archivado',      tone: 'neutral', active: true },
  ],
  types: [
    { id: 'noticia',    label: 'Noticia',                    tone: 'info',    active: true },
    { id: 'publicidad', label: 'Publicidad / promo',         tone: 'wine',    active: true },
    { id: 'producto',   label: 'Producto / servicio',        tone: 'success', active: true },
    { id: 'precio',     label: 'Precio · tarifa actualizada', tone: 'warning', active: true },
    { id: 'testimonio', label: 'Testimonio',                 tone: 'neutral', active: true },
    { id: 'educativo',  label: 'Educativo',                  tone: 'info',    active: true },
    { id: 'feria',      label: 'Feria / evento',             tone: 'warning', active: true },
    { id: 'operacion',  label: 'Operación · zarpes y llegadas', tone: 'wine', active: true },
  ],
};
function _ctLoad() {
  try { const r = JSON.parse(localStorage.getItem(_CT_KEY) || 'null'); if (r && r.flow && r.types) return r; } catch (e) {}
  return JSON.parse(JSON.stringify(CT_DEFAULTS));
}
function _ctSave(d) { try { localStorage.setItem(_CT_KEY, JSON.stringify(d)); } catch (e) {} }
window.ContentTags = { load: _ctLoad, save: _ctSave, defaults: CT_DEFAULTS };

// ── Admin de etiquetas (se monta en Master data) ────────────
function ContentTagsAdmin() {
  const U = window.ERPUI;
  const [data, setData] = _srState(_ctLoad);
  const upd = (next) => { setData(next); _ctSave(next); };
  const set = (kind, id, patch) => upd({ ...data, [kind]: data[kind].map(x => x.id === id ? { ...x, ...patch } : x) });
  const add = (kind) => upd({ ...data, [kind]: [...data[kind], { id: 'ct-' + Date.now(), label: 'Nueva etiqueta', tone: 'neutral', active: true }] });
  const TONES = [['wine', 'Wine'], ['info', 'Azul'], ['success', 'Verde'], ['warning', 'Dorado'], ['danger', 'Rojo'], ['neutral', 'Neutral']];
  const selSt = { font: '600 11.5px/1.2 var(--f-sans)', color: 'var(--ink)', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)' };
  const block = (kind, title, sub) => (
    <U.Card padded={false} key={kind}>
      <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ font: '800 13.5px/1.2 var(--f-display)', color: 'var(--ink)' }}>{title}</div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{sub}</div>
        </div>
        <U.Btn variant="secondary" size="sm" icon={window.Icon.plus(12)} onClick={() => add(kind)}>Agregar</U.Btn>
      </div>
      {data[kind].map((x, i) => (
        <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 80px', gap: 10, alignItems: 'center', padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 0, opacity: x.active ? 1 : 0.45 }}>
          <U.Badge tone={x.tone} size="sm">{x.label}</U.Badge>
          <input value={x.label} onChange={(e) => set(kind, x.id, { label: e.target.value })} style={{ ...selSt, width: '100%' }} />
          <select value={x.tone} onChange={(e) => set(kind, x.id, { tone: e.target.value })} style={selSt}>
            {TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => set(kind, x.id, { active: !x.active })} style={{ font: '700 10.5px/1 var(--f-sans)', color: x.active ? 'var(--success)' : 'var(--ink-mute)', padding: '6px 8px', cursor: 'pointer', background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)' }}>
            {x.active ? 'activa' : 'inactiva'}
          </button>
        </div>
      ))}
    </U.Card>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '11px 16px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: 'var(--wine)', flexShrink: 0 }}>{window.Icon.tag(14)}</span>
        <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
          Estas etiquetas se conectan con el <b>Estudio de Redes</b>: el calendario sugiere el tipo por evento, el generador guarda el tag al descargar, y el registro de piezas permite asignar tipo + estado a cada publicación (fotos de Instagram, estados de WhatsApp, etc.).
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        {block('flow', 'Estado del flujo', 'Dónde está la pieza: de la idea a publicado')}
        {block('types', 'Tipo de contenido', 'Qué es: noticia, publicidad, producto, precio…')}
      </div>
    </div>
  );
}
window.ContentTagsAdmin = ContentTagsAdmin;

// Campañas (mismo mock de Publicidad activa · admin-brand.jsx)
const SR_CAMPAIGNS = [
  { id: 'cmp-2026-05', name: 'Black Friday Asia Q2' },
  { id: 'cmp-2026-04', name: 'Ruta nueva · Cánton-PBL' },
  { id: 'cmp-2026-03', name: 'Reefer estacional VE' },
  { id: 'cmp-2026-06', name: 'Día del padre · regalo' },
  { id: 'organico',    name: 'Orgánico · sin campaña' },
];

// ── Fechas fijas 2026 · ferias / feriados / comerciales ───────
const SR_DATES = [
  { date: '2026-06-19', kind: 'feriado-cn', title: 'Bote del Dragón (端午节)', code: 'China · fábricas cierran', sug: { tab: 4, eg: 'AVISO · FERIADO EN CHINA', t: 'Fábricas cerradas por el Bote del Dragón', dd: '19', mm: 'JUN', cta: 'Planificá tu compra · dtdcargo.com' } },
  { date: '2026-06-21', kind: 'comercial',  title: 'Día del Padre · Venezuela', code: 'fecha comercial VE', sug: { tab: 4, eg: 'DÍA DEL PADRE', t: 'El regalo llega de China a su puerta', dd: '21', mm: 'JUN', cta: 'Cotiza tu DDP · dtdcargo.com/calculadora' } },
  { date: '2026-06-24', kind: 'feriado-ve', title: 'Batalla de Carabobo', code: 'feriado nacional VE', sug: { tab: 1, t: 'Feliz día de la Batalla de Carabobo', k: 'Orgullosamente valencianos · DTD Cargo' } },
  { date: '2026-07-05', kind: 'feriado-ve', title: 'Independencia de Venezuela', code: 'feriado nacional VE', sug: { tab: 1, t: '5 de Julio · Independencia', k: 'Con Confianza, de China a tu puerta' } },
  { date: '2026-07-24', kind: 'feriado-ve', title: 'Natalicio del Libertador', code: 'feriado nacional VE', sug: { tab: 1, t: '24 de Julio · Natalicio del Libertador', k: 'DTD Cargo · China → Venezuela' } },
  { date: '2026-09-25', kind: 'feriado-cn', title: 'Medio Otoño (中秋节)', code: 'China · puente corto', sug: { tab: 4, eg: 'AVISO · FERIADO EN CHINA', t: 'Festival de Medio Otoño: ajustamos recepciones', dd: '25', mm: 'SEP', cta: 'Coordiná con tu asesor · dtdcargo.com' } },
  { date: '2026-10-01', end: '2026-10-07', kind: 'feriado-cn', title: 'Golden Week (国庆节)', code: 'China · semana completa sin operaciones', sug: { tab: 4, eg: 'AVISO CLAVE · GOLDEN WEEK', t: 'China se detiene del 1 al 7 de octubre', dd: '01', mm: 'OCT', cta: 'Adelantá tu carga · dtdcargo.com/calculadora' } },
  { date: '2026-10-15', end: '2026-10-19', kind: 'feria', title: 'Feria de Cantón · Fase 1', code: 'Guangzhou · electrónica y maquinaria', sug: { tab: 4, eg: 'FERIA DE CANTÓN · FASE 1', t: 'Te acompañamos a comprar en la feria', dd: '15', mm: 'OCT', cta: 'Reserva tu cupo · dtdcargo.com' } },
  { date: '2026-10-21', end: '2026-10-25', kind: 'feria', title: 'Feria de Yiwu', code: 'Yiwu · commodities y hogar', sug: { tab: 4, eg: 'FERIA DE YIWU', t: 'El mercado más grande del mundo te espera', dd: '21', mm: 'OCT', cta: 'Compra asistida · dtdcargo.com' } },
  { date: '2026-10-23', end: '2026-10-27', kind: 'feria', title: 'Feria de Cantón · Fase 2', code: 'Guangzhou · hogar y regalos', sug: { tab: 4, eg: 'FERIA DE CANTÓN · FASE 2', t: 'Hogar y regalos: comprá en origen', dd: '23', mm: 'OCT', cta: 'Reserva tu cupo · dtdcargo.com' } },
  { date: '2026-10-31', end: '2026-11-04', kind: 'feria', title: 'Feria de Cantón · Fase 3', code: 'Guangzhou · textil y calzado', sug: { tab: 4, eg: 'FERIA DE CANTÓN · FASE 3', t: 'Textil y calzado directo de fábrica', dd: '31', mm: 'OCT', cta: 'Reserva tu cupo · dtdcargo.com' } },
  { date: '2026-11-27', kind: 'comercial', title: 'Black Friday', code: 'pico de demanda · cierre de consolidados', sug: { tab: 4, eg: 'BLACK FRIDAY', t: 'Última carga antes del Black Friday', dd: '27', mm: 'NOV', cta: 'Reserva tu espacio · dtdcargo.com/calculadora' } },
  { date: '2026-12-15', kind: 'comercial', title: 'Cierre navideño de consolidados', code: 'última ventana CN→VE del año', sug: { tab: 4, eg: 'CIERRE DE CONSOLIDADO', t: 'Última carga antes de Navidad', dd: '15', mm: 'DIC', cta: 'Cotiza tu DDP · dtdcargo.com/calculadora' } },
  { date: '2026-12-24', end: '2026-12-25', kind: 'feriado-ve', title: 'Navidad', code: 'feriado VE', sug: { tab: 1, t: 'Feliz Navidad', k: 'Gracias por confiar, contenedor a contenedor' } },
  { date: '2026-12-31', end: '2027-01-01', kind: 'feriado-ve', title: 'Fin de año · Año Nuevo', code: 'feriado VE', sug: { tab: 1, t: 'Feliz 2027', k: 'Un año más, contenedor a contenedor' } },
  { date: '2027-02-06', end: '2027-02-20', kind: 'feriado-cn', title: 'Año Nuevo Chino (春节) · 2027', code: 'China · ~2 semanas sin producción', sug: { tab: 4, eg: 'AVISO CLAVE · AÑO NUEVO CHINO', t: 'China cierra: adelanta tu compra de febrero', dd: '06', mm: 'FEB', cta: 'Adelanta tu carga · dtdcargo.com/calculadora' } },
  { date: '2027-04-15', end: '2027-04-19', kind: 'feria', title: 'Feria de Cantón · Primavera F1 · 2027', code: 'Guangzhou · electrónica y maquinaria', sug: { tab: 4, eg: 'FERIA DE CANTÓN · PRIMAVERA', t: 'Te acompañamos a comprar en la feria', dd: '15', mm: 'ABR', cta: 'Reserva tu cupo · dtdcargo.com' } },
  { date: '2027-04-23', end: '2027-04-27', kind: 'feria', title: 'Feria de Cantón · Primavera F2 · 2027', code: 'Guangzhou · hogar y regalos', sug: { tab: 4, eg: 'FERIA DE CANTÓN · F2', t: 'Hogar y regalos: compra en origen', dd: '23', mm: 'ABR', cta: 'Reserva tu cupo · dtdcargo.com' } },
  { date: '2027-05-01', end: '2027-05-05', kind: 'feria', title: 'Feria de Cantón · Primavera F3 · 2027', code: 'Guangzhou · textil y calzado', sug: { tab: 4, eg: 'FERIA DE CANTÓN · F3', t: 'Textil y calzado directo de fábrica', dd: '01', mm: 'MAY', cta: 'Reserva tu cupo · dtdcargo.com' } },
  { date: '2027-05-09', kind: 'comercial', title: 'Día de las Madres · Venezuela 2027', code: 'fecha comercial VE · pedir en feb-mar', sug: { tab: 4, eg: 'DÍA DE LAS MADRES', t: 'El regalo llega de China a su puerta', dd: '09', mm: 'MAY', cta: 'Cotiza tu DDP · dtdcargo.com/calculadora' } },
  { date: '2027-06-20', kind: 'comercial', title: 'Día del Padre · Venezuela 2027', code: 'fecha comercial VE', sug: { tab: 4, eg: 'DÍA DEL PADRE', t: 'El regalo llega de China a su puerta', dd: '20', mm: 'JUN', cta: 'Cotiza tu DDP · dtdcargo.com/calculadora' } },
  { date: '2027-06-24', kind: 'feriado-ve', title: 'Batalla de Carabobo · 2027', code: 'feriado nacional VE', sug: { tab: 1, t: 'Feliz día de la Batalla de Carabobo', k: 'Orgullosamente valencianos · DTD Cargo' } },
];

const SR_KIND = {
  'zarpe':      { label: 'Zarpe',      tone: 'wine' },
  'llegada':    { label: 'Llegada',    tone: 'info' },
  'feria':      { label: 'Feria',      tone: 'wine' },
  'feriado-cn': { label: 'Feriado CN', tone: 'neutral' },
  'feriado-ve': { label: 'Feriado VE', tone: 'neutral' },
  'comercial':  { label: 'Comercial',  tone: 'warning' },
};

function _srPD(s) { return new Date(String(s).slice(0, 10) + 'T00:00:00'); }
function _srDM(s) {
  if (!s) return '';
  const d = _srPD(s);
  return d.getDate() + ' ' + d.toLocaleDateString('es-VE', { month: 'short' }).replace('.', '');
}
function _srURL(sug, tagId) {
  const p = new URLSearchParams();
  p.set('tab', sug.tab);
  if (tagId) p.set('pz_tag', tagId);
  ['t', 'k', 'badge', 'eg', 'dd', 'mm', 'cta'].forEach((x) => { if (sug[x]) p.set('pz_' + x, sug[x]); }); // prefijo pz_: evita colisión con params del host (ej. t=token)
  return _SR_GEN + '?' + p.toString();
}
const SR_KIND_TAG = { 'zarpe': 'operacion', 'llegada': 'operacion', 'feria': 'feria', 'feriado-cn': 'noticia', 'feriado-ve': 'noticia', 'comercial': 'publicidad' };

// ── Eventos: ERP (zarpes/llegadas públicas) + fechas fijas ────
function _srEvents() {
  const D = window.ERPData || {};
  const SH = D.SHIPMENTS || D.shipments || [];
  const onm = (c) => (D.origin ? D.origin(c).name : c);
  const dnm = (c) => (D.dest ? D.dest(c).name : c);
  const ev = [];
  SH.forEach((s) => {
    if (!String(s.id).startsWith('DTDU')) return; // solo contenedores reales (público)
    if (s.etd) ev.push({
      date: s.etd, kind: 'zarpe',
      title: 'Zarpe · ' + onm(s.origin) + ' → ' + dnm(s.destination),
      code: s.id + ' · ' + s.type + (s.vessel && s.vessel !== 'pendiente' ? ' · ' + s.vessel : ''),
      sug: { tab: 0, t: 'Zarpó rumbo a ' + dnm(s.destination), k: s.id + (s.eta ? ' · llega ~' + _srDM(s.eta) : ''), badge: 'EN TRÁNSITO' },
    });
    if (s.eta) ev.push({
      date: s.eta, kind: 'llegada',
      title: 'Llegada · ' + dnm(s.destination),
      code: s.id + ' · ' + s.type,
      sug: { tab: 0, t: 'Llegó a ' + dnm(s.destination), k: s.id + ' · puerta a puerta CN→VE', badge: 'LLEGÓ' },
    });
  });
  return ev.concat(SR_DATES);
}

// ── Registro de piezas (seam localStorage) ────────────────────
function _srLoad() { try { return JSON.parse(localStorage.getItem(_SR_LOG_KEY) || '[]'); } catch (e) { return []; } }
function _srSave(a) { try { localStorage.setItem(_SR_LOG_KEY, JSON.stringify(a)); } catch (e) {} }

// ── Calendario ────────────────────────────────────────────────
function SRCalendar() {
  const U = window.ERPUI;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const events = _srMemo(() => {
    return _srEvents()
      .filter((e) => _srPD(e.end || e.date) >= today && _srPD(e.date) <= new Date(today.getTime() + 420 * 86400000))
      .sort((a, b) => _srPD(a.date) - _srPD(b.date));
  }, []);
  const in30 = (k) => events.filter((e) => e.kind === k && _srPD(e.date) <= new Date(today.getTime() + 30 * 86400000)).length;

  // agrupar por mes
  const ct = _ctLoad();
  const tagOf = (kind) => { const id = SR_KIND_TAG[kind]; return id ? (ct.types.find(t => t.id === id && t.active) || null) : null; };
  const months = [];
  events.forEach((e) => {
    const d = _srPD(e.date);
    const key = d.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
    let g = months.find((m) => m.key === key);
    if (!g) { g = { key, items: [] }; months.push(g); }
    g.items.push(e);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <U.KPI label="Zarpes · próx. 30 días" value={String(in30('zarpe'))} tone="wine" />
        <U.KPI label="Llegadas · próx. 30 días" value={String(in30('llegada'))} tone="info" />
        <U.KPI label="Fechas clave · próx. 30 días" value={String(in30('feria') + in30('feriado-cn') + in30('feriado-ve') + in30('comercial'))} tone="warning" />
        <U.KPI label="Eventos en agenda" value={String(events.length)} tone="neutral" />
      </div>

      <U.Card padded style={{ background: 'var(--info-bg)', borderColor: 'rgba(42,111,219,0.3)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--info)', flexShrink: 0 }}>{window.Icon.info(14)}</span>
          <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
            <b>Regla de datos públicos:</b> en piezas de redes se muestra contenedor, ruta, tipo y fechas. <b>Nunca</b> el cliente ni el valor de la carga. «Crear pieza» abre el generador con la plantilla ya llenada — solo falta la foto.
          </div>
        </div>
      </U.Card>

      {months.map((m) => (
        <U.Card key={m.key} padded={false}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', font: '900 13px/1 var(--f-display)', color: 'var(--ink)', textTransform: 'capitalize' }}>{m.key}</div>
          {m.items.map((e, i) => {
            const k = SR_KIND[e.kind] || { label: e.kind, tone: 'neutral' };
            const d = _srPD(e.date);
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '54px 130px 1fr auto', gap: 12, alignItems: 'center', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                <div style={{ textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', padding: '6px 0' }}>
                  <div style={{ font: '800 16px/1 var(--f-display)', color: 'var(--ink)' }}>{d.getDate()}</div>
                  <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>
                    {d.toLocaleDateString('es-VE', { month: 'short' }).replace('.', '')}{e.end ? ' →' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <window.ERPUI.Badge tone={k.tone} size="sm">{k.label}</window.ERPUI.Badge>
                  {tagOf(e.kind) && <window.ERPUI.Badge tone={tagOf(e.kind).tone} size="sm">{tagOf(e.kind).label}</window.ERPUI.Badge>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '700 13px/1.25 var(--f-sans)', color: 'var(--ink)' }}>{e.title}</div>
                  <div style={{ font: '500 11px/1.4 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 2 }}>{e.code}{e.end ? ' · hasta el ' + _srDM(e.end) : ''}</div>
                </div>
                <a href={_srURL(e.sug, SR_KIND_TAG[e.kind])} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>
                  <U.Btn variant="secondary" size="sm" icon={window.Icon.arrowR(12)}>Crear pieza</U.Btn>
                </a>
              </div>
            );
          })}
        </U.Card>
      ))}
    </div>
  );
}

// ── Registro pieza → campaña ──────────────────────────────────
function SRRegistry() {
  const U = window.ERPUI;
  const [items, setItems] = _srState(_srLoad);
  const ct = _ctLoad();
  const update = (next) => { setItems(next); _srSave(next); };
  const setField = (id, field, v) => update(items.map((it) => it.id === id ? { ...it, [field]: v || null } : it));
  const setCampaign = (id, c) => setField(id, 'campaign', c);
  const remove = (id) => update(items.filter((it) => it.id !== id));
  const monthNow = new Date().toISOString().slice(0, 7);
  const thisMonth = items.filter((it) => String(it.ts).slice(0, 7) === monthNow).length;
  const sinCamp = items.filter((it) => !it.campaign).length;
  const campName = (id) => (SR_CAMPAIGNS.find((c) => c.id === id) || {}).name || '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <U.KPI label="Piezas registradas" value={String(items.length)} tone="wine" />
        <U.KPI label="Este mes" value={String(thisMonth)} tone="info" />
        <U.KPI label="Sin campaña asignada" value={String(sinCamp)} tone={sinCamp > 0 ? 'warning' : 'neutral'} />
      </div>

      <U.Card padded>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: 'var(--wine)' }}>{window.Icon.download(18)}</span>
          <div style={{ flex: 1, font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            <b>Registro automático:</b> cada PNG que se descarga del Generador Redes (incluido el catálogo) queda asentado acá. Asigná cada pieza a su campaña para mantener la trazabilidad — sin aprobación previa, solo registro.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <U.Btn variant="ghost" size="sm" icon={window.Icon.refresh ? window.Icon.refresh(13) : null} onClick={() => setItems(_srLoad())}>Actualizar</U.Btn>
            <a href={_SR_GEN} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>
              <U.Btn variant="primary" size="sm" icon={window.Icon.external(12)}>Abrir generador</U.Btn>
            </a>
          </div>
        </div>
      </U.Card>

      {items.length === 0 ? (
        <U.Card padded>
          <div style={{ padding: '26px 0', textAlign: 'center' }}>
            <div style={{ font: '800 14px/1.3 var(--f-display)', color: 'var(--ink)' }}>Todavía no hay piezas registradas</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>Descarga una pieza desde el Generador Redes y va a aparecer acá automáticamente.</div>
          </div>
        </U.Card>
      ) : (
        <U.Card padded={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 150px 140px 160px 24px', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--border)', font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            <span>Fecha</span><span>Pieza</span><span>Tipo</span><span>Estado</span><span>Campaña</span><span></span>
          </div>
          {items.map((it, i) => (
            <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 150px 140px 160px 24px', gap: 10, alignItems: 'center', padding: '11px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
              <span style={{ font: '600 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{_srDM(it.ts)} · {String(it.ts).slice(11, 16)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.3 var(--f-mono)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.file}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{it.origen || 'Generador Redes'}{it.campaign ? ' · ' + campName(it.campaign) : ''}</div>
              </div>
              <select value={it.tag || ''} onChange={(e) => setField(it.id, 'tag', e.target.value)} style={{
                font: '600 11.5px/1.2 var(--f-sans)', color: it.tag ? 'var(--ink)' : 'var(--ink-mute)',
                padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', width: '100%',
              }}>
                <option value="">Tipo…</option>
                {ct.types.filter(t => t.active).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <select value={it.state || ''} onChange={(e) => setField(it.id, 'state', e.target.value)} style={{
                font: '600 11.5px/1.2 var(--f-sans)', color: it.state ? 'var(--ink)' : 'var(--ink-mute)',
                padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', width: '100%',
              }}>
                <option value="">Estado…</option>
                {ct.flow.filter(t => t.active).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <select value={it.campaign || ''} onChange={(e) => setCampaign(it.id, e.target.value)} style={{
                font: '600 11.5px/1.2 var(--f-sans)', color: it.campaign ? 'var(--ink)' : 'var(--ink-mute)',
                padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', width: '100%',
              }}>
                <option value="">Sin campaña…</option>
                {SR_CAMPAIGNS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => remove(it.id)} title="Quitar del registro" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--ink-mute)', display: 'grid', placeItems: 'center', padding: 4, borderRadius: 4 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-mute)'; }}>
                {window.Icon.trash(13)}
              </button>
            </div>
          ))}
        </U.Card>
      )}
    </div>
  );
}

// ── Sección completa ──────────────────────────────────────────
function SectionEstudioRedes() {
  const U = window.ERPUI;
  const [tab, setTab] = _srState('calendar');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded>
        <div className="eyebrow eyebrow-wine">ESTUDIO DE REDES · v1.0</div>
        <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>El dato opera el arte</div>
        <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '70ch' }}>
          Herramientas para quien maneja las redes: el <b>calendario</b> junta zarpes y llegadas reales del ERP con ferias, feriados y fechas comerciales, y arma la pieza con un clic. El <b>registro</b> asienta cada PNG descargado y lo vincula a su campaña. La norma visual vive en el <b>Brand Book §08</b>; acá viven los datos.
        </div>
      </U.Card>
      <U.Tabs value={tab} onChange={setTab} items={[
        { value: 'calendar', label: 'Calendario de contenido' },
        { value: 'registry', label: 'Piezas registradas' },
      ]} />
      {tab === 'calendar' && <SRCalendar />}
      {tab === 'registry' && <SRRegistry />}
    </div>
  );
}

window.AdminEstudioRedes = SectionEstudioRedes;
