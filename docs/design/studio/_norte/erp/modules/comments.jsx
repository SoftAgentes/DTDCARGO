/* global React */
/* ── DTD ERP · Comentarios + @menciones ─────────────────────── */
/* Hilo embebible en cualquier detalle (embarque, cliente, etc.) */

// Initial mock comments per record
const _initialComments = {
  'DTDU-472816': [
    { id: 'c1', author: 'u-002', body: 'Yusneidy, este es el container que está pasando por Panamá. Avisame cuando libere aduana así arranco el booking del flete interno.', mentions: ['u-005'], at: 'hace 2 días', reactions: { '👍': ['u-005'] } },
    { id: 'c2', author: 'u-005', body: '@Martina A. ok recibido. Lo estoy monitoreando. ETA Pto Cabello sigue 12 jun.', mentions: ['u-002'], at: 'hace 2 días', reactions: {} },
    { id: 'c3', author: 'u-001', body: 'Cliente confirmó disponibilidad para recepción en Valencia. @Diego N. asegurate que el reparto esté coordinado.', mentions: ['u-003'], at: 'hace 6 h', reactions: { '✓': ['u-003'] } },
  ],
  'DTDU-419032': [
    { id: 'c10', author: 'u-005', body: 'Tenemos demora estimada de 2 días por congestión Canal de Panamá. Aviso al cliente?', mentions: [], at: 'hace 3 h', reactions: {} },
    { id: 'c11', author: 'u-002', body: 'Sí, mandá el template "ETA en riesgo". @Luis F. ya está al tanto?', mentions: ['u-003'], at: 'hace 2 h', reactions: {} },
  ],
  'DTD-5452': [
    { id: 'c20', author: 'u-002', body: 'Carlos Méndez pidió cotización para FCL40 desde Yiwu para julio. Volumen aprox 60 CBM.', mentions: [], at: 'hace 1 día', reactions: { '👀': ['u-001'] } },
  ],
  'F-2026-0418': [
    { id: 'c30', author: 'u-006', body: 'Factura vencida hace 10 días. @Martina A. podés llamar al cliente?', mentions: ['u-002'], at: 'hace 4 h', reactions: {} },
  ],
};

window.__comments = window.__comments || _initialComments;

