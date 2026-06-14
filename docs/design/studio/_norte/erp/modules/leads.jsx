/* global React */
/* ── DTD ERP · CRM / Leads (Kanban + Tabla + Timeline) ──────── */

const { useState: _lUseState, useMemo: _lUseMemo, useRef: _lUseRef } = React;

const STAGES = ['nuevo', 'estimado', 'demo', 'propuesta', 'ganado', 'descartado'];
const STAGE_COLOR = {
  nuevo: 'info', estimado: 'wine', demo: 'warning',
  propuesta: 'wine', ganado: 'success', descartado: 'neutral',
};

function ModuleLeads() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [viewMode, setViewMode] = _lUseState('kanban');
  const [leads, setLeads] = _lUseState(D.byTenant(D.LEADS));
  const [selected, setSelected] = _lUseState(null);
  const [search, setSearch] = _lUseState('');
  const [ownerFilter, setOwnerFilter] = _lUseState('all');
  const [sourceFilter, setSourceFilter] = _lUseState('all');

  // Filtering
  const filtered = _lUseMemo(() => {
    return leads.filter(l => {
      if (ownerFilter !== 'all' && l.owner !== ownerFilter) return false;
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.name.toLowerCase().includes(q) && !l.company.toLowerCase().includes(q) && !l.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, ownerFilter, sourceFilter]);

  // Move lead between stages (drag & drop)
  const moveLead = (leadId, newStage) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage, lastTouch: 'ahora' } : l));
  };

  // Convert lead → client (creates real-looking new Shipping Mark)
  const convert = (lead) => {
    const next = 5476 + leads.filter(l => l.stage === 'ganado').length;
    const newMarkbox = `DTD-${next}`;
    setLeads(prev => prev.map(l => l.id === lead.id ? {
      ...l,
      stage: 'ganado',
      lastTouch: 'ahora',
      convertedMarkbox: newMarkbox,
      notes: `${l.notes} · ✓ Convertido a cliente · Shipping Mark ${newMarkbox} asignado.`
    } : l));
    // Show success toast (in selected — drawer stays open to show the link)
    setSelected(prev => prev && prev.id === lead.id ? { ...prev, stage: 'ganado', convertedMarkbox: newMarkbox, lastTouch: 'ahora', notes: `${prev.notes} · ✓ Convertido a cliente · Shipping Mark ${newMarkbox} asignado.` } : prev);
  };

  // Stats
  const stats = _lUseMemo(() => {
    const active = leads.filter(l => !['ganado', 'descartado'].includes(l.stage));
    const wonValue = leads.filter(l => l.stage === 'ganado').reduce((s, l) => s + (l.value || 0), 0);
    const pipelineValue = active.reduce((s, l) => s + (l.value || 0), 0);
    const total = leads.length;
    const wonCount = leads.filter(l => l.stage === 'ganado').length;
    return { active: active.length, wonValue, pipelineValue, conversion: total > 0 ? Math.round((wonCount / total) * 100) : 0 };
  }, [leads]);

  const owners = [...new Set(D.byTenant(D.LEADS).map(l => l.owner))];
  const sources = [...new Set(D.byTenant(D.LEADS).map(l => l.source))];

  return (
    <div>
      <U.PageHeader
        title="CRM · Leads"
        subtitle="Pipeline comercial de DTD-Cargo. Origen, etapa, owner y proyección. Vista Kanban con drag & drop entre columnas."
        actions={
          <>
            <ViewToggle3 value={viewMode} onChange={setViewMode} />
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)}>Nuevo lead</U.Btn>
          </>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Leads activos" value={stats.active} delta="+5 esta sem" tone="wine" icon={window.Icon.spark(18)} />
        <U.KPI label="Valor pipeline" value={`$${(stats.pipelineValue/1000).toFixed(0)}K`} delta="potencial 30d" tone="info" icon={window.Icon.chart(18)} />
        <U.KPI label="Ganados mes" value={leads.filter(l=>l.stage==='ganado').length} delta={`$${(stats.wonValue/1000).toFixed(0)}K cerrados`} tone="success" icon={window.Icon.check(18)} />
        <U.KPI label="Tasa conversión" value={`${stats.conversion}%`} delta="↑ 6 pts" tone="success" icon={window.Icon.star(18)} />
      </div>

      {/* Filters */}
      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar lead, empresa o contacto…"
        filters={
          <>
            <U.Select value={ownerFilter} onChange={(e)=>setOwnerFilter(e.target.value)} style={{ width: 180 }} options={[
              { value: 'all', label: 'Todos los owners' },
              ...owners.map(o => ({ value: o, label: o })),
            ]} />
            <U.Select value={sourceFilter} onChange={(e)=>setSourceFilter(e.target.value)} style={{ width: 180 }} options={[
              { value: 'all', label: 'Todos los orígenes' },
              ...sources.map(s => ({ value: s, label: s })),
            ]} />
          </>
        }
        actions={(ownerFilter !== 'all' || sourceFilter !== 'all' || search) && (
          <U.Btn variant="ghost" size="sm" onClick={() => { setSearch(''); setOwnerFilter('all'); setSourceFilter('all'); }}>Limpiar</U.Btn>
        )}
      />

      {/* Views */}
      {viewMode === 'kanban'   && <KanbanLeads leads={filtered} onMove={moveLead} onOpen={setSelected} />}
      {viewMode === 'table'    && <TableLeads leads={filtered} onOpen={setSelected} />}
      {viewMode === 'timeline' && <TimelineLeads leads={filtered} onOpen={setSelected} />}

      {/* Detail Drawer */}
      <LeadDetail lead={selected} onClose={() => setSelected(null)} onMove={moveLead} onConvert={convert} />
    </div>
  );
}

