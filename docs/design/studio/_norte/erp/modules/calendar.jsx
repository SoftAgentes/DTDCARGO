/* global React */
/* ── DTD ERP · Calendario operativo ─────────────────────────── */

const { useState: _cUseState, useMemo: _cUseMemo } = React;

// Feriados chinos 2026 (Yiwu/Shenzhen paran operación)
const CN_HOLIDAYS = [
{ start: '2026-01-01', end: '2026-01-01', name: 'Año Nuevo Internacional', shortName: 'Año Nuevo' },
{ start: '2026-02-16', end: '2026-02-24', name: 'Año Nuevo Chino · 春节', shortName: 'CNY · 春节', critical: true },
{ start: '2026-04-04', end: '2026-04-06', name: 'Qingming · 清明节', shortName: 'Qingming' },
{ start: '2026-05-01', end: '2026-05-05', name: 'Día del Trabajador CN · 劳动节', shortName: 'Día Trab. CN' },
{ start: '2026-06-19', end: '2026-06-21', name: 'Dragon Boat · 端午节', shortName: 'Dragon Boat' },
{ start: '2026-09-25', end: '2026-09-27', name: 'Mid-Autumn · 中秋节', shortName: 'Mid-Autumn' },
{ start: '2026-10-01', end: '2026-10-07', name: 'Golden Week · 国庆节', shortName: 'Golden Week', critical: true }];


// VE holidays selected
const VE_HOLIDAYS = [
{ start: '2026-01-01', end: '2026-01-01', name: 'Año Nuevo VE' },
{ start: '2026-04-02', end: '2026-04-03', name: 'Semana Santa' },
{ start: '2026-04-19', end: '2026-04-19', name: 'Declaración Independencia' },
{ start: '2026-05-01', end: '2026-05-01', name: 'Día del Trabajador VE' },
{ start: '2026-07-05', end: '2026-07-05', name: 'Independencia' },
{ start: '2026-07-24', end: '2026-07-24', name: 'Natalicio Bolívar' },
{ start: '2026-12-25', end: '2026-12-25', name: 'Navidad' }];


// Ferias y expos importantes en China (sourcing · el cliente viaja a comprar)
const FAIRS_CN = [
{ id: 'f-cn-huajiao', name: 'Feria de China Oriental · 华交会', cn: '华交会', shortName: 'Huajiao', start: '2026-03-01', end: '2026-03-04', city: 'Shanghái', cityCn: '上海', sector: 'Textil · bienes de consumo' },
{ id: 'f-cn-canton-s1', name: 'Feria de Cantón · Fase 1 · 广交会', cn: '广交会', shortName: 'Cantón F1', start: '2026-04-15', end: '2026-04-19', city: 'Guangzhou', cityCn: '广州', sector: 'Electrónica · maquinaria' },
{ id: 'f-cn-canton-s2', name: 'Feria de Cantón · Fase 2 · 广交会', cn: '广交会', shortName: 'Cantón F2', start: '2026-04-23', end: '2026-04-27', city: 'Guangzhou', cityCn: '广州', sector: 'Hogar · regalos · decoración' },
{ id: 'f-cn-canton-s3', name: 'Feria de Cantón · Fase 3 · 广交会', cn: '广交会', shortName: 'Cantón F3', start: '2026-05-01', end: '2026-05-05', city: 'Guangzhou', cityCn: '广州', sector: 'Textil · oficina · médico', critical: true },
{ id: 'f-cn-szind', name: 'Shenzhen Industrial Expo · 深圳工业展', cn: '深圳工业展', shortName: 'Shenzhen Ind.', start: '2026-06-10', end: '2026-06-12', city: 'Shenzhen', cityCn: '深圳', sector: 'Industrial · automatización' },
{ id: 'f-cn-yiwu', name: 'Feria Internacional de Yiwu · 义乌博览会', cn: '义乌博览会', shortName: 'Yiwu Fair', start: '2026-10-21', end: '2026-10-25', city: 'Yiwu', cityCn: '义乌', sector: 'Bazar · general · mayorista' },
{ id: 'f-cn-cantona1', name: 'Cantón Otoño · Fase 1 · 广交会', cn: '广交会', shortName: 'Cantón O1', start: '2026-10-15', end: '2026-10-19', city: 'Guangzhou', cityCn: '广州', sector: 'Electrónica · maquinaria' },
{ id: 'f-cn-cantona3', name: 'Cantón Otoño · Fase 3 · 广交会', cn: '广交会', shortName: 'Cantón O3', start: '2026-10-31', end: '2026-11-04', city: 'Guangzhou', cityCn: '广州', sector: 'Textil · oficina · médico' },
{ id: 'f-cn-ciie', name: 'Expo Intl. de Importaciones · 进博会', cn: '进博会', shortName: 'CIIE', start: '2026-11-05', end: '2026-11-10', city: 'Shanghái', cityCn: '上海', sector: 'Importaciones · multisector' }];


// Ferias y expos importantes en Venezuela (demanda local · distribución)
const FAIRS_VE = [
{ id: 'f-ve-construccion', name: 'Expo Construcción & Vivienda', shortName: 'Expo Construcción', start: '2026-03-12', end: '2026-03-15', city: 'Caracas', sector: 'Construcción · ferretería' },
{ id: 'f-ve-pyme', name: 'Expo PyME Industrial', shortName: 'Expo PyME', start: '2026-05-14', end: '2026-05-16', city: 'Valencia', sector: 'Industrial · manufactura' },
{ id: 'f-ve-fic', name: 'Feria Internacional de Caracas · FIC', shortName: 'FIC Caracas', start: '2026-06-18', end: '2026-06-21', city: 'Caracas', sector: 'Multisector · bienes y servicios' },
{ id: 'f-ve-franquicias', name: 'Expo Franquicias Venezuela', shortName: 'Expo Franquicias', start: '2026-07-09', end: '2026-07-11', city: 'Caracas', sector: 'Comercio · retail' },
{ id: 'f-ve-hogar', name: 'Expo Hogar & Decoración', shortName: 'Expo Hogar', start: '2026-09-17', end: '2026-09-19', city: 'Maracaibo', sector: 'Hogar · decoración' },
{ id: 'f-ve-importado', name: 'Expo Comercio Importado', shortName: 'Expo Importado', start: '2026-10-22', end: '2026-10-24', city: 'Valencia', sector: 'Importadores · mayorista' },
{ id: 'f-ve-navidad', name: 'Expo Navidad Mayorista', shortName: 'Expo Navidad', start: '2026-11-12', end: '2026-11-14', city: 'Caracas', sector: 'Estacional · mayorista' }];