function CommentsThread({ recordId, recordType = 'embarque' }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [text, setText] = React.useState('');
  const [comments, setComments] = React.useState(window.__comments[recordId] || []);
  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [mentionQ, setMentionQ] = React.useState('');
  const textareaRef = React.useRef(null);

  // Update if recordId changes
  React.useEffect(() => {
    setComments(window.__comments[recordId] || []);
  }, [recordId]);

  const me = D.USERS[0]; // Carlos V. (Admin)

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    // Detect @ trigger
    const cursorPos = e.target.selectionStart;
    const upToCursor = val.slice(0, cursorPos);
    const m = upToCursor.match(/@(\w*)$/);
    if (m) {
      setMentionQ(m[1].toLowerCase());
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (user) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart;
    const upToCursor = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    const replaced = upToCursor.replace(/@\w*$/, `@${user.name.split(' ')[0]} ${user.name.split(' ')[1]?.[0] || ''}. `);
    setText(replaced + after);
    setMentionOpen(false);
    requestAnimationFrame(() => el.focus());
  };

  const send = () => {
    if (!text.trim()) return;
    // Extract mentions
    const mentions = [];
    D.USERS.forEach(u => {
      const firstName = u.name.split(' ')[0];
      if (new RegExp(`@${firstName}\\b`, 'i').test(text)) mentions.push(u.id);
    });
    const newComment = {
      id: 'c-' + Date.now(),
      author: me.id,
      body: text,
      mentions,
      at: 'ahora',
      reactions: {},
    };
    const next = [...comments, newComment];
    setComments(next);
    window.__comments[recordId] = next;
    setText('');
  };

  const react = (commentId, emoji) => {
    setComments(prev => {
      const next = prev.map(c => {
        if (c.id !== commentId) return c;
        const r = { ...c.reactions };
        const arr = r[emoji] || [];
        if (arr.includes(me.id)) r[emoji] = arr.filter(x => x !== me.id);
        else r[emoji] = [...arr, me.id];
        if (r[emoji].length === 0) delete r[emoji];
        return { ...c, reactions: r };
      });
      window.__comments[recordId] = next;
      return next;
    });
  };

  const filteredUsers = D.USERS.filter(u => u.name.toLowerCase().includes(mentionQ)).slice(0, 5);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="eyebrow eyebrow-wine">COMENTARIOS ({comments.length})</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {comments.length > 0 && (
            <button onClick={() => { const map = { 'DTDU-472816': 't-472816', 'F-2026-0418': 't-0418' }; window.__erpOverlay && window.__erpOverlay('hilo', { threadKey: map[recordId] || 't-472816' }); }} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Expandir hilo {window.Icon.arrowR ? window.Icon.arrowR(11) : '↗'}</button>
          )}
          {comments.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {[...new Set(comments.map(c => c.author))].slice(0, 4).map(uid => {
                const u = D.USERS.find(x => x.id === uid);
                return u ? <U.Avatar key={uid} initials={u.avatar} size={22} color="neutral" /> : null;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Thread */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {comments.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
            Sin comentarios aún. Comentá abajo y @mencioná a alguien del equipo.
          </div>
        ) : comments.map(c => <CommentItem key={c.id} c={c} onReact={(e) => react(c.id, e)} me={me} />)}
      </div>

      {/* Composer */}
      <div style={{
        position: 'relative',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <U.Avatar initials={me.avatar} size={28} color="wine" />
          <div style={{ flex: 1 }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
                if (e.key === 'Escape') setMentionOpen(false);
              }}
              placeholder={`Comentá en este ${recordType}… usá @ para mencionar`}
              rows={2}
              style={{
                width: '100%', border: 0, outline: 'none', resize: 'none',
                background: 'transparent', color: 'var(--ink)',
                font: '500 13px/1.5 var(--f-sans)',
                minHeight: 44,
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
          <button style={{ width: 24, height: 24, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Mencionar (@)" onClick={() => { setText(text + '@'); textareaRef.current?.focus(); setMentionOpen(true); setMentionQ(''); }}>@</button>
          <button style={{ width: 24, height: 24, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Adjuntar">{window.Icon.upload(13)}</button>
          <span style={{ marginLeft: 'auto', font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>⌘ + Enter para enviar</span>
          <U.Btn variant="primary" size="sm" onClick={send} disabled={!text.trim()} icon={window.Icon.arrowR(11)}>Comentar</U.Btn>
        </div>

        {/* Mention dropdown */}
        {mentionOpen && filteredUsers.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 4px)', left: 8,
            width: 280, background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 20,
            animation: 'erp-pop 150ms var(--ease)',
          }}>
            <div style={{ padding: '6px 10px', font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>MENCIONAR A</div>
            {filteredUsers.map(u => (
              <button key={u.id} onClick={() => insertMention(u)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '6px 10px', borderRadius: 'var(--r-sm)', textAlign: 'left',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <U.Avatar initials={u.avatar} size={24} color="wine" />
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{u.name}</div>
                  <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{u.role}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentItem({ c, onReact, me }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [showReactions, setShowReactions] = React.useState(false);
  const author = D.USERS.find(u => u.id === c.author) || D.USERS[0];
  const isMine = c.author === me.id;

  // Highlight @mentions in body
  const renderedBody = c.body.replace(/@([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-Z]\.?)?)/g,
    '<span class="mention-chip">@$1</span>');

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <U.Avatar initials={author.avatar} size={32} color={isMine ? 'wine' : 'neutral'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)' }}>{author.name}</span>
          <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{author.role}</span>
          <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginLeft: 'auto' }}>{c.at}</span>
        </div>
        <div style={{
          padding: '10px 12px', background: 'var(--bg-elevated)',
          borderRadius: '12px 12px 12px 4px',
          font: '500 13px/1.6 var(--f-sans)', color: 'var(--ink)',
        }}
        onMouseEnter={() => setShowReactions(true)}
        onMouseLeave={() => setShowReactions(false)}
        >
          <div dangerouslySetInnerHTML={{ __html: renderedBody }} />
        </div>

        {/* Reactions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          {Object.entries(c.reactions || {}).map(([emoji, users]) => (
            <button key={emoji} onClick={() => onReact(emoji)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 'var(--r-pill)',
              background: users.includes(me.id) ? 'var(--wine-tint)' : 'var(--bg-elevated)',
              color: users.includes(me.id) ? 'var(--wine)' : 'var(--ink-soft)',
              border: `1px solid ${users.includes(me.id) ? 'var(--wine)' : 'transparent'}`,
              font: '600 11px/1.2 var(--f-sans)',
            }}>
              <span>{emoji}</span>
              <span>{users.length}</span>
            </button>
          ))}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowReactions(v => !v)} style={{
              padding: '3px 8px', borderRadius: 'var(--r-pill)',
              color: 'var(--ink-mute)', font: '600 11px/1.2 var(--f-sans)',
              border: '1px dashed var(--border-strong)', background: 'transparent',
            }} title="Reaccionar">+</button>
            {showReactions && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 4px)', left: 0,
                display: 'flex', gap: 2, padding: 4,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-pill)', boxShadow: 'var(--shadow-md)',
                zIndex: 10, animation: 'erp-pop 120ms var(--ease)',
              }}>
                {['👍', '✓', '👀', '🔥', '❓'].map(e => (
                  <button key={e} onClick={() => { onReact(e); setShowReactions(false); }} style={{
                    width: 26, height: 26, fontSize: 14, borderRadius: 'var(--r-sm)',
                  }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
                  >{e}</button>
                ))}
              </div>
            )}
          </div>
          <button style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-mute)', padding: '4px 6px' }}>Responder</button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .mention-chip {
          display: inline-block;
          padding: 1px 6px;
          background: var(--wine-tint);
          color: var(--wine);
          border-radius: 3px;
          font-weight: 700;
        }
      `}} />
    </div>
  );
}

window.CommentsThread = CommentsThread;