// ── View toggle (3 options) ──────────────────────────────────
function ViewToggle3({ value, onChange }) {
  const opts = [
    { v: 'kanban',   l: 'Kanban',   i: 'dashboard' },
    { v: 'table',    l: 'Tabla',    i: 'menu' },
    { v: 'timeline', l: 'Timeline', i: 'clock' },
  ];
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      {opts.map(o => {
        const active = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--r-sm)',
            background: active ? 'var(--bg-surface)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--ink-soft)',
            font: `${active ? '700' : '500'} 12.5px/1 var(--f-sans)`,
            boxShadow: active ? 'var(--shadow-xs)' : 'none',
            transition: 'all var(--dur-fast) var(--ease)',
          }}>{window.Icon[o.i](13)} {o.l}</button>
        );
      })}
    </div>
  );
}

// ── Kanban view (drag & drop functional) ─────────────────────
function KanbanLeads({ leads, onMove, onOpen }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [dragId, setDragId] = _lUseState(null);
  const [dragOver, setDragOver] = _lUseState(null);
  const [stageOrder, setStageOrder] = _lUseState(STAGES);
  const [dragColumn, setDragColumn] = _lUseState(null);
  const [dragColOver, setDragColOver] = _lUseState(null);

  const handleDrop = (stage) => {
    if (dragId) onMove(dragId, stage);
    setDragId(null); setDragOver(null);
  };

  const moveColumn = (from, to) => {
    if (from === to) return;
    setStageOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(next.indexOf(from), 1);
      next.splice(next.indexOf(to), 0, moved);
      return next;
    });
  };

  // Color helpers
  const stageHex = (s) => {
    const t = STAGE_COLOR[s];
    return ({ wine: '#7F0F1A', success: '#1F8A5B', warning: '#B8893A', info: '#2A6FDB', neutral: '#6B6B6B' })[t] || '#7F0F1A';
  };

  return (
    <div style={{ overflowX: 'auto', margin: '0 -8px', padding: '0 8px 8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stageOrder.length}, minmax(240px, 1fr))`, gap: 10, alignItems: 'flex-start' }}>
        {stageOrder.map(stage => {
          const col = leads.filter(l => l.stage === stage);
          const value = col.reduce((s, l) => s + (l.value || 0), 0);
          const tone = STAGE_COLOR[stage];
          const accent = stageHex(stage);
          const isCardOver = dragOver === stage;
          const isColOver = dragColOver === stage && dragColumn && dragColumn !== stage;

          return (
            <div key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragColumn) setDragColOver(stage);
                else setDragOver(stage);
              }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) { setDragOver(null); setDragColOver(null); } }}
              onDrop={() => {
                if (dragColumn) { moveColumn(dragColumn, stage); setDragColumn(null); setDragColOver(null); }
                else { handleDrop(stage); }
              }}
              style={{
                minWidth: 0,
                outline: isColOver ? '2px dashed var(--wine)' : 'none',
                outlineOffset: 2,
                borderRadius: 'var(--r-md)',
                transition: 'outline var(--dur-fast) var(--ease)',
              }}
            >
              {/* ── Column header (new design) ── */}
              <div
                draggable
                onDragStart={(e) => { setDragColumn(stage); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragColumn(null); setDragColOver(null); }}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md) var(--r-md) 0 0',
                  borderBottom: 0,
                  borderTop: `3px solid ${accent}`,
                  padding: '12px 14px 10px',
                  cursor: 'grab',
                  position: 'relative',
                  opacity: dragColumn === stage ? 0.4 : 1,
                }}
              >
                {/* Top row: stage name + menu */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                    <span style={{
                      font: '900 13.5px/1 var(--f-display)',
                      color: 'var(--ink)',
                      letterSpacing: '-0.01em',
                      textTransform: 'capitalize',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{stage}</span>
                  </div>
                  <button style={{
                    width: 22, height: 22,
                    color: 'var(--ink-mute)',
                    borderRadius: 'var(--r-sm)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--ink)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-mute)'; }}
                  title="Opciones de columna">{window.Icon.more(12)}</button>
                </div>

                {/* Bottom row: count · total value */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ font: '800 18px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>{col.length}</span>
                    <span style={{ font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{col.length === 1 ? 'lead' : 'leads'}</span>
                  </div>
                  {value > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ font: '600 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Pipeline</span>
                      <span style={{ font: '800 13.5px/1 var(--f-mono)', color: accent }}>${(value/1000).toFixed(0)}K</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Cards area ── */}
              <div style={{
                background: isCardOver ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                border: '1px solid var(--border)', borderTop: 0,
                borderRadius: '0 0 var(--r-md) var(--r-md)',
                padding: 8, minHeight: 240,
                display: 'flex', flexDirection: 'column', gap: 6,
                transition: 'background var(--dur-fast) var(--ease)',
              }}>
                {col.length === 0 ? (
                  <div style={{
                    padding: '32px 8px', textAlign: 'center',
                    font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)',
                    border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-sm)',
                    margin: 4,
                  }}>Suelta un lead acá</div>
                ) : col.map(l => (
                  <LeadCard key={l.id} l={l}
                    onClick={() => onOpen(l)}
                    onDragStart={(e) => { setDragId(l.id); e.stopPropagation(); }}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    isDragging={dragId === l.id}
                  />
                ))}
                {col.length > 0 && (
                  <button style={{
                    padding: '6px 8px', borderRadius: 'var(--r-sm)',
                    font: '600 11px/1 var(--f-sans)', color: 'var(--ink-mute)',
                    background: 'transparent', border: '1px dashed var(--border-strong)',
                    marginTop: 2,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--wine)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-mute)'; }}
                  >+ Agregar lead</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: 'var(--info)' }}>{window.Icon.info(13)}</span>
        <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
          <b>Drag & drop:</b> arrastra tarjetas entre columnas para cambiar la etapa · arrastra el <b>header de columna</b> para reordenar las etapas del pipeline.
        </div>
      </div>
    </div>
  );
}

function LeadCard({ l, onClick, onDragStart, onDragEnd, isDragging }) {
  const U = window.ERPUI;
  const sourceIcon = {
    'Web · estimador': 'calc', 'Instagram': 'globe', 'LinkedIn': 'shield',
    'Referido': 'star', 'Google Ads': 'spark'
  }[l.source] || 'spark';
  const ownerInitials = l.owner.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        padding: 11, background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        boxShadow: isDragging ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        display: 'flex', flexDirection: 'column', gap: 7,
        transition: 'opacity var(--dur-fast), box-shadow var(--dur-fast)',
      }}
    >
      <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{l.company}</div>
      <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{l.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span style={{ color: 'var(--ink-mute)' }}>{window.Icon[sourceIcon](11)}</span>
        <span style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.04em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.source}</span>
        {l.value && <span style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--wine)' }}>${(l.value/1000).toFixed(0)}K</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <U.Avatar initials={ownerInitials} color="wine" size={20} />
        <span style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{l.lastTouch}</span>
      </div>
    </div>
  );
}

