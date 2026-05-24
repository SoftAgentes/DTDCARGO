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
  { start: '2026-10-01', end: '2026-10-07', name: 'Golden Week · 国庆节', shortName: 'Golden Week', critical: true },
];

// VE holidays selected
const VE_HOLIDAYS = [
  { start: '2026-01-01', end: '2026-01-01', name: 'Año Nuevo VE' },
  { start: '2026-04-02', end: '2026-04-03', name: 'Semana Santa' },
  { start: '2026-04-19', end: '2026-04-19', name: 'Declaración Independencia' },
  { start: '2026-05-01', end: '2026-05-01', name: 'Día del Trabajador VE' },
  { start: '2026-07-05', end: '2026-07-05', name: 'Independencia' },
  { start: '2026-07-24', end: '2026-07-24', name: 'Natalicio Bolívar' },
  { start: '2026-12-25', end: '2026-12-25', name: 'Navidad' },
];

function ModuleCalendar({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [cursor, setCursor] = _cUseState(new Date(2026, 4, 1)); // May 2026
  const [view, setView] = _cUseState('month'); // 'month' | 'week' | 'agenda'
  const [portFilter, setPortFilter] = _cUseState('all');
  const [eventTypeFilter, setEventTypeFilter] = _cUseState({ etd: true, eta: true, pod: true, holiday: true });
  const [dayOpen, setDayOpen] = _cUseState(null);

  // Build event list
  const events = _cUseMemo(() => {
    const list = [];
    D.SHIPMENTS.forEach(s => {
      if (portFilter !== 'all' && s.destination !== portFilter) return;
      if (s.etd && eventTypeFilter.etd) list.push({ id: s.id+'-etd', type: 'etd', date: s.etd, ship: s, tone: 'info', label: `ETD ${s.id}` });
      if (s.eta && eventTypeFilter.eta) list.push({ id: s.id+'-eta', type: 'eta', date: s.eta, ship: s, tone: s.alert ? 'warning' : 'wine', label: `ETA ${s.id}` });
      if (s.status === 'entregado' && s.eta && eventTypeFilter.pod) list.push({ id: s.id+'-pod', type: 'pod', date: s.eta, ship: s, tone: 'success', label: `POD ${s.id}` });
    });
    if (eventTypeFilter.holiday) {
      CN_HOLIDAYS.forEach(h => list.push({ id: 'h-'+h.start, type: 'holiday-cn', start: h.start, end: h.end, label: h.shortName, critical: h.critical, country: 'CN' }));
      VE_HOLIDAYS.forEach(h => list.push({ id: 'v-'+h.start, type: 'holiday-ve', start: h.start, end: h.end, label: h.name, country: 'VE' }));
    }
    return list;
  }, [portFilter, eventTypeFilter]);

  const monthLabel = cursor.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
  const today = new Date('2026-05-23');

  const upcoming = _cUseMemo(() => {
    return events
      .filter(e => {
        const d = new Date(e.date || e.start);
        return d >= today && d <= new Date('2026-12-31');
      })
      .sort((a, b) => new Date(a.date || a.start) - new Date(b.date || b.start))
      .slice(0, 8);
  }, [events]);

  return (
    <div>
      <U.PageHeader
        title="Calendario operativo"
        subtitle="Zarpes · arribos · entregas · feriados CN/VE. Vista de mes con drill-down por día."
        actions={
          <>
            <ViewSwitch value={view} onChange={setView} />
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar ICS</U.Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'flex-start' }}>
        <div>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--ink-soft)',
            }}>{window.Icon.arrowL(14)}</button>
            <h2 style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', textTransform: 'capitalize', margin: 0, flex: 1 }}>{monthLabel}</h2>
            <button onClick={() => setCursor(new Date(2026, 4, 1))} style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 12px/1 var(--f-sans)' }}>Hoy</button>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--ink-soft)',
            }}>{window.Icon.arrowR(14)}</button>
          </div>

          {view === 'month' && <MonthGrid cursor={cursor} events={events} today={today} onDayClick={(d, evts) => setDayOpen({ date: d, events: evts })} />}
          {view === 'week'  && <WeekView cursor={cursor} events={events} today={today} onDayClick={(d, evts) => setDayOpen({ date: d, events: evts })} />}
          {view === 'agenda' && <AgendaView events={events} cursor={cursor} onEventClick={(e) => e.ship && goTo('shipments', e.ship.id, 'detail')} />}

          {/* Legend */}
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>LEYENDA</span>
            <LegendChip color="var(--info)"    label="ETD · zarpe" />
            <LegendChip color="var(--wine)"    label="ETA · arribo" />
            <LegendChip color="var(--warning)" label="ETA en riesgo" />
            <LegendChip color="var(--success)" label="POD · entregado" />
            <LegendChip color="rgba(168,50,62,0.18)" label="Feriado CN" border />
            <LegendChip color="rgba(31,138,91,0.16)" label="Feriado VE" border />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Filters */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>FILTROS</div>
            <U.Select label="Puerto de destino" value={portFilter} onChange={(e)=>setPortFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos los puertos' },
              ...D.DESTINATIONS.map(d => ({ value: d.code, label: d.name })),
            ]} />
            <div style={{ marginTop: 12 }}>
              <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Tipo de evento</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { k: 'etd', l: 'ETD · zarpes', c: 'var(--info)' },
                  { k: 'eta', l: 'ETA · arribos', c: 'var(--wine)' },
                  { k: 'pod', l: 'POD · entregas', c: 'var(--success)' },
                  { k: 'holiday', l: 'Feriados CN/VE', c: 'var(--warning)' },
                ].map(o => (
                  <label key={o.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={eventTypeFilter[o.k]} onChange={(e) => setEventTypeFilter({ ...eventTypeFilter, [o.k]: e.target.checked })} style={{ accentColor: 'var(--wine)' }} />
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: o.c, flexShrink: 0 }} />
                    <span style={{ font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{o.l}</span>
                  </label>
                ))}
              </div>
            </div>
          </U.Card>

          {/* Upcoming */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>PRÓXIMOS EVENTOS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.map(e => (
                <button key={e.id} onClick={() => e.ship && goTo('shipments', e.ship.id, 'detail')} style={{
                  display: 'grid', gridTemplateColumns: '52px 1fr', gap: 10, padding: '8px 10px',
                  textAlign: 'left', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
                  borderLeft: `3px solid ${toneColor(e.tone || 'wine')}`,
                }}>
                  <div style={{ font: '800 11px/1.2 var(--f-mono)', color: 'var(--wine)', textAlign: 'center' }}>
                    {formatShortDate(e.date || e.start)}
                  </div>
                  <div>
                    <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{e.label}</div>
                    {e.ship && <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{e.ship.clientName} · {D.dest(e.ship.destination).name}</div>}
                  </div>
                </button>
              ))}
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

      {/* Day drawer */}
      <U.Drawer
        open={!!dayOpen}
        onClose={() => setDayOpen(null)}
        title={dayOpen ? formatLongDate(dayOpen.date) : ''}
        subtitle={dayOpen ? `${dayOpen.events.length} eventos` : ''}
        width={560}
      >
        {dayOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dayOpen.events.map(e => <EventCard key={e.id} event={e} onClick={() => e.ship && goTo('shipments', e.ship.id, 'detail')} />)}
            {dayOpen.events.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin eventos en este día.</div>
            )}
            <HolidayImpact date={dayOpen.date} goTo={goTo} />
          </div>
        )}
      </U.Drawer>
    </div>
  );
}

