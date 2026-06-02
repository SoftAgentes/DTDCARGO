/* @iife */ (function(){
/* global React */
/* ── Hilo de comentario individual · vista expandida ──────────── */
/* Abre al click en un comentario / @mención. Muestra UN hilo en      */
/* profundidad: raíz + respuestas anidadas + composer. Wiring: TODO.   */

// Hilos mock (self-contained · authors referencian D.USERS por id).
const THREADS = window.ERPData.THREADS;

function countReplies(node) {
  let n = node.replies ? node.replies.length : 0;
  (node.replies || []).forEach(r => { n += countReplies(r); });
  return n;
}
function collectParticipants(node, set) {
  set.add(node.author);
  (node.replies || []).forEach(r => collectParticipants(r, set));
  return set;
}
function highlight(body) {
  return body.replace(/@([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-Z]\.?)?)/g, '<span class="mention-chip">@$1</span>');
}

// ════════════════════════════════════════════════════════════════
function HiloComentario({ threadKey: pkey, embedded } = {}) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;

  const initialKey = React.useMemo(() => {
    if (pkey && THREADS[pkey]) return pkey;
    try { const t = new URLSearchParams(location.search).get('t'); return t && THREADS[t] ? t : 't-472816'; }
    catch (e) { return 't-472816'; }
  }, []);
  const [key, setKey] = React.useState(initialKey);
  const thread = THREADS[key];
  const me = D.USERS[0];

  const [reactions, setReactions] = React.useState({});
  const [reply, setReply] = React.useState('');

  const totalReplies = countReplies(thread.root);
  const participants = [...collectParticipants(thread.root, new Set())];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <TopBar thread={thread} threadKey={key} setKey={setKey} embedded={embedded} />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '20px 32px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 22, alignItems: 'start' }}>
          {/* Main thread */}
          <div style={{ animation: 'hc-rise .35s var(--ease) both' }}>
            <ContextCard record={thread.record} />

            {/* Root comment */}
            <RootComment node={thread.root} me={me} />

            {/* Replies */}
            <div style={{ marginTop: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 14, color: 'var(--ink-soft)' }}>{totalReplies} RESPUESTAS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {thread.root.replies.map(r => <ReplyNode key={r.id} node={r} me={me} depth={0} />)}
              </div>
            </div>

            {/* Composer */}
            <Composer me={me} value={reply} setValue={setReply} recordType={thread.record.type.toLowerCase()} />
          </div>

          {/* Right rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 84 }}>
            <ThreadMeta thread={thread} totalReplies={totalReplies} participants={participants} />
            <ParticipantsCard participants={participants} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────
function TopBar({ thread, threadKey, setKey, embedded }) {
  const I = window.Icon;
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <a href="../DTD Studio · ERP.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', textDecoration: 'none' }}>{I.arrowL(13)} ERP</a>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{thread.record.type}</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <code className="hc-code">{thread.record.id}</code>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>Hilo</span>
      <div style={{ flex: 1 }} />
      <select value={threadKey} onChange={(e) => { setKey(e.target.value); if (!embedded) history.replaceState(null, '', `?t=${e.target.value}`); }}
        style={{ padding: '6px 28px 6px 10px', background: 'var(--bg-elevated) url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"10\\" height=\\"6\\" viewBox=\\"0 0 10 6\\"><path d=\\"M1 1l4 4 4-4\\" stroke=\\"%236B6B6B\\" stroke-width=\\"1.6\\" fill=\\"none\\" stroke-linecap=\\"round\\"/></svg>") no-repeat right 10px center', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '700 12px/1 var(--f-sans)', color: 'var(--ink)', appearance: 'none', outline: 'none', cursor: 'pointer' }}>
        {Object.entries(THREADS).map(([k, t]) => <option key={k} value={k}>{t.record.id}</option>)}
      </select>
    </header>
  );
}

// ── Context card (what record) ───────────────────────────────
function ContextCard({ record }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const icon = { Embarque: 'box', Factura: 'invoice', Cliente: 'users' }[record.type] || 'box';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', marginBottom: 18 }}>
      <span style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I[icon] ? I[icon](20) : null}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{record.type}</span>
          <code className="hc-code">{record.id}</code>
        </div>
        <div style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{record.label}</div>
      </div>
      <a href={`../DTD Studio · ERP.html#${record.mod}`} style={{ textDecoration: 'none' }}><U.Btn variant="secondary" size="sm" iconRight={I.arrowR(12)}>Abrir</U.Btn></a>
    </div>
  );
}

// ── Root comment (prominent) ─────────────────────────────────
function RootComment({ node, me }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const author = D.USERS.find(u => u.id === node.author) || D.USERS[0];
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <U.Avatar initials={author.avatar} size={40} color="wine" />
        <div style={{ flex: 1 }}>
          <div style={{ font: '800 15px/1.1 var(--f-display)', color: 'var(--ink)' }}>{author.name}</div>
          <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{author.role} · {author.team} · {node.at}</div>
        </div>
        <U.Badge tone="wine" size="sm">Comentario raíz</U.Badge>
      </div>
      <div style={{ font: '500 14.5px/1.65 var(--f-sans)', color: 'var(--ink)' }} dangerouslySetInnerHTML={{ __html: highlight(node.body) }} />
      <Reactions reactions={node.reactions} me={me} />
    </div>
  );
}

// ── Reply node (recursive, threaded) ─────────────────────────
function ReplyNode({ node, me, depth }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const author = D.USERS.find(u => u.id === node.author) || D.USERS[0];
  const isMine = node.author === me.id;
  return (
    <div style={{ position: 'relative', paddingLeft: depth > 0 ? 20 : 0 }}>
      {depth > 0 && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 14, width: 2, background: 'var(--border)' }} />}
      <div style={{ display: 'flex', gap: 12 }}>
        <U.Avatar initials={author.avatar} size={32} color={isMine ? 'wine' : 'neutral'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
            <span style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)' }}>{author.name}</span>
            <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{author.role}</span>
            <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginLeft: 'auto' }}>{node.at}</span>
          </div>
          <div style={{ padding: '11px 14px', background: 'var(--bg-elevated)', borderRadius: '12px 12px 12px 4px', font: '500 13px/1.6 var(--f-sans)', color: 'var(--ink)' }} dangerouslySetInnerHTML={{ __html: highlight(node.body) }} />
          <Reactions reactions={node.reactions} me={me} small />
          {node.replies && node.replies.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {node.replies.map(r => <ReplyNode key={r.id} node={r} me={me} depth={depth + 1} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reactions row ────────────────────────────────────────────
function Reactions({ reactions, me, small }) {
  const D = window.ERPData;
  const [r, setR] = React.useState(reactions || {});
  const [open, setOpen] = React.useState(false);
  const toggle = (emoji) => setR(prev => {
    const next = { ...prev }; const arr = next[emoji] || [];
    next[emoji] = arr.includes(me.id) ? arr.filter(x => x !== me.id) : [...arr, me.id];
    if (next[emoji].length === 0) delete next[emoji];
    return next;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: small ? 6 : 12 }}>
      {Object.entries(r).map(([emoji, users]) => (
        <button key={emoji} onClick={() => toggle(emoji)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 'var(--r-pill)',
          background: users.includes(me.id) ? 'var(--wine-tint)' : 'var(--bg-elevated)',
          color: users.includes(me.id) ? 'var(--wine)' : 'var(--ink-soft)',
          border: `1px solid ${users.includes(me.id) ? 'var(--wine)' : 'transparent'}`, font: '600 11px/1.2 var(--f-sans)', cursor: 'pointer',
        }} title={users.map(uid => (D.USERS.find(u => u.id === uid) || {}).name).join(', ')}>
          <span>{emoji}</span><span>{users.length}</span>
        </button>
      ))}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)} style={{ padding: '3px 8px', borderRadius: 'var(--r-pill)', color: 'var(--ink-mute)', font: '600 11px/1.2 var(--f-sans)', border: '1px dashed var(--border-strong)', background: 'transparent', cursor: 'pointer' }} title="Reaccionar">+</button>
        {open && (
          <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, display: 'flex', gap: 2, padding: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', boxShadow: 'var(--shadow-md)', zIndex: 10, animation: 'erp-pop 120ms var(--ease)' }}>
            {['👍', '✓', '👀', '🔥', '❓'].map(e => (
              <button key={e} onClick={() => { toggle(e); setOpen(false); }} style={{ width: 26, height: 26, fontSize: 14, borderRadius: 'var(--r-sm)', cursor: 'pointer', background: 'transparent', border: 0 }}>{e}</button>
            ))}
          </div>
        )}
      </div>
      <button style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-mute)', padding: '4px 6px', background: 'transparent', border: 0, cursor: 'pointer' }}>Responder</button>
    </div>
  );
}

// ── Composer ─────────────────────────────────────────────────
function Composer({ me, value, setValue, recordType }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <div style={{ marginTop: 22, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <U.Avatar initials={me.avatar} size={32} color="wine" />
        <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Respondé en este hilo… usá @ para mencionar`} rows={2}
          style={{ flex: 1, border: 0, outline: 'none', resize: 'vertical', background: 'transparent', color: 'var(--ink)', font: '500 13px/1.6 var(--f-sans)', minHeight: 46 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 6 }}>
        <button style={{ width: 26, height: 26, color: 'var(--ink-soft)', background: 'transparent', border: 0, cursor: 'pointer' }} title="Mencionar">@</button>
        <button style={{ width: 26, height: 26, color: 'var(--ink-soft)', background: 'transparent', border: 0, cursor: 'pointer' }} title="Adjuntar">{I.upload ? I.upload(13) : null}</button>
        <span style={{ marginLeft: 'auto', font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>⌘ + Enter para enviar</span>
        <U.Btn variant="primary" size="sm" disabled={!value.trim()} iconRight={I.arrowR(11)}>Responder</U.Btn>
      </div>
    </div>
  );
}

// ── Thread meta ──────────────────────────────────────────────
function ThreadMeta({ thread, totalReplies, participants }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>INFO DEL HILO</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <U.Field label="Estado" value={<U.Badge tone="success" size="sm" dot>{thread.status}</U.Badge>} />
        <U.Field label="Creado" value={thread.created} />
        <U.Field label="Respuestas" value={String(totalReplies)} mono />
        <U.Field label="Participantes" value={String(participants.length)} mono />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        <U.Btn variant="ghost" full>Seguir hilo</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--ink-soft)' }}>Marcar como resuelto</U.Btn>
      </div>
    </U.Card>
  );
}

// ── Participants ─────────────────────────────────────────────
function ParticipantsCard({ participants }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>PARTICIPANTES</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {participants.map(uid => {
          const u = D.USERS.find(x => x.id === uid);
          if (!u) return null;
          return (
            <a key={uid} href={`usuario-perfil.html?id=${uid}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <U.Avatar initials={u.avatar} size={28} color="neutral" />
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{u.name}</div>
                <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{u.role}</div>
              </div>
            </a>
          );
        })}
      </div>
    </U.Card>
  );
}

window.HiloComentario = HiloComentario;

})();