// ── Table view ───────────────────────────────────────────────
function TableLeads({ leads, onOpen }) {
  const U = window.ERPUI;
  const columns = [
    { label: 'ID', key: 'id', render: (r) => <code style={{ font: '800 11.5px/1 var(--f-mono)' }}>{r.id}</code>, width: 80 },
    { label: 'Empresa', key: 'company', render: (r) => (
      <div>
        <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.company}</div>
        <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{r.name}</div>
      </div>
    )},
    { label: 'Etapa', key: 'stage', render: (r) => <U.Badge tone={STAGE_COLOR[r.stage]} size="sm" dot>{r.stage}</U.Badge>, width: 130 },
    { label: 'Industria', key: 'industry', render: (r) => <U.Badge tone="neutral" size="sm">{r.industry}</U.Badge>, width: 120 },
    { label: 'Origen', key: 'source', render: (r) => <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{r.source}</span>, width: 140 },
    { label: 'Ciudad', key: 'city', width: 110 },
    { label: 'Owner', key: 'owner', render: (r) => (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <U.Avatar initials={r.owner.split(' ').map(w=>w[0]).slice(0,2).join('')} color="wine" size={24} />
        <span style={{ font: '500 12px/1 var(--f-sans)' }}>{r.owner.split(' ')[0]}</span>
      </div>
    )},
    { label: 'Valor', key: 'value', align: 'right', render: (r) => r.value
      ? <span className="mono" style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)' }}>${(r.value/1000).toFixed(0)}K</span>
      : <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>—</span>
    , width: 80 },
    { label: 'Último contacto', key: 'lastTouch', render: (r) => <span style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.lastTouch}</span>, width: 140 },
  ];
  return <U.Table columns={columns} rows={leads} onRowClick={onOpen} />;
}