// Fuentes para sincronización automática (scraping/búsqueda — a evaluar)
const CN_FAIR_SOURCES = [
{ name: 'Feria de Cantón · oficial', domain: 'cantonfair.org.cn', cadence: 'Semanal' },
{ name: 'Feria de Yiwu · oficial', domain: 'yiwufair.com', cadence: 'Mensual' },
{ name: 'CCPIT · calendario de ferias', domain: 'ccpit.org', cadence: 'Mensual' }];

const VE_FAIR_SOURCES = [
{ name: 'Cámara de Comercio de Caracas', domain: 'camaradecaracas.org', cadence: 'Mensual' },
{ name: 'CAVECOM-E · agenda comercial', domain: 'cavecome.org.ve', cadence: 'Mensual' },
{ name: 'Agenda de eventos VE', domain: 'eventos.com.ve', cadence: 'Quincenal' }];

// Fuentes para feriados oficiales (sincronización con IA)
const CN_HOLIDAY_SOURCES = [
{ name: 'Consejo de Estado · feriados CN', domain: 'gov.cn', cadence: 'Anual' },
{ name: 'Calendario oficial de China', domain: 'timeanddate.com', cadence: 'Anual' }];

const VE_HOLIDAY_SOURCES = [
{ name: 'Gaceta Oficial · feriados', domain: 'gacetaoficial.gob.ve', cadence: 'Anual' },
{ name: 'Calendario nacional VE', domain: 'timeanddate.com', cadence: 'Anual' }];


// Otros requerimientos pendientes (deadlines operativos · DTD)
const PENDING_REQS = [
{ id: 'req-1', date: '2026-05-26', label: 'Vence pago naviera', detail: 'Confirmar transferencia a línea marítima', ship: 'DTDU-419032' },
{ id: 'req-2', date: '2026-05-28', label: 'Subir BL al expediente', detail: 'Cargar Bill of Lading firmado', ship: 'DTDU-412908' },
{ id: 'req-3', date: '2026-05-30', label: 'Confirmar consolidación CN', detail: 'Cierre de carga en almacén Yiwu', ship: 'DTDU-401234' },
{ id: 'req-4', date: '2026-06-01', label: 'Declaración SENIAT', detail: 'Presentar manifiesto de importación', ship: 'DTDU-419032' },
{ id: 'req-5', date: '2026-06-05', label: 'Renovar tarifa LCL YIW→PBL', detail: 'Vigencia de tarifa por vencer', ship: null },
{ id: 'req-6', date: '2026-06-10', label: 'Docs pendientes de proveedor', detail: 'Packing list e invoice comercial', ship: 'DTDU-388501' }];


