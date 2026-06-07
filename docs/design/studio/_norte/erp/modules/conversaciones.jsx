/* global React */
/* ── DTD ERP · Conversaciones · v1.9.1 ──────────────────────── */
/* Bandeja unificada WhatsApp + Email + Portal por cliente.      */
/* Lista filtrable · hilo · respuesta + quick replies · contexto.*/

function ModuleConversaciones({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const D = window.ConversacionesData;

  const [statusFilter, setStatusFilter] = React.useState('todos');
  const [channelFilter, setChannelFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState(D.CONVERSATIONS[0]?.id);
  // Mensajes agregados en sesión (respuestas demo) + cambios de estado/asignación
  const [extra, setExtra] = React.useState({});       // { convId: [msg,...] }
  const [overrides, setOverrides] = React.useState({}); // { convId: { status, assignedTo } }

  const convOf = (c) => ({ ...c, ...(overrides[c.id] || {}), messages: [...c.messages, ...(extra[c.id] || [])] });

  const filtered = D.CONVERSATIONS.map(convOf).filter(c => {
    if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
    if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.client.toLowerCase().includes(q) && !c.markbox.toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selected = selectedId ? convOf(D.CONVERSATIONS.find(c => c.id === selectedId)) : null;

  const sendReply = (convId, text) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    setExtra(e => ({ ...e, [convId]: [...(e[convId] || []), { dir: 'out', author: window.__currentUser?.name || 'Agente DTD', at: hh, text }] }));
  };
  const setStatus = (convId, status) => setOverrides(o => ({ ...o, [convId]: { ...(o[convId] || {}), status } }));
  const setAssign = (convId, assignedTo) => setOverrides(o => ({ ...o, [convId]: { ...(o[convId] || {}), assignedTo } }));

  return (
    <div>
      <U.PageHeader
        eyebrow="COMERCIAL · ATENCIÓN AL CLIENTE"
        title="Conversaciones"
        subtitle="Bandeja unificada · WhatsApp, email y portal en un solo hilo por cliente. Con Confianza, de China a tu puerta."
        actions={<U.Btn variant="primary" icon={I.plus(14)}>Nueva conversación</U.Btn>}
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Abiertas" value={D.byStatus('abierto').length} delta={`${D.totalUnread()} mensajes sin leer`} tone="warning" icon={I.chat(18)} />
        <U.KPI label="Sin asignar" value={D.unassigned().length} delta="requieren agente" tone={D.unassigned().length ? 'danger' : 'success'} icon={I.users(18)} />
        <U.KPI label="Casos abiertos" value={D.openReclamos().length} delta="prioridad alta" tone="danger" icon={I.warn(18)} />
        <U.KPI label="Resueltas hoy" value={D.byStatus('resuelto').length} delta="cerradas con cliente" tone="success" icon={I.check(18)} />
      </div>

      {/* Bandeja */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'stretch', height: 'calc(100vh - 360px)', minHeight: 480 }}>
        {/* Lista */}
        <ConversationList
          list={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          channelFilter={channelFilter} setChannelFilter={setChannelFilter}
          search={search} setSearch={setSearch}
        />
        {/* Hilo */}
        {selected
          ? <ConversationThread conv={selected} goTo={goTo} onSend={sendReply} onStatus={setStatus} onAssign={setAssign} />
          : <U.Card padded><U.EmptyState icon={I.chat(22)} title="Sin conversación seleccionada" body="Elegí una conversación de la lista para ver el hilo completo." /></U.Card>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Lista de conversaciones
// ════════════════════════════════════════════════════════════════
function ConversationList({ list, selectedId, onSelect, statusFilter, setStatusFilter, channelFilter, setChannelFilter, search, setSearch }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const D = window.ConversacionesData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      {/* Filtros */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
          <span style={{ color: 'var(--ink-mute)' }}>{I.search(14)}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente o MARKBOX…" style={{ flex: 1, height: '100%', border: 0, outline: 'none', background: 'transparent', font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink)' }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['todos', 'Todas'], ['abierto', 'Abiertas'], ['pendiente', 'Pend.'], ['resuelto', 'Resueltas']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)} style={{
              flex: 1, padding: '6px 4px', borderRadius: 'var(--r-sm)',
              font: `${statusFilter === v ? '700' : '500'} 11px/1 var(--f-sans)`,
              background: statusFilter === v ? 'var(--wine-tint)' : 'transparent',
              color: statusFilter === v ? 'var(--wine)' : 'var(--ink-soft)',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setChannelFilter('all')} style={chipStyle(channelFilter === 'all', 'neutral')}>Todos</button>
          {Object.entries(D.CHANNELS).map(([k, ch]) => (
            <button key={k} onClick={() => setChannelFilter(k)} style={chipStyle(channelFilter === k, ch.tone)}>{ch.label}</button>
          ))}
        </div>
      </div>

      {/* Lista scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {list.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin conversaciones con esos filtros.</div>
        )}
        {list.map((c, i) => {
          const ch = D.CHANNELS[c.channel];
          const tp = D.CONV_TYPE[c.type];
          const ag = D.agent(c.assignedTo);
          const isSel = selectedId === c.id;
          const last = c.messages[c.messages.length - 1];
          return (
            <button key={c.id} onClick={() => onSelect(c.id)} style={{
              width: '100%', textAlign: 'left', display: 'block',
              padding: '12px 14px', borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${isSel ? 'var(--wine)' : 'transparent'}`,
              background: isSel ? 'var(--wine-tint)' : 'transparent',
              transition: 'background var(--dur-fast) var(--ease)',
            }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${ch.tone})`, flexShrink: 0 }} />
                <span style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.client}</span>
                {c.unread > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '700 10px/18px var(--f-sans)', textAlign: 'center' }}>{c.unread}</span>}
                <span style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{c.lastAt}</span>
              </div>
              <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 7 }}>
                {last ? (last.dir === 'out' ? 'Vos: ' : '') + last.text : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <U.Badge tone={tp.tone} size="sm">{tp.label}</U.Badge>
                <code style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{c.markbox}</code>
                <span style={{ flex: 1 }} />
                {ag
                  ? <U.Avatar initials={ag.avatar} size={18} color={c.type === 'reclamo' ? 'wine' : 'neutral'} />
                  : <U.Badge tone="danger" size="sm">sin asignar</U.Badge>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function chipStyle(active, tone) {
  return {
    padding: '4px 9px', borderRadius: 'var(--r-pill)',
    font: `${active ? '700' : '500'} 10.5px/1 var(--f-sans)`,
    background: active ? `var(--${tone}-bg)` : 'var(--bg-elevated)',
    color: active ? `var(--${tone})` : 'var(--ink-soft)',
    border: `1px solid ${active ? `var(--${tone})` : 'transparent'}`,
  };
}

// ════════════════════════════════════════════════════════════════
// Hilo de conversación
// ════════════════════════════════════════════════════════════════
function ConversationThread({ conv, goTo, onSend, onStatus, onAssign }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const D = window.ConversacionesData;
  const [draft, setDraft] = React.useState('');
  const [showQuick, setShowQuick] = React.useState(false);
  const scrollRef = React.useRef(null);

  const ch = D.CHANNELS[conv.channel];
  const tp = D.CONV_TYPE[conv.type];
  const st = D.CONV_STATUS[conv.status];
  const ag = D.agent(conv.assignedTo);
  const users = (window.ERPData?.USERS || []).filter(u => u.status === 'active');

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conv.id, conv.messages.length]);

  const send = () => { if (!draft.trim()) return; onSend(conv.id, draft.trim()); setDraft(''); setShowQuick(false); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)' }}>{conv.client}</span>
            <U.Badge tone={ch.tone} size="sm" dot>{ch.label}</U.Badge>
            <U.Badge tone={tp.tone} size="sm">{tp.label}</U.Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
            <button onClick={() => goTo('clients', conv.markbox)} style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--wine)', cursor: 'pointer' }}>{conv.markbox}</button>
            {conv.shipment && (
              <>
                <span style={{ color: 'var(--ink-mute)' }}>·</span>
                <button onClick={() => goTo('shipments', conv.shipment)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', cursor: 'pointer' }}>{I.box(12)} {conv.shipment}</button>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={conv.assignedTo || ''} onChange={(e) => onAssign(conv.id, e.target.value || null)} style={selectStyle}>
            <option value="">Sin asignar</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={conv.status} onChange={(e) => onStatus(conv.id, e.target.value)} style={selectStyle}>
            {Object.entries(D.CONV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {conv.messages.map((m, i) => {
          const out = m.dir === 'out';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: out ? 'flex-end' : 'flex-start', gap: 3 }}>
              <div style={{
                maxWidth: '74%', padding: '10px 14px', borderRadius: out ? 'var(--r-lg) var(--r-lg) var(--r-xs) var(--r-lg)' : 'var(--r-lg) var(--r-lg) var(--r-lg) var(--r-xs)',
                background: out ? 'var(--wine)' : 'var(--bg-surface)',
                border: out ? 'none' : '1px solid var(--border)',
                color: out ? '#fff' : 'var(--ink)',
                font: '500 13px/1.5 var(--f-sans)',
                boxShadow: 'var(--shadow-xs)',
              }}>{m.text}</div>
              <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', padding: '0 4px' }}>
                {out ? m.author + ' · ' : ''}{m.at}{!out ? ' · ' + m.author : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick replies */}
      {showQuick && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {D.QUICK_REPLIES.map(q => (
            <button key={q.id} onClick={() => { setDraft(q.text); setShowQuick(false); }} title={q.text} style={{
              padding: '6px 11px', borderRadius: 'var(--r-pill)', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)', cursor: 'pointer',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; e.currentTarget.style.color = 'var(--wine)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
            >{q.label}</button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <button onClick={() => setShowQuick(s => !s)} title="Respuestas rápidas" style={{
          width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--r-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: showQuick ? 'var(--wine-tint)' : 'var(--bg-elevated)', color: showQuick ? 'var(--wine)' : 'var(--ink-soft)',
          border: `1px solid ${showQuick ? 'var(--wine)' : 'var(--border)'}`,
        }}>{I.spark(16)}</button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
          placeholder={`Responder por ${ch.label}…  (⌘↵ para enviar)`}
          rows={1}
          style={{
            flex: 1, resize: 'none', minHeight: 38, maxHeight: 120, padding: '9px 12px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink)', outline: 'none',
          }}
        />
        <U.Btn variant="primary" icon={I.arrowR(14)} onClick={send} disabled={!draft.trim()} style={{ height: 38 }}>Enviar</U.Btn>
      </div>
    </div>
  );
}

const selectStyle = {
  height: 32, padding: '0 28px 0 10px',
  background: `var(--bg-surface) url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236B6B6B' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>") no-repeat right 10px center`,
  border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
  font: '600 12px/1 var(--f-sans)', color: 'var(--ink)', appearance: 'none', outline: 'none', cursor: 'pointer',
};

window.ModuleConversaciones = ModuleConversaciones;