// ── Timeline view ────────────────────────────────────────────
function TimelineLeads({ leads, onOpen }) {
  const U = window.ERPUI;
  // Sort by recency (extract a simple weight from lastTouch)
  const order = ['ahora', 'hace 1 día', 'hace 2 días', 'hace 3 días', 'hace 4 días', 'hace 5 días', 'hace 6 días', 'hace 7 días', 'hace 8 días', 'hace 9 días', 'hace 1 sem', 'hace 2 sem', 'hace 3 sem', 'hace 1 mes'];
  const weight = (t) => {
    if (t.includes('h') && !t.includes('hace')) return 0;
    const i = order.indexOf(t);
    return i === -1 ? 99 : i;
  };
  const sorted = [...leads].sort((a, b) => weight(a.lastTouch) - weight(b.lastTouch));

  return (
    <U.Card padded={false}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">ACTIVIDAD CRONOLÓGICA · {sorted.length} LEADS</div>
      </div>
      {sorted.map((l, i) => {
        const sourceIcon = {
          'Web · estimador': 'calc', 'Instagram': 'globe', 'LinkedIn': 'shield',
          'Referido': 'star', 'Google Ads': 'spark'
        }[l.source] || 'spark';
        return (
          <div key={l.id} onClick={() => onOpen(l)} style={{
            display: 'grid', gridTemplateColumns: '110px 36px 1fr 130px 110px 70px',
            gap: 14, padding: '14px 18px', alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--border)' : 0, cursor: 'pointer',
            transition: 'background var(--dur-fast)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ font: '600 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{l.lastTouch}</span>
            <span style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--wine-tint)', color: 'var(--wine)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{window.Icon[sourceIcon](14)}</span>
            {lead.convertedMarkbox && (
            <div style={{
              padding: '14px 16px', background: 'var(--success-bg)',
              border: '1px solid var(--success)', borderRadius: 'var(--r-md)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ color: 'var(--success)' }}>{window.Icon.check(18)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>Cliente creado · {lead.convertedMarkbox}</div>
                <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>El Shipping Mark se asignó automáticamente. Ya puedes crear estimados y embarques para este cliente.</div>
              </div>
              <U.Btn variant="primary" size="sm" iconRight={window.Icon.arrowR(12)} onClick={() => { onClose(); window.__erpGoTo?.('clients', lead.convertedMarkbox, 'detail'); }}>Abrir cliente</U.Btn>
            </div>
          )}

          <div>
              <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{l.company}</div>
              <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{l.notes}</div>
            </div>
            <U.Badge tone={STAGE_COLOR[l.stage]} size="sm" dot>{l.stage}</U.Badge>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <U.Avatar initials={l.owner.split(' ').map(w=>w[0]).slice(0,2).join('')} color="wine" size={22} />
              <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{l.owner.split(' ')[0]}</span>
            </div>
            {l.value
              ? <span className="mono" style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--wine)', textAlign: 'right' }}>${(l.value/1000).toFixed(0)}K</span>
              : <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', textAlign: 'right' }}>—</span>
            }
          </div>
        );
      })}
    </U.Card>
  );
}

// ── Lead detail drawer ───────────────────────────────────────
function LeadDetail({ lead, onClose, onMove, onConvert }) {
  const U = window.ERPUI;
  if (!lead) return null;

  // Mock activity history
  const activity = [
    { type: 'note',  who: lead.owner,   text: lead.notes, when: lead.lastTouch },
    { type: 'call',  who: lead.owner,   text: 'Llamada inicial · 12 min', when: 'hace 1 sem' },
    { type: 'email', who: 'Sistema',    text: `Lead recibido vía ${lead.source}`, when: 'hace 2 sem' },
  ];

  return (
    <U.Drawer
      open={!!lead}
      onClose={onClose}
      title={lead.company}
      subtitle={`${lead.id} · ${lead.name} · ${lead.city}`}
      width={640}
      actions={
        <>
          <U.Btn variant="secondary" icon={window.Icon.mail(13)} onClick={() => window.openQuickEmail?.({ to: '', ctx: { label: lead.company } })}>Email</U.Btn>
          <U.Btn variant="secondary" icon={window.Icon.globe(13)}>WhatsApp</U.Btn>
          {lead.stage !== 'ganado' && lead.stage !== 'descartado' && (
            <U.Btn variant="primary" icon={window.Icon.check(13)} onClick={() => onConvert(lead)}>Convertir a cliente</U.Btn>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Stage flow */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>ETAPA ACTUAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 4 }}>
            {STAGES.map(s => {
              const active = s === lead.stage;
              const idx = STAGES.indexOf(lead.stage);
              const passed = STAGES.indexOf(s) < idx && idx <= STAGES.indexOf('ganado');
              return (
                <button key={s} onClick={() => onMove(lead.id, s)} style={{
                  padding: '8px 6px', borderRadius: 'var(--r-sm)', textAlign: 'center',
                  background: active ? `var(--${STAGE_COLOR[s] === 'neutral' ? 'bg-elevated' : STAGE_COLOR[s] + '-bg' })` : 'transparent',
                  color: active ? `var(--${STAGE_COLOR[s] === 'neutral' ? 'ink' : STAGE_COLOR[s]})` : passed ? 'var(--ink)' : 'var(--ink-mute)',
                  font: `${active ? '800' : '500'} 11px/1.2 var(--f-sans)`,
                  border: active ? `1.5px solid var(--${STAGE_COLOR[s] === 'neutral' ? 'border-strong' : STAGE_COLOR[s]})` : '1px solid var(--border)',
                  textTransform: 'capitalize',
                }}>{s}</button>
              );
            })}
          </div>
          <div style={{ marginTop: 8, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Click en una etapa para mover este lead.</div>
        </div>

        {/* Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <U.Field label="Empresa" value={lead.company} />
          <U.Field label="Contacto" value={lead.name} />
          <U.Field label="Industria" value={lead.industry} />
          <U.Field label="Ciudad" value={lead.city} />
          <U.Field label="Origen" value={lead.source} />
          <U.Field label="Owner" value={lead.owner} />
          <U.Field label="Valor estimado" value={lead.value ? `$${lead.value.toLocaleString()}` : 'sin cuantificar'} mono />
          <U.Field label="WhatsApp" value={lead.whatsapp ? 'Sí · disponible' : 'No'} />
        </div>

        {/* Notes */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>NOTAS</div>
          <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink)' }}>{lead.notes}</div>
        </div>

        {/* Activity history */}
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>HISTORIAL DE TOQUES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activity.map((a, i) => {
              const ic = { note: 'edit', call: 'globe', email: 'mail' }[a.type];
              return (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-elevated)', color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{window.Icon[ic](13)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{a.text}</div>
                    <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{a.who} · {a.when}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', textAlign: 'center', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
            + Agregar nota · llamada · email
          </div>
        </div>
      </div>
    </U.Drawer>
  );
}

window.ModuleLeads = ModuleLeads;