function ModuleCalendar({ goTo, currentUser }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [cursor, setCursor] = _cUseState(new Date(2026, 4, 1)); // May 2026
  const [view, setView] = _cUseState('month'); // 'month' | 'week' | 'agenda'
  const [calTab, setCalTab] = _cUseState('calendar'); // 'calendar' | 'fairs-cn' | 'fairs-ve'
  const [portFilter, setPortFilter] = _cUseState('all');
  const [eventTypeFilter, setEventTypeFilter] = _cUseState({ etd: true, eta: true, pod: true, holidayCN: true, holidayVE: true, fairs: true, pending: true });
  const [dayOpen, setDayOpen] = _cUseState(null);
  const [overrides, setOverrides] = _cUseState(() => {try {return JSON.parse(localStorage.getItem('dtd-cal-overrides') || '{}');} catch (e) {return {};}});
  const saveOv = (o) => {try {localStorage.setItem('dtd-cal-overrides', JSON.stringify(o));} catch (e) {}};
  const [dragEvent, setDragEvent] = _cUseState(null);
  const [pendingMove, setPendingMove] = _cUseState(null);
  const FD = window.FairDetect;
  const [fairStore, setFairStore] = _cUseState(() => FD.load());
  const updateFairStore = (fn) => setFairStore((prev) => {
    const next = JSON.parse(JSON.stringify(prev));
    fn(next);FD.save(next);return next;
  });
  const _who = () => ({ userName: currentUser?.name || 'Carlos Vásquez', userRole: currentUser?.role || 'Admin' });
  const _toApproved = (c) => ({ id: c.id, kind: c.kind, name: c.name, shortName: c.shortName || FD.shortName(c.name), start: c.start, end: c.end, city: c.city, sector: c.sector, sourceDomain: c.sourceDomain, confidence: c.confidence, evidence: c.evidence, detected: true, approvedAt: '2026-05-31', ..._who() });
  const _logAudit = (s, kind, country, action, name, extra) => {
    s.audit[kind][country] = [{ at: new Date().toISOString(), action, fairName: name, kind, country, ..._who(), ...extra || {} }, ...s.audit[kind][country] || []].slice(0, 50);
  };
  const fairActions = {
    detectInto: (kind, country, list) => updateFairStore((s) => {s.candidates[kind][country] = list;s.meta.lastSync[kind][country] = new Date().toISOString();}),
    approve: (kind, country, c) => updateFairStore((s) => {
      s.candidates[kind][country] = s.candidates[kind][country].filter((x) => x.id !== c.id);
      s.approved[kind][country] = [...s.approved[kind][country], _toApproved(c)];
      _logAudit(s, kind, country, 'aprobó', c.name, { origin: 'IA', confidence: c.confidence });
    }),
    approveMany: (kind, country, cands) => updateFairStore((s) => {
      const ids = new Set(cands.map((c) => c.id));
      s.candidates[kind][country] = s.candidates[kind][country].filter((x) => !ids.has(x.id));
      s.approved[kind][country] = [...s.approved[kind][country], ...cands.map(_toApproved)];
      cands.forEach((c) => _logAudit(s, kind, country, 'aprobó', c.name, { origin: 'IA', confidence: c.confidence }));
    }),
    discard: (kind, country, c) => updateFairStore((s) => {
      s.candidates[kind][country] = s.candidates[kind][country].filter((x) => x.id !== c.id);
      s.discarded[kind][country] = [...s.discarded[kind][country], { key: FD.fairKey(c), name: c.name, start: c.start }];
      _logAudit(s, kind, country, 'descartó', c.name, { origin: 'IA', confidence: c.confidence });
    }),
    discardMany: (kind, country, cands) => updateFairStore((s) => {
      const ids = new Set(cands.map((c) => c.id));
      s.candidates[kind][country] = s.candidates[kind][country].filter((x) => !ids.has(x.id));
      s.discarded[kind][country] = [...s.discarded[kind][country], ...cands.map((c) => ({ key: FD.fairKey(c), name: c.name, start: c.start }))];
      cands.forEach((c) => _logAudit(s, kind, country, 'descartó', c.name, { origin: 'IA', confidence: c.confidence }));
    }),
    restore: (kind, country, key) => updateFairStore((s) => {
      const d = s.discarded[kind][country].find((x) => x.key === key);
      s.discarded[kind][country] = s.discarded[kind][country].filter((x) => x.key !== key);
      if (d) _logAudit(s, kind, country, 'restauró', d.name, {});
    }),
    removeApproved: (kind, country, id) => updateFairStore((s) => {
      const f = s.approved[kind][country].find((x) => x.id === id);
      s.approved[kind][country] = s.approved[kind][country].filter((x) => x.id !== id);
      if (f) _logAudit(s, kind, country, 'quitó', f.name, {});
    }),
    setAutoSync: (val) => updateFairStore((s) => {s.meta.autoSync = val;}),
    addSource: (kind, country, src) => updateFairStore((s) => {s.sources[kind][country] = [...s.sources[kind][country] || [], src];}) };

  const fairsCN = _cUseMemo(() => FD.mergeApproved(FAIRS_CN, fairStore.approved.feria.CN), [fairStore.approved.feria.CN]);
  const fairsVE = _cUseMemo(() => FD.mergeApproved(FAIRS_VE, fairStore.approved.feria.VE), [fairStore.approved.feria.VE]);
  const holidaysCN = _cUseMemo(() => FD.mergeApproved(CN_HOLIDAYS, fairStore.approved.feriado.CN), [fairStore.approved.feriado.CN]);
  const holidaysVE = _cUseMemo(() => FD.mergeApproved(VE_HOLIDAYS, fairStore.approved.feriado.VE), [fairStore.approved.feriado.VE]);

  // Build event list
  const events = _cUseMemo(() => {
    const list = [];
    const ov = (id, base) => overrides[id] || base;
    D.byTenant(D.SHIPMENTS).forEach((s) => {
      if (portFilter !== 'all' && s.destination !== portFilter) return;
      if (s.etd && eventTypeFilter.etd) {const id = s.id + '-etd';list.push({ id, type: 'etd', date: ov(id, s.etd), origDate: s.etd, moved: !!overrides[id], ship: s, tone: 'info', label: `ETD ${s.id}` });}
      if (s.eta && eventTypeFilter.eta) {const id = s.id + '-eta';list.push({ id, type: 'eta', date: ov(id, s.eta), origDate: s.eta, moved: !!overrides[id], ship: s, tone: s.alert ? 'warning' : 'wine', label: `ETA ${s.id}` });}
      if (s.status === 'entregado' && s.eta && eventTypeFilter.pod) {const id = s.id + '-pod';list.push({ id, type: 'pod', date: ov(id, s.eta), origDate: s.eta, moved: !!overrides[id], ship: s, tone: 'success', label: `POD ${s.id}` });}
    });
    if (eventTypeFilter.holidayCN) holidaysCN.forEach((h) => list.push({ id: 'h-' + h.start, type: 'holiday-cn', start: h.start, end: h.end, label: h.shortName || h.name, critical: h.critical, country: 'CN' }));
    if (eventTypeFilter.holidayVE) holidaysVE.forEach((h) => list.push({ id: 'v-' + h.start, type: 'holiday-ve', start: h.start, end: h.end, label: h.shortName || h.name, country: 'VE' }));
    if (eventTypeFilter.fairs) {
      fairsCN.forEach((f) => list.push({ id: f.id, type: 'fair-cn', start: f.start, end: f.end, label: f.shortName || f.name, fair: f, country: 'CN', critical: f.critical, tone: 'info' }));
      fairsVE.forEach((f) => list.push({ id: f.id, type: 'fair-ve', start: f.start, end: f.end, label: f.shortName || f.name, fair: f, country: 'VE', tone: 'info' }));
    }
    if (eventTypeFilter.pending) {
      PENDING_REQS.forEach((r) => {
        const ship = r.ship ? D.SHIPMENTS.find((s) => s.id === r.ship) : null;
        list.push({ id: r.id, type: 'requirement', date: r.date, label: r.label, detail: r.detail, ship, tone: 'neutral' });
      });
    }
    return list;
  }, [portFilter, eventTypeFilter, overrides, fairsCN, fairsVE, holidaysCN, holidaysVE]);

  const movedCount = Object.keys(overrides).length;
  const onDayDrop = (day) => {
    if (!dragEvent) return;
    const newDate = day.toISOString().slice(0, 10);
    if (newDate !== dragEvent.date) setPendingMove({ event: dragEvent, newDate });
    setDragEvent(null);
  };
  const confirmMove = () => {
    if (!pendingMove) return;
    const id = pendingMove.event.id;
    const next = { ...overrides };
    if (pendingMove.newDate === pendingMove.event.origDate) delete next[id];else
    next[id] = pendingMove.newDate;
    setOverrides(next);saveOv(next);setPendingMove(null);
  };
  const resetOverrides = () => {setOverrides({});saveOv({});};

  const monthLabel = cursor.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
  const today = new Date('2026-05-23');

  const upcoming = _cUseMemo(() => {
    return events.
    filter((e) => {
      const d = new Date(e.date || e.start);
      return d >= today && d <= new Date('2026-12-31');
    }).
    sort((a, b) => new Date(a.date || a.start) - new Date(b.date || b.start)).
    slice(0, 8);
  }, [events]);

  const exportICS = () => {
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (s) => {const d = new Date(s);return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());};
    const plusOne = (s) => {const d = new Date(s);d.setUTCDate(d.getUTCDate() + 1);return fmt(d);};
    const esc = (t) => String(t || '').replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');
    const summary = (e) => {
      if (e.type === 'etd') return `ETD · ${e.ship.id} · ${e.ship.clientName}`;
      if (e.type === 'eta') return `ETA · ${e.ship.id} · ${e.ship.clientName}`;
      if (e.type === 'pod') return `POD · ${e.ship.id} · ${e.ship.clientName}`;
      if (e.type === 'holiday-cn') return `Feriado CN · ${e.label}`;
      if (e.type === 'holiday-ve') return `Feriado VE · ${e.label}`;
      if (e.type?.startsWith('fair')) return `Feria · ${e.fair?.name || e.label}`;
      if (e.type === 'requirement') return `Pendiente · ${e.label}`;
      return e.label || 'Evento';
    };
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DTD-Cargo//Calendario operativo//ES', 'CALSCALE:GREGORIAN'];
    events.forEach((e) => {
      const start = e.date || e.start;
      if (!start) return;
      lines.push('BEGIN:VEVENT', `UID:${e.id}@dtdcargo`, `DTSTAMP:${fmt(today)}T000000Z`, `DTSTART;VALUE=DATE:${fmt(start)}`, `DTEND;VALUE=DATE:${e.end ? plusOne(e.end) : plusOne(start)}`, `SUMMARY:${esc(summary(e))}`);
      if (e.ship) lines.push(`LOCATION:${esc(D.dest(e.ship.destination).name)}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;a.download = 'dtd-calendario-2026.ics';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <U.PageHeader
        title="Calendario operativo"
        subtitle="Zarpes · arribos · entregas · feriados y ferias CN/VE. Vista de mes con drill-down por día."
        actions={
        calTab === 'calendar' ?
        <>
            <ViewSwitch value={view} onChange={setView} />
            <U.Btn variant="secondary" icon={window.Icon.download(14)} onClick={exportICS}>Exportar ICS</U.Btn>
          </> : null
        } />
      

      <U.Tabs value={calTab} onChange={setCalTab} style={{ marginBottom: 18 }} items={[
      { value: 'calendar', label: 'Calendario' },
      { value: 'fairs-cn', label: 'Ferias China', count: fairsCN.length },
      { value: 'fairs-ve', label: 'Ferias Venezuela', count: fairsVE.length }]} />


      {calTab === 'calendar' &&
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'flex-start' }}>
        <div>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }} data-comment-anchor="c10c539455-div-104-11">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--ink-soft)'
            }}>{window.Icon.arrowL(14)}</button>
            <h2 style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', textTransform: 'capitalize', margin: 0, flex: 1 }}>{monthLabel}</h2>
            <button onClick={() => setCursor(new Date(2026, 4, 1))} style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 12px/1 var(--f-sans)' }}>Hoy</button>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--ink-soft)'
            }}>{window.Icon.arrowR(14)}</button>
          </div>

          {view === 'month' &&
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>
                <span style={{ color: 'var(--wine)' }}>{window.Icon.flow(13)}</span>
                Arrastrá un evento (ETD / ETA / POD) a otro día para reprogramarlo.
              </span>
              {movedCount > 0 &&
            <button onClick={resetOverrides} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', border: '1px solid var(--wine)', font: '700 11.5px/1 var(--f-sans)', cursor: 'pointer' }}>
                  {window.Icon.refresh(12)} {movedCount} reprogramado{movedCount > 1 ? 's' : ''} · Restablecer
                </button>
            }
            </div>
          }
          {view === 'month' && <MonthGrid cursor={cursor} events={events} today={today} onDayClick={(d, evts) => setDayOpen({ date: d, events: evts })} onEventDragStart={setDragEvent} onDayDrop={onDayDrop} />}
          {view === 'week' && <WeekView cursor={cursor} events={events} today={today} onDayClick={(d, evts) => setDayOpen({ date: d, events: evts })} />}
          {view === 'agenda' && <AgendaView events={events} cursor={cursor} onEventClick={(e) => e.ship && goTo('shipments', e.ship.id, 'detail')} />}

          {/* Legend */}
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }} data-comment-anchor="04e8d2d9b1-div-135-11">
            <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>LEYENDA</span>
            <LegendChip color="var(--info)" label="ETD · zarpe" />
            <LegendChip color="var(--wine)" label="ETA · arribo" />
            <LegendChip color="var(--warning)" label="ETA en riesgo" />
            <LegendChip color="var(--success)" label="POD · entregado" />
            <LegendChip color="rgba(168,50,62,0.18)" label="Feriado CN" border />
            <LegendChip color="rgba(31,138,91,0.16)" label="Feriado VE" border />
            <LegendChip color="rgba(42,111,219,0.16)" label="Feria internacional" border />
            <LegendChip color="var(--ink-soft)" label="Req. pendiente" />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Filters */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>FILTROS</div>
            <U.Select label="Puerto de destino" value={portFilter} onChange={(e) => setPortFilter(e.target.value)} options={[
            { value: 'all', label: 'Todos los puertos' },
            ...D.DESTINATIONS.map((d) => ({ value: d.code, label: d.name }))]
            } />
            <div style={{ marginTop: 14 }}>
              <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Mostrar en calendario</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FilterRow
                  label="Contenedores" bold
                  icon={window.Icon.ship(15)}
                  checked={eventTypeFilter.etd || eventTypeFilter.eta || eventTypeFilter.pod}
                  indeterminate={!(eventTypeFilter.etd && eventTypeFilter.eta && eventTypeFilter.pod) && (eventTypeFilter.etd || eventTypeFilter.eta || eventTypeFilter.pod)}
                  onToggle={(v) => setEventTypeFilter({ ...eventTypeFilter, etd: v, eta: v, pod: v })} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 22, margin: '1px 0 5px' }}>
                  {[
                  { k: 'etd', l: 'ETD · zarpes', c: 'var(--info)' },
                  { k: 'eta', l: 'ETA · arribos', c: 'var(--wine)' },
                  { k: 'pod', l: 'POD · entregas', c: 'var(--success)' }].
                  map((o) =>
                  <FilterRow key={o.k} label={o.l} dot={o.c} small
                    checked={eventTypeFilter[o.k]}
                    onToggle={(v) => setEventTypeFilter({ ...eventTypeFilter, [o.k]: v })} />
                  )}
                </div>
                <FilterRow label="Feriados de China" dot="var(--wine)" icon={window.Icon.cn(15)}
                  checked={eventTypeFilter.holidayCN}
                  onToggle={(v) => setEventTypeFilter({ ...eventTypeFilter, holidayCN: v })} />
                <FilterRow label="Feriados de Venezuela" dot="var(--success)" icon={window.Icon.flag(15)}
                  checked={eventTypeFilter.holidayVE}
                  onToggle={(v) => setEventTypeFilter({ ...eventTypeFilter, holidayVE: v })} />
                <FilterRow label="Ferias internacionales" dot="var(--info)" icon={window.Icon.globe(15)}
                  checked={eventTypeFilter.fairs}
                  onToggle={(v) => setEventTypeFilter({ ...eventTypeFilter, fairs: v })} />
                <FilterRow label="Otros requerimientos pendientes" dot="var(--ink-soft)" icon={window.Icon.clock(15)}
                  checked={eventTypeFilter.pending}
                  onToggle={(v) => setEventTypeFilter({ ...eventTypeFilter, pending: v })} />
              </div>
            </div>
          </U.Card>

          {/* Upcoming */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>PRÓXIMOS EVENTOS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.map((e) =>
              <button key={e.id} onClick={() => e.ship && goTo('shipments', e.ship.id, 'detail')} style={{
                display: 'grid', gridTemplateColumns: '52px 1fr', gap: 10, padding: '8px 10px',
                textAlign: 'left', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
                borderLeft: `3px solid ${toneColor(e.tone || 'wine')}`
              }}>
                  <div style={{ font: '800 11px/1.2 var(--f-mono)', color: 'var(--wine)', textAlign: 'center' }}>
                    {formatShortDate(e.date || e.start)}
                  </div>
                  <div>
                    <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{e.label}</div>
                    {e.ship && <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{e.ship.clientName} · {D.dest(e.ship.destination).name}</div>}
                  </div>
                </button>
              )}
            </div>
          </U.Card>

          {/* CN holidays warning */}
          <U.Card padded style={{ background: 'var(--warning-bg)', borderColor: 'rgba(184,137,58,0.3)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(14)}</span>
              <div>
                <div style={{ font: '800 12.5px/1.2 var(--f-display)', color: 'var(--ink)' }}>Atención feriados CN</div>
                <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
                  Año Nuevo Chino (16-24 feb) y Golden Week (1-7 oct) <b style={{ color: 'var(--ink)' }}>paralizan</b> Yiwu y Shenzhen. Planificá zarpes con 3 semanas de anticipación.
                </div>
              </div>
            </div>
          </U.Card>
        </div>
      </div>
      }

      {calTab !== 'calendar' && (() => {
        const country = calTab === 'fairs-cn' ? 'CN' : 'VE';
        const data = {
          feria: { merged: country === 'CN' ? fairsCN : fairsVE, baseSources: country === 'CN' ? CN_FAIR_SOURCES : VE_FAIR_SOURCES },
          feriado: { merged: country === 'CN' ? holidaysCN : holidaysVE, baseSources: country === 'CN' ? CN_HOLIDAY_SOURCES : VE_HOLIDAY_SOURCES } };
        return <FD.Panel country={country} data={data} today={today} store={fairStore} actions={fairActions} />;
      })()}

      {/* Day drawer */}
      <U.Drawer
        open={!!dayOpen}
        onClose={() => setDayOpen(null)}
        title={dayOpen ? formatLongDate(dayOpen.date) : ''}
        subtitle={dayOpen ? `${dayOpen.events.length} eventos` : ''}
        width={560}>
        
        {dayOpen &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dayOpen.events.map((e) => <EventCard key={e.id} event={e} onClick={() => e.ship && goTo('shipments', e.ship.id, 'detail')} />)}
            {dayOpen.events.length === 0 &&
          <div style={{ padding: '40px 20px', textAlign: 'center', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin eventos en este día.</div>
          }
            <HolidayImpact date={dayOpen.date} goTo={goTo} />
          </div>
        }
      </U.Drawer>

      <U.Modal open={!!pendingMove} onClose={() => setPendingMove(null)} title="Reprogramar evento" width={460}
      actions={<><U.Btn variant="ghost" onClick={() => setPendingMove(null)}>Cancelar</U.Btn><U.Btn variant="primary" icon={window.Icon.check(13)} onClick={confirmMove}>Reprogramar</U.Btn></>}>
        
        {pendingMove &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <U.Badge tone={pendingMove.event.tone} size="md">{pendingMove.event.type.toUpperCase()}</U.Badge>
              <div>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>{pendingMove.event.ship?.id || pendingMove.event.label}</div>
                {pendingMove.event.ship && <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{pendingMove.event.ship.clientName}</div>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: 10, alignItems: 'center' }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Antes</div>
                <div style={{ font: '800 13px/1.2 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 6 }}>{formatShortDate(pendingMove.event.date)}</div>
              </div>
              <span style={{ color: 'var(--wine)', textAlign: 'center' }}>{window.Icon.arrowR(16)}</span>
              <div style={{ padding: '10px 12px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', textAlign: 'center', border: '1px solid var(--wine)' }}>
                <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Nueva fecha</div>
                <div style={{ font: '800 13px/1.2 var(--f-mono)', color: 'var(--wine)', marginTop: 6 }}>{formatShortDate(pendingMove.newDate)}</div>
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--info)', marginTop: 1 }}>{window.Icon.info(13)}</span>
              <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
                Reprograma la fecha en el calendario. Podés restablecer todo con el botón de arriba. El embarque real se actualiza desde el módulo Embarques.
              </div>
            </div>
          </div>
        }
      </U.Modal>
    </div>);

}

// ── Month grid ──────────────────────────────────────────────
function MonthGrid({ cursor, events, today, onDayClick, onEventDragStart, onDayDrop }) {
  const [overKey, setOverKey] = _cUseState(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells = [];

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) cells.push(null);else
    cells.push(new Date(year, month, dayNum));
  }

  const eventsByDate = _cUseMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      if (e.date) {
        const key = e.date;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      } else if (e.start && e.end) {
        // Holiday range
        let d = new Date(e.start),end = new Date(e.end);
        while (d <= end) {
          const key = d.toISOString().slice(0, 10);
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(e);
          d.setDate(d.getDate() + 1);
        }
      }
    });
    return map;
  }, [events]);

  const dayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const todayKey = today.toISOString().slice(0, 10);

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg-elevated)' }}>
        {dayNames.map((d) =>
        <div key={d} style={{ padding: '10px 14px', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textAlign: 'left', borderRight: '1px solid var(--border)' }}>{d}</div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ minHeight: 120, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 0 }} />;
          const key = day.toISOString().slice(0, 10);
          const dayEvents = eventsByDate.get(key) || [];
          const isToday = key === todayKey;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const cnHoliday = dayEvents.find((e) => e.type === 'holiday-cn');
          const veHoliday = dayEvents.find((e) => e.type === 'holiday-ve');
          const fairEvents = dayEvents.filter((e) => e.type?.startsWith('fair'));
          const reqEvents = dayEvents.filter((e) => e.type === 'requirement');
          const shipEvents = dayEvents.filter((e) => ['etd', 'eta', 'pod'].includes(e.type));

          return (
            <div key={i}
            onClick={() => onDayClick(day, dayEvents.filter((e) => !e.type?.startsWith('holiday')))}
            onDragOver={(ev) => {ev.preventDefault();if (overKey !== key) setOverKey(key);}}
            onDragLeave={() => setOverKey((k) => k === key ? null : k)}
            onDrop={(ev) => {ev.preventDefault();setOverKey(null);onDayDrop && onDayDrop(day);}}
            style={{
              minHeight: 120, padding: 8,
              background: overKey === key ? 'var(--wine-tint)' : cnHoliday ?
              `rgba(168,50,62,${cnHoliday.critical ? 0.14 : 0.07})` :
              veHoliday ?
              'rgba(31,138,91,0.08)' :
              isWeekend ? 'rgba(0,0,0,0.015)' : 'var(--bg-surface)',
              borderTop: '1px solid var(--border)',
              borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border)' : 0,
              cursor: 'pointer',
              position: 'relative',
              outline: overKey === key ? '2px solid var(--wine)' : 'none',
              outlineOffset: '-2px',
              transition: 'background var(--dur-fast) var(--ease)'
            }}
            onMouseEnter={(e) => {if (!cnHoliday && !veHoliday && overKey !== key) e.currentTarget.style.background = 'var(--bg-elevated)';}}
            onMouseLeave={(e) => {if (!cnHoliday && !veHoliday && overKey !== key) e.currentTarget.style.background = isWeekend ? 'rgba(0,0,0,0.015)' : 'var(--bg-surface)';}}>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: isToday ? 26 : 'auto', height: isToday ? 26 : 'auto',
                  borderRadius: '50%',
                  background: isToday ? 'var(--wine)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--ink)',
                  font: `${isToday ? '900' : '700'} 13px/1 var(--f-display)`,
                  padding: isToday ? 0 : '0 4px',
                  letterSpacing: '-0.02em'
                }}>{day.getDate()}</span>
                {(cnHoliday || veHoliday) &&
                <span style={{
                  font: '700 8.5px/1.2 var(--f-sans)',
                  color: cnHoliday ? 'var(--wine)' : 'var(--success)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  textAlign: 'right', maxWidth: 70
                }}>{cnHoliday?.label || veHoliday?.label}</span>
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {fairEvents.map((e) =>
                <div key={e.id} onClick={(ev) => ev.stopPropagation()} title={e.fair?.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 3,
                  background: 'rgba(42,111,219,0.10)', border: '1px solid rgba(42,111,219,0.30)',
                  color: 'var(--info)', font: '700 9.5px/1.3 var(--f-sans)', maxWidth: '100%'
                }}>
                    <span style={{ flexShrink: 0, display: 'inline-flex' }}>{window.Icon.globe(10)}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
                  </div>
                )}
                {reqEvents.map((e) =>
                <div key={e.id} onClick={(ev) => ev.stopPropagation()} title={e.detail || e.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 3,
                  background: 'var(--bg-elevated)', border: '1px dashed var(--border)',
                  color: 'var(--ink-soft)', font: '600 9.5px/1.3 var(--f-sans)', maxWidth: '100%'
                }}>
                    <span style={{ flexShrink: 0, display: 'inline-flex' }}>{window.Icon.clock(10)}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
                  </div>
                )}
                {shipEvents.slice(0, 3).map((e) =>
                <div key={e.id}
                draggable
                onDragStart={(ev) => {ev.stopPropagation();ev.dataTransfer.effectAllowed = 'move';onEventDragStart && onEventDragStart(e);}}
                onDragEnd={() => onEventDragStart && onEventDragStart(null)}
                onClick={(ev) => ev.stopPropagation()}
                title={e.moved ? `Reprogramado · arrastrá para mover de nuevo` : `Arrastrá para reprogramar`}
                style={{
                  padding: '2px 6px', borderRadius: 3,
                  background: `${toneColor(e.tone)}22`,
                  color: toneColor(e.tone),
                  font: '700 10px/1.3 var(--f-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  cursor: 'grab',
                  boxShadow: e.moved ? 'inset 2px 0 0 var(--wine)' : 'none'
                }}>{e.moved ? '↻ ' : ''}{e.type.toUpperCase()} {e.ship?.id?.split('-')[1]}</div>
                )}
                {shipEvents.length > 3 &&
                <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', padding: '2px 6px' }}>
                    +{shipEvents.length - 3} más
                  </div>
                }
              </div>
            </div>);

        })}
      </div>
    </div>);

}

// ── Week view ───────────────────────────────────────────────
function WeekView({ cursor, events, today, onDayClick }) {
  // Find Monday of the week containing cursor
  const c = new Date(cursor);
  const offset = (c.getDay() + 6) % 7;
  c.setDate(c.getDate() - offset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(c);d.setDate(d.getDate() + i);return d;
  });
  const todayKey = today.toISOString().slice(0, 10);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {days.map((d, i) => {
        const key = d.toISOString().slice(0, 10);
        const dayEvents = events.filter((e) => e.date === key || e.start <= key && e.end >= key);
        const isToday = key === todayKey;
        return (
          <div key={i} onClick={() => onDayClick(d, dayEvents.filter((e) => !e.type?.startsWith('holiday')))} style={{
            background: 'var(--bg-surface)', border: `1px solid ${isToday ? 'var(--wine)' : 'var(--border)'}`,
            borderRadius: 'var(--r-md)', padding: 12, minHeight: 360, cursor: 'pointer'
          }}>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
              {d.toLocaleDateString('es-VE', { weekday: 'short' })}
            </div>
            <div style={{ font: '900 22px/1 var(--f-display)', color: isToday ? 'var(--wine)' : 'var(--ink)', marginBottom: 12 }}>{d.getDate()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {dayEvents.map((e) =>
              <div key={e.id} style={{
                padding: '6px 8px', borderRadius: 'var(--r-sm)',
                background: e.type?.startsWith('holiday-cn') ? 'rgba(168,50,62,0.14)' : e.type?.startsWith('holiday-ve') ? 'rgba(31,138,91,0.14)' : `${toneColor(e.tone)}22`,
                borderLeft: `3px solid ${e.type?.startsWith('holiday-cn') ? 'var(--wine)' : e.type?.startsWith('holiday-ve') ? 'var(--success)' : toneColor(e.tone)}`
              }}>
                  <div style={{ font: '700 10.5px/1 var(--f-sans)', color: e.type?.startsWith('holiday') ? 'var(--ink)' : toneColor(e.tone), letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>
                    {e.type?.startsWith('holiday') ? e.type.endsWith('cn') ? 'Feriado CN' : 'Feriado VE' :
                  e.type?.startsWith('fair') ? 'Feria ' + (e.type.endsWith('cn') ? 'CN' : 'VE') :
                  e.type === 'requirement' ? 'Pendiente' : e.type}
                  </div>
                  <div style={{ font: '600 11px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{e.ship?.id || e.label}</div>
                </div>
              )}
            </div>
          </div>);

      })}
    </div>);

}

// ── Agenda view ─────────────────────────────────────────────
function AgendaView({ events, cursor, onEventClick }) {
  const sorted = [...events].sort((a, b) => new Date(a.date || a.start) - new Date(b.date || b.start));
  const monthEvents = sorted.filter((e) => {
    const d = new Date(e.date || e.start);
    return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
  });
  const grouped = new Map();
  monthEvents.forEach((e) => {
    const k = e.date || e.start;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(e);
  });
  const U = window.ERPUI;

  return (
    <U.Card padded={false}>
      {grouped.size === 0 ?
      <U.EmptyState style={{ margin: 18 }} icon={window.Icon.clock(20)} title="Sin eventos" body="Este mes no tiene zarpes, arribos ni feriados con los filtros aplicados." /> :
      [...grouped.entries()].map(([date, evts], i) =>
      <div key={date} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, padding: '14px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <div>
              <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)' }}>{new Date(date).getDate()}</div>
              <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
                {new Date(date).toLocaleDateString('es-VE', { weekday: 'long' })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evts.map((e) => <EventCard key={e.id} event={e} onClick={() => onEventClick(e)} compact />)}
            </div>
          </div>
      )
      }
    </U.Card>);

}

// ── Event card / chip ───────────────────────────────────────
function EventCard({ event: e, onClick, compact = false }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const isHoliday = e.type?.startsWith('holiday');
  const isFair = e.type?.startsWith('fair');
  const isReq = e.type === 'requirement';
  const tone = e.tone || (isHoliday ? e.type.endsWith('cn') ? 'wine' : 'success' : 'wine');
  const badgeLabel = isHoliday ? e.type.endsWith('cn') ? 'CN' : 'VE' : isFair ? 'FERIA' : isReq ? 'PEND.' : e.type.toUpperCase();
  const disabled = isHoliday || isFair || isReq && !e.ship;
  const title = isFair ? e.fair?.name || e.label : e.ship?.id || e.label;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'grid', gridTemplateColumns: '70px 1fr 70px', gap: 12,
      padding: compact ? '10px 12px' : '12px 14px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${toneColor(tone)}`,
      borderRadius: 'var(--r-md)',
      textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
      alignItems: 'center'
    }}>
      <U.Badge tone={tone} size="sm">{badgeLabel}</U.Badge>
      <div>
        <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{title}</div>
        {e.ship &&
        <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
            {e.ship.clientName} · {D.origin(e.ship.origin).name} → {D.dest(e.ship.destination).name}
          </div>
        }
        {isHoliday && <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Operaciones pausadas</div>}
        {isFair && <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{e.fair?.city} · {e.fair?.sector}</div>}
        {isReq && !e.ship && e.detail && <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{e.detail}</div>}
      </div>
      {e.ship && <U.Badge tone={D.STATUS_TONE[e.ship.status] || 'neutral'} size="sm">{e.ship.status}</U.Badge>}
    </button>);

}

