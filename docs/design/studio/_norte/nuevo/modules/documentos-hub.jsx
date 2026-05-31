/* global React */
/* ── DTD ERP · Documentos · Hub central · v1.9.1 ────────────── */
/* Árbol de carpetas + explorador + adjunto a transacción.       */
/* Override de window.ModuleDocuments (reemplaza la tabla plana).*/

function ModuleDocumentosHub({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const X = window.DocumentosData;
  const [folder, setFolder] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(null);

  const rows = X.docsIn(folder).filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q) || (d.link.id || '').toLowerCase().includes(q) || d.type.toLowerCase().includes(q);
  });

  return (
    <div>
      <U.PageHeader
        eyebrow="HUB CENTRAL · ADJUNTOS"
        title="Documentos"
        subtitle="Todos los adjuntos del negocio en un lugar, clasificados por carpeta y vinculados a su transacción. Operacionales, logísticos, contables y aduaneros."
        actions={
          <>
            <U.Btn variant="secondary" icon={I.upload(14)}>Subir documento</U.Btn>
            <U.Btn variant="primary" icon={I.plus(14)} onClick={() => window.DTDWiring?.openGenerateBLModal?.()}>Generar BL</U.Btn>
          </>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Documentos" value={X.DOCUMENTS.length} delta={`${X.FOLDERS.length} carpetas`} tone="wine" icon={I.doc(18)} />
        <U.KPI label="Pendientes de firma" value={X.pending().length} delta="requieren acción" tone={X.pending().length ? 'warning' : 'success'} icon={I.edit(18)} />
        <U.KPI label="Por vencer / vencidos" value={X.expiring().length} delta="permisos & certificados" tone={X.expiring().length ? 'danger' : 'success'} icon={I.shield(18)} />
        <U.KPI label="Sin transacción" value={X.unlinked().length} delta="clasificar / vincular" tone={X.unlinked().length ? 'info' : 'success'} icon={I.link(18)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '264px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Árbol de carpetas */}
        <FolderTree folder={folder} onSelect={setFolder} />

        {/* Explorador */}
        <div>
          <U.Toolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por nombre, ID, tipo o transacción…"
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ font: '800 14px/1 var(--f-display)', color: 'var(--ink)' }}>
              {folder === 'all' ? 'Todos los documentos' : X.folderLabel(folder)}
              <span style={{ font: '600 12px/1 var(--f-mono)', color: 'var(--ink-mute)', marginLeft: 8 }}>{rows.length}</span>
            </div>
          </div>

          <U.Card padded={false}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 150px 130px 90px 110px', gap: 14,
              padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
              font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              <span>Documento</span>
              <span>Transacción</span>
              <span>Fecha · autor</span>
              <span style={{ textAlign: 'right' }}>Tamaño</span>
              <span style={{ textAlign: 'right' }}>Estado</span>
            </div>
            {rows.map((d, i) => {
              const ext = X.EXT_META[d.ext] || { tone: 'neutral', label: d.ext.toUpperCase() };
              const lk = X.LINK_KIND[d.link.kind];
              const st = X.DOC_STATUS[d.status];
              const isSel = selected === d.id;
              return (
                <div key={d.id} onClick={() => setSelected(d.id)} style={{
                  display: 'grid', gridTemplateColumns: '1fr 150px 130px 90px 110px', gap: 14, alignItems: 'center',
                  padding: '11px 18px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border)' : 0,
                  background: isSel ? 'var(--wine-tint)' : 'transparent', transition: 'background var(--dur-fast) var(--ease)',
                }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <FileGlyph ext={d.ext} tone={ext.tone} label={ext.label} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{d.type} · {X.folderLabel(d.folder)}</div>
                    </div>
                  </div>
                  <div onClick={(e) => { if (lk.module) { e.stopPropagation(); goTo(lk.module, d.link.id); } }} style={{ minWidth: 0 }}>
                    {d.link.kind === 'ninguno'
                      ? <U.Badge tone="neutral" size="sm">sin vínculo</U.Badge>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} title={`Ir a ${lk.label}`}>
                          <span style={{ color: 'var(--wine)', display: 'inline-flex' }}>{I[lk.icon]?.(13)}</span>
                          <code style={{ font: '600 11px/1.2 var(--f-mono)', color: 'var(--wine)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.link.id}</code>
                        </span>}
                  </div>
                  <div>
                    <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{d.date}</div>
                    <div style={{ font: '500 10px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{d.by}</div>
                  </div>
                  <div style={{ textAlign: 'right', font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{d.size}</div>
                  <div style={{ textAlign: 'right' }}><U.Badge tone={st.tone} size="sm" dot>{st.label}</U.Badge></div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin documentos en esta carpeta.</div>
            )}
          </U.Card>
        </div>
      </div>

      <DocDrawer doc={selected ? X.DOCUMENTS.find(d => d.id === selected) : null} onClose={() => setSelected(null)} goTo={goTo} />
    </div>
  );
}

// ── Árbol de carpetas ─────────────────────────────────────────
function FolderTree({ folder, onSelect }) {
  const I = window.Icon;
  const X = window.DocumentosData;
  const [open, setOpen] = React.useState(() => { const o = {}; X.FOLDERS.forEach(f => o[f.id] = true); return o; });
  const activeTop = X.topOf(folder)?.id;

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <button onClick={() => onSelect('all')} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: folder === 'all' ? 'var(--wine-tint)' : 'transparent', borderBottom: '1px solid var(--border)',
          font: `${folder === 'all' ? '700' : '600'} 13px/1 var(--f-sans)`, color: folder === 'all' ? 'var(--wine)' : 'var(--ink)', textAlign: 'left',
        }}>
          <span style={{ color: folder === 'all' ? 'var(--wine)' : 'var(--ink-soft)', display: 'inline-flex' }}>{I.doc(16)}</span>
          <span style={{ flex: 1 }}>Todos los documentos</span>
          <span style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{X.DOCUMENTS.length}</span>
        </button>

        <div style={{ padding: '6px' }}>
          {X.FOLDERS.map(f => {
            const isOpen = open[f.id];
            const topActive = activeTop === f.id;
            return (
              <div key={f.id} style={{ marginBottom: 2 }}>
                <button onClick={() => { onSelect(f.id); setOpen(o => ({ ...o, [f.id]: true })); }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 'var(--r-md)',
                  background: folder === f.id ? 'var(--bg-elevated)' : 'transparent', textAlign: 'left',
                  font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)',
                }}>
                  <span onClick={(e) => { e.stopPropagation(); setOpen(o => ({ ...o, [f.id]: !o[f.id] })); }} style={{ display: 'inline-flex', color: 'var(--ink-mute)', transform: `rotate(${isOpen ? 0 : -90}deg)`, transition: 'transform var(--dur-fast) var(--ease)' }}>{I.chevD(11)}</span>
                  <span style={{ width: 24, height: 24, borderRadius: 'var(--r-sm)', background: `var(--${f.tone}-bg)`, color: `var(--${f.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I[f.icon]?.(13)}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                  <span style={{ font: '700 10.5px/1 var(--f-mono)', color: topActive ? 'var(--wine)' : 'var(--ink-mute)' }}>{X.folderCount(f.id)}</span>
                </button>
                {isOpen && f.children.map(c => {
                  const active = folder === c.id;
                  return (
                    <button key={c.id} onClick={() => onSelect(c.id)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 30px', borderRadius: 'var(--r-md)',
                      background: active ? 'var(--wine-tint)' : 'transparent', textAlign: 'left',
                      font: `${active ? '700' : '500'} 12px/1.2 var(--f-sans)`, color: active ? 'var(--wine)' : 'var(--ink-soft)',
                    }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                      <span style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{X.folderCount(c.id)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
  );
}

// ── Glifo de archivo ──────────────────────────────────────────
function FileGlyph({ ext, tone, label, size = 38 }) {
  return (
    <span style={{
      width: size, height: size, flexShrink: 0, borderRadius: 'var(--r-sm)',
      background: `var(--${tone}-bg)`, color: `var(--${tone})`,
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
      border: `1px solid var(--${tone})`,
    }}>
      {window.Icon.doc(size > 50 ? 22 : 15)}
      <span style={{ font: `800 ${size > 50 ? 9 : 7.5}px/1 var(--f-sans)`, letterSpacing: '0.04em' }}>{label}</span>
    </span>
  );
}

// ── Drawer de detalle ─────────────────────────────────────────
function DocDrawer({ doc, onClose, goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const X = window.DocumentosData;
  if (!doc) return null;
  const ext = X.EXT_META[doc.ext] || { tone: 'neutral', label: doc.ext.toUpperCase() };
  const lk = X.LINK_KIND[doc.link.kind];
  const st = X.DOC_STATUS[doc.status];

  return (
    <U.Drawer
      open={!!doc}
      onClose={onClose}
      title={doc.name}
      subtitle={`${doc.type} · ${X.folderLabel(doc.folder)}`}
      width={620}
      actions={
        <>
          <U.Btn variant="ghost" style={{ color: 'var(--danger)' }} icon={I.trash(13)}>Eliminar</U.Btn>
          <U.Btn variant="secondary" icon={I.download(13)}>Descargar</U.Btn>
          <U.Btn variant="primary" icon={I.eye(13)}>Ver completo</U.Btn>
        </>
      }
    >
      {/* Preview placeholder */}
      <div style={{
        height: 220, borderRadius: 'var(--r-lg)', border: '1px dashed var(--border-strong)', background: 'var(--bg-elevated)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 18,
      }}>
        <FileGlyph ext={doc.ext} tone={ext.tone} label={ext.label} size={64} />
        <div style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Vista previa · {ext.label} · {doc.size}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <U.Field label="ID documento" value={doc.id} mono />
        <U.Field label="Tipo" value={doc.type} />
        <U.Field label="Carpeta" value={X.folderLabel(doc.folder)} />
        <U.Field label="Estado" value={<U.Badge tone={st.tone} dot>{st.label}</U.Badge>} />
        <U.Field label="Subido" value={doc.date} mono />
        <U.Field label="Autor" value={doc.by} />
      </div>

      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>TRANSACCIÓN VINCULADA</div>
      {doc.link.kind === 'ninguno' ? (
        <div style={{ padding: '14px 16px', background: 'var(--info-bg)', borderLeft: '3px solid var(--info)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>Este documento no está adjunto a ninguna transacción todavía.</span>
          <U.Btn variant="soft" size="sm" icon={I.link(12)}>Vincular</U.Btn>
        </div>
      ) : (
        <button onClick={() => { if (lk.module) goTo(lk.module, doc.link.id); }} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', textAlign: 'left',
        }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-tint)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
        >
          <span style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I[lk.icon]?.(18)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{lk.label}</div>
            <code style={{ font: '700 13px/1.3 var(--f-mono)', color: 'var(--ink)' }}>{doc.link.id}</code>
          </div>
          <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{I.arrowR(14)}</span>
        </button>
      )}
    </U.Drawer>
  );
}

window.ModuleDocumentosHub = ModuleDocumentosHub;
window.ModuleDocuments = ModuleDocumentosHub; // override de la tabla plana

// ── Embebible: adjuntos de UNA transacción (para detalles) ────
function DocsForTransaction({ kind, id, goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const X = window.DocumentosData;
  const nav = goTo || window.__erpGoTo;
  const docs = (X?.DOCUMENTS || []).filter(d => d.link.kind === kind && d.link.id === id);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="eyebrow eyebrow-wine">DOCUMENTOS{docs.length ? ` · ${docs.length}` : ''}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <U.Btn variant="ghost" size="sm" icon={I.upload(12)}>Adjuntar</U.Btn>
          {nav && <U.Btn variant="ghost" size="sm" iconRight={I.arrowR(11)} onClick={() => nav('documents')}>Ver en hub</U.Btn>}
        </div>
      </div>
      {docs.length === 0 ? (
        <div style={{ padding: '18px', textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
          Sin documentos adjuntos a esta transacción. Usá <b style={{ color: 'var(--ink)' }}>Adjuntar</b> para subir el BL, packing, factura, etc. — se clasifican solos en el hub.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map(d => {
            const ext = X.EXT_META[d.ext] || { tone: 'neutral', label: d.ext.toUpperCase() };
            const st = X.DOC_STATUS[d.status];
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <FileGlyph ext={d.ext} tone={ext.tone} label={ext.label} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{d.type} · {d.date} · {d.size}</div>
                </div>
                <U.Badge tone={st.tone} size="sm" dot>{st.label}</U.Badge>
                <button style={{ color: 'var(--ink-soft)', padding: 6, display: 'inline-flex' }} title="Descargar">{I.download(14)}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
window.DocsForTransaction = DocsForTransaction;