// ── Month grid ──────────────────────────────────────────────
function MonthGrid({ cursor, events, today, onDayClick }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells = [];

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) cells.push(null);
    else cells.push(new Date(year, month, dayNum));
  }

  const eventsByDate = _cUseMemo(() => {
    const map = new Map();
    events.forEach(e => {
      if (e.date) {
        const key = e.date;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(e);
      } else if (e.start && e.end) {
        // Holiday range
        let d = new Date(e.start), end = new Date(e.end);
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
        {dayNames.map(d => (
          <div key={d} style={{ padding: '10px 14px', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textAlign: 'left', borderRight: '1px solid var(--border)' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ minHeight: 120, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', borderRight: (i+1)%7 !== 0 ? '1px solid var(--border)' : 0 }} />;
          const key = day.toISOString().slice(0, 10);
          const dayEvents = eventsByDate.get(key) || [];
          const isToday = key === todayKey;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const cnHoliday = dayEvents.find(e => e.type === 'holiday-cn');
          const veHoliday = dayEvents.find(e => e.type === 'holiday-ve');

          return (
            <div key={i}
              onClick={() => onDayClick(day, dayEvents.filter(e => !e.type?.startsWith('holiday')))}
              style={{
                minHeight: 120, padding: 8,
                background: cnHoliday
                  ? `rgba(168,50,62,${cnHoliday.critical ? 0.14 : 0.07})`
                  : veHoliday
                  ? 'rgba(31,138,91,0.08)'
                  : isWeekend ? 'rgba(0,0,0,0.015)' : 'var(--bg-surface)',
                borderTop: '1px solid var(--border)',
                borderRight: (i+1)%7 !== 0 ? '1px solid var(--border)' : 0,
                cursor: 'pointer',
                position: 'relative',
                transition: 'background var(--dur-fast) var(--ease)',
              }}
              onMouseEnter={(e) => { if (!cnHoliday && !veHoliday) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (!cnHoliday && !veHoliday) e.currentTarget.style.background = isWeekend ? 'rgba(0,0,0,0.015)' : 'var(--bg-surface)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: isToday ? 26 : 'auto', height: isToday ? 26 : 'auto',
                  borderRadius: '50%',
                  background: isToday ? 'var(--wine)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--ink)',
                  font: `${isToday ? '900' : '700'} 13px/1 var(--f-display)`,
                  padding: isToday ? 0 : '0 4px',
                  letterSpacing: '-0.02em',
                }}>{day.getDate()}</span>
                {(cnHoliday || veHoliday) && (
                  <span style={{
                    font: '700 8.5px/1.2 var(--f-sans)',
                    color: cnHoliday ? 'var(--wine)' : 'var(--success)',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    textAlign: 'right', maxWidth: 70,
                  }}>{cnHoliday?.label || veHoliday?.label}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {dayEvents.filter(e => !e.type?.startsWith('holiday')).slice(0, 3).map(e => (
                  <div key={e.id} style={{
                    padding: '2px 6px', borderRadius: 3,
                    background: `${toneColor(e.tone)}22`,
                    color: toneColor(e.tone),
                    font: '700 10px/1.3 var(--f-mono)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.type.toUpperCase()} {e.ship?.id?.split('-')[1]}</div>
                ))}
                {dayEvents.filter(e => !e.type?.startsWith('holiday')).length > 3 && (
                  <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', padding: '2px 6px' }}>
                    +{dayEvents.filter(e => !e.type?.startsWith('holiday')).length - 3} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week view ───────────────────────────────────────────────
function WeekView({ cursor, events, today, onDayClick }) {
  // Find Monday of the week containing cursor
  const c = new Date(cursor);
  const offset = (c.getDay() + 6) % 7;
  c.setDate(c.getDate() - offset);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(c); d.setDate(d.getDate() + i); return d;
  });
  const todayKey = today.toISOString().slice(0, 10);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {days.map((d, i) => {
        const key = d.toISOString().slice(0, 10);
        const dayEvents = events.filter(e => (e.date === key) || (e.start <= key && e.end >= key));
        const isToday = key === todayKey;
        return (
          <div key={i} onClick={() => onDayClick(d, dayEvents.filter(e => !e.type?.startsWith('holiday')))} style={{
            background: 'var(--bg-surface)', border: `1px solid ${isToday ? 'var(--wine)' : 'var(--border)'}`,
            borderRadius: 'var(--r-md)', padding: 12, minHeight: 360, cursor: 'pointer',
          }}>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
              {d.toLocaleDateString('es-VE', { weekday: 'short' })}
            </div>
            <div style={{ font: '900 22px/1 var(--f-display)', color: isToday ? 'var(--wine)' : 'var(--ink)', marginBottom: 12 }}>{d.getDate()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {dayEvents.map(e => (
                <div key={e.id} style={{
                  padding: '6px 8px', borderRadius: 'var(--r-sm)',
                  background: e.type?.startsWith('holiday-cn') ? 'rgba(168,50,62,0.14)' : e.type?.startsWith('holiday-ve') ? 'rgba(31,138,91,0.14)' : `${toneColor(e.tone)}22`,
                  borderLeft: `3px solid ${e.type?.startsWith('holiday-cn') ? 'var(--wine)' : e.type?.startsWith('holiday-ve') ? 'var(--success)' : toneColor(e.tone)}`,
                }}>
                  <div style={{ font: '700 10.5px/1 var(--f-sans)', color: e.type?.startsWith('holiday') ? 'var(--ink)' : toneColor(e.tone), letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>
                    {e.type?.startsWith('holiday') ? (e.type.endsWith('cn') ? 'CN' : 'VE') : e.type}
                  </div>
                  <div style={{ font: '600 11px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{e.ship?.id || e.label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Agenda view ─────────────────────────────────────────────
function AgendaView({ events, cursor, onEventClick }) {
  const sorted = [...events].sort((a, b) => new Date(a.date || a.start) - new Date(b.date || b.start));
  const monthEvents = sorted.filter(e => {
    const d = new Date(e.date || e.start);
    return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
  });
  const grouped = new Map();
  monthEvents.forEach(e => {
    const k = e.date || e.start;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(e);
  });
  const U = window.ERPUI;

  return (
    <U.Card padded={false}>
      {grouped.size === 0
        ? <U.EmptyState style={{ margin: 18 }} icon={window.Icon.clock(20)} title="Sin eventos" body="Este mes no tiene zarpes, arribos ni feriados con los filtros aplicados." />
        : [...grouped.entries()].map(([date, evts], i) => (
          <div key={date} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, padding: '14px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <div>
              <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)' }}>{new Date(date).getDate()}</div>
              <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
                {new Date(date).toLocaleDateString('es-VE', { weekday: 'long' })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evts.map(e => <EventCard key={e.id} event={e} onClick={() => onEventClick(e)} compact />)}
            </div>
          </div>
        ))
      }
    </U.Card>
  );
}

// ── Event card / chip ───────────────────────────────────────
function EventCard({ event: e, onClick, compact = false }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const isHoliday = e.type?.startsWith('holiday');
  const tone = e.tone || (isHoliday ? (e.type.endsWith('cn') ? 'wine' : 'success') : 'wine');
  return (
    <button onClick={onClick} disabled={isHoliday} style={{
      display: 'grid', gridTemplateColumns: '70px 1fr 70px', gap: 12,
      padding: compact ? '10px 12px' : '12px 14px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${toneColor(tone)}`,
      borderRadius: 'var(--r-md)',
      textAlign: 'left', cursor: isHoliday ? 'default' : 'pointer',
      alignItems: 'center',
    }}>
      <U.Badge tone={tone} size="sm">{isHoliday ? (e.type.endsWith('cn') ? 'CN' : 'VE') : e.type.toUpperCase()}</U.Badge>
      <div>
        <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{e.ship?.id || e.label}</div>
        {e.ship && (
          <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
            {e.ship.clientName} · {D.origin(e.ship.origin).name} → {D.dest(e.ship.destination).name}
          </div>
        )}
        {isHoliday && <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Operaciones pausadas</div>}
      </div>
      {e.ship && <U.Badge tone={D.STATUS_TONE[e.ship.status] || 'neutral'} size="sm">{e.ship.status}</U.Badge>}
    </button>
  );
}

// ── Helpers ─────────────────────────────────────────────────
function ViewSwitch({ value, onChange }) {
  const opts = [
    { v: 'month', l: 'Mes', i: 'dashboard' },
    { v: 'week',  l: 'Semana', i: 'menu' },
    { v: 'agenda', l: 'Agenda', i: 'doc' },
  ];
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      {opts.map(o => {
        const a = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--r-sm)',
            background: a ? 'var(--bg-surface)' : 'transparent',
            color: a ? 'var(--ink)' : 'var(--ink-soft)',
            font: `${a ? '700' : '500'} 12.5px/1 var(--f-sans)`,
            boxShadow: a ? 'var(--shadow-xs)' : 'none',
          }}>{window.Icon[o.i](13)} {o.l}</button>
        );
      })}
    </div>
  );
}
function LegendChip({ color, label, border }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: color, border: border ? '1px solid var(--border)' : 0 }} />
      <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</span>
    </div>
  );
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
  const cnHoliday = CN_HOLIDAYS.find(h => dStr >= h.start && dStr <= h.end);
  if (!cnHoliday) return null;

  // Find shipments with ETD or operations affected (within +/- 14 days of holiday)
  const start = new Date(cnHoliday.start);
  const end = new Date(cnHoliday.end);
  const window14before = new Date(start); window14before.setDate(start.getDate() - 14);
  const window7after  = new Date(end);   window7after.setDate(end.getDate() + 7);

  const affected = D.SHIPMENTS.filter(s => {
    if (!s.etd) return false;
    const etd = new Date(s.etd);
    return etd >= window14before && etd <= window7after && ['confirmado','recibido CN','consolidado','zarpado'].includes(s.status);
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

      {affected.length === 0 ? (
        <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          ✓ Ningún embarque programado en la ventana crítica de este feriado.
        </div>
      ) : (
        <>
          <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink)', marginBottom: 8 }}>
            Embarques con ETD próxima al feriado (riesgo de demora):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {affected.map(s => (
              <button key={s.id} onClick={() => goTo?.('shipments', s.id, 'detail')} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 90px 80px',
                gap: 10, padding: '8px 10px',
                background: 'var(--bg-surface)', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
                alignItems: 'center', textAlign: 'left', cursor: 'pointer',
              }}>
                <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{s.id}</code>
                <span style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.clientName}</span>
                <U.StatusBadge status={s.status} size="sm" />
                <span style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>ETD {s.etd}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