// ── Helpers ─────────────────────────────────────────────────
function ViewSwitch({ value, onChange }) {
  const opts = [
  { v: 'month', l: 'Mes', i: 'dashboard' },
  { v: 'week', l: 'Semana', i: 'menu' },
  { v: 'agenda', l: 'Agenda', i: 'doc' }];

  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      {opts.map((o) => {
        const a = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--r-sm)',
            background: a ? 'var(--bg-surface)' : 'transparent',
            color: a ? 'var(--ink)' : 'var(--ink-soft)',
            font: `${a ? '700' : '500'} 12.5px/1 var(--f-sans)`,
            boxShadow: a ? 'var(--shadow-xs)' : 'none'
          }}>{window.Icon[o.i](13)} {o.l}</button>);

      })}
    </div>);

}
function LegendChip({ color, label, border }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color, border: border ? '1px solid var(--border)' : 0 }} />
      <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</span>
    </div>);

}
// ── Filtro: fila con checkbox ───────────────────────────────
function FilterRow({ label, icon, dot, checked, onToggle, bold = false, small = false, indeterminate = false }) {
  const ref = React.useRef(null);
  React.useEffect(() => {if (ref.current) ref.current.indeterminate = indeterminate;}, [indeterminate]);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: small ? '4px 8px' : '6px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} style={{ accentColor: 'var(--wine)', width: 14, height: 14, flexShrink: 0 }} />
      {icon && <span style={{ color: 'var(--ink-soft)', display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      {dot && <span style={{ width: 8, height: 8, borderRadius: 2, background: dot, flexShrink: 0 }} />}
      <span style={{ font: `${bold ? '700' : '500'} ${small ? '12' : '12.5'}px/1.3 var(--f-sans)`, color: 'var(--ink)' }}>{label}</span>
    </label>);

}

function toneColor(t) {
  return { wine: 'var(--wine)', info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', neutral: 'var(--ink-soft)' }[t] || 'var(--wine)';
}
function formatShortDate(s) {
  const d = new Date(s);
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }).toUpperCase();
}
function formatLongDate(d) {
  return d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

window.ModuleCalendar = ModuleCalendar;

// ── Holiday impact analysis ──────────────────────────────────
function HolidayImpact({ date, goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const dStr = date.toISOString().slice(0, 10);
  // Check if this date falls in a CN holiday
  const cnHoliday = CN_HOLIDAYS.find((h) => dStr >= h.start && dStr <= h.end);
  if (!cnHoliday) return null;

  // Find shipments with ETD or operations affected (within +/- 14 days of holiday)
  const start = new Date(cnHoliday.start);
  const end = new Date(cnHoliday.end);
  const window14before = new Date(start);window14before.setDate(start.getDate() - 14);
  const window7after = new Date(end);window7after.setDate(end.getDate() + 7);

  const affected = D.byTenant(D.SHIPMENTS).filter((s) => {
    if (!s.etd) return false;
    const etd = new Date(s.etd);
    return etd >= window14before && etd <= window7after && ['confirmado', 'recibido CN', 'consolidado', 'zarpado'].includes(s.status);
  });

  return (
    <div style={{ marginTop: 8, padding: '14px 16px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--warning)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(15)}</span>
        <div style={{ flex: 1 }}>
          <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>{cnHoliday.name}</div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>
            {cnHoliday.critical ? 'Feriado crítico · operación CN paralizada' : 'Feriado CN · operación reducida'}
          </div>
        </div>
        {affected.length > 0 && <U.Badge tone="warning">{affected.length} embarque{affected.length > 1 ? 's' : ''} afectado{affected.length > 1 ? 's' : ''}</U.Badge>}
      </div>

      {affected.length === 0 ?
      <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          ✓ Ningún embarque programado en la ventana crítica de este feriado.
        </div> :

      <>
          <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink)', marginBottom: 8 }}>
            Embarques con ETD próxima al feriado (riesgo de demora):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {affected.map((s) =>
          <button key={s.id} onClick={() => goTo?.('shipments', s.id, 'detail')} style={{
            display: 'grid', gridTemplateColumns: '110px 1fr 90px 80px',
            gap: 10, padding: '8px 10px',
            background: 'var(--bg-surface)', borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border)',
            alignItems: 'center', textAlign: 'left', cursor: 'pointer'
          }}>
                <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{s.id}</code>
                <span style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.clientName}</span>
                <U.StatusBadge status={s.status} size="sm" />
                <span style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>ETD {s.etd}</span>
              </button>
          )}
          </div>
        </>
      }
    </div>);

}